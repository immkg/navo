import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import * as intentsApi from "../api/intents";
import * as aiApi from "../api/ai";
import Dashboard from "./Dashboard";

function buildIntent(overrides = {}) {
  return {
    id: "intent-1",
    title: "Renew passport",
    description: "",
    status: "active",
    priority: "medium",
    startDate: null,
    dueDate: null,
    workCount: 0,
    completedWorkCount: 0,
    placeCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Dashboard — Draft with AI", () => {
  it("fills in description/priority/due date from the AI draft", async () => {
    vi.spyOn(intentsApi, "getIntents").mockResolvedValue([]);
    vi.spyOn(aiApi, "draftIntent").mockResolvedValue({
      description: "Renew your passport before it expires.",
      priority: "high",
      dueDate: "2026-09-01",
    });

    renderWithProviders(<Dashboard />);

    fireEvent.click(
      screen.getByText("+ Add details (priority, dates, description)")
    );

    const titleInput = screen.getByPlaceholderText("e.g., Plan a vacation");
    fireEvent.change(titleInput, { target: { value: "Renew passport" } });

    fireEvent.click(screen.getByText("✨ Draft with AI"));

    await waitFor(() =>
      expect(aiApi.draftIntent).toHaveBeenCalledWith(
        "Renew passport",
        undefined
      )
    );

    await waitFor(() =>
      expect(
        screen.getByPlaceholderText(
          "Add some details about what you want to achieve"
        )
      ).toHaveValue("Renew your passport before it expires.")
    );
    expect(screen.getByDisplayValue("2026-09-01")).toBeInTheDocument();
  });

  it("prompts for a title instead of calling the API when the title is empty", async () => {
    vi.spyOn(intentsApi, "getIntents").mockResolvedValue([]);
    const draftIntentSpy = vi.spyOn(aiApi, "draftIntent");

    renderWithProviders(<Dashboard />);

    fireEvent.click(
      screen.getByText("+ Add details (priority, dates, description)")
    );

    expect(screen.getByText("✨ Draft with AI")).toBeDisabled();
    expect(draftIntentSpy).not.toHaveBeenCalled();
  });
});

describe("Dashboard — long-press to select", () => {
  it("enters selection mode and selects the card after a long press", async () => {
    vi.spyOn(intentsApi, "getIntents").mockResolvedValue([buildIntent()]);

    renderWithProviders(<Dashboard />);

    await screen.findByText("Renew passport");

    const card = screen.getByText("Renew passport").closest("article");
    fireEvent.pointerDown(card, { clientX: 0, clientY: 0 });

    const checkbox = await screen.findByLabelText(
      "Select Renew passport",
      {},
      { timeout: 1000 }
    );
    await waitFor(() => expect(checkbox).toBeChecked());

    fireEvent.click(screen.getByText("Done"));
    expect(screen.queryByLabelText("Select Renew passport")).toBeNull();
  });

  it("cancels the long press if the pointer moves (e.g. a scroll)", async () => {
    vi.spyOn(intentsApi, "getIntents").mockResolvedValue([buildIntent()]);

    renderWithProviders(<Dashboard />);

    await screen.findByText("Renew passport");

    const card = screen.getByText("Renew passport").closest("article");
    fireEvent.pointerDown(card, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(card, { clientX: 0, clientY: 40 });

    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(screen.queryByLabelText("Select Renew passport")).toBeNull();
  });

  it("does not enter selection mode on a short tap", async () => {
    vi.spyOn(intentsApi, "getIntents").mockResolvedValue([buildIntent()]);

    renderWithProviders(<Dashboard />);

    await screen.findByText("Renew passport");

    const card = screen.getByText("Renew passport").closest("article");
    fireEvent.pointerDown(card, { clientX: 0, clientY: 0 });
    fireEvent.pointerUp(card, { clientX: 0, clientY: 0 });

    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(screen.queryByLabelText("Select Renew passport")).toBeNull();
  });
});
