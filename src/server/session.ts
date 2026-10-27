import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { RoleName } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { Actor } from "./policies";

/**
 * The signed-in user, re-read from the database on every request so that role changes and deleted
 * accounts take effect immediately instead of waiting for the JWT to expire.
 */
export const getCurrentUser = cache(async (): Promise<Actor | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: { select: { name: true } } },
  });
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role.name };
});

export async function requireUser(): Promise<Actor> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(...roles: RoleName[]): Promise<Actor> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/forbidden");
  return user;
}
