import { fireEvent, screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import * as intentsApi from "../../api/intents";
import IntentCard from "./IntentCard";

function buildIntent(overrides = {}) {
  return {
    id: "intent-1",
    title: "Renew passport",
    description: "Before it expires",
    status: "active",
    priority: "medium",
    startDate: null,
    dueDate: null,
    workCount: 2,
    completedWorkCount: 1,
    placeCount: 1,
    ...overrides,
  };
}

function renderCard(props = {}) {
  return renderWithProviders(
    <Routes>
      <Route
        path="/"
        element={
          <IntentCard
            intent={buildIntent()}
            selectionMode={false}
            isSelected={false}
            onToggleSelected={vi.fn()}
            onEnterSelectionMode={vi.fn()}
            {...props}
          />
        }
      />
      <Route path="/intent/:id" element={<div>Intent details page</div>} />
    </Routes>
  );
}

describe("IntentCard", () => {
  it("renders the title and description", () => {
    renderCard();
    expect(screen.getByText("Renew passport")).toBeInTheDocument();
    expect(screen.getByText("Before it expires")).toBeInTheDocument();
  });

  it("navigates to the intent's detail page when the card is clicked", async () => {
    renderCard();
    fireEvent.click(screen.getByLabelText("Renew passport"));
    await screen.findByText("Intent details page");
  });

  it("toggles selection instead of navigating while in selection mode", () => {
    const onToggleSelected = vi.fn();
    renderCard({ selectionMode: true, onToggleSelected });

    fireEvent.click(screen.getByLabelText("Renew passport"));

    expect(onToggleSelected).toHaveBeenCalledWith("intent-1");
    expect(screen.queryByText("Intent details page")).not.toBeInTheDocument();
  });

  it("toggles selection from the checkbox", () => {
    const onToggleSelected = vi.fn();
    renderCard({ selectionMode: true, isSelected: false, onToggleSelected });

    fireEvent.click(screen.getByLabelText("Select Renew passport"));

    expect(onToggleSelected).toHaveBeenCalledWith("intent-1");
  });

  it("enters selection mode after a long press on the card body", async () => {
    const onEnterSelectionMode = vi.fn();
    renderCard({ onEnterSelectionMode });

    const card = screen.getByText("Renew passport").closest("article");
    fireEvent.pointerDown(card, { clientX: 0, clientY: 0 });

    await waitFor(
      () => expect(onEnterSelectionMode).toHaveBeenCalledWith("intent-1"),
      { timeout: 1000 }
    );
  });

  it("updates priority from the card's priority select", async () => {
    vi.spyOn(intentsApi, "updateIntent").mockResolvedValue({});
    renderCard();

    fireEvent.change(screen.getByTitle("Set priority"), {
      target: { value: "high" },
    });

    await waitFor(() =>
      expect(intentsApi.updateIntent).toHaveBeenCalledWith("intent-1", {
        priority: "high",
      })
    );
  });

  it("updates status from the action buttons", async () => {
    vi.spyOn(intentsApi, "updateIntent").mockResolvedValue({});
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: "Complete" }));

    await waitFor(() =>
      expect(intentsApi.updateIntent).toHaveBeenCalledWith("intent-1", {
        status: "completed",
      })
    );
  });

  it("notifies when a status update fails", async () => {
    vi.spyOn(intentsApi, "updateIntent").mockRejectedValue(new Error("boom"));
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: "Complete" }));

    await screen.findByText("Unable to update status right now.");
  });

  it("updates the start and due dates from their inputs", async () => {
    vi.spyOn(intentsApi, "updateIntent").mockResolvedValue({});
    renderCard();

    fireEvent.change(screen.getByTitle("Set start date"), {
      target: { value: "2026-01-15" },
    });
    await waitFor(() =>
      expect(intentsApi.updateIntent).toHaveBeenCalledWith("intent-1", {
        startDate: "2026-01-15",
      })
    );

    fireEvent.change(screen.getByTitle("Set due date"), {
      target: { value: "2026-02-01" },
    });
    await waitFor(() =>
      expect(intentsApi.updateIntent).toHaveBeenCalledWith("intent-1", {
        dueDate: "2026-02-01",
      })
    );
  });

  it("focuses the date input when its button is clicked (no native showPicker in jsdom)", () => {
    renderCard();

    const startDateInput = document.getElementById("start-date-intent-1");
    const focusSpy = vi.spyOn(startDateInput, "focus");
    const startButton = screen
      .getByText("Start")
      .closest("label")
      .querySelector("button");

    fireEvent.click(startButton);

    expect(focusSpy).toHaveBeenCalled();
  });

  it("calls the native date picker when the browser supports showPicker", () => {
    renderCard();

    const dueDateInput = document.getElementById("due-date-intent-1");
    dueDateInput.showPicker = vi.fn();
    const dueButton = screen
      .getByText("Due")
      .closest("label")
      .querySelector("button");

    fireEvent.click(dueButton);

    expect(dueDateInput.showPicker).toHaveBeenCalled();
  });

  describe("swipe gestures (touch)", () => {
    it("marks the intent complete on a rightward swipe past the threshold", async () => {
      vi.spyOn(intentsApi, "updateIntent").mockResolvedValue({});
      renderCard();

      const card = screen.getByText("Renew passport").closest("article");
      fireEvent.pointerDown(card, {
        clientX: 0,
        clientY: 0,
        pointerType: "touch",
      });
      fireEvent.pointerMove(card, {
        clientX: 120,
        clientY: 0,
        pointerType: "touch",
      });
      fireEvent.pointerUp(card, { pointerType: "touch" });

      await waitFor(() =>
        expect(intentsApi.updateIntent).toHaveBeenCalledWith("intent-1", {
          status: "completed",
        })
      );
    });

    it("does not navigate after a completed swipe", async () => {
      vi.spyOn(intentsApi, "updateIntent").mockResolvedValue({});
      renderCard();

      const card = screen.getByText("Renew passport").closest("article");
      fireEvent.pointerDown(card, {
        clientX: 0,
        clientY: 0,
        pointerType: "touch",
      });
      fireEvent.pointerMove(card, {
        clientX: 120,
        clientY: 0,
        pointerType: "touch",
      });
      fireEvent.pointerUp(card, { pointerType: "touch" });
      fireEvent.click(screen.getByLabelText("Renew passport"));

      expect(screen.queryByText("Intent details page")).not.toBeInTheDocument();
    });

    it("asks for confirmation and deletes on a leftward swipe past the threshold", async () => {
      vi.spyOn(intentsApi, "deleteIntent").mockResolvedValue();
      renderCard();

      const card = screen.getByText("Renew passport").closest("article");
      fireEvent.pointerDown(card, {
        clientX: 0,
        clientY: 0,
        pointerType: "touch",
      });
      fireEvent.pointerMove(card, {
        clientX: -120,
        clientY: 0,
        pointerType: "touch",
      });
      fireEvent.pointerUp(card, { pointerType: "touch" });

      await screen.findByText("Delete intent?");
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));

      await waitFor(() =>
        expect(intentsApi.deleteIntent).toHaveBeenCalledWith("intent-1")
      );
    });

    it("updates the drag position across multiple pointer moves", async () => {
      vi.spyOn(intentsApi, "updateIntent").mockResolvedValue({});
      renderCard();

      const card = screen.getByText("Renew passport").closest("article");
      fireEvent.pointerDown(card, {
        clientX: 0,
        clientY: 0,
        pointerType: "touch",
      });
      fireEvent.pointerMove(card, {
        clientX: 20,
        clientY: 0,
        pointerType: "touch",
      });
      fireEvent.pointerMove(card, {
        clientX: 120,
        clientY: 0,
        pointerType: "touch",
      });
      fireEvent.pointerUp(card, { pointerType: "touch" });

      await waitFor(() =>
        expect(intentsApi.updateIntent).toHaveBeenCalledWith("intent-1", {
          status: "completed",
        })
      );
    });

    it("does not delete when the confirmation is cancelled", async () => {
      const deleteSpy = vi.spyOn(intentsApi, "deleteIntent");
      renderCard();

      const card = screen.getByText("Renew passport").closest("article");
      fireEvent.pointerDown(card, {
        clientX: 0,
        clientY: 0,
        pointerType: "touch",
      });
      fireEvent.pointerMove(card, {
        clientX: -120,
        clientY: 0,
        pointerType: "touch",
      });
      fireEvent.pointerUp(card, { pointerType: "touch" });

      await screen.findByText("Delete intent?");
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(deleteSpy).not.toHaveBeenCalled();
    });

    it("snaps back without deleting when a swipe is small", async () => {
      const deleteSpy = vi.spyOn(intentsApi, "deleteIntent");
      renderCard();

      const card = screen.getByText("Renew passport").closest("article");
      fireEvent.pointerDown(card, {
        clientX: 0,
        clientY: 0,
        pointerType: "touch",
      });
      fireEvent.pointerMove(card, {
        clientX: -30,
        clientY: 0,
        pointerType: "touch",
      });
      fireEvent.pointerUp(card, { pointerType: "touch" });

      expect(screen.queryByText("Delete intent?")).not.toBeInTheDocument();
      expect(deleteSpy).not.toHaveBeenCalled();
    });
  });
});
