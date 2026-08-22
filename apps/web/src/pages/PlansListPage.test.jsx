import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import * as plansApi from "../api/plans";
import PlansListPage from "./PlansListPage";

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<PlansListPage />} />
      <Route path="/plan/:id" element={<div>Plan detail stub</div>} />
    </Routes>
  );
}

describe("PlansListPage", () => {
  it("shows existing plans", async () => {
    vi.spyOn(plansApi, "getPlans").mockResolvedValue([
      {
        id: "plan-1",
        title: "Saturday errands",
        status: "draft",
        startAt: "2026-08-22T09:00:00.000Z",
        endAt: "2026-08-22T12:00:00.000Z",
        stops: [],
      },
    ]);

    renderPage();

    expect(await screen.findByText("Saturday errands")).toBeInTheDocument();
    expect(screen.getByText("draft")).toBeInTheDocument();
  });

  it("shows an empty state when there are no plans", async () => {
    vi.spyOn(plansApi, "getPlans").mockResolvedValue([]);

    renderPage();

    expect(
      await screen.findByText("No plans yet. Create one to get started.")
    ).toBeInTheDocument();
  });

  it("creates a plan from the form and navigates to its detail page", async () => {
    vi.spyOn(plansApi, "getPlans").mockResolvedValue([]);
    vi.spyOn(plansApi, "createPlan").mockResolvedValue({
      id: "plan-new",
      stops: [],
    });

    renderPage();

    fireEvent.click(await screen.findByText("+ New plan"));

    // Coordinates are required to submit; open each picker's manual-entry
    // fallback and fill both in.
    const summaries = screen.getAllByText("Enter coordinates manually");
    summaries.forEach((summary) => fireEvent.click(summary));
    const latitudeInputs = screen.getAllByLabelText("Latitude");
    const longitudeInputs = screen.getAllByLabelText("Longitude");
    latitudeInputs.forEach((input) =>
      fireEvent.change(input, { target: { value: "12.34" } })
    );
    longitudeInputs.forEach((input) =>
      fireEvent.change(input, { target: { value: "56.78" } })
    );

    fireEvent.click(screen.getByRole("button", { name: "Create plan" }));

    await waitFor(() => expect(plansApi.createPlan).toHaveBeenCalled());
    const [payload] = plansApi.createPlan.mock.calls[0];
    // Regression test for a timezone bug: the default start/end times were
    // built by rendering a UTC-based ISO string into a <input
    // type="datetime-local">, which reads/writes local wall-clock time —
    // shifting the submitted instant by the viewer's UTC offset. Asserting
    // against real elapsed time (not just truthiness) catches that
    // regardless of which timezone the test runs in.
    const startMs = new Date(payload.startAt).getTime();
    const endMs = new Date(payload.endAt).getTime();
    expect(Math.abs(startMs - Date.now())).toBeLessThan(2 * 60 * 1000);
    expect(Math.abs(endMs - startMs - 8 * 3600000)).toBeLessThan(2 * 60 * 1000);
    expect(await screen.findByText("Plan detail stub")).toBeInTheDocument();
  });

  it("asks for confirmation and deletes a plan without navigating to it", async () => {
    vi.spyOn(plansApi, "getPlans").mockResolvedValue([
      {
        id: "plan-1",
        title: "Saturday errands",
        status: "draft",
        startAt: "2026-08-22T09:00:00.000Z",
        endAt: "2026-08-22T12:00:00.000Z",
        stops: [],
      },
    ]);
    vi.spyOn(plansApi, "deletePlan").mockResolvedValue();

    renderPage();

    fireEvent.click(await screen.findByText("Delete"));
    const confirmDialog = await screen.findByRole("dialog", {
      name: "Delete plan?",
    });
    fireEvent.click(
      within(confirmDialog).getByRole("button", { name: "Delete" })
    );

    await waitFor(() =>
      expect(plansApi.deletePlan).toHaveBeenCalledWith("plan-1")
    );
    expect(screen.queryByText("Plan detail stub")).not.toBeInTheDocument();
  });
});
