import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Card from "./Card";

describe("Card", () => {
  it("renders its children", () => {
    render(<Card>Hello</Card>);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("applies the default padding, rounding, and border classes", () => {
    render(<Card data-testid="card">Content</Card>);
    const card = screen.getByTestId("card");

    expect(card.className).toContain("p-4 sm:p-5"); // padding=md default
    expect(card.className).toContain("rounded-3xl"); // rounded=lg default
    expect(card.className).toContain("border border-border"); // bordered=true default
    expect(card.className).toContain("bg-surface");
    expect(card.tagName).toBe("DIV");
  });

  it("applies sm padding and md rounding when requested", () => {
    render(
      <Card data-testid="card" padding="sm" rounded="md">
        Content
      </Card>
    );
    const card = screen.getByTestId("card");

    expect(card.className).toContain("p-3 sm:p-4");
    expect(card.className).toContain("rounded-2xl");
  });

  it("treats an unknown padding/rounded value like the md/lg default", () => {
    render(
      <Card data-testid="card" padding="unknown" rounded="unknown">
        Content
      </Card>
    );
    const card = screen.getByTestId("card");

    expect(card.className).toContain("p-4 sm:p-5");
    expect(card.className).toContain("rounded-3xl");
  });

  it("omits the border classes when bordered is false", () => {
    render(
      <Card data-testid="card" bordered={false}>
        Content
      </Card>
    );
    const card = screen.getByTestId("card");

    expect(card.className).not.toContain("border-border");
  });

  it("renders as a different element when `as` is provided", () => {
    render(
      <Card as="section" data-testid="card">
        Content
      </Card>
    );
    expect(screen.getByTestId("card").tagName).toBe("SECTION");
  });

  it("merges a custom className additively instead of replacing the base classes", () => {
    render(
      <Card data-testid="card" className="mt-4">
        Content
      </Card>
    );
    const card = screen.getByTestId("card");

    expect(card.className).toContain("mt-4");
    expect(card.className).toContain("bg-surface");
  });
});
