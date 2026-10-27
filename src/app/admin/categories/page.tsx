import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { FormField } from "@/components/form-field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/db";
import { createCategoryAction, deleteCategoryAction } from "@/server/actions/admin";
import { requireRole } from "@/server/session";
import { listCategoriesWithCounts } from "@/server/services/admin";

export const metadata: Metadata = { title: "Admin · Categories" };

export default async function AdminCategoriesPage() {
  const user = await requireRole("ADMIN");
  const categories = await listCategoriesWithCounts(db, user);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y rounded-md border">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  {c.name} <span className="text-muted-foreground">({c._count.courses} courses)</span>
                </span>
                <ActionForm action={deleteCategoryAction.bind(null, c.id)} confirm={`Delete "${c.name}"? Courses keep existing without a category.`} showSuccess={false}>
                  <SubmitButton variant="ghost" size="icon" aria-label={`Delete category ${c.name}`}>
                    <Trash2 aria-hidden />
                  </SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Add category</CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm action={createCategoryAction} className="grid gap-3" resetOnSuccess aria-label="Add category">
            <FormField id="category-name" name="name" label="Name">
              <Input id="category-name" name="name" required minLength={2} maxLength={60} />
            </FormField>
            <div>
              <SubmitButton>Add category</SubmitButton>
            </div>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
