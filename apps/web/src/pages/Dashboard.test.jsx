import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import * as intentsApi from "../api/intents";
import * as aiApi from "../api/ai";
import Dashboard from "./Dashboard";

describe("Dashboard — Draft with AI", () => {
  it("fills in description/priority/due date from the AI draft", async () => {
    vi.spyOn(intentsApi, "getIntents").mockResolvedValue([]);
    vi.spyOn(aiApi, "draftIntent").mockResolvedValue({
      description: "Renew your passport before it expires.",
      priority: "high",
      dueDate: "2026-09-01",
    });

    renderWithProviders(<Dashboard />);

    fireEvent.click(screen.getByText("+ New Intent"));

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

    fireEvent.click(screen.getByText("+ New Intent"));

    expect(screen.getByText("✨ Draft with AI")).toBeDisabled();
    expect(draftIntentSpy).not.toHaveBeenCalled();
  });
});
