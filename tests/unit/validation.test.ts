import { describe, expect, it } from "vitest";
import { courseSchema, formToObject, lessonSchema, questionSchema, quizSchema, registerSchema } from "@/lib/validation";
import { slugify } from "@/lib/utils";

describe("questionSchema", () => {
  it("drops blank choices and maps the correct index to the remaining choices", () => {
    const parsed = questionSchema.parse({ prompt: "Pick one", points: "2", choices: ["A", "", "C", ""], correctIndex: "2" });
    expect(parsed.points).toBe(2);
    expect(parsed.choices).toEqual([
      { text: "A", isCorrect: false, position: 0 },
      { text: "C", isCorrect: true, position: 1 },
    ]);
  });

  it("requires at least two choices", () => {
    const result = questionSchema.safeParse({ prompt: "Pick one", points: 1, choices: ["A", "", ""], correctIndex: 0 });
    expect(result.success).toBe(false);
  });

  it("requires the correct answer to be a non-empty choice", () => {
    const result = questionSchema.safeParse({ prompt: "Pick one", points: 1, choices: ["A", "B", ""], correctIndex: 2 });
    expect(result.success).toBe(false);
  });
});

describe("course and lesson forms", () => {
  it("splits objectives by line and normalises a blank category", () => {
    const parsed = courseSchema.parse({
      title: "Intro",
      summary: "A short summary text",
      description: "A longer description",
      categoryId: "",
      objectives: "One\r\n\n  Two  \n",
    });
    expect(parsed.objectives).toEqual(["One", "Two"]);
    expect(parsed.categoryId).toBeNull();
  });

  it("parses datetime-local values as UTC and blank numbers as null", () => {
    const parsed = lessonSchema.parse({ title: "Lesson", content: "Body", objectives: "", estimatedMinutes: "", dueAt: "2026-11-01T10:30" });
    expect(parsed.estimatedMinutes).toBeNull();
    expect(parsed.dueAt?.toISOString()).toBe("2026-11-01T10:30:00.000Z");
  });

  it("bounds quiz passing scores and treats checkboxes as booleans", () => {
    expect(quizSchema.safeParse({ title: "Quiz", passingScore: "101", maxAttempts: "", dueAt: "", moduleId: "" }).success).toBe(false);
    const parsed = quizSchema.parse({ title: "Quiz", passingScore: "80", maxAttempts: "3", isRequired: "on", dueAt: "", moduleId: "" });
    expect(parsed).toMatchObject({ passingScore: 80, maxAttempts: 3, isRequired: true, dueAt: null, moduleId: null });
    expect(quizSchema.parse({ title: "Quiz", passingScore: "80" }).isRequired).toBe(false);
  });
});

describe("registerSchema", () => {
  it("normalises email and checks password confirmation", () => {
    const ok = registerSchema.parse({ name: "Ann", email: "  Ann@Example.COM ", password: "longpassword", confirmPassword: "longpassword" });
    expect(ok.email).toBe("ann@example.com");
    const mismatch = registerSchema.safeParse({ name: "Ann", email: "a@b.co", password: "longpassword", confirmPassword: "different" });
    expect(mismatch.success).toBe(false);
  });
});

describe("helpers", () => {
  it("collects repeated form keys into arrays", () => {
    const fd = new FormData();
    fd.append("a", "1");
    fd.append("a", "2");
    fd.append("b", "x");
    expect(formToObject(fd)).toEqual({ a: ["1", "2"], b: "x" });
  });

  it("slugifies titles", () => {
    expect(slugify("  Intro to C++ & Café Design! ")).toBe("intro-to-c-cafe-design");
  });
});
