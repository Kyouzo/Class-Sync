import { Prisma, type CourseStatus } from "@prisma/client";
import type { z } from "zod";
import type { Db } from "@/lib/db";
import { slugify } from "@/lib/utils";
import {
  completionSettingsSchema,
  courseSchema,
  fieldErrors,
  lessonSchema,
  moduleSchema,
} from "@/lib/validation";
import { conflict, forbidden, invalid, notFound, unauthenticated } from "../errors";
import { canCreateCourse, canManageCourse, type Actor } from "../policies";
import { requireManagedCourse, type Client } from "./access";

export function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = fieldErrors(result.error);
    const first = Object.values(errors).flat().find(Boolean) ?? result.error.issues[0]?.message;
    throw invalid(first ?? "Please check the form and try again.", errors);
  }
  return result.data;
}

async function uniqueSlug(db: Client, title: string, excludeId?: string): Promise<string> {
  const base = slugify(title) || "course";
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const existing = await db.course.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing || existing.id === excludeId) return candidate;
  }
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

async function assertCategory(db: Client, categoryId: string | null) {
  if (!categoryId) return;
  const category = await db.category.findUnique({ where: { id: categoryId }, select: { id: true } });
  if (!category) throw invalid("Unknown category.", { categoryId: ["Unknown category."] });
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

export async function createCourse(db: Db, actor: Actor | null, input: unknown) {
  if (!actor) throw unauthenticated();
  if (!canCreateCourse(actor)) throw forbidden("Only instructors can create courses.");
  const data = parse(courseSchema, input);
  await assertCategory(db, data.categoryId);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.course.create({
        data: { ...data, slug: await uniqueSlug(db, data.title), instructorId: actor.id },
      });
    } catch (error) {
      // Two courses with the same title created concurrently: retry with a fresh slug.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    }
  }
  throw conflict("Could not generate a unique course URL. Try a different title.");
}

export async function updateCourse(db: Db, actor: Actor | null, courseId: string, input: unknown) {
  const course = await requireManagedCourse(db, actor, courseId);
  const data = parse(courseSchema, input);
  await assertCategory(db, data.categoryId);
  // Keep public URLs stable once a course has been published.
  const slug = course.status === "DRAFT" && data.title !== course.title ? await uniqueSlug(db, data.title, course.id) : course.slug;
  return db.course.update({ where: { id: course.id }, data: { ...data, slug } });
}

export async function updateCompletionSettings(db: Db, actor: Actor | null, courseId: string, input: unknown) {
  const course = await requireManagedCourse(db, actor, courseId);
  const data = parse(completionSettingsSchema, input);
  return db.course.update({ where: { id: course.id }, data });
}

/** Returns human-readable reasons a course cannot be published yet (empty when ready). */
export async function publishReadiness(db: Client, courseId: string): Promise<string[]> {
  const [lessonCount, quizzes] = await Promise.all([
    db.lesson.count({ where: { module: { courseId } } }),
    db.quiz.findMany({
      where: { courseId },
      select: { title: true, questions: { select: { choices: { select: { isCorrect: true } } } } },
    }),
  ]);
  const problems: string[] = [];
  if (lessonCount === 0) problems.push("Add at least one lesson.");
  for (const quiz of quizzes) {
    if (quiz.questions.length === 0) problems.push(`Quiz "${quiz.title}" has no questions.`);
    else if (quiz.questions.some((q) => q.choices.filter((c) => c.isCorrect).length !== 1 || q.choices.length < 2)) {
      problems.push(`Quiz "${quiz.title}" has a question without exactly one correct answer.`);
    }
  }
  return problems;
}

export async function setCourseStatus(db: Db, actor: Actor | null, courseId: string, status: CourseStatus) {
  const course = await requireManagedCourse(db, actor, courseId);
  if (status === "PUBLISHED") {
    const problems = await publishReadiness(db, course.id);
    if (problems.length > 0) throw invalid(`This course is not ready to publish: ${problems.join(" ")}`);
  }
  if (status === "DRAFT" && course.status !== "DRAFT") {
    const enrollments = await db.enrollment.count({ where: { courseId: course.id } });
    if (enrollments > 0) throw conflict("Courses with enrolled students can be archived, but not moved back to draft.");
  }
  return db.course.update({
    where: { id: course.id },
    data: { status, publishedAt: status === "PUBLISHED" ? (course.publishedAt ?? new Date()) : course.publishedAt },
  });
}

export async function deleteCourse(db: Db, actor: Actor | null, courseId: string) {
  const course = await requireManagedCourse(db, actor, courseId);
  const enrollments = await db.enrollment.count({ where: { courseId: course.id } });
  if (enrollments > 0) throw conflict("Courses with enrolled students cannot be deleted. Archive it instead.");
  await db.course.delete({ where: { id: course.id } });
}

export async function listInstructorCourses(db: Db, actor: Actor) {
  return db.course.findMany({
    where: actor.role === "ADMIN" ? {} : { instructorId: actor.id },
    orderBy: { updatedAt: "desc" },
    include: {
      category: true,
      instructor: { select: { name: true } },
      _count: { select: { enrollments: true, modules: true, quizzes: true } },
    },
  });
}

