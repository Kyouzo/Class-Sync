"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { formToObject } from "@/lib/validation";
import { getCurrentUser } from "../session";
import { createCategory, deleteCategory, setUserRole } from "../services/admin";
import { attempt, success, type ActionState } from "./result";

export async function setUserRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUser();
  const result = await attempt(() => setUserRole(db, actor, formToObject(formData)));
  if (!result.ok) return result.state;
  revalidatePath("/admin", "layout");
  return success("Role updated.");
}

export async function createCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUser();
  const result = await attempt(() => createCategory(db, actor, formToObject(formData)));
  if (!result.ok) return result.state;
  revalidatePath("/admin/categories");
  revalidatePath("/courses");
  return success(`Category "${result.value.name}" created.`);
}

export async function deleteCategoryAction(categoryId: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUser();
  const result = await attempt(() => deleteCategory(db, actor, categoryId));
  if (!result.ok) return result.state;
  revalidatePath("/admin/categories");
  revalidatePath("/courses");
  return success("Category deleted.");
}
