import { expect, test } from "@playwright/test";
import { INSTRUCTOR, signIn, uniqueSuffix } from "./helpers";

/**
 * MVP acceptance: an instructor publishes a course; a student enrolls, completes lessons, takes a
 * quiz, receives a persisted grade, tracks progress and earns a certificate only once requirements
 * are met.
 */
test("instructor publishes a course and a student completes it", async ({ browser }) => {
  const suffix = uniqueSuffix();
  const courseTitle = `E2E Geography ${suffix}`;

  // --- Instructor builds and publishes the course --------------------------------------------
  const instructorContext = await browser.newContext();
  const instructor = await instructorContext.newPage();
  await signIn(instructor, INSTRUCTOR);

  await instructor.goto("/instructor/courses/new");
  await instructor.getByLabel("Title", { exact: true }).fill(courseTitle);
  await instructor.getByLabel("Summary", { exact: true }).fill("A short course about European capitals.");
  await instructor.getByLabel("Description", { exact: true }).fill("Learn the capitals of Europe, one lesson at a time.");
  await instructor.getByLabel("Learning objectives", { exact: true }).fill("Name European capitals");
  await instructor.getByRole("button", { name: "Create course" }).click();
  await expect(instructor).toHaveURL(/\/instructor\/courses\/[^/]+\/content$/);

  await instructor.getByLabel("Module title").fill("Western Europe");
  await instructor.getByRole("button", { name: "Add module" }).click();
  await expect(instructor.getByText("Module 1: Western Europe")).toBeVisible();

  await instructor.getByText("Add a lesson to Western Europe").click();
  await instructor.getByLabel("Lesson title").fill("Capital of France");
  await instructor.getByLabel("Content", { exact: true }).fill("## France\n\nThe capital of France is **Paris**.");
  await instructor.getByRole("button", { name: "Add lesson" }).click();
  await expect(instructor.getByRole("heading", { name: "Edit lesson" })).toBeVisible();

  await instructor.getByRole("link", { name: "Content & quizzes" }).click();
  await instructor.getByLabel("Quiz title").fill("Capitals quiz");
  await instructor.getByLabel("Passing score (%)").fill("70");
  await instructor.getByRole("button", { name: "Create quiz" }).click();
  await expect(instructor.getByRole("heading", { name: /Capitals quiz: questions/ })).toBeVisible();

  const questionForm = instructor.getByRole("form", { name: "Add question" });
  await questionForm.getByLabel("Question").fill("What is the capital of France?");
  await questionForm.getByLabel("Choice 1", { exact: true }).fill("Paris");
  await questionForm.getByLabel("Choice 2", { exact: true }).fill("Rome");
  await questionForm.getByLabel("Choice 3", { exact: true }).fill("Madrid");
  await questionForm.getByLabel("Choice 1 is correct").check();
  await questionForm.getByRole("button", { name: "Add question" }).click();
  await expect(instructor.getByText("Question added.")).toBeVisible();

  await instructor.getByRole("link", { name: "Details" }).click();
  await instructor.getByRole("button", { name: "Publish course" }).click();
  await expect(instructor.getByText("This course is live in the catalog.")).toBeVisible();
  await instructorContext.close();

  // --- Student registers, enrolls and learns ------------------------------------------------
  const student = await (await browser.newContext()).newPage();
  await student.goto("/register");
  await student.getByLabel("Full name").fill(`Student ${suffix}`);
  await student.getByLabel("Email").fill(`student-${suffix}@example.test`);
  await student.getByLabel("Password", { exact: true }).fill("a-strong-password");
  await student.getByLabel("Confirm password").fill("a-strong-password");
  await student.getByRole("button", { name: "Create account" }).click();
  await expect(student).toHaveURL(/\/dashboard/);

  await student.goto(`/courses?q=${encodeURIComponent(courseTitle)}`);
  await student.getByRole("link", { name: courseTitle }).click();
  await student.getByRole("button", { name: "Enroll for free" }).click();
  await expect(student).toHaveURL(/\/learn\//);

  // Certificate is not available yet.
  await expect(student.getByText("Remaining requirements")).toBeVisible();
  await expect(student.getByRole("link", { name: /Download certificate/ })).toHaveCount(0);

  await student.getByRole("link", { name: "Start learning" }).click();
  await expect(student.getByRole("heading", { name: "Capital of France" })).toBeVisible();
  await student.getByRole("button", { name: "Mark as complete" }).click();
  await expect(student.getByText("Lesson marked complete.")).toBeVisible();

  await student.getByRole("navigation", { name: "Lessons" }).getByRole("link", { name: /Capitals quiz/ }).click();
  await expect(student.getByRole("radio", { name: "Paris" })).toBeVisible();
  // Correct answers are not exposed before submission.
  await expect(student.getByText("(correct answer)")).toHaveCount(0);
  await student.getByRole("radio", { name: "Paris" }).check();
  await student.getByRole("button", { name: "Submit answers" }).click();

  await expect(student.getByRole("heading", { name: "You passed!" })).toBeVisible();
  await expect(student.getByText("1/1")).toBeVisible();
  await expect(student.getByText("(correct answer)")).toBeVisible();

  // Grade is persisted and progress is complete.
  await student.reload();
  await expect(student.getByRole("heading", { name: "You passed!" })).toBeVisible();
  await student.goto("/dashboard/grades");
  await expect(student.getByRole("row", { name: /Capitals quiz.*100%.*Passed/ })).toBeVisible();

  await student.getByRole("link", { name: courseTitle }).click();
  await expect(student.getByRole("progressbar", { name: "Course progress" })).toHaveAttribute("aria-valuenow", "100");
  const certificateLink = student.getByRole("link", { name: /Download certificate/ });
  await expect(certificateLink).toBeVisible();

  const response = await student.request.get((await certificateLink.getAttribute("href"))!);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/pdf");
  expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");
});