export async function getCourseForEditing(db: Db, actor: Actor | null, courseId: string) {
  await requireManagedCourse(db, actor, courseId);
  const course = await db.course.findUniqueOrThrow({
    where: { id: courseId },
    include: {
      category: true,
      modules: {
        orderBy: { position: "asc" },
        include: {
          lessons: {
            orderBy: { position: "asc" },
            select: { id: true, title: true, position: true, dueAt: true, _count: { select: { resources: true } } },
          },
        },
      },
      quizzes: {
        orderBy: { createdAt: "asc" },
        include: { module: { select: { title: true } }, _count: { select: { questions: true, attempts: true } } },
      },
      _count: { select: { enrollments: true } },
    },
  });
  return { course, readiness: await publishReadiness(db, courseId) };
}

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

export async function createModule(db: Db, actor: Actor | null, courseId: string, input: unknown) {
  const course = await requireManagedCourse(db, actor, courseId);
  const data = parse(moduleSchema, input);
  return db.$transaction(async (tx) => {
    const last = await tx.module.aggregate({ where: { courseId: course.id }, _max: { position: true } });
    return tx.module.create({ data: { courseId: course.id, title: data.title, position: (last._max.position ?? -1) + 1 } });
  });
}

async function requireManagedModule(db: Client, actor: Actor | null, moduleId: string) {
  if (!actor) throw unauthenticated();
  const mod = await db.module.findUnique({ where: { id: moduleId }, include: { course: true } });
  if (!mod) throw notFound("Module not found.");
  if (!canManageCourse(actor, mod.course)) throw forbidden();
  return mod;
}

export async function renameModule(db: Db, actor: Actor | null, moduleId: string, input: unknown) {
  const mod = await requireManagedModule(db, actor, moduleId);
  const data = parse(moduleSchema, input);
  return db.module.update({ where: { id: mod.id }, data: { title: data.title } });
}

export async function deleteModule(db: Db, actor: Actor | null, moduleId: string) {
  const mod = await requireManagedModule(db, actor, moduleId);
  await db.module.delete({ where: { id: mod.id } });
  return mod.course;
}

export async function moveModule(db: Db, actor: Actor | null, moduleId: string, direction: "up" | "down") {
  const mod = await requireManagedModule(db, actor, moduleId);
  await db.$transaction(async (tx) => {
    const neighbour = await tx.module.findFirst({
      where: {
        courseId: mod.courseId,
        position: direction === "up" ? { lt: mod.position } : { gt: mod.position },
      },
      orderBy: { position: direction === "up" ? "desc" : "asc" },
    });
    if (!neighbour) return;
    await tx.module.update({ where: { id: mod.id }, data: { position: neighbour.position } });
    await tx.module.update({ where: { id: neighbour.id }, data: { position: mod.position } });
  });
  return mod.course;
}

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------

export async function createLesson(db: Db, actor: Actor | null, moduleId: string, input: unknown) {
  const mod = await requireManagedModule(db, actor, moduleId);
  const data = parse(lessonSchema, input);
  return db.$transaction(async (tx) => {
    const last = await tx.lesson.aggregate({ where: { moduleId: mod.id }, _max: { position: true } });
    return tx.lesson.create({ data: { ...data, moduleId: mod.id, position: (last._max.position ?? -1) + 1 } });
  });
}

export async function requireManagedLesson(db: Client, actor: Actor | null, lessonId: string) {
  if (!actor) throw unauthenticated();
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { include: { course: true } }, resources: { orderBy: { createdAt: "asc" } } },
  });
  if (!lesson) throw notFound("Lesson not found.");
  if (!canManageCourse(actor, lesson.module.course)) throw forbidden();
  return lesson;
}

export async function updateLesson(db: Db, actor: Actor | null, lessonId: string, input: unknown) {
  const lesson = await requireManagedLesson(db, actor, lessonId);
  const data = parse(lessonSchema, input);
  return db.lesson.update({ where: { id: lesson.id }, data });
}

export async function deleteLesson(db: Db, actor: Actor | null, lessonId: string) {
  const lesson = await requireManagedLesson(db, actor, lessonId);
  await db.lesson.delete({ where: { id: lesson.id } });
  return lesson;
}

export async function moveLesson(db: Db, actor: Actor | null, lessonId: string, direction: "up" | "down") {
  const lesson = await requireManagedLesson(db, actor, lessonId);
  await db.$transaction(async (tx) => {
    const neighbour = await tx.lesson.findFirst({
      where: {
        moduleId: lesson.moduleId,
        position: direction === "up" ? { lt: lesson.position } : { gt: lesson.position },
      },
      orderBy: { position: direction === "up" ? "desc" : "asc" },
    });
    if (!neighbour) return;
    await tx.lesson.update({ where: { id: lesson.id }, data: { position: neighbour.position } });
    await tx.lesson.update({ where: { id: neighbour.id }, data: { position: lesson.position } });
  });
  return lesson;
}
