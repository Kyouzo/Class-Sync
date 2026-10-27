import { Prisma } from "@prisma/client";
import type { Db } from "@/lib/db";
import { questionSchema, quizSchema, quizSubmissionSchema } from "@/lib/validation";
import { conflict, forbidden, invalid, notFound, unauthenticated } from "../errors";
import { gradeSubmission, SubmissionError } from "../grading";
import { canManageCourse, canViewLearnerRecords, type Actor } from "../policies";
import { requireCourseContent, requireManagedCourse, type Client } from "./access";
import { parse } from "./courses";
import { syncCompletion } from "./progress";

// ---------------------------------------------------------------------------
// Instructor: quiz authoring
// ---------------------------------------------------------------------------

async function assertModuleInCourse(db: Client, moduleId: string | null, courseId: string) {
  if (!moduleId) return;
  const mod = await db.module.findFirst({ where: { id: moduleId, courseId }, select: { id: true } });
  if (!mod) throw invalid("Module does not belong to this course.", { moduleId: ["Unknown module."] });
}

export async function createQuiz(db: Db, actor: Actor | null, courseId: string, input: unknown) {
  const course = await requireManagedCourse(db, actor, courseId);
  const data = parse(quizSchema, input);
  await assertModuleInCourse(db, data.moduleId, course.id);
  return db.quiz.create({ data: { ...data, courseId: course.id } });
}

async function requireManagedQuiz(db: Client, actor: Actor | null, quizId: string) {
  if (!actor) throw unauthenticated();
  const quiz = await db.quiz.findUnique({ where: { id: quizId }, include: { course: true } });
  if (!quiz) throw notFound("Quiz not found.");
  if (!canManageCourse(actor, quiz.course)) throw forbidden();
  return quiz;
}

export async function updateQuiz(db: Db, actor: Actor | null, quizId: string, input: unknown) {
  const quiz = await requireManagedQuiz(db, actor, quizId);
  const data = parse(quizSchema, input);
  await assertModuleInCourse(db, data.moduleId, quiz.courseId);
  return db.quiz.update({ where: { id: quiz.id }, data });
}

export async function deleteQuiz(db: Db, actor: Actor | null, quizId: string) {
  const quiz = await requireManagedQuiz(db, actor, quizId);
  if (quiz.course.status === "PUBLISHED") {
    const attempts = await db.quizAttempt.count({ where: { quizId: quiz.id } });
    if (attempts > 0) throw conflict("This quiz has graded attempts and cannot be deleted while the course is published.");
  }
  await db.quiz.delete({ where: { id: quiz.id } });
  return quiz;
}

export async function getQuizForEditing(db: Db, actor: Actor | null, quizId: string) {
  await requireManagedQuiz(db, actor, quizId);
  return db.quiz.findUniqueOrThrow({
    where: { id: quizId },
    include: {
      course: { select: { id: true, title: true, slug: true, status: true, modules: { orderBy: { position: "asc" }, select: { id: true, title: true } } } },
      questions: { orderBy: { position: "asc" }, include: { choices: { orderBy: { position: "asc" } } } },
      _count: { select: { attempts: true } },
    },
  });
}

/** Creates a question, or replaces an existing question's content and choices. */
export async function saveQuestion(db: Db, actor: Actor | null, quizId: string, questionId: string | null, input: unknown) {
  const quiz = await requireManagedQuiz(db, actor, quizId);
  const data = parse(questionSchema, input);
  return db.$transaction(async (tx) => {
    if (questionId) {
      const existing = await tx.question.findFirst({ where: { id: questionId, quizId: quiz.id } });
      if (!existing) throw notFound("Question not found.");
      // Stored responses keep their graded snapshot; their choice link is nulled when choices are replaced.
      await tx.answerChoice.deleteMany({ where: { questionId } });
      return tx.question.update({
        where: { id: questionId },
        data: {
          prompt: data.prompt,
          explanation: data.explanation,
          points: data.points,
          choices: { create: data.choices },
        },
      });
    }
    const last = await tx.question.aggregate({ where: { quizId: quiz.id }, _max: { position: true } });
    return tx.question.create({
      data: {
        quizId: quiz.id,
        prompt: data.prompt,
        explanation: data.explanation,
        points: data.points,
        position: (last._max.position ?? -1) + 1,
        choices: { create: data.choices },
      },
    });
  });
}

export async function deleteQuestion(db: Db, actor: Actor | null, questionId: string) {
  const question = await db.question.findUnique({ where: { id: questionId }, select: { id: true, quizId: true } });
  if (!question) throw notFound("Question not found.");
  const quiz = await requireManagedQuiz(db, actor, question.quizId);
  await db.question.delete({ where: { id: question.id } });
  return quiz;
}

