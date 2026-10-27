import type { Category, Course, Lesson, Quiz } from "@prisma/client";
import { FormField } from "@/components/form-field";
import { Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { MAX_CHOICES } from "@/lib/validation";
import { toDateTimeLocal } from "@/lib/utils";

export function CourseFields({ categories, course }: { categories: Category[]; course?: Course }) {
  return (
    <div className="grid gap-4">
      <FormField id="title" label="Title">
        <Input id="title" name="title" required minLength={3} maxLength={120} defaultValue={course?.title} />
      </FormField>
      <FormField id="summary" label="Summary" hint="One or two sentences shown in the catalog.">
        <Textarea id="summary" name="summary" required minLength={10} maxLength={300} rows={2} defaultValue={course?.summary} />
      </FormField>
      <FormField id="description" label="Description" hint="Markdown is supported.">
        <Textarea id="description" name="description" required minLength={10} maxLength={10000} rows={6} defaultValue={course?.description} />
      </FormField>
      <FormField id="objectives" label="Learning objectives" hint="One objective per line.">
        <Textarea id="objectives" name="objectives" rows={4} defaultValue={course?.objectives.join("\n")} />
      </FormField>
      <FormField id="categoryId" label="Category">
        <NativeSelect id="categoryId" name="categoryId" defaultValue={course?.categoryId ?? ""}>
          <option value="">Uncategorised</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </FormField>
    </div>
  );
}

export function LessonFields({ lesson }: { lesson?: Lesson }) {
  return (
    <div className="grid gap-4">
      <FormField id="lesson-title" name="title" label="Lesson title">
        <Input id="lesson-title" name="title" required minLength={2} maxLength={160} defaultValue={lesson?.title} />
      </FormField>
      <FormField id="lesson-content" name="content" label="Content" hint="Markdown is supported: headings, lists, links, code blocks and tables.">
        <Textarea id="lesson-content" name="content" required rows={lesson ? 16 : 6} maxLength={50000} defaultValue={lesson?.content} className="font-mono text-sm" />
      </FormField>
      <FormField id="lesson-objectives" name="objectives" label="Learning objectives" hint="One objective per line.">
        <Textarea id="lesson-objectives" name="objectives" rows={3} defaultValue={lesson?.objectives.join("\n")} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="lesson-minutes" name="estimatedMinutes" label="Estimated minutes">
          <Input id="lesson-minutes" name="estimatedMinutes" type="number" min={1} max={600} defaultValue={lesson?.estimatedMinutes ?? ""} />
        </FormField>
        <FormField id="lesson-due" name="dueAt" label="Due date (UTC, optional)">
          <Input id="lesson-due" name="dueAt" type="datetime-local" defaultValue={toDateTimeLocal(lesson?.dueAt)} />
        </FormField>
      </div>
    </div>
  );
}

export function QuizFields({ quiz, modules }: { quiz?: Quiz; modules: { id: string; title: string }[] }) {
  return (
    <div className="grid gap-4">
      <FormField id="quiz-title" name="title" label="Quiz title">
        <Input id="quiz-title" name="title" required minLength={2} maxLength={160} defaultValue={quiz?.title} />
      </FormField>
      <FormField id="quiz-description" name="description" label="Instructions">
        <Textarea id="quiz-description" name="description" rows={2} maxLength={2000} defaultValue={quiz?.description} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField id="quiz-passing" name="passingScore" label="Passing score (%)">
          <Input id="quiz-passing" name="passingScore" type="number" min={0} max={100} required defaultValue={quiz?.passingScore ?? 70} />
        </FormField>
        <FormField id="quiz-attempts" name="maxAttempts" label="Max attempts" hint="Leave blank for unlimited.">
          <Input id="quiz-attempts" name="maxAttempts" type="number" min={1} max={100} defaultValue={quiz?.maxAttempts ?? ""} />
        </FormField>
        <FormField id="quiz-due" name="dueAt" label="Due date (UTC)">
          <Input id="quiz-due" name="dueAt" type="datetime-local" defaultValue={toDateTimeLocal(quiz?.dueAt)} />
        </FormField>
      </div>
      <FormField id="quiz-module" name="moduleId" label="Module">
        <NativeSelect id="quiz-module" name="moduleId" defaultValue={quiz?.moduleId ?? ""}>
          <option value="">Course-level quiz</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <Label>
        <input type="checkbox" name="isRequired" defaultChecked={quiz?.isRequired ?? true} className="accent-primary size-4" />
        Required for course completion and grade
      </Label>
    </div>
  );
}

export function QuestionFields({
  idPrefix,
  question,
}: {
  idPrefix: string;
  question?: { prompt: string; explanation: string; points: number; choices: { text: string; isCorrect: boolean }[] };
}) {
  const choices = Array.from({ length: MAX_CHOICES }, (_, i) => question?.choices[i]);
  const correct = question ? question.choices.findIndex((c) => c.isCorrect) : 0;
  return (
    <div className="grid gap-4">
      <FormField id={`${idPrefix}-prompt`} name="prompt" label="Question">
        <Textarea id={`${idPrefix}-prompt`} name="prompt" required minLength={3} maxLength={1000} rows={2} defaultValue={question?.prompt} />
      </FormField>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Answer choices (select the correct one; blank choices are ignored)</legend>
        {choices.map((choice, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="radio"
              name="correctIndex"
              value={i}
              defaultChecked={i === correct}
              aria-label={`Choice ${i + 1} is correct`}
              className="accent-primary size-4 shrink-0"
            />
            <Input name={`choice${i}`} aria-label={`Choice ${i + 1}`} defaultValue={choice?.text ?? ""} maxLength={500} placeholder={i < 2 ? "Required" : "Optional"} />
          </div>
        ))}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
        <FormField id={`${idPrefix}-points`} name="points" label="Points">
          <Input id={`${idPrefix}-points`} name="points" type="number" min={1} max={100} required defaultValue={question?.points ?? 1} />
        </FormField>
        <FormField id={`${idPrefix}-explanation`} name="explanation" label="Explanation (shown after submission)">
          <Input id={`${idPrefix}-explanation`} name="explanation" maxLength={2000} defaultValue={question?.explanation} />
        </FormField>
      </div>
    </div>
  );
}
