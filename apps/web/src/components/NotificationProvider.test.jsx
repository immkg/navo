import { useState } from "react";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NotificationProvider } from "./NotificationProvider";
import { useNotifications } from "../hooks/useNotifications";

function Harness() {
  const { notify, confirm } = useNotifications();
  const [result, setResult] = useState("none");

  return (
    <div>
      <button onClick={() => notify("Something broke")}>notify-error</button>
      <button onClick={() => notify("Saved!", { type: "success" })}>
        notify-success
      </button>
      <button onClick={() => notify("FYI", { type: "info" })}>
        notify-info
      </button>
      <button
        onClick={async () =>
          setResult(String(await confirm("Do you want to proceed?")))
        }
      >
        confirm-default
      </button>
      <button
        onClick={async () =>
          setResult(
            String(
              await confirm("Delete this item?", {
                title: "Delete item?",
                confirmLabel: "Delete",
                cancelLabel: "Nevermind",
                danger: true,
              })
            )
          )
        }
      >
        confirm-danger
      </button>
      <p data-testid="result">{result}</p>
    </div>
  );
}

function renderHarness() {
  return render(
    <NotificationProvider>
      <Harness />
    </NotificationProvider>
  );
}

describe("NotificationProvider / useNotifications", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("notify() shows a toast with the message and defaults to error styling", () => {
    renderHarness();
    fireEvent.click(screen.getByText("notify-error"));

    const toast = screen.getByRole("alert");
    expect(toast).toHaveTextContent("Something broke");
    expect(toast.className).toContain("border-danger/30");
    expect(toast.className).toContain("bg-danger/10");
    expect(toast.className).toContain("text-danger");
  });

  it("notify() applies success styling for type: success", () => {
    renderHarness();
    fireEvent.click(screen.getByText("notify-success"));

    const toast = screen.getByRole("alert");
    expect(toast).toHaveTextContent("Saved!");
    expect(toast.className).toContain("border-success/30");
    expect(toast.className).toContain("bg-success/10");
    expect(toast.className).toContain("text-success");
  });

  it("notify() applies info styling for type: info", () => {
    renderHarness();
    fireEvent.click(screen.getByText("notify-info"));

    const toast = screen.getByRole("alert");
    expect(toast).toHaveTextContent("FYI");
    expect(toast.className).toContain("border-primary/30");
    expect(toast.className).toContain("bg-primary/10");
    expect(toast.className).toContain("text-primary");
  });

  it("stacks multiple toasts at once", () => {
    renderHarness();
    fireEvent.click(screen.getByText("notify-error"));
    fireEvent.click(screen.getByText("notify-success"));
    fireEvent.click(screen.getByText("notify-info"));

    expect(screen.getAllByRole("alert")).toHaveLength(3);
  });

  it("clicking the dismiss button removes the toast immediately", () => {
    renderHarness();
    fireEvent.click(screen.getByText("notify-error"));
    expect(screen.getAllByRole("alert")).toHaveLength(1);

    fireEvent.click(screen.getByLabelText("Dismiss"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("auto-dismisses a toast after its duration (default 5000ms)", () => {
    vi.useFakeTimers();
    renderHarness();
    fireEvent.click(screen.getByText("notify-error"));
    expect(screen.getAllByRole("alert")).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(screen.getAllByRole("alert")).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("confirm() resolves true when the confirm button is clicked, with default labels", async () => {
    renderHarness();
    fireEvent.click(screen.getByText("confirm-default"));

    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
    expect(screen.getByText("Do you want to proceed?")).toBeInTheDocument();
    const confirmButton = screen.getByRole("button", { name: "Confirm" });
    // default (non-danger) confirm uses the primary Button variant
    expect(confirmButton.className).toContain("bg-primary");

    await act(async () => {
      fireEvent.click(confirmButton);
    });

    expect(screen.getByTestId("result")).toHaveTextContent("true");
  });

  it("confirm() resolves false when the cancel button is clicked", async () => {
    renderHarness();
    fireEvent.click(screen.getByText("confirm-default"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    });

    expect(screen.getByTestId("result")).toHaveTextContent("false");
  });

  it("confirm() honors title/confirmLabel/cancelLabel/danger options", async () => {
    renderHarness();
    fireEvent.click(screen.getByText("confirm-danger"));

    expect(screen.getByText("Delete item?")).toBeInTheDocument();
    expect(screen.getByText("Delete this item?")).toBeInTheDocument();

    const deleteButton = screen.getByRole("button", { name: "Delete" });
    expect(deleteButton.className).toContain("bg-danger");
    expect(
      screen.getByRole("button", { name: "Nevermind" })
    ).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(deleteButton);
    });

    expect(screen.getByTestId("result")).toHaveTextContent("true");
  });

  it("does not resolve the confirm promise when clicking the backdrop (closeOnBackdrop is false)", () => {
    renderHarness();
    fireEvent.click(screen.getByText("confirm-default"));

    const dialog = screen.getByRole("dialog");
    // the backdrop is the dialog's parent; clicking it directly (not the
    // dialog content) should be a no-op since the Modal is opened with
    // closeOnBackdrop={false}.
    fireEvent.click(dialog.parentElement);

    expect(screen.getByTestId("result")).toHaveTextContent("none");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("useNotifications", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("throws when used outside a NotificationProvider", () => {
    expect(() => renderHook(() => useNotifications())).toThrow(
      "useNotifications must be used within a NotificationProvider"
    );
  });
});
