import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { EnrollmentChart } from "@/components/instructor/charts";
import { EmptyState, PageHeader, StatCard, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { formatDate, formatPercent } from "@/lib/utils";
import { requireRole } from "@/server/session";
import { getInstructorOverview } from "@/server/services/analytics";

export const metadata: Metadata = { title: "Instructor dashboard" };

export default async function InstructorDashboard() {
  const user = await requireRole("INSTRUCTOR", "ADMIN");
  const { courses, recentAttempts } = await getInstructorOverview(db, user);
  const enrolled = courses.reduce((n, c) => n + c.enrolled, 0);
  const completed = courses.reduce((n, c) => n + c.completed, 0);

  return (
    <>
      <PageHeader
        title="Instructor dashboard"
        description={user.role === "ADMIN" ? "All courses on the platform." : "Your courses and learner activity."}
        actions={
          <Button asChild>
            <Link href="/instructor/courses/new">
              <Plus aria-hidden /> New course
            </Link>
          </Button>
        }
      />
      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        <StatCard label="Courses" value={courses.length} />
        <StatCard label="Published" value={courses.filter((c) => c.status === "PUBLISHED").length} />
        <StatCard label="Enrollments" value={enrolled} />
        <StatCard label="Completions" value={completed} hint={enrolled ? `${formatPercent((completed / enrolled) * 100)} completion rate` : undefined} />
      </div>

      {courses.length === 0 ? (
        <EmptyState title="You have not created any courses yet" action={<Button asChild><Link href="/instructor/courses/new">Create your first course</Link></Button>} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Courses</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Enrolled</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courses.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <Link href={`/instructor/courses/${c.id}`} className="hover:underline">
                          {c.title}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={c.status} />
                      </TableCell>
                      <TableCell>{c.enrolled}</TableCell>
                      <TableCell>{c.completed}</TableCell>
                      <TableCell className="space-x-3 text-right whitespace-nowrap">
                        <Link href={`/instructor/courses/${c.id}/students`} className="text-primary text-sm hover:underline">
                          Students
                        </Link>
                        <Link href={`/instructor/courses/${c.id}/content`} className="text-primary text-sm hover:underline">
                          Content
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Enrollments and completions</CardTitle>
            </CardHeader>
            <CardContent>
              <EnrollmentChart data={courses.slice(0, 8)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Recent quiz submissions</CardTitle>
            </CardHeader>
            <CardContent>
              {recentAttempts.length === 0 ? (
                <p className="text-muted-foreground text-sm">No submissions yet.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {recentAttempts.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 py-2">
                      <span className="min-w-0">
                        <span className="font-medium">{a.user.name}</span> · {a.quiz.title}
                        <span className="text-muted-foreground block text-xs">
                          {a.quiz.course.title} · {formatDate(a.submittedAt, true)}
                        </span>
                      </span>
                      <Badge variant={a.passed ? "success" : "destructive"}>{formatPercent(Number(a.percentage))}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
