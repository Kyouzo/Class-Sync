"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formToObject } from "@/lib/validation";
import { getCurrentUser } from "../session";
import { createQuiz, deleteQuestion, deleteQuiz, saveQuestion, submitQuizAttempt, updateQuiz } from "../services/quizzes";
import { attempt, success, type ActionState } from "./result";

export async function createQuizAction(courseId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUser();
  const result = await attempt(() => createQuiz(db, actor, courseId, formToObject(formData)));
  if (!result.ok) return result.state;
  revalidatePath(`/instructor/courses/${courseId}`, "layout");
  redirect(`/instructor/courses/${courseId}/quizzes/${result.value.id}`);
}

export async function updateQuizAction(quizId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUser();
  const result = await attempt(() => updateQuiz(db, actor, quizId, formToObject(formData)));
  if (!result.ok) return result.state;
  revalidatePath(`/instructor/courses/${result.value.courseId}`, "layout");
  return success("Quiz settings saved.");
}

export async function deleteQuizAction(quizId: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUser();
  const result = await attempt(() => deleteQuiz(db, actor, quizId));
  if (!result.ok) return result.state;
  revalidatePath(`/instructor/courses/${result.value.courseId}`, "layout");
  redirect(`/instructor/courses/${result.value.courseId}/content`);
}

/** Choices arrive as `choice0..choiceN`; the radio group `correctIndex` marks the right one. */
function questionInput(formData: FormData) {
  const raw = formToObject(formData);
  const choices: string[] = [];
  for (let i = 0; formData.has(`choice${i}`); i++) choices.push(String(formData.get(`choice${i}`) ?? ""));
  return { ...raw, choices };
}

export async function saveQuestionAction(quizId: string, questionId: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUser();
  const result = await attempt(() => saveQuestion(db, actor, quizId, questionId, questionInput(formData)));
  if (!result.ok) return result.state;
  revalidatePath("/instructor", "layout");
  return success(questionId ? "Question updated." : "Question added.");
}

export async function deleteQuestionAction(questionId: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUser();
  const result = await attempt(() => deleteQuestion(db, actor, questionId));
  if (!result.ok) return result.state;
  revalidatePath("/instructor", "layout");
  return success("Question deleted.");
}

/** Answers arrive as `answer:<questionId>` radio groups. */
export async function submitQuizAction(quizId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUser();
  const answers: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("answer:") && typeof value === "string") answers[key.slice("answer:".length)] = value;
  }
  const result = await attempt(() => submitQuizAttempt(db, actor, { quizId, answers }));
  if (!result.ok) return result.state;
  const quiz = await db.quiz.findUniqueOrThrow({ where: { id: quizId }, select: { course: { select: { slug: true } } } });
  revalidatePath(`/learn/${quiz.course.slug}`, "layout");
  revalidatePath("/dashboard", "layout");
  redirect(`/learn/${quiz.course.slug}/quizzes/${quizId}/attempts/${result.value.id}`);
}
