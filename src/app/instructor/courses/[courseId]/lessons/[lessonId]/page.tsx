import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { LessonFields } from "@/components/instructor/forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/db";
import { ALLOWED_ATTACHMENTS, maxUploadBytes } from "@/lib/storage";
import { formatBytes } from "@/lib/utils";
import { deleteLessonAction, deleteResourceAction, updateLessonAction, uploadResourceAction } from "@/server/actions/courses";
import { guard } from "@/server/page-guard";
import { requireRole } from "@/server/session";
import { requireManagedLesson } from "@/server/services/courses";

export default async function EditLessonPage({ params }: { params: Promise<{ courseId: string; lessonId: string }> }) {
  const { courseId, lessonId } = await params;
  const user = await requireRole("INSTRUCTOR", "ADMIN");
  const lesson = await guard(() => requireManagedLesson(db, user, lessonId));
  if (lesson.module.courseId !== courseId) notFound();

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <Card>
        <CardHeader>
          <Link href={`/instructor/courses/${courseId}/content`} className="text-muted-foreground text-sm hover:underline">
            ← {lesson.module.title}
          </Link>
          <CardTitle>Edit lesson</CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm action={updateLessonAction.bind(null, lesson.id)} className="grid gap-6" aria-label="Edit lesson">
            <LessonFields lesson={lesson} />
            <div className="flex flex-wrap gap-2">
              <SubmitButton pendingText="Saving…">Save lesson</SubmitButton>
              <Link href={`/learn/${lesson.module.course.slug}/lessons/${lesson.id}`} className="text-primary self-center text-sm hover:underline">
                Preview as learner
              </Link>
            </div>
          </ActionForm>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Downloadable resources</CardTitle>
            <CardDescription>
              Up to {formatBytes(maxUploadBytes())}. Allowed: {Object.keys(ALLOWED_ATTACHMENTS).join(", ")}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {lesson.resources.length > 0 && (
              <ul className="divide-y rounded-md border text-sm">
                {lesson.resources.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <a href={`/api/resources/${r.id}`} className="flex min-w-0 items-center gap-2 hover:underline">
                      <FileText className="size-4 shrink-0" aria-hidden />
                      <span className="truncate">{r.fileName}</span>
                    </a>
                    <ActionForm action={deleteResourceAction.bind(null, r.id)} confirm={`Remove ${r.fileName}?`} showSuccess={false}>
                      <SubmitButton variant="ghost" size="icon" aria-label={`Remove ${r.fileName}`}>
                        <Trash2 aria-hidden />
                      </SubmitButton>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            )}
            <ActionForm action={uploadResourceAction.bind(null, lesson.id)} encType="multipart/form-data" className="grid gap-2" resetOnSuccess aria-label="Upload resource">
              <Input type="file" name="file" required aria-label="File" accept={Object.keys(ALLOWED_ATTACHMENTS).map((e) => `.${e}`).join(",")} />
              <div>
                <SubmitButton variant="secondary" pendingText="Uploading…">
                  Upload
                </SubmitButton>
              </div>
            </ActionForm>
          </CardContent>
        </Card>
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>Delete lesson</CardTitle>
            <CardDescription>Also removes learner progress for this lesson.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm action={deleteLessonAction.bind(null, lesson.id)} confirm="Delete this lesson?">
              <SubmitButton variant="destructive">Delete lesson</SubmitButton>
            </ActionForm>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
