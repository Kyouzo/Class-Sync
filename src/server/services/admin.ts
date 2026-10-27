import type { CourseStatus, Prisma } from "@prisma/client";
import type { Db } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { categorySchema, roleUpdateSchema } from "@/lib/validation";
import { conflict, forbidden, notFound, unauthenticated } from "../errors";
import { isAdmin, type Actor } from "../policies";
import { parse } from "./courses";

export const USERS_PAGE_SIZE = 20;

function requireAdmin(actor: Actor | null): asserts actor is Actor {
  if (!actor) throw unauthenticated();
  if (!isAdmin(actor)) throw forbidden("Administrators only.");
}

export async function listUsers(db: Db, actor: Actor | null, params: { q?: string; page: number }) {
  requireAdmin(actor);
  const where: Prisma.UserWhereInput = params.q
    ? { OR: [{ name: { contains: params.q, mode: "insensitive" } }, { email: { contains: params.q, mode: "insensitive" } }] }
    : {};
  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * USERS_PAGE_SIZE,
      take: USERS_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        role: { select: { name: true } },
        _count: { select: { enrollments: true, coursesTaught: true } },
      },
    }),
  ]);
  return { users, total, page: params.page, pageCount: Math.max(1, Math.ceil(total / USERS_PAGE_SIZE)) };
}

export async function setUserRole(db: Db, actor: Actor | null, input: unknown) {
  requireAdmin(actor);
  const data = parse(roleUpdateSchema, input);
  if (data.userId === actor.id) throw forbidden("You cannot change your own role.");
  const user = await db.user.findUnique({ where: { id: data.userId }, include: { _count: { select: { coursesTaught: true } } } });
  if (!user) throw notFound("User not found.");
  if (data.role === "STUDENT" && user._count.coursesTaught > 0) {
    throw conflict("This user still owns courses. Reassign or delete them before demoting to student.");
  }
  const role = await db.role.findUniqueOrThrow({ where: { name: data.role } });
  return db.user.update({ where: { id: user.id }, data: { roleId: role.id } });
}

export async function listCategoriesWithCounts(db: Db, actor: Actor | null) {
  requireAdmin(actor);
  return db.category.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { courses: true } } } });
}

export async function createCategory(db: Db, actor: Actor | null, input: unknown) {
  requireAdmin(actor);
  const data = parse(categorySchema, input);
  const slug = slugify(data.name);
  const existing = await db.category.findFirst({ where: { OR: [{ name: data.name }, { slug }] } });
  if (existing) throw conflict("A category with that name already exists.");
  return db.category.create({ data: { name: data.name, slug } });
}

export async function deleteCategory(db: Db, actor: Actor | null, categoryId: string) {
  requireAdmin(actor);
  // Courses keep existing; their category is cleared by the ON DELETE SET NULL foreign key.
  await db.category.delete({ where: { id: categoryId } }).catch(() => {
    throw notFound("Category not found.");
  });
}

export async function listAllCourses(db: Db, actor: Actor | null, status?: CourseStatus) {
  requireAdmin(actor);
  return db.course.findMany({
    where: status ? { status } : {},
    orderBy: { updatedAt: "desc" },
    include: { instructor: { select: { name: true } }, _count: { select: { enrollments: true } } },
  });
}

export async function getPlatformStats(db: Db, actor: Actor | null) {
  requireAdmin(actor);
  const [users, courses, enrollments, certificates, attempts] = await Promise.all([
    db.user.groupBy({ by: ["roleId"], _count: true }),
    db.course.groupBy({ by: ["status"], _count: true }),
    db.enrollment.count(),
    db.certificate.count(),
    db.quizAttempt.count(),
  ]);
  const roles = await db.role.findMany();
  return {
    usersByRole: roles.map((r) => ({ role: r.name, count: users.find((u) => u.roleId === r.id)?._count ?? 0 })),
    coursesByStatus: courses.map((c) => ({ status: c.status, count: c._count })),
    enrollments,
    certificates,
    attempts,
  };
}
