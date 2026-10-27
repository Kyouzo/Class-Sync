import Link from "next/link";
import type { Metadata } from "next";
import { CalendarClock, Megaphone, TriangleAlert } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/shared";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { requireUser } from "@/server/session";
import { DEADLINE_WINDOW_DAYS, getNotifications, markNotificationsSeen } from "@/server/services/notifications";

export const metadata: Metadata = { title: "Notifications" };

const icons = { overdue: TriangleAlert, deadline: CalendarClock, announcement: Megaphone };

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await getNotifications(db, user);
  await markNotificationsSeen(db, user);

  return (
    <>
      <PageHeader
        title="Notifications"
        description={`Outstanding deadlines within ${DEADLINE_WINDOW_DAYS} days and recent announcements from your courses.`}
      />
      {notifications.length === 0 ? (
        <EmptyState title="You're all caught up" />
      ) : (
        <ul className="divide-y rounded-lg border">
          {notifications.map((n) => {
            const Icon = icons[n.kind];
            return (
              <li key={n.id}>
                <Link href={n.href} className="hover:bg-accent flex items-start gap-3 p-4">
                  <Icon className={`mt-0.5 size-5 shrink-0 ${n.kind === "overdue" ? "text-destructive" : "text-primary"}`} aria-hidden />
                  <span className="min-w-0">
                    <span className="block font-medium">{n.title}</span>
                    <span className="text-muted-foreground block text-sm">
                      {n.detail} · {n.kind === "announcement" ? `Posted ${formatDate(n.date)}` : `Due ${formatDate(n.date, true)} UTC`}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
