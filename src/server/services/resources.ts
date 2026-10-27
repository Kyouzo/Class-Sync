import { randomUUID } from "node:crypto";
import type { Db } from "@/lib/db";
import { ALLOWED_ATTACHMENTS, maxUploadBytes, type StorageAdapter } from "@/lib/storage";
import { invalid, notFound, unauthenticated } from "../errors";
import type { Actor } from "../policies";
import { requireCourseContent } from "./access";
import { requireManagedLesson } from "./courses";

function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "file";
}

/** Uploads a downloadable resource to a lesson after validating type and size. */
export async function uploadResource(db: Db, storage: StorageAdapter, actor: Actor | null, lessonId: string, file: File | null) {
  const lesson = await requireManagedLesson(db, actor, lessonId);
  if (!file || file.size === 0) throw invalid("Choose a file to upload.");
  const limit = maxUploadBytes();
  if (file.size > limit) throw invalid(`Files must be ${Math.floor(limit / 1024 / 1024)} MB or smaller.`);
  const fileName = safeFileName(file.name);
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = ALLOWED_ATTACHMENTS[extension];
  if (!mimeType) {
    throw invalid(`Unsupported file type. Allowed: ${Object.keys(ALLOWED_ATTACHMENTS).join(", ")}.`);
  }
  const storageKey = `lessons/${lesson.id}/${randomUUID()}.${extension}`;
  await storage.put(storageKey, new Uint8Array(await file.arrayBuffer()), mimeType);
  try {
    return await db.resource.create({ data: { lessonId: lesson.id, fileName, storageKey, mimeType, sizeBytes: file.size } });
  } catch (error) {
    await storage.delete(storageKey).catch(() => undefined);
    throw error;
  }
}

export async function deleteResource(db: Db, storage: StorageAdapter, actor: Actor | null, resourceId: string) {
  const resource = await db.resource.findUnique({ where: { id: resourceId } });
  if (!resource) throw notFound("Resource not found.");
  const lesson = await requireManagedLesson(db, actor, resource.lessonId);
  await db.resource.delete({ where: { id: resource.id } });
  await storage.delete(resource.storageKey).catch(() => undefined);
  return lesson;
}

/** Returns the file for download if the actor can access the lesson's course content. */
export async function getResourceForDownload(db: Db, storage: StorageAdapter, actor: Actor | null, resourceId: string) {
  if (!actor) throw unauthenticated();
  const resource = await db.resource.findUnique({
    where: { id: resourceId },
    include: { lesson: { select: { module: { select: { courseId: true } } } } },
  });
  if (!resource) throw notFound("Resource not found.");
  await requireCourseContent(db, actor, { id: resource.lesson.module.courseId });
  const body = await storage.get(resource.storageKey);
  if (!body) throw notFound("The file is missing from storage.");
  return { resource, body };
}
