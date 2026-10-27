/** Pure grading and completion logic. No database access, so it is trivially unit-testable. */

export type GradableQuestion = {
  id: string;
  points: number;
  choices: { id: string; isCorrect: boolean }[];
};

export type GradedResponse = {
  questionId: string;
  choiceId: string;
  isCorrect: boolean;
  pointsAwarded: number;
};

export type GradeResult = {
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  responses: GradedResponse[];
};

export class SubmissionError extends Error {}

/** Rounds to two decimals, matching the DECIMAL(5,2) columns. */
export const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Grades a submission. Every question must be answered exactly once with a choice that belongs to it;
 * anything else is rejected rather than silently scored.
 */
export function gradeSubmission(
  questions: GradableQuestion[],
  answers: Record<string, string>,
  passingScore: number,
): GradeResult {
  if (questions.length === 0) throw new SubmissionError("This quiz has no questions.");
  const questionIds = new Set(questions.map((q) => q.id));
  for (const key of Object.keys(answers)) {
    if (!questionIds.has(key)) throw new SubmissionError("Submission contains an unknown question.");
  }

  let score = 0;
  let maxScore = 0;
  const responses: GradedResponse[] = [];
  for (const question of questions) {
    maxScore += question.points;
    const choiceId = answers[question.id];
    if (!choiceId) throw new SubmissionError("Please answer every question before submitting.");
    const choice = question.choices.find((c) => c.id === choiceId);
    if (!choice) throw new SubmissionError("Submission contains an invalid answer choice.");
    const pointsAwarded = choice.isCorrect ? question.points : 0;
    score += pointsAwarded;
    responses.push({ questionId: question.id, choiceId, isCorrect: choice.isCorrect, pointsAwarded });
  }

  const percentage = maxScore === 0 ? 0 : round2((score / maxScore) * 100);
  return { score, maxScore, percentage, passed: percentage >= passingScore, responses };
}

export function progressPercent(completed: number, total: number): number {
  if (total <= 0) return 0;
  return round2((Math.min(completed, total) / total) * 100);
}

export type QuizStanding = { quizId: string; isRequired: boolean; bestPercentage: number | null; passed: boolean };

/** Course grade = mean of best scores on required quizzes (unattempted counts as 0). Null when there are none. */
export function courseGrade(quizzes: QuizStanding[]): number | null {
  const required = quizzes.filter((q) => q.isRequired);
  if (required.length === 0) return null;
  const total = required.reduce((sum, q) => sum + (q.bestPercentage ?? 0), 0);
  return round2(total / required.length);
}

export type CompletionRequirements = {
  requireAllLessons: boolean;
  requirePassingQuizzes: boolean;
  minimumGrade: number | null;
};

export type CompletionInput = {
  totalLessons: number;
  completedLessons: number;
  quizzes: QuizStanding[];
};

export type CompletionEvaluation = {
  eligible: boolean;
  progress: number;
  grade: number | null;
  unmet: string[];
};

/** Decides whether a learner has satisfied a course's configured completion requirements. */
export function evaluateCompletion(req: CompletionRequirements, input: CompletionInput): CompletionEvaluation {
  const unmet: string[] = [];
  const progress = progressPercent(input.completedLessons, input.totalLessons);
  const grade = courseGrade(input.quizzes);
  const requiredQuizzes = input.quizzes.filter((q) => q.isRequired);

  if (input.totalLessons === 0 && requiredQuizzes.length === 0) {
    unmet.push("The course has no lessons or required quizzes yet.");
  }
  if (req.requireAllLessons && input.completedLessons < input.totalLessons) {
    unmet.push(`Complete all lessons (${Math.min(input.completedLessons, input.totalLessons)}/${input.totalLessons} done).`);
  }
  if (req.requirePassingQuizzes) {
    const failing = requiredQuizzes.filter((q) => !q.passed);
    if (failing.length > 0) unmet.push(`Pass all required quizzes (${failing.length} remaining).`);
  }
  // A minimum grade is only meaningful when the course has graded (required) quizzes.
  if (req.minimumGrade !== null && grade !== null && grade < req.minimumGrade) {
    unmet.push(`Reach a course grade of at least ${req.minimumGrade}% (currently ${grade}%).`);
  }
  return { eligible: unmet.length === 0, progress, grade, unmet };
}
