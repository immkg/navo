import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Badge from "./Badge";

describe("Badge", () => {
  it("renders its children text", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("defaults to the neutral tone", () => {
    render(<Badge>Label</Badge>);
    expect(screen.getByText("Label").className).toContain(
      "bg-surface-alt text-muted-foreground"
    );
  });

  const toneStyles = {
    neutral: "bg-surface-alt text-muted-foreground",
    primary: "bg-primary/10 text-primary",
    danger: "bg-danger/10 text-danger",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    accent: "bg-accent/10 text-accent",
  };

  Object.entries(toneStyles).forEach(([tone, expectedClasses]) => {
    it(`applies the ${tone} tone's exact class combination`, () => {
      render(<Badge tone={tone}>Label</Badge>);
      expect(screen.getByText("Label").className).toContain(expectedClasses);
    });
  });

  it("falls back to the neutral styling for an unknown tone", () => {
    render(<Badge tone="not-a-real-tone">Label</Badge>);
    expect(screen.getByText("Label").className).toContain(toneStyles.neutral);
  });

  it("merges a custom className additively", () => {
    render(<Badge className="ml-2">Label</Badge>);
    const badge = screen.getByText("Label");

    expect(badge.className).toContain("ml-2");
    expect(badge.className).toContain(toneStyles.neutral);
  });

  it("renders as a <span>", () => {
    render(<Badge>Label</Badge>);
    expect(screen.getByText("Label").tagName).toBe("SPAN");
  });
});
