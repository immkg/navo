import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import * as workApi from "../../api/work";
import RecommendedWorkPanel from "./RecommendedWorkPanel";

describe("RecommendedWorkPanel", () => {
  it("renders nothing when there is no recommended work", async () => {
    vi.spyOn(workApi, "getRecommendedWork").mockResolvedValue([]);

    const { container } = renderWithProviders(<RecommendedWorkPanel />);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container.textContent).toBe("");
  });

  it("lists every recommended work item with its priority and a link to its intent", async () => {
    vi.spyOn(workApi, "getRecommendedWork").mockResolvedValue([
      { id: "w1", title: "Renew passport", priority: "high", intentId: "i1" },
      { id: "w2", title: "Buy milk", priority: "low", intentId: "i2" },
    ]);

    renderWithProviders(<RecommendedWorkPanel />);

    expect(await screen.findByText("Recommended work")).toBeInTheDocument();
    expect(screen.getByText("Renew passport")).toBeInTheDocument();
    expect(screen.getByText("high priority")).toBeInTheDocument();
    expect(screen.getByText("Buy milk")).toBeInTheDocument();
    expect(screen.getByText("low priority")).toBeInTheDocument();

    const links = screen.getAllByText("View");
    expect(links).toHaveLength(2);
    expect(links[0].closest("a")).toHaveAttribute("href", "/intent/i1");
    expect(links[1].closest("a")).toHaveAttribute("href", "/intent/i2");
  });

  it("requests the panel's own limit, independent of other recommended-work consumers", async () => {
    const spy = vi.spyOn(workApi, "getRecommendedWork").mockResolvedValue([]);

    renderWithProviders(<RecommendedWorkPanel />);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(spy).toHaveBeenCalledWith(5);
  });
});
