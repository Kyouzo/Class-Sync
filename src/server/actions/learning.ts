"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formToObject } from "@/lib/validation";
import { getCurrentUser } from "../session";
import { createAnnouncement, createPost, deleteAnnouncement, deletePost } from "../services/community";
import { claimCertificate, enroll, setLessonCompletion } from "../services/progress";
import { attempt, success, type ActionState } from "./result";

export async function enrollAction(courseId: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  const result = await attempt(() => enroll(db, actor, courseId));
  if (!result.ok) return result.state;
  const course = await db.course.findUniqueOrThrow({ where: { id: courseId }, select: { slug: true } });
  revalidatePath("/dashboard");
  redirect(`/learn/${course.slug}`);
}

export async function setLessonCompletionAction(lessonId: string, completed: boolean, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUser();
  const result = await attempt(() => setLessonCompletion(db, actor, lessonId, completed));
  if (!result.ok) return result.state;
  revalidatePath("/learn", "layout");
  revalidatePath("/dashboard", "layout");
  if (completed && result.value?.certificate && result.value.standing.evaluation.eligible) {
    return success("Lesson complete. You have finished the course and earned a certificate!");
  }
  return success(completed ? "Lesson marked complete." : "Lesson marked incomplete.");
}

export async function claimCertificateAction(courseId: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUser();
  const result = await attempt(() => claimCertificate(db, actor, courseId));
  if (!result.ok) return result.state;
  revalidatePath("/dashboard", "layout");
  revalidatePath("/learn", "layout");
  return success("Certificate issued.");
}

// Community -------------------------------------------------------------------

export async function createAnnouncementAction(courseId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUser();
  const result = await attempt(() => createAnnouncement(db, actor, courseId, formToObject(formData)));
  if (!result.ok) return result.state;
  revalidatePath("/instructor", "layout");
  revalidatePath("/learn", "layout");
  revalidatePath("/notifications");
  return success("Announcement posted.");
}

export async function deleteAnnouncementAction(announcementId: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUser();
  const result = await attempt(() => deleteAnnouncement(db, actor, announcementId));
  if (!result.ok) return result.state;
  revalidatePath("/instructor", "layout");
  revalidatePath("/learn", "layout");
  return success("Announcement deleted.");
}

export async function createPostAction(courseId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUser();
  const result = await attempt(() => createPost(db, actor, courseId, formToObject(formData)));
  if (!result.ok) return result.state;
  const post = result.value;
  const course = await db.course.findUniqueOrThrow({ where: { id: courseId }, select: { slug: true } });
  revalidatePath(`/learn/${course.slug}/discussions`, "layout");
  if (!post.parentId) redirect(`/learn/${course.slug}/discussions/${post.id}`);
  return success("Reply posted.");
}

export async function deletePostAction(postId: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUser();
  const result = await attempt(() => deletePost(db, actor, postId));
  if (!result.ok) return result.state;
  const course = result.value.course;
  revalidatePath(`/learn/${course.slug}/discussions`, "layout");
  if (!result.value.parentId) redirect(`/learn/${course.slug}/discussions`);
  return success("Post deleted.");
}
