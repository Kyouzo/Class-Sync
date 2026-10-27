import { describe, expect, it } from "vitest";
import type { StorageAdapter } from "@/lib/storage";
import { requireCourseContent } from "@/server/services/access";
import { setUserRole } from "@/server/services/admin";
import { getCourseRoster } from "@/server/services/analytics";
import { getCertificateForDownload } from "@/server/services/certificates";
import { createPost, deletePost } from "@/server/services/community";
import { createCourse as createCourseService, createModule, setCourseStatus, updateCourse } from "@/server/services/courses";
import { getLearnerReport, setLessonCompletion } from "@/server/services/progress";
import { getAttemptReview, submitQuizAttempt, updateQuiz } from "@/server/services/quizzes";
import { getResourceForDownload, uploadResource } from "@/server/services/resources";
import { answers, createCourse, createUser, db, enrollDirect, expectAppError } from "./helpers";

function memoryStorage(): StorageAdapter {
  const files = new Map<string, Uint8Array>();
  return {
    put: async (key, body) => void files.set(key, body),
    get: async (key) => files.get(key) ?? null,
    delete: async (key) => void files.delete(key),
  };
}

const validCourse = { title: "Secure Course", summary: "Summary text here", description: "Description text", objectives: "" };

describe("instructor-only controls", () => {
  it("only lets instructors and admins create courses", async () => {
    const student = await createUser("STUDENT");
    const instructor = await createUser("INSTRUCTOR");
    await expectAppError(createCourseService(db, student, validCourse), "FORBIDDEN");
    await expectAppError(createCourseService(db, null, validCourse), "UNAUTHENTICATED");
    const course = await createCourseService(db, instructor, validCourse);
    expect(course).toMatchObject({ status: "DRAFT", instructorId: instructor.id, slug: "secure-course" });
    const second = await createCourseService(db, instructor, validCourse);
    expect(second.slug).toBe("secure-course-2");
  });

  it("prevents instructors from editing other instructors' courses", async () => {
    const owner = await createUser("INSTRUCTOR");
    const other = await createUser("INSTRUCTOR");
    const student = await createUser("STUDENT");
    const admin = await createUser("ADMIN");
    const { course, quiz } = await createCourse(owner);
    const { course: draft } = await createCourse(owner, { status: "DRAFT" });

    await expectAppError(updateCourse(db, other, course.id, validCourse), "FORBIDDEN");
    await expectAppError(updateCourse(db, student, course.id, validCourse), "FORBIDDEN");
    await expectAppError(updateCourse(db, other, draft.id, validCourse), "NOT_FOUND"); // drafts don't leak
    await expectAppError(createModule(db, other, course.id, { title: "Hijack" }), "FORBIDDEN");
    await expectAppError(updateQuiz(db, other, quiz!.id, { title: "x", passingScore: 0 }), "FORBIDDEN");
    await expectAppError(setCourseStatus(db, other, course.id, "ARCHIVED"), "FORBIDDEN");
    await expectAppError(getCourseRoster(db, other, course.id), "FORBIDDEN");
    await expectAppError(getCourseRoster(db, student, course.id), "FORBIDDEN");

    // Administrators may manage any course.
    await setCourseStatus(db, admin, course.id, "ARCHIVED");
    expect((await db.course.findUniqueOrThrow({ where: { id: course.id } })).status).toBe("ARCHIVED");
  });

  it("refuses to publish a course without lessons", async () => {
    const owner = await createUser("INSTRUCTOR");
    const { course } = await createCourse(owner, { status: "DRAFT", lessons: 0, quiz: false });
    await expectAppError(setCourseStatus(db, owner, course.id, "PUBLISHED"), "VALIDATION");
    await db.lesson.create({ data: { moduleId: (await db.module.findFirstOrThrow({ where: { courseId: course.id } })).id, title: "L", content: "C", position: 0 } });
    const published = await setCourseStatus(db, owner, course.id, "PUBLISHED");
    expect(published.status).toBe("PUBLISHED");
    expect(published.publishedAt).not.toBeNull();
  });

  it("only lets admins change roles, and never their own", async () => {
    const admin = await createUser("ADMIN");
    const instructor = await createUser("INSTRUCTOR");
    const student = await createUser("STUDENT");
    await expectAppError(setUserRole(db, instructor, { userId: student.id, role: "ADMIN" }), "FORBIDDEN");
    await expectAppError(setUserRole(db, admin, { userId: admin.id, role: "STUDENT" }), "FORBIDDEN");
    await setUserRole(db, admin, { userId: student.id, role: "INSTRUCTOR" });
    const updated = await db.user.findUniqueOrThrow({ where: { id: student.id }, include: { role: true } });
    expect(updated.role.name).toBe("INSTRUCTOR");
  });
});

