import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheck, Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { QuestionFields, QuizFields } from "@/components/instructor/forms";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { deleteQuestionAction, deleteQuizAction, saveQuestionAction, updateQuizAction } from "@/server/actions/quizzes";
import { guard } from "@/server/page-guard";
import { requireRole } from "@/server/session";
import { getQuizForEditing } from "@/server/services/quizzes";

export default async function EditQuizPage({ params }: { params: Promise<{ courseId: string; quizId: string }> }) {
  const { courseId, quizId } = await params;
  const user = await requireRole("INSTRUCTOR", "ADMIN");
  const quiz = await guard(() => getQuizForEditing(db, user, quizId));
  if (quiz.courseId !== courseId) notFound();

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <section aria-labelledby="questions-heading" className="space-y-4">
        <div>
          <Link href={`/instructor/courses/${courseId}/content`} className="text-muted-foreground text-sm hover:underline">
            ← Content & quizzes
          </Link>
          <h2 id="questions-heading" className="text-lg font-semibold">
            {quiz.title}: questions
          </h2>
        </div>
        {quiz._count.attempts > 0 && (
          <Alert variant="info">
            Learners have submitted {quiz._count.attempts} attempts. Stored grades are never recalculated; edits only affect future attempts.
          </Alert>
        )}
        {quiz.questions.map((q, i) => (
          <Card key={q.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">
                  {i + 1}. {q.prompt}
                </CardTitle>
                <ActionForm action={deleteQuestionAction.bind(null, q.id)} confirm="Delete this question?" showSuccess={false}>
                  <SubmitButton variant="ghost" size="icon" aria-label={`Delete question ${i + 1}`}>
                    <Trash2 aria-hidden />
                  </SubmitButton>
                </ActionForm>
              </div>
              <ul className="text-sm">
                {q.choices.map((c) => (
                  <li key={c.id} className="flex items-center gap-2">
                    {c.isCorrect ? <CircleCheck className="text-success size-4" aria-label="Correct answer" /> : <span className="size-4" />}
                    {c.text}
                  </li>
                ))}
              </ul>
            </CardHeader>
            <CardContent>
              <details>
                <summary className="text-muted-foreground cursor-pointer text-sm">Edit question</summary>
                <ActionForm action={saveQuestionAction.bind(null, quiz.id, q.id)} className="mt-4 grid gap-4" aria-label={`Edit question ${i + 1}`}>
                  <QuestionFields idPrefix={`q-${q.id}`} question={q} />
                  <div>
                    <SubmitButton pendingText="Saving…">Save question</SubmitButton>
                  </div>
                </ActionForm>
              </details>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardHeader>
            <CardTitle>Add question</CardTitle>
            <CardDescription>Multiple choice with exactly one correct answer.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm action={saveQuestionAction.bind(null, quiz.id, null)} className="grid gap-4" resetOnSuccess aria-label="Add question">
              <QuestionFields idPrefix="new-question" />
              <div>
                <SubmitButton pendingText="Adding…">Add question</SubmitButton>
              </div>
            </ActionForm>
          </CardContent>
        </Card>
      </section>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Quiz settings</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={updateQuizAction.bind(null, quiz.id)} className="grid gap-4" aria-label="Quiz settings">
              <QuizFields quiz={quiz} modules={quiz.course.modules} />
              <div>
                <SubmitButton pendingText="Saving…">Save settings</SubmitButton>
              </div>
            </ActionForm>
          </CardContent>
        </Card>
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>Delete quiz</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={deleteQuizAction.bind(null, quiz.id)} confirm="Delete this quiz and all of its attempts?">
              <SubmitButton variant="destructive">Delete quiz</SubmitButton>
            </ActionForm>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
