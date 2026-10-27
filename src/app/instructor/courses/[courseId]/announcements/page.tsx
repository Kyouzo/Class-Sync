import { Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { FormField } from "@/components/form-field";
import { EmptyState } from "@/components/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { createAnnouncementAction, deleteAnnouncementAction } from "@/server/actions/learning";
import { guard } from "@/server/page-guard";
import { requireRole } from "@/server/session";
import { requireManagedCourse } from "@/server/services/access";

export default async function ManageAnnouncementsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const user = await requireRole("INSTRUCTOR", "ADMIN");
  const course = await guard(() => requireManagedCourse(db, user, courseId));
  const announcements = await db.announcement.findMany({ where: { courseId: course.id }, orderBy: { createdAt: "desc" } });

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>New announcement</CardTitle>
          <CardDescription>Enrolled learners see announcements in the course and in their notifications.</CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm action={createAnnouncementAction.bind(null, course.id)} className="grid gap-4" resetOnSuccess aria-label="New announcement">
            <FormField id="announcement-title" name="title" label="Title">
              <Input id="announcement-title" name="title" required minLength={3} maxLength={160} />
            </FormField>
            <FormField id="announcement-body" name="body" label="Message">
              <Textarea id="announcement-body" name="body" required minLength={3} maxLength={5000} rows={5} />
            </FormField>
            <div>
              <SubmitButton pendingText="Posting…">Post announcement</SubmitButton>
            </div>
          </ActionForm>
        </CardContent>
      </Card>
      <section aria-label="Posted announcements">
        {announcements.length === 0 ? (
          <EmptyState title="No announcements yet" />
        ) : (
          <ul className="space-y-4">
            {announcements.map((a) => (
              <li key={a.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{a.title}</p>
                    <p className="text-muted-foreground text-xs">{formatDate(a.createdAt, true)}</p>
                  </div>
                  <ActionForm action={deleteAnnouncementAction.bind(null, a.id)} confirm="Delete this announcement?" showSuccess={false}>
                    <SubmitButton variant="ghost" size="icon" aria-label={`Delete announcement ${a.title}`}>
                      <Trash2 aria-hidden />
                    </SubmitButton>
                  </ActionForm>
                </div>
                <p className="mt-2 text-sm whitespace-pre-line">{a.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
