import Link from "next/link";
import type { Metadata } from "next";
import { CalendarClock, Megaphone } from "lucide-react";
import { EmptyState, PageHeader, StatCard } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { db } from "@/lib/db";
import { formatDate, formatPercent } from "@/lib/utils";
import { requireUser } from "@/server/session";
import { getNotifications } from "@/server/services/notifications";
import { getStudentDashboard } from "@/server/services/progress";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const [items, notifications] = await Promise.all([getStudentDashboard(db, user), getNotifications(db, user)]);
  const completed = items.filter((i) => i.enrollment.status === "COMPLETED").length;
  const avgProgress = items.length ? items.reduce((sum, i) => sum + i.standing.evaluation.progress, 0) / items.length : 0;
  const deadlines = notifications.filter((n) => n.kind !== "announcement").slice(0, 5);
  const announcements = notifications.filter((n) => n.kind === "announcement").slice(0, 3);

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        description="Your courses, progress and upcoming deadlines."
        actions={
          (user.role === "INSTRUCTOR" || user.role === "ADMIN") && (
            <Button asChild variant="outline">
              <Link href="/instructor">Instructor dashboard</Link>
            </Button>
          )
        }
      />
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Enrolled courses" value={items.length} />
        <StatCard label="Completed" value={completed} />
        <StatCard label="Average progress" value={formatPercent(avgProgress)} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <section aria-labelledby="my-courses">
          <h2 id="my-courses" className="mb-4 text-lg font-semibold">
            My courses
          </h2>
          {items.length === 0 ? (
            <EmptyState
              title="You are not enrolled in any courses yet"
              description={user.role === "STUDENT" ? "Browse the catalog to find something to learn." : "Only student accounts can enroll in courses."}
              action={
                <Button asChild>
                  <Link href="/courses">Browse courses</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {items.map(({ enrollment, standing }) => (
                <Card key={enrollment.id}>
                  <CardHeader>
                    <div className="flex flex-wrap gap-2">
                      {enrollment.course.category && <Badge variant="secondary">{enrollment.course.category.name}</Badge>}
                      {enrollment.status === "COMPLETED" && <Badge variant="success">Completed</Badge>}
                      {enrollment.course.status === "ARCHIVED" && <Badge variant="outline">Archived</Badge>}
                    </div>
                    <CardTitle>{enrollment.course.title}</CardTitle>
                    <CardDescription className="line-clamp-2">{enrollment.course.summary}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Progress value={standing.evaluation.progress} label={`${enrollment.course.title} progress`} />
                    <p className="text-muted-foreground flex justify-between text-xs">
                      <span>{formatPercent(standing.evaluation.progress)} complete</span>
                      <span>Grade {formatPercent(standing.evaluation.grade)}</span>
                    </p>
                  </CardContent>
                  <CardFooter className="mt-auto gap-2">
                    <Button asChild size="sm">
                      <Link href={`/learn/${enrollment.course.slug}`}>{enrollment.status === "COMPLETED" ? "Review" : "Continue"}</Link>
                    </Button>
                    {enrollment.certificate && (
                      <Button asChild size="sm" variant="outline">
                        <a href={`/api/certificates/${enrollment.certificate.id}`} download>
                          Certificate
                        </a>
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <section aria-labelledby="deadlines">
            <h2 id="deadlines" className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <CalendarClock className="size-5" aria-hidden /> Deadlines
            </h2>
            {deadlines.length === 0 ? (
              <p className="text-muted-foreground text-sm">No upcoming deadlines.</p>
            ) : (
              <ul className="space-y-2">
                {deadlines.map((d) => (
                  <li key={d.id}>
                    <Link href={d.href} className="hover:bg-accent block rounded-md border p-3 text-sm">
                      <span className={d.kind === "overdue" ? "text-destructive font-medium" : "font-medium"}>{d.title}</span>
                      <span className="text-muted-foreground block text-xs">
                        {d.detail} · {formatDate(d.date, true)} UTC
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="latest-announcements">
            <h2 id="latest-announcements" className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <Megaphone className="size-5" aria-hidden /> Announcements
            </h2>
            {announcements.length === 0 ? (
              <p className="text-muted-foreground text-sm">No recent announcements.</p>
            ) : (
              <ul className="space-y-2">
                {announcements.map((a) => (
                  <li key={a.id}>
                    <Link href={a.href} className="hover:bg-accent block rounded-md border p-3 text-sm">
                      <span className="font-medium">{a.title}</span>
                      <span className="text-muted-foreground block text-xs">
                        {a.detail} · {formatDate(a.date)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
