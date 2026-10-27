import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { guard } from "./page-guard";
import { requireUser } from "./session";
import { requireCourseContent } from "./services/access";
import { getLearnerStanding } from "./services/progress";

/**
 * Everything the /learn/[slug] layout and pages need, loaded once per request. Access is enforced
 * here: non-enrolled users are sent back to the course overview, drafts 404 for non-managers.
 */
export const getLearningContext = cache(async (slug: string) => {
  const user = await requireUser();
  const access = await guard(() => requireCourseContent(db, user, { slug }), { forbiddenRedirect: `/courses/${slug}` });
  const course = await db.course.findUniqueOrThrow({
    where: { id: access.course.id },
    include: {
      instructor: { select: { name: true } },
      modules: {
        orderBy: { position: "asc" },
        include: { lessons: { orderBy: { position: "asc" }, select: { id: true, title: true, dueAt: true, estimatedMinutes: true } } },
      },
      quizzes: { orderBy: { createdAt: "asc" }, select: { id: true, title: true, isRequired: true, dueAt: true, moduleId: true, passingScore: true } },
    },
  });
  const [standing, certificate] = access.enrollment
    ? await Promise.all([
        getLearnerStanding(db, user.id, course.id),
        db.certificate.findUnique({ where: { userId_courseId: { userId: user.id, courseId: course.id } } }),
      ])
    : [null, null];
  const lessons = course.modules.flatMap((m) => m.lessons);
  return { user, course, lessons, enrollment: access.enrollment, canManage: access.canManage, standing, certificate };
});
