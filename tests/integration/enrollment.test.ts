import { describe, expect, it } from "vitest";
import { getCourseOverview, listPublishedCourses } from "@/server/services/catalog";
import { enroll } from "@/server/services/progress";
import { createCourse, createUser, db, expectAppError } from "./helpers";

describe("enrollment", () => {
  it("enrolls a student in a published course exactly once", async () => {
    const instructor = await createUser("INSTRUCTOR");
    const student = await createUser("STUDENT");
    const { course } = await createCourse(instructor);

    const first = await enroll(db, student, course.id);
    const second = await enroll(db, student, course.id);
    expect(second.id).toBe(first.id);
    expect(await db.enrollment.count({ where: { courseId: course.id } })).toBe(1);

    const overview = await getCourseOverview(db, student, course.slug);
    expect(overview.enrollment?.id).toBe(first.id);
    expect(overview.canEnroll).toBe(false);
  });

  it("handles concurrent enrollment requests without duplicates", async () => {
    const instructor = await createUser("INSTRUCTOR");
    const student = await createUser("STUDENT");
    const { course } = await createCourse(instructor);
    await Promise.all([enroll(db, student, course.id), enroll(db, student, course.id), enroll(db, student, course.id)]);
    expect(await db.enrollment.count({ where: { userId: student.id } })).toBe(1);
  });

  it("does not reveal or allow enrollment in draft courses", async () => {
    const instructor = await createUser("INSTRUCTOR");
    const student = await createUser("STUDENT");
    const { course } = await createCourse(instructor, { status: "DRAFT" });
    await expectAppError(enroll(db, student, course.id), "NOT_FOUND");
    await expectAppError(getCourseOverview(db, student, course.slug), "NOT_FOUND");
    await expectAppError(getCourseOverview(db, null, course.slug), "NOT_FOUND");
  });

  it("rejects enrollment in archived courses and by non-students", async () => {
    const instructor = await createUser("INSTRUCTOR");
    const student = await createUser("STUDENT");
    const { course: archived } = await createCourse(instructor, { status: "ARCHIVED" });
    await expectAppError(enroll(db, student, archived.id), "FORBIDDEN");

    const { course } = await createCourse(instructor);
    await expectAppError(enroll(db, instructor, course.id), "FORBIDDEN");
    await expectAppError(enroll(db, null, course.id), "UNAUTHENTICATED");
  });

  it("lists only published courses in the catalog with search and pagination", async () => {
    const instructor = await createUser("INSTRUCTOR");
    await createCourse(instructor, { status: "DRAFT" });
    const published = [];
    for (let i = 0; i < 11; i++) published.push((await createCourse(instructor)).course);

    const page1 = await listPublishedCourses(db, { page: 1 });
    expect(page1.total).toBe(11);
    expect(page1.pageCount).toBe(2);
    expect(page1.courses).toHaveLength(9);
    const page2 = await listPublishedCourses(db, { page: 2 });
    expect(page2.courses).toHaveLength(2);

    const search = await listPublishedCourses(db, { page: 1, q: published[3].title.toLowerCase() });
    expect(search.courses.map((c) => c.id)).toContain(published[3].id);
  });
});
