import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown, Pagination, StatusBadge } from "@/components/shared";
import { Progress } from "@/components/ui/progress";

describe("Pagination", () => {
  it("preserves filters in page links and disables unavailable directions", () => {
    render(<Pagination page={1} pageCount={3} basePath="/courses" params={{ q: "sql", category: undefined }} />);
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /next/i })).toHaveAttribute("href", "/courses?q=sql&page=2");
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
  });

  it("renders nothing for a single page", () => {
    const { container } = render(<Pagination page={1} pageCount={1} basePath="/courses" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("Progress", () => {
  it("exposes a clamped value to assistive technology", () => {
    render(<Progress value={142} label="Course progress" />);
    expect(screen.getByRole("progressbar", { name: "Course progress" })).toHaveAttribute("aria-valuenow", "100");
  });
});

describe("StatusBadge", () => {
  it("labels course status", () => {
    render(<StatusBadge status="PUBLISHED" />);
    expect(screen.getByText("Published")).toBeInTheDocument();
  });
});

describe("Markdown", () => {
  it("renders formatting but not raw HTML", () => {
    const { container } = render(<Markdown>{"## Title\n\n<script>alert(1)</script>\n\n- item"}</Markdown>);
    expect(screen.getByRole("heading", { name: "Title" })).toBeInTheDocument();
    expect(screen.getByRole("listitem")).toHaveTextContent("item");
    expect(container.querySelector("script")).toBeNull();
  });
});
