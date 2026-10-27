import type { Prisma } from "@prisma/client";
import type { Db } from "@/lib/db";
import { notFound } from "../errors";
import { canEnroll, canManageCourse, canViewCourseOverview, type Actor } from "../policies";

export const CATALOG_PAGE_SIZE = 9;

export async function listCategories(db: Db) {
  return db.category.findMany({ orderBy: { name: "asc" } });
}

/** Public catalog: published courses only, with search, category filter and pagination. */
export async function listPublishedCourses(db: Db, params: { q?: string; category?: string; page: number }) {
  const where: Prisma.CourseWhereInput = { status: "PUBLISHED" };
  if (params.q) {
    where.OR = [
      { title: { contains: params.q, mode: "insensitive" } },
      { summary: { contains: params.q, mode: "insensitive" } },
    ];
  }
  if (params.category) where.category = { slug: params.category };

  const [total, courses] = await Promise.all([
    db.course.count({ where }),
    db.course.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      skip: (params.page - 1) * CATALOG_PAGE_SIZE,
      take: CATALOG_PAGE_SIZE,
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        category: { select: { name: true, slug: true } },
        instructor: { select: { name: true } },
        _count: { select: { modules: true, enrollments: true } },
      },
    }),
  ]);
  return { courses, total, page: params.page, pageCount: Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE)) };
}

/** Course landing page with syllabus (titles only) and the viewer's enrollment state. */
export async function getCourseOverview(db: Db, actor: Actor | null, slug: string) {
  const course = await db.course.findUnique({
    where: { slug },
    include: {
      category: true,
      instructor: { select: { id: true, name: true } },
      modules: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          lessons: { orderBy: { position: "asc" }, select: { id: true, title: true, estimatedMinutes: true } },
        },
      },
      quizzes: { select: { id: true, title: true, isRequired: true, passingScore: true } },
      _count: { select: { enrollments: true } },
    },
  });
  if (!course || !canViewCourseOverview(actor, course)) throw notFound("Course not found.");

  const enrollment = actor
    ? await db.enrollment.findUnique({ where: { userId_courseId: { userId: actor.id, courseId: course.id } } })
    : null;

  return {
    course,
    enrollment,
    canManage: canManageCourse(actor, course),
    canEnroll: canEnroll(actor, course) && !enrollment,
  };
}
