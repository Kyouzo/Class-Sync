"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { initialActionState, type ActionState } from "@/server/actions/result";

export type QuizQuestionView = {
  id: string;
  prompt: string;
  points: number;
  choices: { id: string; text: string }[];
};

/**
 * Renders a quiz for answering. It only ever receives question prompts and choice text, never which
 * choice is correct; grading happens on the server.
 */
export function QuizForm({
  questions,
  action,
}: {
  questions: QuizQuestionView[];
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const answered = questions.filter((q) => answers[q.id]).length;
  const complete = answered === questions.length;

  return (
    <form action={formAction} className="space-y-6" aria-label="Quiz">
      <ol className="space-y-6">
        {questions.map((q, i) => (
          <li key={q.id}>
            <fieldset className="rounded-lg border p-4">
              <legend className="px-1 font-medium">
                {i + 1}. {q.prompt}
                <span className="text-muted-foreground ml-2 text-xs font-normal">
                  ({q.points} {q.points === 1 ? "point" : "points"})
                </span>
              </legend>
              <div className="mt-2 grid gap-2">
                {q.choices.map((c) => (
                  <label
                    key={c.id}
                    className="hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-accent flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm"
                  >
                    <input
                      type="radio"
                      name={`answer:${q.id}`}
                      value={c.id}
                      required
                      className="accent-primary mt-0.5"
                      onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: c.id }))}
                    />
                    <span>{c.text}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>
      {state.error && (
        <p role="alert" className="text-destructive flex items-center gap-2 text-sm">
          <CircleAlert className="size-4" aria-hidden /> {state.error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <SubmitQuiz disabled={!complete} />
        <p className="text-muted-foreground text-sm" aria-live="polite">
          {answered} of {questions.length} answered
        </p>
      </div>
    </form>
  );
}

function SubmitQuiz({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending}>
      {pending && <LoaderCircle className="animate-spin" aria-hidden />}
      {pending ? "Submitting…" : "Submit answers"}
    </Button>
  );
}
