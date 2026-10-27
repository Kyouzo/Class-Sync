import { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import type { Db } from "@/lib/db";
import { conflict, forbidden, notFound, unauthenticated } from "../errors";
import { evaluateCompletion, type CompletionEvaluation, type QuizStanding } from "../grading";
import { canEnroll, canManageCourse, canViewLearnerRecords, type Actor } from "../policies";
import { requireCourseContent, type Client } from "./access";

// ---------------------------------------------------------------------------
// Enrollment
// ---------------------------------------------------------------------------

/** Enrolls a student in a published course. Idempotent: enrolling twice returns the existing record. */
export async function enroll(db: Db, actor: Actor | null, courseId: string) {
  if (!actor) throw unauthenticated();
  const course = await db.course.findUnique({ where: { id: courseId }, select: { id: true, slug: true, status: true, instructorId: true } });
  if (!course || (course.status === "DRAFT" && !canManageCourse(actor, course))) throw notFound("Course not found.");
  if (actor.role !== "STUDENT") throw forbidden("Only student accounts can enroll in courses.");
  if (!canEnroll(actor, course)) throw forbidden("This course is not open for enrollment.");
  const where = { userId_courseId: { userId: actor.id, courseId: course.id } };
  try {
    return await db.enrollment.upsert({ where, create: { userId: actor.id, courseId: course.id }, update: {} });
  } catch (error) {
    // Concurrent double-click: the unique constraint guarantees one enrollment.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return db.enrollment.findUniqueOrThrow({ where });
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Progress & completion
// ---------------------------------------------------------------------------

export type LearnerStanding = {
  totalLessons: number;
  completedLessonIds: Set<string>;
  quizzes: (QuizStanding & { title: string; passingScore: number; attempts: number; maxAttempts: number | null })[];
  evaluation: CompletionEvaluation;
};

/** Computes a learner's progress, quiz standings, grade and completion eligibility for a course. */
export async function getLearnerStanding(db: Client, userId: string, courseId: string): Promise<LearnerStanding> {
  const [course, lessons, completed, quizzes] = await Promise.all([
    db.course.findUniqueOrThrow({
      where: { id: courseId },
      select: { requireAllLessons: true, requirePassingQuizzes: true, minimumGrade: true },
    }),
    db.lesson.findMany({ where: { module: { courseId } }, select: { id: true } }),
    db.lessonProgress.findMany({ where: { userId, lesson: { module: { courseId } } }, select: { lessonId: true } }),
    db.quiz.findMany({
      where: { courseId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        isRequired: true,
        passingScore: true,
        maxAttempts: true,
        attempts: { where: { userId }, select: { percentage: true, passed: true } },
      },
    }),
  ]);

  const standings = quizzes.map((q) => {
    const best = q.attempts.reduce<number | null>((max, a) => Math.max(max ?? 0, Number(a.percentage)), null);
    return {
      quizId: q.id,
      title: q.title,
      isRequired: q.isRequired,
      passingScore: q.passingScore,
      maxAttempts: q.maxAttempts,
      attempts: q.attempts.length,
      bestPercentage: best,
      passed: q.attempts.some((a) => a.passed),
    };
  });
  const completedLessonIds = new Set(completed.map((c) => c.lessonId));
  const evaluation = evaluateCompletion(course, {
    totalLessons: lessons.length,
    completedLessons: lessons.filter((l) => completedLessonIds.has(l.id)).length,
    quizzes: standings,
  });
  return { totalLessons: lessons.length, completedLessonIds, quizzes: standings, evaluation };
}

function certificateCode(): string {
  const raw = randomBytes(9).toString("base64url").toUpperCase().replace(/[^A-Z0-9]/g, "X");
  return `CS-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

/**
 * Re-evaluates completion for a learner. When every configured requirement is satisfied the enrollment
 * is marked completed and a certificate is issued (exactly once, enforced by unique constraints).
 * Must run inside a transaction together with the change that triggered it.
 */
export async function syncCompletion(tx: Prisma.TransactionClient, userId: string, courseId: string) {
  const enrollment = await tx.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    include: { certificate: true, user: { select: { name: true } }, course: { include: { instructor: { select: { name: true } } } } },
  });
  if (!enrollment) return null;
  const standing = await getLearnerStanding(tx, userId, courseId);
  if (!standing.evaluation.eligible) return { standing, certificate: enrollment.certificate };

  let certificate = enrollment.certificate;
  if (!certificate) {
    certificate = await tx.certificate.create({
      data: {
        code: certificateCode(),
        userId,
        courseId,
        enrollmentId: enrollment.id,
        recipientName: enrollment.user.name,
        courseTitle: enrollment.course.title,
        instructorName: enrollment.course.instructor.name,
        finalGrade: standing.evaluation.grade,
      },
    });
  }
  if (enrollment.status !== "COMPLETED") {
    await tx.enrollment.update({ where: { id: enrollment.id }, data: { status: "COMPLETED", completedAt: new Date() } });
  }
  return { standing, certificate };
}

async function inTransaction<T>(db: Db, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  try {
    return await db.$transaction(fn);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw conflict("This was updated by another request at the same time. Please try again.");
    }
    throw error;
  }
}

/** Marks a lesson complete (or not) for an enrolled learner and re-evaluates course completion. */
export async function setLessonCompletion(db: Db, actor: Actor | null, lessonId: string, completed: boolean) {
  if (!actor) throw unauthenticated();
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { id: true, module: { select: { courseId: true } } } });
  if (!lesson) throw notFound("Lesson not found.");
  const { course, enrollment } = await requireCourseContent(db, actor, { id: lesson.module.courseId });
  if (!enrollment) throw forbidden("Only enrolled learners can track progress.");

  return inTransaction(db, async (tx) => {
    if (completed) {
      await tx.lessonProgress.upsert({
        where: { userId_lessonId: { userId: actor.id, lessonId: lesson.id } },
        create: { userId: actor.id, lessonId: lesson.id },
        update: {},
      });
    } else {
      await tx.lessonProgress.deleteMany({ where: { userId: actor.id, lessonId: lesson.id } });
    }
    return syncCompletion(tx, actor.id, course.id);
  });
}

/**
 * Explicit "claim certificate" request. Issues the certificate only if the learner currently satisfies
 * the course's completion requirements.
 */
export async function claimCertificate(db: Db, actor: Actor | null, courseId: string) {
  if (!actor) throw unauthenticated();
  const { enrollment } = await requireCourseContent(db, actor, { id: courseId });
  if (!enrollment) throw forbidden("Only enrolled learners can earn certificates.");
  const result = await inTransaction(db, (tx) => syncCompletion(tx, actor.id, courseId));
  if (!result?.certificate) {
    throw forbidden(`You have not met the completion requirements yet. ${result?.standing.evaluation.unmet.join(" ") ?? ""}`.trim());
  }
  return result.certificate;
}

/** Progress and grades for one learner in one course, guarded against viewing other students' records. */
export async function getLearnerReport(db: Db, actor: Actor | null, courseId: string, learnerId: string) {
  if (!actor) throw unauthenticated();
  const course = await db.course.findUnique({ where: { id: courseId }, select: { id: true, title: true, slug: true, instructorId: true } });
  if (!course) throw notFound("Course not found.");
  if (!canViewLearnerRecords(actor, learnerId, course)) throw forbidden("You cannot view another student's records.");
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: learnerId, courseId } },
    include: { user: { select: { id: true, name: true, email: true } }, certificate: true },
  });
  if (!enrollment) throw notFound("This learner is not enrolled in the course.");
  const [standing, attempts] = await Promise.all([
    getLearnerStanding(db, learnerId, courseId),
    db.quizAttempt.findMany({
      where: { userId: learnerId, quiz: { courseId } },
      orderBy: { submittedAt: "desc" },
      include: { quiz: { select: { title: true } } },
    }),
  ]);
  return { course, enrollment, standing, attempts };
}

/** Student dashboard: every enrollment with progress and grade. */
export async function getStudentDashboard(db: Db, actor: Actor) {
  const enrollments = await db.enrollment.findMany({
    where: { userId: actor.id, course: { status: { not: "DRAFT" } } },
    orderBy: { enrolledAt: "desc" },
    include: {
      certificate: { select: { id: true, code: true } },
      course: { select: { id: true, slug: true, title: true, summary: true, status: true, category: { select: { name: true } } } },
    },
  });
  const standings = await Promise.all(enrollments.map((e) => getLearnerStanding(db, actor.id, e.courseId)));
  return enrollments.map((enrollment, i) => ({ enrollment, standing: standings[i] }));
}
