import type { CourseStatus, RoleName } from "@prisma/client";

/** The authenticated user as seen by authorization checks. Role is always loaded from the database. */
export type Actor = { id: string; role: RoleName; name: string; email: string };

type CourseRef = { instructorId: string; status: CourseStatus };

export const isAdmin = (actor: Actor | null | undefined) => actor?.role === "ADMIN";

export function canCreateCourse(actor: Actor | null | undefined): boolean {
  return actor?.role === "INSTRUCTOR" || actor?.role === "ADMIN";
}

/** Instructor-only controls: only the owning instructor or an administrator. */
export function canManageCourse(actor: Actor | null | undefined, course: Pick<CourseRef, "instructorId">): boolean {
  if (!actor) return false;
  if (actor.role === "ADMIN") return true;
  return actor.role === "INSTRUCTOR" && course.instructorId === actor.id;
}

/** Course landing page: published courses are public; drafts/archived are visible to managers only. */
export function canViewCourseOverview(actor: Actor | null | undefined, course: CourseRef): boolean {
  return course.status === "PUBLISHED" || canManageCourse(actor, course);
}

/**
 * Lessons, quizzes, discussions and announcements. Managers can always preview. Enrolled learners keep
 * access to archived courses, but never to drafts.
 */
export function canAccessCourseContent(
  actor: Actor | null | undefined,
  course: CourseRef,
  enrollment: { id: string } | null | undefined,
): boolean {
  if (!actor) return false;
  if (canManageCourse(actor, course)) return true;
  return Boolean(enrollment) && course.status !== "DRAFT";
}

/** Only students can enroll, and only in published courses. */
export function canEnroll(actor: Actor | null | undefined, course: CourseRef): boolean {
  return actor?.role === "STUDENT" && course.status === "PUBLISHED";
}

/** A learner's grades and progress are visible to that learner, the course instructor and administrators. */
export function canViewLearnerRecords(
  actor: Actor | null | undefined,
  learnerId: string,
  course: Pick<CourseRef, "instructorId">,
): boolean {
  if (!actor) return false;
  return actor.id === learnerId || canManageCourse(actor, course);
}

export function canModeratePost(
  actor: Actor | null | undefined,
  post: { authorId: string },
  course: Pick<CourseRef, "instructorId">,
): boolean {
  if (!actor) return false;
  return post.authorId === actor.id || canManageCourse(actor, course);
}
