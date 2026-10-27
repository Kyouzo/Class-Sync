import { expect, type Page } from "@playwright/test";

/** Demo accounts created by `prisma/seed.ts`. */
export const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "ClassSync123!";
export const INSTRUCTOR = "instructor@classsync.dev";
export const STUDENT = "student@classsync.dev";

export async function signIn(page: Page, email: string, password = SEED_PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export function uniqueSuffix() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
