import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Button from "./Button";

describe("Button", () => {
  it("renders its children and responds to clicks", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);

    const button = screen.getByRole("button", { name: "Save" });
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("defaults to type=button so it never submits a form by accident", () => {
    render(<Button>Cancel</Button>);

    expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute(
      "type",
      "button"
    );
  });

  it("lets a caller override type (e.g. type=submit)", () => {
    render(<Button type="submit">Create</Button>);

    expect(screen.getByRole("button", { name: "Create" })).toHaveAttribute(
      "type",
      "submit"
    );
  });

  it("disables the button and blocks clicks when disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Delete
      </Button>
    );

    const button = screen.getByRole("button", { name: "Delete" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
