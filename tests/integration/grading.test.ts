import { describe, expect, it } from "vitest";
import { getAttemptReview, getQuizForLearner, saveQuestion, submitQuizAttempt } from "@/server/services/quizzes";
import { answers, createCourse, createUser, db, enrollDirect, expectAppError } from "./helpers";

async function setup(quiz: NonNullable<Parameters<typeof createCourse>[1]>["quiz"] = {}) {
  const instructor = await createUser("INSTRUCTOR");
  const student = await createUser("STUDENT");
  const fixture = await createCourse(instructor, { quiz });
  await enrollDirect(student, fixture.course.id);
  return { instructor, student, ...fixture, quiz: fixture.quiz! };
}

describe("quiz grading", () => {
  it("never sends correct answers to a learner before submission", async () => {
    const { student, quiz } = await setup();
    const view = await getQuizForLearner(db, student, quiz.id);
    expect(view.canSubmit).toBe(true);
    for (const question of view.quiz.questions) {
      for (const choice of question.choices) {
        expect(Object.keys(choice).sort()).toEqual(["id", "text"]);
      }
    }
    expect(JSON.stringify(view.quiz)).not.toMatch(/isCorrect|explanation/);
  });

  it("grades automatically and persists the attempt with its responses", async () => {
    const { student, quiz } = await setup({ questions: 4, passingScore: 70 });
    const attempt = await submitQuizAttempt(db, student, { quizId: quiz.id, answers: answers(quiz, 3) });
    expect(attempt).toMatchObject({ attemptNumber: 1, score: 3, maxScore: 4, passed: true });
    expect(Number(attempt.percentage)).toBe(75);

    const stored = await db.quizAttempt.findUniqueOrThrow({ where: { id: attempt.id }, include: { responses: true } });
    expect(stored.responses).toHaveLength(4);
    expect(stored.responses.filter((r) => r.isCorrect)).toHaveLength(3);

    const review = await getAttemptReview(db, student, attempt.id);
    expect(review.quiz.questions[0].choices.some((c) => c.isCorrect)).toBe(true);
  });

  it("records a failing attempt and numbers attempts sequentially", async () => {
    const { student, quiz } = await setup({ passingScore: 100 });
    const first = await submitQuizAttempt(db, student, { quizId: quiz.id, answers: answers(quiz, 1) });
    expect(first.passed).toBe(false);
    const second = await submitQuizAttempt(db, student, { quizId: quiz.id, answers: answers(quiz) });
    expect(second).toMatchObject({ attemptNumber: 2, passed: true });
  });

  it("enforces the maximum number of attempts", async () => {
    const { student, quiz } = await setup({ maxAttempts: 1 });
    await submitQuizAttempt(db, student, { quizId: quiz.id, answers: answers(quiz, 0) });
    await expectAppError(submitQuizAttempt(db, student, { quizId: quiz.id, answers: answers(quiz) }), "FORBIDDEN");
    const view = await getQuizForLearner(db, student, quiz.id);
    expect(view.attemptsRemaining).toBe(0);
    expect(view.canSubmit).toBe(false);
  });

  it("rejects incomplete, foreign or malformed submissions without storing anything", async () => {
    const { student, quiz } = await setup();
    const [q1, q2] = quiz.questions;
    await expectAppError(submitQuizAttempt(db, student, { quizId: quiz.id, answers: { [q1.id]: q1.correct } }), "VALIDATION");
    await expectAppError(submitQuizAttempt(db, student, { quizId: quiz.id, answers: { [q1.id]: q2.correct, [q2.id]: q2.correct } }), "VALIDATION");
    await expectAppError(submitQuizAttempt(db, student, { quizId: quiz.id, answers: "nope" }), "VALIDATION");
    expect(await db.quizAttempt.count()).toBe(0);
  });

  it("only lets enrolled students submit", async () => {
    const { instructor, quiz } = await setup();
    const outsider = await createUser("STUDENT");
    await expectAppError(submitQuizAttempt(db, outsider, { quizId: quiz.id, answers: answers(quiz) }), "FORBIDDEN");
    await expectAppError(getQuizForLearner(db, outsider, quiz.id), "FORBIDDEN");
    await expectAppError(submitQuizAttempt(db, instructor, { quizId: quiz.id, answers: answers(quiz) }), "FORBIDDEN");
  });

  it("keeps stored grades when questions are edited afterwards", async () => {
    const { instructor, student, quiz } = await setup();
    const attempt = await submitQuizAttempt(db, student, { quizId: quiz.id, answers: answers(quiz) });
    await saveQuestion(db, instructor, quiz.id, quiz.questions[0].id, {
      prompt: "Rewritten question",
      points: "5",
      choices: ["New A", "New B"],
      correctIndex: "1",
    });
    const stored = await db.quizAttempt.findUniqueOrThrow({ where: { id: attempt.id }, include: { responses: true } });
    expect(stored.score).toBe(2);
    expect(Number(stored.percentage)).toBe(100);
    expect(stored.responses.every((r) => r.isCorrect)).toBe(true);
  });
});
