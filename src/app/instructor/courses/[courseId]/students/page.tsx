import Link from "next/link";
import { ProgressDistributionChart, QuizResultsChart } from "@/components/instructor/charts";
import { EmptyState, StatCard } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";
import { formatDate, formatPercent } from "@/lib/utils";
import { guard } from "@/server/page-guard";
import { requireRole } from "@/server/session";
import { getCourseRoster } from "@/server/services/analytics";

export default async function StudentsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const user = await requireRole("INSTRUCTOR", "ADMIN");
  const roster = await guard(() => getCourseRoster(db, user, courseId));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Enrolled" value={roster.summary.enrolled} />
        <StatCard label="Completed" value={roster.summary.completed} />
        <StatCard label="Average progress" value={formatPercent(roster.summary.averageProgress)} hint={`${roster.totalLessons} lessons in course`} />
      </div>

      {roster.students.length === 0 ? (
        <EmptyState title="No students enrolled yet" description="Students appear here once they enroll in the published course." />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Progress distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ProgressDistributionChart data={roster.progressDistribution} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Quiz results</CardTitle>
              </CardHeader>
              <CardContent>
                {roster.quizStats.length === 0 ? (
                  <p className="text-muted-foreground text-sm">This course has no quizzes.</p>
                ) : (
                  <QuizResultsChart data={roster.quizStats} />
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Students</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Enrolled</TableHead>
                    <TableHead className="min-w-32">Progress</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roster.students.map((s) => (
                    <TableRow key={s.user.id}>
                      <TableCell>
                        <Link href={`/instructor/courses/${courseId}/students/${s.user.id}`} className="font-medium hover:underline">
                          {s.user.name}
                        </Link>
                        <span className="text-muted-foreground block text-xs">{s.user.email}</span>
                      </TableCell>
                      <TableCell>{formatDate(s.enrolledAt)}</TableCell>
                      <TableCell>
                        <Progress value={s.progress} label={`${s.user.name} progress`} />
                        <span className="text-muted-foreground text-xs">{formatPercent(s.progress)}</span>
                      </TableCell>
                      <TableCell>{formatPercent(s.grade)}</TableCell>
                      <TableCell>
                        {s.completedAt ? <Badge variant="success">Completed</Badge> : <Badge variant="secondary">In progress</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {roster.quizStats.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Assessment summary</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quiz</TableHead>
                      <TableHead>Pass mark</TableHead>
                      <TableHead>Students attempted</TableHead>
                      <TableHead>Average best score</TableHead>
                      <TableHead>Pass rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roster.quizStats.map((q) => (
                      <TableRow key={q.id}>
                        <TableCell>{q.title}</TableCell>
                        <TableCell>{q.passingScore}%</TableCell>
                        <TableCell>{q.attempted}</TableCell>
                        <TableCell>{formatPercent(q.averageBest)}</TableCell>
                        <TableCell>{formatPercent(q.passRate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
