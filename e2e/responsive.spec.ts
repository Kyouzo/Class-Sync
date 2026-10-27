import { expect, test } from "@playwright/test";
import { signIn, STUDENT } from "./helpers";

test("catalog and dashboard work on a phone-sized screen", async ({ page }) => {
  await page.goto("/courses");
  await expect(page.getByRole("heading", { name: "Course catalog" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  await signIn(page, STUDENT);
  await page.getByRole("button", { name: "Open account menu" }).click();
  await page.getByRole("menuitem", { name: "Courses" }).click();
  await expect(page).toHaveURL(/\/courses/);
});
