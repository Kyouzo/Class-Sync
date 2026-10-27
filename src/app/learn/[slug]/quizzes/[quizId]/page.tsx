import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { QuizForm } from "@/components/quiz-form";
import { PageHeader } from "@/components/shared";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";
import { formatDate, formatPercent } from "@/lib/utils";
import { submitQuizAction } from "@/server/actions/quizzes";
import { getLearningContext } from "@/server/learning-context";
import { guard } from "@/server/page-guard";
import { getQuizForLearner } from "@/server/services/quizzes";

export default async function QuizPage({ params }: { params: Promise<{ slug: string; quizId: string }> }) {
  const { slug, quizId } = await params;
  const { user, course } = await getLearningContext(slug);
  const { quiz, attempts, attemptsRemaining, canSubmit, enrollment, course: quizCourse } = await guard(
    () => getQuizForLearner(db, user, quizId),
    { forbiddenRedirect: `/courses/${slug}` },
  );
  if (quizCourse.id !== course.id) notFound();
  const passed = attempts.some((a) => a.passed);

  return (
    <>
      <PageHeader
        title={quiz.title}
        eyebrow="Quiz"
        description={
          <span className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline">Pass mark {quiz.passingScore}%</Badge>
            <Badge variant="outline">{quiz.questions.length} questions</Badge>
            <Badge variant="outline">{quiz.maxAttempts === null ? "Unlimited attempts" : `${quiz.maxAttempts} attempts allowed`}</Badge>
            {!quiz.isRequired && <Badge variant="secondary">Optional</Badge>}
            {passed && <Badge variant="success">Passed</Badge>}
            {quiz.dueAt && (
              <span className="flex items-center gap-1">
                <CalendarClock className="size-4" aria-hidden /> Due {formatDate(quiz.dueAt, true)} UTC
              </span>
            )}
          </span>
        }
      />
      {quiz.description && <p className="text-muted-foreground mb-6">{quiz.description}</p>}

      {attempts.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Attempt history</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>
                    <span className="sr-only">Review</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.attemptNumber}</TableCell>
                    <TableCell>{formatDate(a.submittedAt, true)}</TableCell>
                    <TableCell>
                      {a.score}/{a.maxScore} ({formatPercent(Number(a.percentage))})
                    </TableCell>
                    <TableCell>{a.passed ? <Badge variant="success">Passed</Badge> : <Badge variant="destructive">Not passed</Badge>}</TableCell>
                    <TableCell>
                      <Link href={`/learn/${course.slug}/quizzes/${quiz.id}/attempts/${a.id}`} className="text-primary text-sm hover:underline">
                        Review
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {canSubmit ? (
        <section aria-labelledby="take-quiz">
          <h2 id="take-quiz" className="mb-4 text-lg font-semibold">
            {attempts.length > 0 ? "Try again" : "Answer the questions"}
            {attemptsRemaining !== null && <span className="text-muted-foreground ml-2 text-sm font-normal">({attemptsRemaining} attempts remaining)</span>}
          </h2>
          <QuizForm questions={quiz.questions} action={submitQuizAction.bind(null, quiz.id)} />
        </section>
      ) : !enrollment ? (
        <Alert variant="info">Quiz preview: {quiz.questions.length} questions. Only enrolled students can submit answers.</Alert>
      ) : attemptsRemaining === 0 ? (
        <Alert variant="info">You have used all of your attempts for this quiz.</Alert>
      ) : (
        <Alert variant="info">This quiz is not accepting submissions.</Alert>
      )}
    </>
  );
}
