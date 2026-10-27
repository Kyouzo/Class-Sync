import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheck, CircleX } from "lucide-react";
import { PageHeader, StatCard } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { cn, formatDate, formatPercent } from "@/lib/utils";
import { getLearningContext } from "@/server/learning-context";
import { guard } from "@/server/page-guard";
import { getAttemptReview } from "@/server/services/quizzes";

/** Review of a submitted attempt. Correct answers are revealed only here, after submission. */
export default async function AttemptReviewPage({ params }: { params: Promise<{ slug: string; quizId: string; attemptId: string }> }) {
  const { slug, quizId, attemptId } = await params;
  const { user, course } = await getLearningContext(slug);
  const attempt = await guard(() => getAttemptReview(db, user, attemptId));
  if (attempt.quizId !== quizId || attempt.quiz.course.id !== course.id) notFound();
  const responses = new Map(attempt.responses.map((r) => [r.questionId, r]));

  return (
    <>
      <PageHeader
        eyebrow={`${attempt.quiz.title} · Attempt ${attempt.attemptNumber}${attempt.userId !== user.id ? ` · ${attempt.user.name}` : ""}`}
        title={attempt.passed ? "You passed!" : "Not passed yet"}
        description={`Submitted ${formatDate(attempt.submittedAt, true)} UTC. Pass mark: ${attempt.quiz.passingScore}%.`}
        actions={
          <Button asChild variant="outline">
            <Link href={`/learn/${course.slug}/quizzes/${quizId}`}>Back to quiz</Link>
          </Button>
        }
      />
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Score" value={`${attempt.score}/${attempt.maxScore}`} />
        <StatCard label="Percentage" value={formatPercent(Number(attempt.percentage))} />
        <StatCard label="Result" value={attempt.passed ? <Badge variant="success">Passed</Badge> : <Badge variant="destructive">Not passed</Badge>} />
      </div>

      <ol className="space-y-4">
        {attempt.quiz.questions.map((q, i) => {
          const response = responses.get(q.id);
          return (
            <li key={q.id} className="rounded-lg border p-4">
              <p className="flex items-start gap-2 font-medium">
                {response?.isCorrect ? (
                  <CircleCheck className="text-success mt-0.5 size-5 shrink-0" aria-label="Correct" />
                ) : (
                  <CircleX className="text-destructive mt-0.5 size-5 shrink-0" aria-label="Incorrect" />
                )}
                <span>
                  {i + 1}. {q.prompt}
                </span>
              </p>
              <ul className="mt-3 grid gap-2 text-sm">
                {q.choices.map((c) => {
                  const chosen = response?.choiceId === c.id;
                  return (
                    <li
                      key={c.id}
                      className={cn(
                        "rounded-md border px-3 py-2",
                        c.isCorrect && "border-success bg-success/10",
                        chosen && !c.isCorrect && "border-destructive bg-destructive/10",
                      )}
                    >
                      {c.text}
                      {chosen && <span className="ml-2 text-xs font-medium">(your answer)</span>}
                      {c.isCorrect && <span className="text-success ml-2 text-xs font-medium">(correct answer)</span>}
                    </li>
                  );
                })}
              </ul>
              {!response?.choiceId && response && <p className="text-muted-foreground mt-2 text-xs">This question was edited after you answered it.</p>}
              {q.explanation && <p className="text-muted-foreground mt-3 text-sm">{q.explanation}</p>}
            </li>
          );
        })}
      </ol>
    </>
  );
}
