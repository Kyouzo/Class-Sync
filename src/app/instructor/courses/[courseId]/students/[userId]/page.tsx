import Link from "next/link";
import { StatCard } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";
import { formatDate, formatPercent } from "@/lib/utils";
import { guard } from "@/server/page-guard";
import { requireRole } from "@/server/session";
import { getLearnerReport } from "@/server/services/progress";

export default async function LearnerReportPage({ params }: { params: Promise<{ courseId: string; userId: string }> }) {
  const { courseId, userId } = await params;
  const user = await requireRole("INSTRUCTOR", "ADMIN");
  const { course, enrollment, standing, attempts } = await guard(() => getLearnerReport(db, user, courseId, userId));

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/instructor/courses/${courseId}/students`} className="text-muted-foreground text-sm hover:underline">
          ← All students
        </Link>
        <h2 className="text-xl font-semibold">{enrollment.user.name}</h2>
        <p className="text-muted-foreground text-sm">
          {enrollment.user.email} · enrolled {formatDate(enrollment.enrolledAt)}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Progress" value={formatPercent(standing.evaluation.progress)} hint={`${standing.completedLessonIds.size}/${standing.totalLessons} lessons`} />
        <StatCard label="Course grade" value={formatPercent(standing.evaluation.grade)} />
        <StatCard
          label="Status"
          value={enrollment.completedAt ? "Completed" : "In progress"}
          hint={enrollment.certificate ? `Certificate ${enrollment.certificate.code}` : standing.evaluation.unmet[0]}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Quiz attempts</CardTitle>
        </CardHeader>
        <CardContent>
          {attempts.length === 0 ? (
            <p className="text-muted-foreground text-sm">No attempts yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quiz</TableHead>
                  <TableHead>Attempt</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link href={`/learn/${course.slug}/quizzes/${a.quizId}/attempts/${a.id}`} className="hover:underline">
                        {a.quiz.title}
                      </Link>
                    </TableCell>
                    <TableCell>#{a.attemptNumber}</TableCell>
                    <TableCell>{formatDate(a.submittedAt, true)}</TableCell>
                    <TableCell>
                      {a.score}/{a.maxScore} ({formatPercent(Number(a.percentage))})
                    </TableCell>
                    <TableCell>{a.passed ? <Badge variant="success">Passed</Badge> : <Badge variant="destructive">Not passed</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
