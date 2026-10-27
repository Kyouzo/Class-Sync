"use server";

import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import { fieldErrors, formToObject, registerSchema } from "@/lib/validation";
import type { ActionState } from "./result";

/** Only allow same-site relative redirects after sign-in. */
function safeCallback(value: FormDataEntryValue | null): string {
  const url = typeof value === "string" ? value : "";
  return url.startsWith("/") && !url.startsWith("//") ? url : "/dashboard";
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: safeCallback(formData.get("callbackUrl")),
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) return { error: "Invalid email or password." };
    throw error; // Next.js redirect
  }
}

/** Self-registration always creates a student account; administrators promote instructors. */
export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const { name, email, password } = parsed.data;
  try {
    const role = await db.role.findUniqueOrThrow({ where: { name: "STUDENT" } });
    await db.user.create({ data: { name, email, passwordHash: await bcrypt.hash(password, 10), roleId: role.id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "An account with that email already exists.", fieldErrors: { email: ["Email is already registered."] } };
    }
    throw error;
  }
  await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  return { ok: true };
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}
