import { expect, test } from "@playwright/test";
import { signIn, STUDENT } from "./helpers";

test("anonymous visitors are sent to sign in for protected pages", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/learn/modern-web-foundations");
  await expect(page).toHaveURL(/\/login/);
  const pdf = await page.request.get("/api/certificates/anything");
  expect(pdf.status()).toBe(401);
});

test("students cannot reach instructor or admin controls", async ({ page }) => {
  await signIn(page, STUDENT);
  await page.goto("/instructor");
  await expect(page).toHaveURL(/\/forbidden/);
  await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/forbidden/);
});

test("unpublished courses are hidden from students", async ({ page }) => {
  await signIn(page, STUDENT);
  await page.goto("/courses/design-systems-101");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await page.goto("/learn/design-systems-101");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await page.goto("/courses?q=design+systems");
  await expect(page.getByText("0 courses found")).toBeVisible();
});

test("students must enroll before opening course content", async ({ page }) => {
  await signIn(page, STUDENT);
  await page.goto("/learn/effective-remote-collaboration");
  await expect(page).toHaveURL(/\/courses\/effective-remote-collaboration$/);
  await expect(page.getByRole("button", { name: "Enroll for free" })).toBeVisible();
});
