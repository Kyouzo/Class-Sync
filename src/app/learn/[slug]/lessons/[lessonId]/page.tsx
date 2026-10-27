import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, ChevronLeft, ChevronRight, Clock, Download, FileText, Target } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Markdown, PageHeader } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { formatBytes, formatDate } from "@/lib/utils";
import { setLessonCompletionAction } from "@/server/actions/learning";
import { getLearningContext } from "@/server/learning-context";

export default async function LessonPage({ params }: { params: Promise<{ slug: string; lessonId: string }> }) {
  const { slug, lessonId } = await params;
  const { course, lessons, standing, enrollment } = await getLearningContext(slug);
  const index = lessons.findIndex((l) => l.id === lessonId);
  if (index === -1) notFound();
  const lesson = await db.lesson.findUniqueOrThrow({
    where: { id: lessonId },
    include: { module: { select: { title: true } }, resources: { orderBy: { createdAt: "asc" } } },
  });
  const completed = standing?.completedLessonIds.has(lesson.id) ?? false;
  const prev = lessons[index - 1];
  const next = lessons[index + 1];
  const base = `/learn/${course.slug}`;

  return (
    <article>
      <PageHeader
        eyebrow={lesson.module.title}
        title={lesson.title}
        description={
          <span className="flex flex-wrap items-center gap-3 text-sm">
            {lesson.estimatedMinutes && (
              <span className="flex items-center gap-1">
                <Clock className="size-4" aria-hidden /> {lesson.estimatedMinutes} min
              </span>
            )}
            {lesson.dueAt && (
              <span className="flex items-center gap-1">
                <CalendarClock className="size-4" aria-hidden /> Due {formatDate(lesson.dueAt, true)} UTC
              </span>
            )}
            {completed && <Badge variant="success">Completed</Badge>}
          </span>
        }
      />

      {lesson.objectives.length > 0 && (
        <section aria-labelledby="lesson-objectives" className="bg-accent/50 mb-6 rounded-lg border p-4">
          <h2 id="lesson-objectives" className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Target className="size-4" aria-hidden /> Learning objectives
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {lesson.objectives.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </section>
      )}

      <Markdown>{lesson.content}</Markdown>

      {lesson.resources.length > 0 && (
        <section aria-labelledby="resources" className="mt-8">
          <h2 id="resources" className="mb-3 text-lg font-semibold">
            Resources
          </h2>
          <ul className="divide-y rounded-lg border">
            {lesson.resources.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 p-3">
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <FileText className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">{r.fileName}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">{formatBytes(r.sizeBytes)}</span>
                </span>
                <Button asChild size="sm" variant="outline">
                  <a href={`/api/resources/${r.id}`} download={r.fileName}>
                    <Download aria-hidden /> Download
                  </a>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-10 flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
        {enrollment ? (
          <ActionForm action={setLessonCompletionAction.bind(null, lesson.id, !completed)}>
            <SubmitButton variant={completed ? "outline" : "default"} pendingText="Saving…">
              {completed ? "Mark as incomplete" : "Mark as complete"}
            </SubmitButton>
          </ActionForm>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          {prev && (
            <Button asChild variant="outline" size="sm">
              <Link href={`${base}/lessons/${prev.id}`}>
                <ChevronLeft aria-hidden /> Previous
              </Link>
            </Button>
          )}
          {next && (
            <Button asChild variant="outline" size="sm">
              <Link href={`${base}/lessons/${next.id}`}>
                Next <ChevronRight aria-hidden />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
