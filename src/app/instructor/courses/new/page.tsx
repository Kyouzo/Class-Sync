import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { CourseFields } from "@/components/instructor/forms";
import { PageHeader } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/lib/db";
import { createCourseAction } from "@/server/actions/courses";
import { listCategories } from "@/server/services/catalog";

export const metadata: Metadata = { title: "New course" };

export default async function NewCoursePage() {
  const categories = await listCategories(db);
  return (
    <>
      <PageHeader title="Create a course" description="Courses start as drafts. Add modules and lessons, then publish when ready." />
      <Card className="max-w-3xl">
        <CardContent>
          <ActionForm action={createCourseAction} className="grid gap-6" aria-label="Create course">
            <CourseFields categories={categories} />
            <div>
              <SubmitButton pendingText="Creating…">Create course</SubmitButton>
            </div>
          </ActionForm>
        </CardContent>
      </Card>
    </>
  );
}
