import { z } from "zod";

// ---------------------------------------------------------------------------
// Form helpers: HTML forms submit strings, so normalise blanks/checkboxes first.
// ---------------------------------------------------------------------------

const blankToNull = (v: unknown) => (v === "" || v === undefined || v === null ? null : v);

export const optionalInt = (min: number, max: number) =>
  z.preprocess(blankToNull, z.coerce.number().int().min(min).max(max).nullable());

/** `datetime-local` values carry no timezone; ClassSync interprets them as UTC. */
export const optionalDate = z.preprocess((v) => {
  const value = blankToNull(v);
  if (value === null) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) return new Date(`${value}Z`);
  return value;
}, z.coerce.date().nullable());

export const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

/** Textarea with one entry per line. */
export const lines = (maxItems: number, maxLength = 200) =>
  z.preprocess(
    (v) =>
      typeof v === "string"
        ? v
            .split(/\r?\n/)
            .map((s) => s.trim())
            .filter(Boolean)
        : v ?? [],
    z.array(z.string().max(maxLength)).max(maxItems),
  );

const id = z.string().min(1).max(64);
const text = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be at most ${max} characters.`);

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const registerSchema = z
  .object({
    name: text(2, 80, "Name"),
    email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
    password: z.string().min(8, "Password must be at least 8 characters.").max(72),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(72),
});

// ---------------------------------------------------------------------------
// Courses & content
// ---------------------------------------------------------------------------

export const courseSchema = z.object({
  title: text(3, 120, "Title"),
  summary: text(10, 300, "Summary"),
  description: text(10, 10_000, "Description"),
  categoryId: z.preprocess(blankToNull, id.nullable()),
  objectives: lines(20),
});

export const completionSettingsSchema = z.object({
  requireAllLessons: checkbox,
  requirePassingQuizzes: checkbox,
  minimumGrade: optionalInt(0, 100),
});

export const moduleSchema = z.object({ title: text(2, 120, "Module title") });

export const lessonSchema = z.object({
  title: text(2, 160, "Lesson title"),
  content: text(1, 50_000, "Lesson content"),
  objectives: lines(15),
  estimatedMinutes: optionalInt(1, 600),
  dueAt: optionalDate,
});

export const quizSchema = z.object({
  title: text(2, 160, "Quiz title"),
  description: z.string().trim().max(2_000).default(""),
  passingScore: z.coerce.number().int().min(0).max(100),
  maxAttempts: optionalInt(1, 100),
  isRequired: checkbox,
  dueAt: optionalDate,
  moduleId: z.preprocess(blankToNull, id.nullable()),
});

export const MAX_CHOICES = 6;

export const questionSchema = z
  .object({
    prompt: text(3, 1_000, "Question"),
    explanation: z.string().trim().max(2_000).default(""),
    points: z.coerce.number().int().min(1).max(100),
    choices: z.array(z.string().trim().max(500)).max(MAX_CHOICES),
    correctIndex: z.coerce.number().int().min(0),
  })
  .transform((q, ctx) => {
    // Blank choice inputs are ignored; the correct index refers to the original input position.
    const kept = q.choices.map((t, i) => ({ text: t, i })).filter((c) => c.text.length > 0);
    if (kept.length < 2) {
      ctx.addIssue({ code: "custom", message: "Provide at least two answer choices.", path: ["choices"] });
      return z.NEVER;
    }
    if (!kept.some((c) => c.i === q.correctIndex)) {
      ctx.addIssue({ code: "custom", message: "Mark one non-empty choice as correct.", path: ["correctIndex"] });
      return z.NEVER;
    }
    return {
      prompt: q.prompt,
      explanation: q.explanation,
      points: q.points,
      choices: kept.map((c, position) => ({ text: c.text, isCorrect: c.i === q.correctIndex, position })),
    };
  });

export const quizSubmissionSchema = z.object({
  quizId: id,
  answers: z.record(id, id).refine((a) => Object.keys(a).length <= 500, "Too many answers."),
});

// ---------------------------------------------------------------------------
// Community
// ---------------------------------------------------------------------------

export const announcementSchema = z.object({
  title: text(3, 160, "Title"),
  body: text(3, 5_000, "Message"),
});

export const discussionPostSchema = z.object({
  title: z.preprocess(blankToNull, text(3, 160, "Title").nullable()),
  body: text(1, 5_000, "Message"),
  parentId: z.preprocess(blankToNull, id.nullable()),
});

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export const categorySchema = z.object({ name: text(2, 60, "Category name") });

export const roleUpdateSchema = z.object({
  userId: id,
  role: z.enum(["STUDENT", "INSTRUCTOR", "ADMIN"]),
});

export const catalogQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  category: z.string().trim().max(80).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

/** Flattens a FormData into a plain object (repeated keys become arrays). */
export function formToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    if (key in out) {
      const existing = out[key];
      out[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function fieldErrors(error: z.ZodError): Record<string, string[] | undefined> {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}
