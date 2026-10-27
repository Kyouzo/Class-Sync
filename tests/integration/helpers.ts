import { PrismaClient, type CourseStatus, type RoleName } from "@prisma/client";
import { expect } from "vitest";
import { AppError, type AppErrorCode } from "@/server/errors";
import type { Actor } from "@/server/policies";

export const db = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });

export async function resetDb() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"public"."${t.tablename}"`).join(", ")} CASCADE`);
  await db.role.createMany({
    data: (["STUDENT", "INSTRUCTOR", "ADMIN"] as const).map((name) => ({ name, description: name })),
  });
}

let counter = 0;

export async function createUser(role: RoleName, name?: string): Promise<Actor> {
  counter++;
  const roleRow = await db.role.findUniqueOrThrow({ where: { name: role } });
  const user = await db.user.create({
    data: { name: name ?? `${role.toLowerCase()} ${counter}`, email: `${role.toLowerCase()}${counter}@test.dev`, passwordHash: "x", roleId: roleRow.id },
  });
  return { id: user.id, name: user.name, email: user.email, role };
}

type CourseOptions = {
  status?: CourseStatus;
  lessons?: number;
  quiz?: { passingScore?: number; maxAttempts?: number | null; questions?: number; isRequired?: boolean } | false;
  requireAllLessons?: boolean;
  requirePassingQuizzes?: boolean;
  minimumGrade?: number | null;
};

export type QuizFixture = { id: string; questions: { id: string; correct: string; wrong: string }[] };

/** Creates a course with one module, N lessons and (optionally) one quiz of two-choice questions. */
export async function createCourse(instructor: Actor, options: CourseOptions = {}) {
  counter++;
  const course = await db.course.create({
    data: {
      title: `Course ${counter}`,
      slug: `course-${counter}-${Date.now()}`,
      summary: "A test course summary",
      description: "A test course description",
      status: options.status ?? "PUBLISHED",
      publishedAt: options.status === "DRAFT" ? null : new Date(),
      instructorId: instructor.id,
      requireAllLessons: options.requireAllLessons ?? true,
      requirePassingQuizzes: options.requirePassingQuizzes ?? true,
      minimumGrade: options.minimumGrade ?? null,
    },
  });
  const mod = await db.module.create({ data: { courseId: course.id, title: "Module", position: 0 } });
  const lessonIds: string[] = [];
  for (let i = 0; i < (options.lessons ?? 2); i++) {
    const lesson = await db.lesson.create({ data: { moduleId: mod.id, title: `Lesson ${i + 1}`, content: "Content", position: i } });
    lessonIds.push(lesson.id);
  }

  let quiz: QuizFixture | null = null;
  if (options.quiz !== false) {
    const q = options.quiz ?? {};
    const created = await db.quiz.create({
      data: {
        courseId: course.id,
        moduleId: mod.id,
        title: "Quiz",
        passingScore: q.passingScore ?? 70,
        maxAttempts: q.maxAttempts === undefined ? null : q.maxAttempts,
        isRequired: q.isRequired ?? true,
      },
    });
    quiz = { id: created.id, questions: [] };
    for (let i = 0; i < (q.questions ?? 2); i++) {
      const question = await db.question.create({
        data: {
          quizId: created.id,
          prompt: `Question ${i + 1}`,
          position: i,
          choices: { create: [{ text: "Right", isCorrect: true, position: 0 }, { text: "Wrong", isCorrect: false, position: 1 }] },
        },
        include: { choices: true },
      });
      quiz.questions.push({
        id: question.id,
        correct: question.choices.find((c) => c.isCorrect)!.id,
        wrong: question.choices.find((c) => !c.isCorrect)!.id,
      });
    }
  }
  return { course, moduleId: mod.id, lessonIds, quiz };
}

export async function enrollDirect(user: Actor, courseId: string) {
  return db.enrollment.create({ data: { userId: user.id, courseId } });
}

/** Builds an answer map: `correctCount` questions answered correctly, the rest wrong. */
export function answers(quiz: QuizFixture, correctCount = quiz.questions.length) {
  return Object.fromEntries(quiz.questions.map((q, i) => [q.id, i < correctCount ? q.correct : q.wrong]));
}

export async function expectAppError(promise: Promise<unknown>, code: AppErrorCode) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error, `expected AppError ${code}`).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe(code);
}
