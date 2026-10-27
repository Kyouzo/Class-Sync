import { describe, expect, it } from "vitest";
import { getCourseRoster } from "@/server/services/analytics";
import { claimCertificate, getLearnerStanding, setLessonCompletion } from "@/server/services/progress";
import { submitQuizAttempt } from "@/server/services/quizzes";
import { answers, createCourse, createUser, db, enrollDirect, expectAppError } from "./helpers";

describe("progress tracking", () => {
  it("tracks lesson completion and progress percentage", async () => {
    const instructor = await createUser("INSTRUCTOR");
    const student = await createUser("STUDENT");
    const { course, lessonIds } = await createCourse(instructor, { lessons: 4 });
    await enrollDirect(student, course.id);

    await setLessonCompletion(db, student, lessonIds[0], true);
    await setLessonCompletion(db, student, lessonIds[1], true);
    await setLessonCompletion(db, student, lessonIds[1], true); // idempotent
    let standing = await getLearnerStanding(db, student.id, course.id);
    expect(standing.evaluation.progress).toBe(50);
    expect(await db.lessonProgress.count({ where: { userId: student.id } })).toBe(2);

    await setLessonCompletion(db, student, lessonIds[0], false);
    standing = await getLearnerStanding(db, student.id, course.id);
    expect(standing.evaluation.progress).toBe(25);
  });

  it("does not let non-enrolled users record progress", async () => {
    const instructor = await createUser("INSTRUCTOR");
    const student = await createUser("STUDENT");
    const { lessonIds } = await createCourse(instructor);
    await expectAppError(setLessonCompletion(db, student, lessonIds[0], true), "FORBIDDEN");
    await expectAppError(setLessonCompletion(db, instructor, lessonIds[0], true), "FORBIDDEN");
  });

  it("shows instructors per-student progress and grades", async () => {
    const instructor = await createUser("INSTRUCTOR");
    const [a, b] = [await createUser("STUDENT"), await createUser("STUDENT")];
    const { course, lessonIds, quiz } = await createCourse(instructor, { lessons: 2 });
    await enrollDirect(a, course.id);
    await enrollDirect(b, course.id);
    await setLessonCompletion(db, a, lessonIds[0], true);
    await submitQuizAttempt(db, a, { quizId: quiz!.id, answers: answers(quiz!, 1) });

    const roster = await getCourseRoster(db, instructor, course.id);
    const rowA = roster.students.find((s) => s.user.id === a.id)!;
    expect(rowA).toMatchObject({ progress: 50, grade: 50 });
    expect(roster.students.find((s) => s.user.id === b.id)).toMatchObject({ progress: 0, grade: 0 });
    expect(roster.quizStats[0]).toMatchObject({ attempted: 1, averageBest: 50, passRate: 0 });
    expect(roster.summary).toMatchObject({ enrolled: 2, completed: 0, averageProgress: 25 });
  });
});

describe("completion and certificates", () => {
  it("issues a certificate only once every requirement is met", async () => {
    const instructor = await createUser("INSTRUCTOR", "Ivy Instructor");
    const student = await createUser("STUDENT", "Stu Dent");
    const { course, lessonIds, quiz } = await createCourse(instructor, { lessons: 2, quiz: { passingScore: 100 } });
    await enrollDirect(student, course.id);

    await setLessonCompletion(db, student, lessonIds[0], true);
    await setLessonCompletion(db, student, lessonIds[1], true);
    expect(await db.certificate.count()).toBe(0); // quiz not passed yet
    await expectAppError(claimCertificate(db, student, course.id), "FORBIDDEN");

    await submitQuizAttempt(db, student, { quizId: quiz!.id, answers: answers(quiz!, 1) });
    expect(await db.certificate.count()).toBe(0); // failed attempt

    await submitQuizAttempt(db, student, { quizId: quiz!.id, answers: answers(quiz!) });
    const certificate = await db.certificate.findFirstOrThrow({ where: { userId: student.id } });
    expect(certificate).toMatchObject({ recipientName: "Stu Dent", courseTitle: course.title, instructorName: "Ivy Instructor" });
    expect(Number(certificate.finalGrade)).toBe(100);

    const enrollment = await db.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: student.id, courseId: course.id } } });
    expect(enrollment.status).toBe("COMPLETED");
    expect(enrollment.completedAt).not.toBeNull();

    // Claiming again is idempotent.
    const claimed = await claimCertificate(db, student, course.id);
    expect(claimed.id).toBe(certificate.id);
    expect(await db.certificate.count()).toBe(1);
  });

  it("respects a configured minimum course grade", async () => {
    const instructor = await createUser("INSTRUCTOR");
    const student = await createUser("STUDENT");
    const { course, lessonIds, quiz } = await createCourse(instructor, {
      lessons: 1,
      quiz: { passingScore: 50, questions: 4 },
      minimumGrade: 90,
    });
    await enrollDirect(student, course.id);
    await setLessonCompletion(db, student, lessonIds[0], true);
    await submitQuizAttempt(db, student, { quizId: quiz!.id, answers: answers(quiz!, 3) }); // 75%: passes quiz, misses grade
    expect(await db.certificate.count()).toBe(0);
    const standing = await getLearnerStanding(db, student.id, course.id);
    expect(standing.evaluation.unmet.join(" ")).toMatch(/at least 90%/);

    await submitQuizAttempt(db, student, { quizId: quiz!.id, answers: answers(quiz!) });
    expect(await db.certificate.count()).toBe(1);
  });

  it("honours courses that only require lessons", async () => {
    const instructor = await createUser("INSTRUCTOR");
    const student = await createUser("STUDENT");
    const { course, lessonIds } = await createCourse(instructor, { lessons: 1, requirePassingQuizzes: false });
    await enrollDirect(student, course.id);
    const result = await setLessonCompletion(db, student, lessonIds[0], true);
    expect(result?.certificate).not.toBeNull();
  });
});