describe("course content access", () => {
  it("blocks unenrolled users and hides drafts from learners", async () => {
    const owner = await createUser("INSTRUCTOR");
    const student = await createUser("STUDENT");
    const { course } = await createCourse(owner);
    const { course: draft } = await createCourse(owner, { status: "DRAFT" });

    await expectAppError(requireCourseContent(db, student, { slug: course.slug }), "FORBIDDEN");
    await expectAppError(requireCourseContent(db, null, { slug: course.slug }), "UNAUTHENTICATED");
    await expectAppError(requireCourseContent(db, student, { slug: draft.slug }), "NOT_FOUND");

    // Even a pre-existing enrollment cannot open a course that was moved back to draft.
    await enrollDirect(student, draft.id);
    await expectAppError(requireCourseContent(db, student, { slug: draft.slug }), "NOT_FOUND");

    await enrollDirect(student, course.id);
    const access = await requireCourseContent(db, student, { slug: course.slug });
    expect(access.canManage).toBe(false);
    const preview = await requireCourseContent(db, owner, { slug: draft.slug });
    expect(preview.canManage).toBe(true);
  });

  it("guards attachment downloads by enrollment", async () => {
    const owner = await createUser("INSTRUCTOR");
    const enrolled = await createUser("STUDENT");
    const outsider = await createUser("STUDENT");
    const storage = memoryStorage();
    const { course, lessonIds } = await createCourse(owner);
    await enrollDirect(enrolled, course.id);

    const file = new File(["hello world"], "notes.txt", { type: "text/plain" });
    const resource = await uploadResource(db, storage, owner, lessonIds[0], file);
    await expectAppError(uploadResource(db, storage, enrolled, lessonIds[0], file), "FORBIDDEN");
    await expectAppError(uploadResource(db, storage, owner, lessonIds[0], new File(["x"], "evil.exe")), "VALIDATION");

    const download = await getResourceForDownload(db, storage, enrolled, resource.id);
    expect(new TextDecoder().decode(download.body)).toBe("hello world");
    await expectAppError(getResourceForDownload(db, storage, outsider, resource.id), "FORBIDDEN");
  });

  it("only lets participants post and authors or instructors delete", async () => {
    const owner = await createUser("INSTRUCTOR");
    const [a, b, outsider] = [await createUser("STUDENT"), await createUser("STUDENT"), await createUser("STUDENT")];
    const { course } = await createCourse(owner);
    await enrollDirect(a, course.id);
    await enrollDirect(b, course.id);

    await expectAppError(createPost(db, outsider, course.id, { title: "Hi there", body: "x" }), "FORBIDDEN");
    await expectAppError(createPost(db, a, course.id, { body: "No title" }), "VALIDATION");
    const thread = await createPost(db, a, course.id, { title: "Question", body: "How?" });
    const reply = await createPost(db, b, course.id, { body: "Like this", parentId: thread.id });
    await expectAppError(deletePost(db, a, reply.id), "FORBIDDEN");
    await deletePost(db, owner, reply.id);
    await deletePost(db, a, thread.id);
    expect(await db.discussionPost.count()).toBe(0);
  });
});

describe("grade privacy", () => {
  it("prevents students from viewing other students' grades, attempts and certificates", async () => {
    const owner = await createUser("INSTRUCTOR");
    const otherInstructor = await createUser("INSTRUCTOR");
    const alice = await createUser("STUDENT");
    const bob = await createUser("STUDENT");
    const { course, lessonIds, quiz } = await createCourse(owner, { lessons: 1 });
    await enrollDirect(alice, course.id);
    await enrollDirect(bob, course.id);
    await setLessonCompletion(db, alice, lessonIds[0], true);
    const attempt = await submitQuizAttempt(db, alice, { quizId: quiz!.id, answers: answers(quiz!) });
    const certificate = await db.certificate.findFirstOrThrow({ where: { userId: alice.id } });

    await expectAppError(getLearnerReport(db, bob, course.id, alice.id), "FORBIDDEN");
    await expectAppError(getLearnerReport(db, otherInstructor, course.id, alice.id), "FORBIDDEN");
    await expectAppError(getAttemptReview(db, bob, attempt.id), "NOT_FOUND");
    await expectAppError(getCertificateForDownload(db, bob, certificate.id), "NOT_FOUND");

    expect((await getLearnerReport(db, alice, course.id, alice.id)).attempts).toHaveLength(1);
    expect((await getLearnerReport(db, owner, course.id, alice.id)).standing.evaluation.eligible).toBe(true);
    expect((await getAttemptReview(db, owner, attempt.id)).id).toBe(attempt.id);
    expect((await getCertificateForDownload(db, alice, certificate.id)).id).toBe(certificate.id);
  });
});
