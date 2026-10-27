import Link from "next/link";
import { ArrowDown, ArrowUp, ClipboardCheck, FileText, Paperclip, Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { LessonFields, QuizFields } from "@/components/instructor/forms";
import { FormField } from "@/components/form-field";
import { EmptyState } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import {
  createLessonAction,
  createModuleAction,
  deleteModuleAction,
  moveLessonAction,
  moveModuleAction,
  renameModuleAction,
} from "@/server/actions/courses";
import { createQuizAction } from "@/server/actions/quizzes";
import { guard } from "@/server/page-guard";
import { requireRole } from "@/server/session";
import { getCourseForEditing } from "@/server/services/courses";

export default async function CourseContentPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const user = await requireRole("INSTRUCTOR", "ADMIN");
  const { course } = await guard(() => getCourseForEditing(db, user, courseId));
  const base = `/instructor/courses/${course.id}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <section aria-labelledby="modules-heading" className="space-y-4">
        <h2 id="modules-heading" className="text-lg font-semibold">
          Modules and lessons
        </h2>
        {course.modules.length === 0 && <EmptyState title="No modules yet" description="Add a module to start building your course." />}
        {course.modules.map((m, mi) => (
          <Card key={m.id}>
            <CardHeader className="gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>
                  Module {mi + 1}: {m.title}
                </CardTitle>
                <div className="flex items-center gap-1">
                  <ActionForm action={moveModuleAction.bind(null, m.id, "up")} showSuccess={false}>
                    <SubmitButton variant="ghost" size="icon" aria-label={`Move module ${m.title} up`} disabled={mi === 0}>
                      <ArrowUp aria-hidden />
                    </SubmitButton>
                  </ActionForm>
                  <ActionForm action={moveModuleAction.bind(null, m.id, "down")} showSuccess={false}>
                    <SubmitButton variant="ghost" size="icon" aria-label={`Move module ${m.title} down`} disabled={mi === course.modules.length - 1}>
                      <ArrowDown aria-hidden />
                    </SubmitButton>
                  </ActionForm>
                  <ActionForm action={deleteModuleAction.bind(null, m.id)} confirm={`Delete module "${m.title}" and all of its lessons?`} showSuccess={false}>
                    <SubmitButton variant="ghost" size="icon" aria-label={`Delete module ${m.title}`}>
                      <Trash2 aria-hidden />
                    </SubmitButton>
                  </ActionForm>
                </div>
              </div>
              <details>
                <summary className="text-muted-foreground cursor-pointer text-sm">Rename module</summary>
                <ActionForm action={renameModuleAction.bind(null, m.id)} className="mt-2 flex gap-2">
                  <Input name="title" defaultValue={m.title} aria-label="Module title" required minLength={2} maxLength={120} />
                  <SubmitButton variant="secondary">Rename</SubmitButton>
                </ActionForm>
              </details>
            </CardHeader>
            <CardContent className="space-y-4">
              {m.lessons.length === 0 ? (
                <p className="text-muted-foreground text-sm">No lessons in this module yet.</p>
              ) : (
                <ol className="divide-y rounded-md border">
                  {m.lessons.map((l, li) => (
                    <li key={l.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <Link href={`${base}/lessons/${l.id}`} className="flex min-w-0 items-center gap-2 text-sm hover:underline">
                        <FileText className="size-4 shrink-0" aria-hidden />
                        <span className="truncate">{l.title}</span>
                        {l._count.resources > 0 && (
                          <span className="text-muted-foreground flex items-center text-xs">
                            <Paperclip className="size-3" aria-label="attachments" />
                            {l._count.resources}
                          </span>
                        )}
                        {l.dueAt && <span className="text-muted-foreground text-xs">due {formatDate(l.dueAt)}</span>}
                      </Link>
                      <div className="flex shrink-0">
                        <ActionForm action={moveLessonAction.bind(null, l.id, "up")} showSuccess={false}>
                          <SubmitButton variant="ghost" size="icon" aria-label={`Move lesson ${l.title} up`} disabled={li === 0}>
                            <ArrowUp aria-hidden />
                          </SubmitButton>
                        </ActionForm>
                        <ActionForm action={moveLessonAction.bind(null, l.id, "down")} showSuccess={false}>
                          <SubmitButton variant="ghost" size="icon" aria-label={`Move lesson ${l.title} down`} disabled={li === m.lessons.length - 1}>
                            <ArrowDown aria-hidden />
                          </SubmitButton>
                        </ActionForm>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              <details className="rounded-md border p-3">
                <summary className="cursor-pointer text-sm font-medium">Add a lesson to {m.title}</summary>
                <ActionForm action={createLessonAction.bind(null, m.id)} className="mt-4 grid gap-4" aria-label={`Add lesson to ${m.title}`}>
                  <LessonFields />
                  <div>
                    <SubmitButton pendingText="Adding…">Add lesson</SubmitButton>
                  </div>
                </ActionForm>
              </details>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardHeader>
            <CardTitle>Add module</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={createModuleAction.bind(null, course.id)} className="flex flex-col gap-2 sm:flex-row sm:items-end" resetOnSuccess aria-label="Add module">
              <div className="flex-1">
                <FormField id="module-title" name="title" label="Module title">
                  <Input id="module-title" name="title" required minLength={2} maxLength={120} />
                </FormField>
              </div>
              <SubmitButton pendingText="Adding…">Add module</SubmitButton>
            </ActionForm>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="quizzes-heading" className="space-y-4">
        <h2 id="quizzes-heading" className="text-lg font-semibold">
          Quizzes
        </h2>
        {course.quizzes.length === 0 ? (
          <p className="text-muted-foreground text-sm">No quizzes yet.</p>
        ) : (
          <ul className="space-y-2">
            {course.quizzes.map((q) => (
              <li key={q.id}>
                <Link href={`${base}/quizzes/${q.id}`} className="hover:bg-accent block rounded-md border p-3">
                  <span className="flex items-center gap-2 font-medium">
                    <ClipboardCheck className="text-primary size-4" aria-hidden /> {q.title}
                  </span>
                  <span className="text-muted-foreground mt-1 flex flex-wrap gap-2 text-xs">
                    <span>{q._count.questions} questions</span>
                    <span>pass {q.passingScore}%</span>
                    <span>{q._count.attempts} attempts</span>
                    {q.module && <span>· {q.module.title}</span>}
                    {q._count.questions === 0 && <Badge variant="warning">Needs questions</Badge>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Card>
          <CardHeader>
            <CardTitle>New quiz</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={createQuizAction.bind(null, course.id)} className="grid gap-4" aria-label="New quiz">
              <QuizFields modules={course.modules} />
              <div>
                <SubmitButton pendingText="Creating…">Create quiz</SubmitButton>
              </div>
            </ActionForm>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
