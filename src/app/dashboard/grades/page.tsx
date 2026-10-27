import Link from "next/link";
import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";
import { formatDate, formatPercent } from "@/lib/utils";
import { requireUser } from "@/server/session";
import { getStudentDashboard } from "@/server/services/progress";

export const metadata: Metadata = { title: "My grades" };

/** A learner's own grades only: every query is scoped to the signed-in user. */
export default async function GradesPage() {
  const user = await requireUser();
  const [items, attempts] = await Promise.all([
    getStudentDashboard(db, user),
    db.quizAttempt.findMany({
      where: { userId: user.id },
      orderBy: { submittedAt: "desc" },
      include: { quiz: { select: { id: true, title: true, course: { select: { slug: true } } } } },
    }),
  ]);

  return (
    <>
      <PageHeader title="My grades" description="Course grades are the average of your best scores on required quizzes." />
      {items.length === 0 ? (
        <EmptyState title="No grades yet" description="Enroll in a course and take a quiz to see your grades here." />
      ) : (
        <div className="space-y-6">
          {items.map(({ enrollment, standing }) => {
            const courseAttempts = attempts.filter((a) => a.quiz.course.slug === enrollment.course.slug);
            return (
              <Card key={enrollment.id}>
                <CardHeader>
                  <CardTitle>
                    <Link href={`/learn/${enrollment.course.slug}`} className="hover:underline">
                      {enrollment.course.title}
                    </Link>
                  </CardTitle>
                  <CardDescription>
                    Course grade {formatPercent(standing.evaluation.grade)} · Progress {formatPercent(standing.evaluation.progress)}
                    {enrollment.status === "COMPLETED" && " · Completed"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {courseAttempts.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No quiz attempts yet.</p>
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
                        {courseAttempts.map((a) => (
                          <TableRow key={a.id}>
                            <TableCell>
                              <Link href={`/learn/${a.quiz.course.slug}/quizzes/${a.quiz.id}/attempts/${a.id}`} className="hover:underline">
                                {a.quiz.title}
                              </Link>
                            </TableCell>
                            <TableCell>#{a.attemptNumber}</TableCell>
                            <TableCell>{formatDate(a.submittedAt, true)}</TableCell>
                            <TableCell>{formatPercent(Number(a.percentage))}</TableCell>
                            <TableCell>{a.passed ? <Badge variant="success">Passed</Badge> : <Badge variant="destructive">Not passed</Badge>}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
