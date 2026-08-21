import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Modal from "./Modal";

function renderModal(props) {
  return render(
    <Modal open={true} onClose={vi.fn()} {...props}>
      Body content
    </Modal>
  );
}

describe("Modal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <Modal open={false} onClose={vi.fn()}>
        Body content
      </Modal>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the title, children, and footer when open", () => {
    render(
      <Modal open={true} onClose={vi.fn()} title="Confirm" footer={<button>OK</button>}>
        Body content
      </Modal>
    );

    expect(screen.getByText("Confirm")).toBeInTheDocument();
    expect(screen.getByText("Body content")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "OK" })).toBeInTheDocument();
  });

  it("does not render a title bar when no title is given", () => {
    renderModal({ title: undefined });
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });

  it("calls onClose when the backdrop is clicked (closeOnBackdrop defaults to true)", () => {
    const onClose = vi.fn();
    renderModal({ onClose, title: "Confirm" });

    const backdrop = screen.getByRole("dialog").parentElement;
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when the dialog panel itself is clicked", () => {
    const onClose = vi.fn();
    renderModal({ onClose, title: "Confirm" });

    fireEvent.click(screen.getByRole("dialog"));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not call onClose on backdrop click when closeOnBackdrop is false", () => {
    const onClose = vi.fn();
    renderModal({ onClose, title: "Confirm", closeOnBackdrop: false });

    const backdrop = screen.getByRole("dialog").parentElement;
    fireEvent.click(backdrop);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose when the close (X) button is clicked", () => {
    const onClose = vi.fn();
    renderModal({ onClose, title: "Confirm" });

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape is pressed while open", () => {
    const onClose = vi.fn();
    renderModal({ onClose, title: "Confirm" });

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not attach an Escape listener when closed", () => {
    const onClose = vi.fn();
    render(
      <Modal open={false} onClose={onClose} title="Confirm">
        Body content
      </Modal>
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });

  it.each([
    ["sm", "sm:max-w-sm"],
    ["md", "sm:max-w-md"],
    ["lg", "sm:max-w-lg"],
  ])("applies the %s size's max-width class", (size, expectedClass) => {
    renderModal({ title: "Confirm", size });

    expect(screen.getByRole("dialog").className).toContain(expectedClass);
  });

  it("defaults to the md size's max-width class when size is omitted", () => {
    renderModal({ title: "Confirm" });

    expect(screen.getByRole("dialog").className).toContain("sm:max-w-md");
  });
});
