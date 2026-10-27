import { describe, expect, it } from "vitest";
import {
  canAccessCourseContent,
  canCreateCourse,
  canEnroll,
  canManageCourse,
  canModeratePost,
  canViewCourseOverview,
  canViewLearnerRecords,
  type Actor,
} from "@/server/policies";

const actor = (id: string, role: Actor["role"]): Actor => ({ id, role, name: id, email: `${id}@test.dev` });
const student = actor("student", "STUDENT");
const otherStudent = actor("other", "STUDENT");
const owner = actor("owner", "INSTRUCTOR");
const otherInstructor = actor("instructor2", "INSTRUCTOR");
const admin = actor("admin", "ADMIN");

const draft = { instructorId: owner.id, status: "DRAFT" as const };
const published = { instructorId: owner.id, status: "PUBLISHED" as const };
const archived = { instructorId: owner.id, status: "ARCHIVED" as const };
const enrollment = { id: "enrollment" };

describe("course management", () => {
  it("only lets instructors and admins create courses", () => {
    expect(canCreateCourse(student)).toBe(false);
    expect(canCreateCourse(owner)).toBe(true);
    expect(canCreateCourse(admin)).toBe(true);
    expect(canCreateCourse(null)).toBe(false);
  });

  it("restricts instructor-only controls to the owner and admins", () => {
    expect(canManageCourse(owner, published)).toBe(true);
    expect(canManageCourse(admin, published)).toBe(true);
    expect(canManageCourse(otherInstructor, published)).toBe(false);
    expect(canManageCourse(student, published)).toBe(false);
    // A student whose id matches the instructor id still cannot manage (role is checked too).
    expect(canManageCourse(actor(owner.id, "STUDENT"), published)).toBe(false);
  });
});

describe("course visibility", () => {
  it("hides unpublished courses from everyone but managers", () => {
    expect(canViewCourseOverview(null, published)).toBe(true);
    expect(canViewCourseOverview(null, draft)).toBe(false);
    expect(canViewCourseOverview(student, draft)).toBe(false);
    expect(canViewCourseOverview(otherInstructor, draft)).toBe(false);
    expect(canViewCourseOverview(owner, draft)).toBe(true);
    expect(canViewCourseOverview(admin, archived)).toBe(true);
    expect(canViewCourseOverview(student, archived)).toBe(false);
  });

  it("requires enrollment for content and never exposes drafts to learners", () => {
    expect(canAccessCourseContent(student, published, null)).toBe(false);
    expect(canAccessCourseContent(student, published, enrollment)).toBe(true);
    expect(canAccessCourseContent(student, archived, enrollment)).toBe(true);
    expect(canAccessCourseContent(student, draft, enrollment)).toBe(false);
    expect(canAccessCourseContent(owner, draft, null)).toBe(true);
    expect(canAccessCourseContent(null, published, enrollment)).toBe(false);
  });

  it("only lets students enroll in published courses", () => {
    expect(canEnroll(student, published)).toBe(true);
    expect(canEnroll(student, draft)).toBe(false);
    expect(canEnroll(student, archived)).toBe(false);
    expect(canEnroll(owner, published)).toBe(false);
    expect(canEnroll(null, published)).toBe(false);
  });
});

describe("learner records", () => {
  it("lets learners see only their own grades", () => {
    expect(canViewLearnerRecords(student, student.id, published)).toBe(true);
    expect(canViewLearnerRecords(otherStudent, student.id, published)).toBe(false);
    expect(canViewLearnerRecords(owner, student.id, published)).toBe(true);
    expect(canViewLearnerRecords(otherInstructor, student.id, published)).toBe(false);
    expect(canViewLearnerRecords(admin, student.id, published)).toBe(true);
  });

  it("lets authors and course managers moderate posts", () => {
    const post = { authorId: student.id };
    expect(canModeratePost(student, post, published)).toBe(true);
    expect(canModeratePost(otherStudent, post, published)).toBe(false);
    expect(canModeratePost(owner, post, published)).toBe(true);
  });
});
