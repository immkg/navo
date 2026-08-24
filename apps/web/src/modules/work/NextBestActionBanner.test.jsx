import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import * as workApi from "../../api/work";
import NextBestActionBanner from "./NextBestActionBanner";

describe("NextBestActionBanner", () => {
  it("renders nothing when there is no recommended work", async () => {
    vi.spyOn(workApi, "getRecommendedWork").mockResolvedValue([]);

    const { container } = renderWithProviders(<NextBestActionBanner />);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container.textContent).toBe("");
  });

  it("shows the top-ranked work item with a link to its intent", async () => {
    vi.spyOn(workApi, "getRecommendedWork").mockResolvedValue([
      { id: "w1", title: "Renew passport", intentId: "intent-1" },
      { id: "w2", title: "Buy milk", intentId: "intent-2" },
    ]);

    renderWithProviders(<NextBestActionBanner />);

    expect(await screen.findByText("Next best action")).toBeInTheDocument();
    expect(screen.getByText("Renew passport")).toBeInTheDocument();
    expect(screen.queryByText("Buy milk")).not.toBeInTheDocument();
    expect(screen.getByText("View").closest("a")).toHaveAttribute(
      "href",
      "/intent/intent-1"
    );
  });

  it("omits the View link when the work item has no intent", async () => {
    vi.spyOn(workApi, "getRecommendedWork").mockResolvedValue([
      { id: "w1", title: "Standalone task", intentId: null },
    ]);

    renderWithProviders(<NextBestActionBanner />);

    expect(await screen.findByText("Standalone task")).toBeInTheDocument();
    expect(screen.queryByText("View")).not.toBeInTheDocument();
  });
});
