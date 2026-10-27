import Link from "next/link";
import { Award, Download } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { PageHeader, StatCard } from "@/components/shared";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";
import { formatDate, formatPercent } from "@/lib/utils";
import { claimCertificateAction } from "@/server/actions/learning";
import { getLearningContext } from "@/server/learning-context";

export default async function LearnOverviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { course, lessons, standing, certificate, enrollment } = await getLearningContext(slug);
  const nextLesson = lessons.find((l) => !standing?.completedLessonIds.has(l.id)) ?? lessons[0];
  const announcements = await db.announcement.findMany({ where: { courseId: course.id }, orderBy: { createdAt: "desc" }, take: 3 });

  return (
    <>
      <PageHeader
        title={course.title}
        eyebrow={`Instructor: ${course.instructor.name}`}
        actions={
          nextLesson && (
            <Button asChild>
              <Link href={`/learn/${course.slug}/lessons/${nextLesson.id}`}>
                {standing && standing.completedLessonIds.size > 0 ? "Continue learning" : "Start learning"}
              </Link>
            </Button>
          )
        }
      />

      {standing && enrollment && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Progress" value={formatPercent(standing.evaluation.progress)} hint={`${standing.completedLessonIds.size} of ${standing.totalLessons} lessons`} />
            <StatCard label="Course grade" value={formatPercent(standing.evaluation.grade)} hint="Average best score on required quizzes" />
            <StatCard label="Status" value={enrollment.status === "COMPLETED" ? "Completed" : "In progress"} hint={enrollment.completedAt ? `Completed ${formatDate(enrollment.completedAt)}` : undefined} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="text-primary size-5" aria-hidden /> Certificate
              </CardTitle>
              <CardDescription>Certificates are issued automatically once every completion requirement is met.</CardDescription>
            </CardHeader>
            <CardContent>
              {certificate ? (
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="success">Issued {formatDate(certificate.issuedAt)}</Badge>
                  <Button asChild size="sm">
                    <a href={`/api/certificates/${certificate.id}`} download>
                      <Download aria-hidden /> Download certificate (PDF)
                    </a>
                  </Button>
                  <Link href={`/certificates/${certificate.code}`} className="text-primary text-sm hover:underline">
                    Verification page
                  </Link>
                </div>
              ) : standing.evaluation.eligible ? (
                <ActionForm action={claimCertificateAction.bind(null, course.id)}>
                  <SubmitButton pendingText="Issuing…">Claim certificate</SubmitButton>
                </ActionForm>
              ) : (
                <div className="space-y-2 text-sm">
                  <p className="font-medium">Remaining requirements</p>
                  <ul className="text-muted-foreground list-disc space-y-1 pl-5">
                    {standing.evaluation.unmet.map((u) => (
                      <li key={u}>{u}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {standing.quizzes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Quizzes and grades</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quiz</TableHead>
                      <TableHead>Pass mark</TableHead>
                      <TableHead>Best score</TableHead>
                      <TableHead>Attempts</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {standing.quizzes.map((q) => (
                      <TableRow key={q.quizId}>
                        <TableCell>
                          <Link href={`/learn/${course.slug}/quizzes/${q.quizId}`} className="hover:underline">
                            {q.title}
                          </Link>
                          {!q.isRequired && <span className="text-muted-foreground ml-1 text-xs">(optional)</span>}
                        </TableCell>
                        <TableCell>{q.passingScore}%</TableCell>
                        <TableCell>{formatPercent(q.bestPercentage)}</TableCell>
                        <TableCell>
                          {q.attempts}
                          {q.maxAttempts !== null && ` / ${q.maxAttempts}`}
                        </TableCell>
                        <TableCell>
                          {q.passed ? <Badge variant="success">Passed</Badge> : q.attempts > 0 ? <Badge variant="destructive">Not passed</Badge> : <Badge variant="secondary">Not started</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!enrollment && (
        <Alert variant="info">You are previewing this course. Learner progress appears here for enrolled students.</Alert>
      )}

      {announcements.length > 0 && (
        <section className="mt-8" aria-labelledby="recent-announcements">
          <h2 id="recent-announcements" className="mb-3 text-lg font-semibold">
            Recent announcements
          </h2>
          <ul className="space-y-3">
            {announcements.map((a) => (
              <li key={a.id} className="rounded-lg border p-4">
                <p className="font-medium">{a.title}</p>
                <p className="text-muted-foreground text-xs">{formatDate(a.createdAt, true)}</p>
                <p className="mt-2 text-sm whitespace-pre-line">{a.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
