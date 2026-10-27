import type { Db } from "@/lib/db";
import { courseGrade, evaluateCompletion, progressPercent, round2 } from "../grading";
import type { Actor } from "../policies";
import { requireManagedCourse } from "./access";

/** Per-student progress and grades for a course. Instructor/admin only. */
export async function getCourseRoster(db: Db, actor: Actor | null, courseId: string) {
  const course = await requireManagedCourse(db, actor, courseId);
  const [lessons, quizzes, enrollments, progress, attempts] = await Promise.all([
    db.lesson.findMany({ where: { module: { courseId } }, select: { id: true } }),
    db.quiz.findMany({ where: { courseId }, orderBy: { createdAt: "asc" }, select: { id: true, title: true, isRequired: true, passingScore: true } }),
    db.enrollment.findMany({
      where: { courseId },
      orderBy: { enrolledAt: "asc" },
      include: { user: { select: { id: true, name: true, email: true } }, certificate: { select: { code: true } } },
    }),
    db.lessonProgress.findMany({ where: { lesson: { module: { courseId } } }, select: { userId: true, lessonId: true } }),
    db.quizAttempt.findMany({ where: { quiz: { courseId } }, select: { userId: true, quizId: true, percentage: true, passed: true } }),
  ]);

  const completedByUser = new Map<string, number>();
  for (const p of progress) completedByUser.set(p.userId, (completedByUser.get(p.userId) ?? 0) + 1);

  const bestByUserQuiz = new Map<string, { best: number; passed: boolean; attempts: number }>();
  for (const a of attempts) {
    const key = `${a.userId}:${a.quizId}`;
    const prev = bestByUserQuiz.get(key);
    const pct = Number(a.percentage);
    bestByUserQuiz.set(key, {
      best: Math.max(prev?.best ?? 0, pct),
      passed: (prev?.passed ?? false) || a.passed,
      attempts: (prev?.attempts ?? 0) + 1,
    });
  }

  const students = enrollments.map((e) => {
    const standings = quizzes.map((q) => {
      const s = bestByUserQuiz.get(`${e.userId}:${q.id}`);
      return { quizId: q.id, isRequired: q.isRequired, bestPercentage: s?.best ?? null, passed: s?.passed ?? false, attempts: s?.attempts ?? 0 };
    });
    const completedLessons = completedByUser.get(e.userId) ?? 0;
    const evaluation = evaluateCompletion(course, { totalLessons: lessons.length, completedLessons, quizzes: standings });
    return {
      user: e.user,
      enrolledAt: e.enrolledAt,
      completedAt: e.completedAt,
      certificateCode: e.certificate?.code ?? null,
      progress: progressPercent(completedLessons, lessons.length),
      grade: courseGrade(standings),
      quizzes: standings,
      eligible: evaluation.eligible,
    };
  });

  const quizStats = quizzes.map((q) => {
    const results = students.map((s) => s.quizzes.find((x) => x.quizId === q.id)!).filter((x) => x.attempts > 0);
    return {
      id: q.id,
      title: q.title,
      passingScore: q.passingScore,
      attempted: results.length,
      averageBest: results.length ? round2(results.reduce((sum, r) => sum + (r.bestPercentage ?? 0), 0) / results.length) : null,
      passRate: results.length ? round2((results.filter((r) => r.passed).length / results.length) * 100) : null,
    };
  });

  const buckets = [
    { range: "0-24%", count: 0 },
    { range: "25-49%", count: 0 },
    { range: "50-74%", count: 0 },
    { range: "75-99%", count: 0 },
    { range: "100%", count: 0 },
  ];
  for (const s of students) {
    const index = s.progress >= 100 ? 4 : Math.min(3, Math.floor(s.progress / 25));
    buckets[index].count++;
  }

  return {
    course,
    totalLessons: lessons.length,
    students,
    quizStats,
    progressDistribution: buckets,
    summary: {
      enrolled: students.length,
      completed: students.filter((s) => s.completedAt).length,
      averageProgress: students.length ? round2(students.reduce((sum, s) => sum + s.progress, 0) / students.length) : 0,
    },
  };
}

/** Instructor dashboard: summary metrics across all of the instructor's courses. */
export async function getInstructorOverview(db: Db, actor: Actor) {
  const courseWhere = actor.role === "ADMIN" ? {} : { instructorId: actor.id };
  const courses = await db.course.findMany({
    where: courseWhere,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      _count: { select: { enrollments: true } },
      enrollments: { where: { status: "COMPLETED" }, select: { id: true } },
    },
  });
  const recentAttempts = await db.quizAttempt.findMany({
    where: { quiz: { course: courseWhere } },
    orderBy: { submittedAt: "desc" },
    take: 8,
    include: { user: { select: { name: true } }, quiz: { select: { title: true, course: { select: { id: true, title: true } } } } },
  });
  return {
    courses: courses.map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      status: c.status,
      enrolled: c._count.enrollments,
      completed: c.enrollments.length,
    })),
    recentAttempts,
  };
}
