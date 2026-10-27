import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QuizForm, type QuizQuestionView } from "@/components/quiz-form";

const questions: QuizQuestionView[] = [
  { id: "q1", prompt: "Which protocol serves web pages?", points: 1, choices: [{ id: "c1", text: "HTTP" }, { id: "c2", text: "SMTP" }] },
  { id: "q2", prompt: "Which element wraps main content?", points: 2, choices: [{ id: "c3", text: "<main>" }, { id: "c4", text: "<div>" }] },
];

describe("QuizForm", () => {
  it("renders every question and choice as an accessible radio group", () => {
    render(<QuizForm questions={questions} action={vi.fn()} />);
    expect(screen.getByRole("group", { name: /which protocol serves web pages/i })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(screen.getByText("(2 points)")).toBeInTheDocument();
  });

  it("keeps submit disabled until every question is answered", async () => {
    const user = userEvent.setup();
    render(<QuizForm questions={questions} action={vi.fn()} />);
    const submit = screen.getByRole("button", { name: /submit answers/i });
    expect(submit).toBeDisabled();
    expect(screen.getByText("0 of 2 answered")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "HTTP" }));
    expect(screen.getByText("1 of 2 answered")).toBeInTheDocument();
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: "<main>" }));
    expect(screen.getByText("2 of 2 answered")).toBeInTheDocument();
    expect(submit).toBeEnabled();
  });

  it("submits answers keyed by question id and shows server errors", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async (_state: unknown, formData: FormData) => {
      expect(formData.get("answer:q1")).toBe("c2");
      expect(formData.get("answer:q2")).toBe("c3");
      return { error: "You have used all attempts for this quiz." };
    });
    render(<QuizForm questions={questions} action={action} />);
    await user.click(screen.getByRole("radio", { name: "SMTP" }));
    await user.click(screen.getByRole("radio", { name: "<main>" }));
    await user.click(screen.getByRole("button", { name: /submit answers/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You have used all attempts");
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("never renders correctness information", () => {
    const { container } = render(<QuizForm questions={questions} action={vi.fn()} />);
    expect(container.innerHTML).not.toMatch(/correct/i);
  });
});
