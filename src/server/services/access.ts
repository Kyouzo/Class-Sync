import type { Prisma } from "@prisma/client";
import type { Db } from "@/lib/db";
import { forbidden, notFound, unauthenticated } from "../errors";
import { canAccessCourseContent, canManageCourse, canViewCourseOverview, type Actor } from "../policies";

export type Client = Db | Prisma.TransactionClient;

type CourseWhere = { id: string } | { slug: string };

/**
 * Loads a course for its content area (lessons, quizzes, discussions, announcements).
 * Courses the actor may not even see are reported as "not found" so drafts don't leak.
 */
export async function requireCourseContent(db: Client, actor: Actor | null, where: CourseWhere) {
  if (!actor) throw unauthenticated();
  const course = await db.course.findUnique({
    where,
    select: { id: true, slug: true, title: true, status: true, instructorId: true },
  });
  // Drafts are invisible to everyone but their managers. Enrolled learners may still reach archived courses.
  if (!course || (course.status === "DRAFT" && !canManageCourse(actor, course))) {
    throw notFound("Course not found.");
  }
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: actor.id, courseId: course.id } },
    select: { id: true, status: true, completedAt: true },
  });
  if (!canAccessCourseContent(actor, course, enrollment)) {
    throw forbidden("Enroll in this course to access its content.");
  }
  return { course, enrollment, canManage: canManageCourse(actor, course) };
}

/** Loads a course for instructor-only controls. */
export async function requireManagedCourse(db: Client, actor: Actor | null, courseId: string) {
  if (!actor) throw unauthenticated();
  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) throw notFound("Course not found.");
  if (!canManageCourse(actor, course)) {
    throw canViewCourseOverview(actor, course) ? forbidden() : notFound("Course not found.");
  }
  return course;
}
