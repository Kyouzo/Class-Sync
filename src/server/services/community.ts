import type { Db } from "@/lib/db";
import { announcementSchema, discussionPostSchema } from "@/lib/validation";
import { forbidden, invalid, notFound, unauthenticated } from "../errors";
import { canModeratePost, type Actor } from "../policies";
import { requireCourseContent, requireManagedCourse } from "./access";
import { parse } from "./courses";

export const THREADS_PAGE_SIZE = 10;

// ---------------------------------------------------------------------------
// Announcements (instructor -> enrolled learners)
// ---------------------------------------------------------------------------

export async function createAnnouncement(db: Db, actor: Actor | null, courseId: string, input: unknown) {
  const course = await requireManagedCourse(db, actor, courseId);
  const data = parse(announcementSchema, input);
  return db.announcement.create({ data: { ...data, courseId: course.id, authorId: actor!.id } });
}

export async function deleteAnnouncement(db: Db, actor: Actor | null, announcementId: string) {
  const announcement = await db.announcement.findUnique({ where: { id: announcementId } });
  if (!announcement) throw notFound("Announcement not found.");
  const course = await requireManagedCourse(db, actor, announcement.courseId);
  await db.announcement.delete({ where: { id: announcement.id } });
  return course;
}

export async function listAnnouncements(db: Db, actor: Actor | null, courseSlug: string) {
  const access = await requireCourseContent(db, actor, { slug: courseSlug });
  const announcements = await db.announcement.findMany({
    where: { courseId: access.course.id },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { name: true } } },
  });
  return { ...access, announcements };
}

// ---------------------------------------------------------------------------
// Discussions (threads with flat replies)
// ---------------------------------------------------------------------------

export async function listThreads(db: Db, actor: Actor | null, courseSlug: string, page: number) {
  const access = await requireCourseContent(db, actor, { slug: courseSlug });
  const where = { courseId: access.course.id, parentId: null };
  const [total, threads] = await Promise.all([
    db.discussionPost.count({ where }),
    db.discussionPost.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * THREADS_PAGE_SIZE,
      take: THREADS_PAGE_SIZE,
      include: { author: { select: { name: true } }, _count: { select: { replies: true } } },
    }),
  ]);
  return { ...access, threads, total, page, pageCount: Math.max(1, Math.ceil(total / THREADS_PAGE_SIZE)) };
}

export async function getThread(db: Db, actor: Actor | null, courseSlug: string, postId: string) {
  const access = await requireCourseContent(db, actor, { slug: courseSlug });
  const thread = await db.discussionPost.findFirst({
    where: { id: postId, courseId: access.course.id, parentId: null },
    include: {
      author: { select: { id: true, name: true, role: { select: { name: true } } } },
      replies: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, role: { select: { name: true } } } } },
      },
    },
  });
  if (!thread) throw notFound("Discussion not found.");
  return { ...access, thread };
}

export async function createPost(db: Db, actor: Actor | null, courseId: string, input: unknown) {
  if (!actor) throw unauthenticated();
  const { course } = await requireCourseContent(db, actor, { id: courseId });
  if (course.status === "ARCHIVED") throw forbidden("Discussions are read-only for archived courses.");
  const data = parse(discussionPostSchema, input);
  if (data.parentId) {
    const parent = await db.discussionPost.findFirst({ where: { id: data.parentId, courseId: course.id, parentId: null } });
    if (!parent) throw notFound("Discussion not found.");
    return db.discussionPost.create({ data: { courseId: course.id, authorId: actor.id, parentId: parent.id, body: data.body } });
  }
  if (!data.title) throw invalid("A new discussion needs a title.", { title: ["Title is required."] });
  return db.discussionPost.create({ data: { courseId: course.id, authorId: actor.id, title: data.title, body: data.body } });
}

export async function deletePost(db: Db, actor: Actor | null, postId: string) {
  if (!actor) throw unauthenticated();
  const post = await db.discussionPost.findUnique({ where: { id: postId }, include: { course: true } });
  if (!post) throw notFound("Post not found.");
  if (!canModeratePost(actor, post, post.course)) throw forbidden("You can only delete your own posts.");
  await db.discussionPost.delete({ where: { id: post.id } });
  return post;
}
