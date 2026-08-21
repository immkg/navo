import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import * as workApi from "../api/work";
import * as aiApi from "../api/ai";
import * as googleMaps from "../utils/googleMaps";
import PlannerPage from "./PlannerPage";

function workItem(id, name, latitude, longitude) {
  return {
    id,
    title: `Work ${id}`,
    status: "todo",
    durationMinutes: 30,
    type: "task",
    selectedLocationOptionId: `opt-${id}`,
    locationOptions: [
      {
        id: `opt-${id}`,
        title: null,
        locations: [{ id: `loc-${id}`, name, latitude, longitude }],
      },
    ],
  };
}

describe("PlannerPage — AI-optimize route", () => {
  afterEach(() => {
    delete navigator.geolocation;
  });

  it("reorders stops and shows the model's reasoning", async () => {
    delete navigator.geolocation;
    vi.spyOn(workApi, "getWorkItems").mockResolvedValue([
      workItem("w1", "Stop One", 2, 2),
      workItem("w2", "Stop Two", 1, 1),
    ]);
    vi.spyOn(googleMaps, "loadGoogleMaps").mockRejectedValue(
      new Error("not available in tests")
    );
    vi.spyOn(aiApi, "optimizeRoute").mockResolvedValue({
      order: ["loc-w2", "loc-w1"],
      reasoning: "Stop Two is closer to your start point.",
    });

    renderWithProviders(<PlannerPage />);

    await waitFor(() =>
      expect(screen.getAllByText("Stop One").length).toBeGreaterThan(0)
    );

    fireEvent.click(screen.getByText("✨ AI-optimize route"));

    await waitFor(() => expect(aiApi.optimizeRoute).toHaveBeenCalled());
    const [, stops] = aiApi.optimizeRoute.mock.calls[0];
    expect(stops.map((stop) => stop.id).sort()).toEqual(["loc-w1", "loc-w2"]);

    await screen.findByText("Stop Two is closer to your start point.");
    const stopHeadings = screen.getAllByText(/^Stop (One|Two)$/);
    expect(stopHeadings[0]).toHaveTextContent("Stop Two");
    expect(stopHeadings[1]).toHaveTextContent("Stop One");

    fireEvent.click(screen.getByText("Reset to nearest-first"));
    expect(
      screen.queryByText("Stop Two is closer to your start point.")
    ).not.toBeInTheDocument();
  });
});
