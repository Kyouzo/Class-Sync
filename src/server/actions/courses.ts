"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CourseStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { formToObject } from "@/lib/validation";
import { getCurrentUser } from "../session";
import {
  createCourse,
  createLesson,
  createModule,
  deleteCourse,
  deleteLesson,
  deleteModule,
  moveLesson,
  moveModule,
  renameModule,
  setCourseStatus,
  updateCompletionSettings,
  updateCourse,
  updateLesson,
} from "../services/courses";
import { deleteResource, uploadResource } from "../services/resources";
import { attempt, success, type ActionState } from "./result";

const editPath = (courseId: string) => `/instructor/courses/${courseId}`;

function revalidateCourse(courseId: string, slug?: string) {
  revalidatePath(editPath(courseId), "layout");
  revalidatePath("/instructor");
  revalidatePath("/courses");
  if (slug) revalidatePath(`/courses/${slug}`);
}

export async function createCourseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUser();
  const result = await attempt(() => createCourse(db, actor, formToObject(formData)));
  if (!result.ok) return result.state;
  revalidatePath("/instructor");
  redirect(`${editPath(result.value.id)}/content`);
}

export async function updateCourseAction(courseId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUser();
  const result = await attempt(() => updateCourse(db, actor, courseId, formToObject(formData)));
  if (!result.ok) return result.state;
  revalidateCourse(courseId, result.value.slug);
  return success("Course details saved.");
}

export async function updateCompletionAction(courseId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUser();
  const result = await attempt(() => updateCompletionSettings(db, actor, courseId, formToObject(formData)));
  if (!result.ok) return result.state;
  revalidateCourse(courseId, result.value.slug);
  return success("Completion requirements saved.");
}

export async function setCourseStatusAction(courseId: string, status: CourseStatus, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUser();
  const result = await attempt(() => setCourseStatus(db, actor, courseId, status));
  if (!result.ok) return result.state;
  revalidateCourse(courseId, result.value.slug);
  revalidatePath("/admin/courses");
  const labels: Record<CourseStatus, string> = { PUBLISHED: "Course published.", DRAFT: "Course moved to draft.", ARCHIVED: "Course archived." };
  return success(labels[status]);
}

export async function deleteCourseAction(courseId: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUser();
  const result = await attempt(() => deleteCourse(db, actor, courseId));
  if (!result.ok) return result.state;
  revalidatePath("/instructor");
  redirect("/instructor");
}

// Modules ---------------------------------------------------------------------

export async function createModuleAction(courseId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUser();
  const result = await attempt(() => createModule(db, actor, courseId, formToObject(formData)));
  if (!result.ok) return result.state;
  revalidateCourse(courseId);
  return success("Module added.");
}

export async function renameModuleAction(moduleId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUser();
  const result = await attempt(() => renameModule(db, actor, moduleId, formToObject(formData)));
  if (!result.ok) return result.state;
  revalidateCourse(result.value.courseId);
  return success("Module renamed.");
}

export async function deleteModuleAction(moduleId: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUser();
  const result = await attempt(() => deleteModule(db, actor, moduleId));
  if (!result.ok) return result.state;
  revalidateCourse(result.value.id, result.value.slug);
  return success("Module deleted.");
}

export async function moveModuleAction(moduleId: string, direction: "up" | "down", _prev: ActionState, _formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUser();
  const result = await attempt(() => moveModule(db, actor, moduleId, direction));
  if (!result.ok) return result.state;
  revalidateCourse(result.value.id);
  return success("Module moved.");
}

// Lessons ---------------------------------------------------------------------

export async function createLessonAction(moduleId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUser();
  const result = await attempt(() => createLesson(db, actor, moduleId, formToObject(formData)));
  if (!result.ok) return result.state;
  const mod = await db.module.findUniqueOrThrow({ where: { id: moduleId }, select: { courseId: true } });
  revalidateCourse(mod.courseId);
  redirect(`${editPath(mod.courseId)}/lessons/${result.value.id}`);
}

export async function updateLessonAction(lessonId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUser();
  const result = await attempt(() => updateLesson(db, actor, lessonId, formToObject(formData)));
  if (!result.ok) return result.state;
  const lesson = await db.lesson.findUniqueOrThrow({ where: { id: lessonId }, select: { module: { select: { course: { select: { id: true, slug: true } } } } } });
  revalidateCourse(lesson.module.course.id, lesson.module.course.slug);
  revalidatePath(`/learn/${lesson.module.course.slug}`, "layout");
  return success("Lesson saved.");
}

export async function deleteLessonAction(lessonId: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUser();
  const result = await attempt(() => deleteLesson(db, actor, lessonId));
  if (!result.ok) return result.state;
  const course = result.value.module.course;
  revalidateCourse(course.id, course.slug);
  redirect(`${editPath(course.id)}/content`);
}

export async function moveLessonAction(lessonId: string, direction: "up" | "down", _prev: ActionState, _formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUser();
  const result = await attempt(() => moveLesson(db, actor, lessonId, direction));
  if (!result.ok) return result.state;
  revalidateCourse(result.value.module.course.id);
  return success("Lesson moved.");
}

// Resources -------------------------------------------------------------------

export async function uploadResourceAction(lessonId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUser();
  const file = formData.get("file");
  const result = await attempt(() => uploadResource(db, getStorage(), actor, lessonId, file instanceof File ? file : null));
  if (!result.ok) return result.state;
  revalidatePath("/instructor", "layout");
  revalidatePath("/learn", "layout");
  return success(`Uploaded ${result.value.fileName}.`);
}

export async function deleteResourceAction(resourceId: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUser();
  const result = await attempt(() => deleteResource(db, getStorage(), actor, resourceId));
  if (!result.ok) return result.state;
  revalidatePath("/instructor", "layout");
  revalidatePath("/learn", "layout");
  return success("Attachment removed.");
}
