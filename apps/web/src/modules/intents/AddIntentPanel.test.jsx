import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import * as intentsApi from "../../api/intents";
import * as aiApi from "../../api/ai";
import AddIntentPanel from "./AddIntentPanel";

// TanStack Query's mutationFn is invoked with the variables as the first
// argument plus an internal context object as a second — assert on the
// first argument only rather than the exact call signature.
function firstArgsOf(mockFn) {
  return mockFn.mock.calls.map((call) => call[0]);
}

function getTextField() {
  return screen.getByPlaceholderText(
    "What do you want to do? (e.g., Plan a vacation)"
  );
}

describe("AddIntentPanel", () => {
  it("creates a single intent from the text field and clears it", async () => {
    vi.spyOn(intentsApi, "createIntent").mockResolvedValue({
      id: "new",
      title: "Renew passport",
    });

    renderWithProviders(<AddIntentPanel onOpenDetails={vi.fn()} />);

    const input = getTextField();
    fireEvent.change(input, { target: { value: "Renew passport" } });
    fireEvent.click(screen.getByText("Add"));

    await waitFor(() =>
      expect(firstArgsOf(intentsApi.createIntent)).toEqual([
        { title: "Renew passport" },
      ])
    );
    await waitFor(() => expect(input).toHaveValue(""));
  });

  it("submits on Enter and inserts a newline on Shift+Enter", async () => {
    vi.spyOn(intentsApi, "createIntent").mockResolvedValue({ id: "new" });

    renderWithProviders(<AddIntentPanel onOpenDetails={vi.fn()} />);

    const input = getTextField();
    fireEvent.change(input, { target: { value: "Renew passport" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(intentsApi.createIntent).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(firstArgsOf(intentsApi.createIntent)).toEqual([
        { title: "Renew passport" },
      ])
    );
  });

  it("calls onOpenDetails with the current text", () => {
    const onOpenDetails = vi.fn();
    renderWithProviders(<AddIntentPanel onOpenDetails={onOpenDetails} />);

    const input = getTextField();
    fireEvent.change(input, { target: { value: "Renew passport" } });
    fireEvent.click(
      screen.getByText("+ Add details (priority, dates, description)")
    );

    expect(onOpenDetails).toHaveBeenCalledWith("Renew passport");
  });

  describe("split with AI", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("shows a review list and creates only the checked/edited drafts", async () => {
      vi.spyOn(aiApi, "splitIntent").mockResolvedValue({
        intents: [
          { title: "Renew passport", description: null, priority: "high" },
          { title: "Book flights", description: null, priority: "medium" },
        ],
      });
      vi.spyOn(intentsApi, "createIntent").mockResolvedValue({ id: "x" });

      renderWithProviders(<AddIntentPanel onOpenDetails={vi.fn()} />);

      const input = getTextField();
      fireEvent.change(input, {
        target: { value: "renew passport, book flights" },
      });
      fireEvent.click(screen.getByText("✨ Split with AI"));

      await waitFor(() =>
        expect(aiApi.splitIntent).toHaveBeenCalledWith(
          "renew passport, book flights"
        )
      );

      await screen.findByDisplayValue("Renew passport");
      const bookFlightsCheckbox = screen.getByLabelText("Include Book flights");
      fireEvent.click(bookFlightsCheckbox);

      fireEvent.click(screen.getByText("Create 1 intent"));

      await waitFor(() =>
        expect(intentsApi.createIntent).toHaveBeenCalledTimes(1)
      );
      expect(firstArgsOf(intentsApi.createIntent)).toEqual([
        { title: "Renew passport", description: undefined, priority: "high" },
      ]);
    });

    it("notifies and does nothing when AI finds no intents", async () => {
      vi.spyOn(aiApi, "splitIntent").mockResolvedValue({ intents: [] });

      renderWithProviders(<AddIntentPanel onOpenDetails={vi.fn()} />);

      const input = getTextField();
      fireEvent.change(input, { target: { value: "hmm" } });
      fireEvent.click(screen.getByText("✨ Split with AI"));

      await screen.findByText("AI couldn't find a clear intent in that text.");
      expect(
        screen.queryByText("Review split intents")
      ).not.toBeInTheDocument();
    });
  });
});
