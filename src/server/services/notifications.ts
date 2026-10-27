import type { Db } from "@/lib/db";
import type { Actor } from "../policies";

export type Notification = {
  id: string;
  kind: "deadline" | "overdue" | "announcement";
  title: string;
  detail: string;
  href: string;
  date: Date;
};

const DAY = 24 * 60 * 60 * 1000;
export const DEADLINE_WINDOW_DAYS = 14;

/**
 * In-app notifications computed from the learner's enrollments: upcoming/overdue lesson and quiz
 * deadlines that are still outstanding, plus recent announcements. No email provider is required.
 */
export async function getNotifications(db: Db, actor: Actor, now = new Date()): Promise<Notification[]> {
  const enrollments = await db.enrollment.findMany({
    where: { userId: actor.id, course: { status: "PUBLISHED" } },
    select: { courseId: true, course: { select: { slug: true, title: true } } },
  });
  if (enrollments.length === 0) return [];
  const courseIds = enrollments.map((e) => e.courseId);
  const courseById = new Map(enrollments.map((e) => [e.courseId, e.course]));
  const windowEnd = new Date(now.getTime() + DEADLINE_WINDOW_DAYS * DAY);
  const overdueStart = new Date(now.getTime() - DEADLINE_WINDOW_DAYS * DAY);

  const [quizzes, lessons, announcements] = await Promise.all([
    db.quiz.findMany({
      where: { courseId: { in: courseIds }, dueAt: { gte: overdueStart, lte: windowEnd } },
      select: { id: true, title: true, dueAt: true, courseId: true, attempts: { where: { userId: actor.id, passed: true }, select: { id: true }, take: 1 } },
    }),
    db.lesson.findMany({
      where: { module: { courseId: { in: courseIds } }, dueAt: { gte: overdueStart, lte: windowEnd } },
      select: { id: true, title: true, dueAt: true, module: { select: { courseId: true } }, progress: { where: { userId: actor.id }, select: { id: true } } },
    }),
    db.announcement.findMany({
      where: { courseId: { in: courseIds }, createdAt: { gte: overdueStart } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, title: true, createdAt: true, courseId: true },
    }),
  ]);

  const items: Notification[] = [];
  for (const q of quizzes) {
    if (q.attempts.length > 0 || !q.dueAt) continue;
    const course = courseById.get(q.courseId)!;
    items.push({
      id: `quiz-${q.id}`,
      kind: q.dueAt < now ? "overdue" : "deadline",
      title: `${q.dueAt < now ? "Overdue" : "Due soon"}: ${q.title}`,
      detail: course.title,
      href: `/learn/${course.slug}/quizzes/${q.id}`,
      date: q.dueAt,
    });
  }
  for (const l of lessons) {
    if (l.progress.length > 0 || !l.dueAt) continue;
    const course = courseById.get(l.module.courseId)!;
    items.push({
      id: `lesson-${l.id}`,
      kind: l.dueAt < now ? "overdue" : "deadline",
      title: `${l.dueAt < now ? "Overdue" : "Due soon"}: ${l.title}`,
      detail: course.title,
      href: `/learn/${course.slug}/lessons/${l.id}`,
      date: l.dueAt,
    });
  }
  for (const a of announcements) {
    const course = courseById.get(a.courseId)!;
    items.push({
      id: `announcement-${a.id}`,
      kind: "announcement",
      title: a.title,
      detail: course.title,
      href: `/learn/${course.slug}/announcements`,
      date: a.createdAt,
    });
  }
  // Overdue first, then upcoming deadlines soonest first, then newest announcements.
  const rank = { overdue: 0, deadline: 1, announcement: 2 } as const;
  return items.sort((a, b) =>
    rank[a.kind] !== rank[b.kind]
      ? rank[a.kind] - rank[b.kind]
      : a.kind === "announcement"
        ? b.date.getTime() - a.date.getTime()
        : a.date.getTime() - b.date.getTime(),
  );
}

/**
 * Badge count: announcements posted since the notifications page was last opened, plus outstanding
 * deadlines as a daily reminder (they reappear if the page has not been opened for a day).
 */
export async function countUnseenNotifications(db: Db, actor: Actor, now = new Date()): Promise<number> {
  const [user, items] = await Promise.all([
    db.user.findUnique({ where: { id: actor.id }, select: { notificationsSeenAt: true } }),
    getNotifications(db, actor, now),
  ]);
  const seen = user?.notificationsSeenAt;
  const remindDeadlines = !seen || now.getTime() - seen.getTime() > DAY;
  return items.filter((n) => (n.kind === "announcement" ? !seen || n.date > seen : remindDeadlines)).length;
}

export async function markNotificationsSeen(db: Db, actor: Actor) {
  await db.user.update({ where: { id: actor.id }, data: { notificationsSeenAt: new Date() } });
}
