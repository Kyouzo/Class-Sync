import { describe, expect, it } from "vitest";
import { courseGrade, evaluateCompletion, gradeSubmission, progressPercent, SubmissionError } from "@/server/grading";

const questions = [
  { id: "q1", points: 1, choices: [{ id: "q1a", isCorrect: true }, { id: "q1b", isCorrect: false }] },
  { id: "q2", points: 2, choices: [{ id: "q2a", isCorrect: false }, { id: "q2b", isCorrect: true }] },
  { id: "q3", points: 1, choices: [{ id: "q3a", isCorrect: true }, { id: "q3b", isCorrect: false }] },
];

describe("gradeSubmission", () => {
  it("awards full marks for all-correct answers", () => {
    const result = gradeSubmission(questions, { q1: "q1a", q2: "q2b", q3: "q3a" }, 70);
    expect(result).toMatchObject({ score: 4, maxScore: 4, percentage: 100, passed: true });
    expect(result.responses.every((r) => r.isCorrect)).toBe(true);
  });

  it("weights questions by points and applies the passing score", () => {
    const result = gradeSubmission(questions, { q1: "q1a", q2: "q2a", q3: "q3a" }, 70);
    expect(result.score).toBe(2);
    expect(result.percentage).toBe(50);
    expect(result.passed).toBe(false);
    expect(result.responses.find((r) => r.questionId === "q2")).toMatchObject({ isCorrect: false, pointsAwarded: 0 });
  });

  it("treats the passing score as inclusive", () => {
    expect(gradeSubmission(questions, { q1: "q1a", q2: "q2a", q3: "q3a" }, 50).passed).toBe(true);
  });

  it("rounds percentages to two decimals", () => {
    const three = questions.map((q) => ({ ...q, points: 1 }));
    expect(gradeSubmission(three, { q1: "q1a", q2: "q2a", q3: "q3b" }, 0).percentage).toBe(33.33);
  });

  it("rejects unanswered questions", () => {
    expect(() => gradeSubmission(questions, { q1: "q1a", q2: "q2b" }, 70)).toThrow(SubmissionError);
  });

  it("rejects answers for unknown questions", () => {
    expect(() => gradeSubmission(questions, { q1: "q1a", q2: "q2b", q3: "q3a", qX: "q1a" }, 70)).toThrow(/unknown question/);
  });

  it("rejects a choice that belongs to a different question", () => {
    expect(() => gradeSubmission(questions, { q1: "q2b", q2: "q2b", q3: "q3a" }, 70)).toThrow(/invalid answer/);
  });

  it("rejects quizzes without questions", () => {
    expect(() => gradeSubmission([], {}, 70)).toThrow(/no questions/);
  });
});

describe("progressPercent", () => {
  it("handles empty courses and clamps over-completion", () => {
    expect(progressPercent(0, 0)).toBe(0);
    expect(progressPercent(1, 3)).toBe(33.33);
    expect(progressPercent(5, 4)).toBe(100);
  });
});

describe("courseGrade", () => {
  it("averages best scores of required quizzes, counting unattempted as zero", () => {
    expect(
      courseGrade([
        { quizId: "a", isRequired: true, bestPercentage: 90, passed: true },
        { quizId: "b", isRequired: true, bestPercentage: null, passed: false },
        { quizId: "c", isRequired: false, bestPercentage: 10, passed: false },
      ]),
    ).toBe(45);
  });

  it("is null when there are no required quizzes", () => {
    expect(courseGrade([{ quizId: "a", isRequired: false, bestPercentage: 80, passed: true }])).toBeNull();
  });
});

describe("evaluateCompletion", () => {
  const all = { requireAllLessons: true, requirePassingQuizzes: true, minimumGrade: null };
  const passedQuiz = { quizId: "a", isRequired: true, bestPercentage: 80, passed: true };

  it("is eligible when every requirement is satisfied", () => {
    const result = evaluateCompletion(all, { totalLessons: 3, completedLessons: 3, quizzes: [passedQuiz] });
    expect(result).toMatchObject({ eligible: true, progress: 100, grade: 80, unmet: [] });
  });

  it("requires every lesson when configured", () => {
    const result = evaluateCompletion(all, { totalLessons: 3, completedLessons: 2, quizzes: [passedQuiz] });
    expect(result.eligible).toBe(false);
    expect(result.unmet[0]).toMatch(/2\/3/);
  });

  it("ignores lessons when not required", () => {
    const result = evaluateCompletion({ ...all, requireAllLessons: false }, { totalLessons: 3, completedLessons: 0, quizzes: [passedQuiz] });
    expect(result.eligible).toBe(true);
  });

  it("requires passing all required quizzes but not optional ones", () => {
    const optionalFail = { quizId: "b", isRequired: false, bestPercentage: 0, passed: false };
    expect(evaluateCompletion(all, { totalLessons: 1, completedLessons: 1, quizzes: [passedQuiz, optionalFail] }).eligible).toBe(true);
    const requiredFail = { ...optionalFail, isRequired: true };
    expect(evaluateCompletion(all, { totalLessons: 1, completedLessons: 1, quizzes: [passedQuiz, requiredFail] }).eligible).toBe(false);
  });

  it("enforces a minimum course grade", () => {
    const result = evaluateCompletion({ ...all, minimumGrade: 85 }, { totalLessons: 1, completedLessons: 1, quizzes: [passedQuiz] });
    expect(result.eligible).toBe(false);
    expect(result.unmet.join(" ")).toMatch(/at least 85%/);
  });

  it("never marks an empty course as complete", () => {
    expect(evaluateCompletion(all, { totalLessons: 0, completedLessons: 0, quizzes: [] }).eligible).toBe(false);
  });
});
