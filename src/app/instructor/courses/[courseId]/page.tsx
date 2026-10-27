import { ActionForm, SubmitButton } from "@/components/action-form";
import { CourseFields } from "@/components/instructor/forms";
import { FormField } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { db } from "@/lib/db";
import { deleteCourseAction, setCourseStatusAction, updateCompletionAction, updateCourseAction } from "@/server/actions/courses";
import { guard } from "@/server/page-guard";
import { requireRole } from "@/server/session";
import { listCategories } from "@/server/services/catalog";
import { getCourseForEditing } from "@/server/services/courses";

export default async function CourseDetailsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const user = await requireRole("INSTRUCTOR", "ADMIN");
  const [{ course, readiness }, categories] = await Promise.all([guard(() => getCourseForEditing(db, user, courseId)), listCategories(db)]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <Card>
        <CardHeader>
          <CardTitle>Course details</CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm action={updateCourseAction.bind(null, course.id)} className="grid gap-6" aria-label="Course details">
            <CourseFields categories={categories} course={course} />
            <div>
              <SubmitButton pendingText="Saving…">Save details</SubmitButton>
            </div>
          </ActionForm>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Publishing</CardTitle>
            <CardDescription>
              {course.status === "PUBLISHED"
                ? "This course is live in the catalog."
                : course.status === "ARCHIVED"
                  ? "Archived: hidden from the catalog; enrolled students keep read access."
                  : "Drafts are only visible to you and administrators."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {course.status !== "PUBLISHED" && readiness.length > 0 && (
              <Alert variant="info">
                <div>
                  <p className="font-medium">Before publishing:</p>
                  <ul className="list-disc pl-4">
                    {readiness.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              </Alert>
            )}
            <div className="flex flex-wrap gap-2">
              {course.status !== "PUBLISHED" && (
                <ActionForm action={setCourseStatusAction.bind(null, course.id, "PUBLISHED")}>
                  <SubmitButton disabled={readiness.length > 0} pendingText="Publishing…">
                    Publish course
                  </SubmitButton>
                </ActionForm>
              )}
              {course.status === "PUBLISHED" && (
                <ActionForm action={setCourseStatusAction.bind(null, course.id, "ARCHIVED")} confirm="Archive this course? It will be removed from the catalog.">
                  <SubmitButton variant="outline">Archive course</SubmitButton>
                </ActionForm>
              )}
              {course.status !== "DRAFT" && course._count.enrollments === 0 && (
                <ActionForm action={setCourseStatusAction.bind(null, course.id, "DRAFT")}>
                  <SubmitButton variant="outline">Move to draft</SubmitButton>
                </ActionForm>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Completion requirements</CardTitle>
            <CardDescription>Learners are marked complete and receive a certificate when all selected requirements are met.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm action={updateCompletionAction.bind(null, course.id)} className="grid gap-4" aria-label="Completion requirements">
              <Label>
                <input type="checkbox" name="requireAllLessons" defaultChecked={course.requireAllLessons} className="accent-primary size-4" />
                Complete every lesson
              </Label>
              <Label>
                <input type="checkbox" name="requirePassingQuizzes" defaultChecked={course.requirePassingQuizzes} className="accent-primary size-4" />
                Pass every required quiz
              </Label>
              <FormField id="minimumGrade" label="Minimum course grade (%)" hint="Optional. Average of best scores on required quizzes.">
                <Input id="minimumGrade" name="minimumGrade" type="number" min={0} max={100} defaultValue={course.minimumGrade ?? ""} />
              </FormField>
              <div>
                <SubmitButton variant="secondary" pendingText="Saving…">
                  Save requirements
                </SubmitButton>
              </div>
            </ActionForm>
          </CardContent>
        </Card>

        {course._count.enrollments === 0 && (
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle>Delete course</CardTitle>
              <CardDescription>Permanently removes the course and all of its content. Only possible before anyone enrolls.</CardDescription>
            </CardHeader>
            <CardContent>
              <ActionForm action={deleteCourseAction.bind(null, course.id)} confirm="Permanently delete this course and all of its content?">
                <SubmitButton variant="destructive">Delete course</SubmitButton>
              </ActionForm>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