// ---------------------------------------------------------------------------
// Learner: taking quizzes
// ---------------------------------------------------------------------------

/**
 * The quiz as shown to a learner before submission. Choices are selected field-by-field so that
 * `isCorrect` and explanations never leave the server.
 */
export async function getQuizForLearner(db: Db, actor: Actor | null, quizId: string) {
  if (!actor) throw unauthenticated();
  const ref = await db.quiz.findUnique({ where: { id: quizId }, select: { courseId: true } });
  if (!ref) throw notFound("Quiz not found.");
  const access = await requireCourseContent(db, actor, { id: ref.courseId });

  const quiz = await db.quiz.findUniqueOrThrow({
    where: { id: quizId },
    select: {
      id: true,
      title: true,
      description: true,
      passingScore: true,
      maxAttempts: true,
      isRequired: true,
      dueAt: true,
      questions: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          prompt: true,
          points: true,
          choices: { orderBy: { position: "asc" }, select: { id: true, text: true } },
        },
      },
    },
  });
  const attempts = await db.quizAttempt.findMany({
    where: { quizId, userId: actor.id },
    orderBy: { attemptNumber: "desc" },
    select: { id: true, attemptNumber: true, score: true, maxScore: true, percentage: true, passed: true, submittedAt: true },
  });
  const attemptsRemaining = quiz.maxAttempts === null ? null : Math.max(0, quiz.maxAttempts - attempts.length);
  const canSubmit = Boolean(access.enrollment) && access.course.status === "PUBLISHED" && attemptsRemaining !== 0 && quiz.questions.length > 0;
  return { quiz, attempts, attemptsRemaining, canSubmit, ...access };
}

/** Validates, grades and persists a quiz attempt in a single transaction. */
export async function submitQuizAttempt(db: Db, actor: Actor | null, input: unknown) {
  if (!actor) throw unauthenticated();
  const { quizId, answers } = parse(quizSubmissionSchema, input);
  const ref = await db.quiz.findUnique({ where: { id: quizId }, select: { courseId: true } });
  if (!ref) throw notFound("Quiz not found.");
  const { course, enrollment } = await requireCourseContent(db, actor, { id: ref.courseId });
  if (!enrollment) throw forbidden("Only enrolled students can submit quizzes.");
  if (course.status !== "PUBLISHED") throw forbidden("This course is no longer accepting quiz submissions.");

  try {
    return await db.$transaction(async (tx) => {
      const quiz = await tx.quiz.findUniqueOrThrow({
        where: { id: quizId },
        include: { questions: { include: { choices: { select: { id: true, isCorrect: true } } } } },
      });
      const previous = await tx.quizAttempt.count({ where: { quizId, userId: actor.id } });
      if (quiz.maxAttempts !== null && previous >= quiz.maxAttempts) {
        throw forbidden("You have used all attempts for this quiz.");
      }
      let result;
      try {
        result = gradeSubmission(quiz.questions, answers, quiz.passingScore);
      } catch (error) {
        if (error instanceof SubmissionError) throw invalid(error.message);
        throw error;
      }
      const attempt = await tx.quizAttempt.create({
        data: {
          quizId,
          userId: actor.id,
          attemptNumber: previous + 1,
          score: result.score,
          maxScore: result.maxScore,
          percentage: result.percentage,
          passed: result.passed,
          responses: { create: result.responses },
        },
      });
      await syncCompletion(tx, actor.id, course.id);
      return attempt;
    });
  } catch (error) {
    // Two simultaneous submissions race for the same attempt number; the unique constraint rejects one.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw conflict("Another submission for this quiz was being processed. Please refresh and try again.");
    }
    throw error;
  }
}

/** A submitted attempt with correct answers revealed. Only the learner and course managers can see it. */
export async function getAttemptReview(db: Db, actor: Actor | null, attemptId: string) {
  if (!actor) throw unauthenticated();
  const attempt = await db.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      user: { select: { id: true, name: true } },
      quiz: {
        include: {
          course: { select: { id: true, slug: true, title: true, instructorId: true, status: true } },
          questions: { orderBy: { position: "asc" }, include: { choices: { orderBy: { position: "asc" } } } },
        },
      },
      responses: true,
    },
  });
  if (!attempt) throw notFound("Attempt not found.");
  if (!canViewLearnerRecords(actor, attempt.userId, attempt.quiz.course)) throw notFound("Attempt not found.");
  return attempt;
}
