import { fireEvent, screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import * as plansApi from "../api/plans";
import PlanDetailPage from "./PlanDetailPage";

function basePlan(overrides = {}) {
  return {
    id: "plan-1",
    title: "Saturday errands",
    status: "draft",
    startAt: "2026-08-22T09:00:00.000Z",
    startLatitude: 0,
    startLongitude: 0,
    endAt: "2026-08-22T12:00:00.000Z",
    endLatitude: 0,
    endLongitude: 0,
    stops: [],
    ...overrides,
  };
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/plan/:id" element={<PlanDetailPage />} />
    </Routes>,
    { route: "/plan/plan-1" }
  );
}

describe("PlanDetailPage", () => {
  afterEach(() => {
    delete navigator.geolocation;
  });

  it("shows the plan's stops with planned times and work items", async () => {
    vi.spyOn(plansApi, "getPlan").mockResolvedValue(
      basePlan({
        stops: [
          {
            id: "stop-1",
            status: "planned",
            plannedArrivalAt: "2026-08-22T09:10:00.000Z",
            plannedDepartureAt: "2026-08-22T09:20:00.000Z",
            location: { id: "loc-1", name: "Pharmacy", address: "1 Main St" },
            works: [
              {
                id: "psw-1",
                status: "planned",
                work: {
                  id: "w1",
                  title: "Pick up prescription",
                  priority: "medium",
                  durationMinutes: 10,
                },
              },
            ],
          },
        ],
      })
    );

    renderPage();

    expect(await screen.findByText("Pharmacy")).toBeInTheDocument();
    expect(screen.getByText("Pick up prescription")).toBeInTheDocument();
  });

  it("shows an empty state when nothing fits", async () => {
    vi.spyOn(plansApi, "getPlan").mockResolvedValue(basePlan());

    renderPage();

    expect(
      await screen.findByText("Nothing fits in this window yet.")
    ).toBeInTheDocument();
  });

  it("starts a draft plan", async () => {
    vi.spyOn(plansApi, "getPlan").mockResolvedValue(basePlan());
    vi.spyOn(plansApi, "updatePlan").mockResolvedValue(
      basePlan({ status: "active" })
    );

    renderPage();

    fireEvent.click(await screen.findByText("Start"));

    await waitFor(() =>
      expect(plansApi.updatePlan).toHaveBeenCalledWith("plan-1", {
        status: "active",
      })
    );
  });

  it("shows Complete and Abandon controls for an active plan", async () => {
    vi.spyOn(plansApi, "getPlan").mockResolvedValue(
      basePlan({ status: "active" })
    );

    renderPage();

    expect(await screen.findByText("Complete")).toBeInTheDocument();
    expect(screen.getByText("Abandon")).toBeInTheDocument();
    expect(screen.queryByText("Start")).not.toBeInTheDocument();
  });

  it("marks a work item done", async () => {
    const plan = basePlan({
      status: "active",
      stops: [
        {
          id: "stop-1",
          status: "planned",
          plannedArrivalAt: "2026-08-22T09:10:00.000Z",
          plannedDepartureAt: "2026-08-22T09:20:00.000Z",
          location: { id: "loc-1", name: "Pharmacy" },
          works: [
            {
              id: "psw-1",
              status: "planned",
              work: {
                id: "w1",
                title: "Pick up prescription",
                priority: "medium",
                durationMinutes: 10,
              },
            },
          ],
        },
      ],
    });
    vi.spyOn(plansApi, "getPlan").mockResolvedValue(plan);
    vi.spyOn(plansApi, "updatePlanStopWork").mockResolvedValue({
      id: "psw-1",
      status: "done",
      work: plan.stops[0].works[0].work,
    });

    renderPage();

    fireEvent.click(await screen.findByText("Done"));

    await waitFor(() =>
      expect(plansApi.updatePlanStopWork).toHaveBeenCalledWith(
        "plan-1",
        "stop-1",
        "w1",
        { status: "done" }
      )
    );
  });

  it("re-checks the plan using the device's current location and shows AI variations", async () => {
    navigator.geolocation = {
      getCurrentPosition: (onSuccess) =>
        onSuccess({ coords: { latitude: 1, longitude: 1 } }),
    };
    vi.spyOn(plansApi, "getPlan").mockResolvedValue(
      basePlan({ status: "active" })
    );
    vi.spyOn(plansApi, "recheckPlan").mockResolvedValue({
      plan: basePlan({ status: "active" }),
      variations: [
        {
          addWorkIds: ["w2"],
          removeWorkIds: ["w1"],
          reasoning: "Swap in the overdue errand.",
        },
      ],
    });

    renderPage();

    fireEvent.click(await screen.findByText("Re-check plan"));

    await waitFor(() =>
      expect(plansApi.recheckPlan).toHaveBeenCalledWith("plan-1", {
        latitude: 1,
        longitude: 1,
      })
    );
    expect(
      await screen.findByText("Swap in the overdue errand.")
    ).toBeInTheDocument();
  });

  it("applies an AI-suggested variation", async () => {
    navigator.geolocation = {
      getCurrentPosition: (onSuccess) =>
        onSuccess({ coords: { latitude: 1, longitude: 1 } }),
    };
    vi.spyOn(plansApi, "getPlan").mockResolvedValue(
      basePlan({ status: "active" })
    );
    vi.spyOn(plansApi, "recheckPlan").mockResolvedValue({
      plan: basePlan({ status: "active" }),
      variations: [
        {
          addWorkIds: ["w2"],
          removeWorkIds: ["w1"],
          reasoning: "Swap in the overdue errand.",
        },
      ],
    });
    vi.spyOn(plansApi, "updatePlan").mockResolvedValue(
      basePlan({ status: "active" })
    );

    renderPage();

    fireEvent.click(await screen.findByText("Re-check plan"));
    fireEvent.click(await screen.findByText("Apply"));

    await waitFor(() =>
      expect(plansApi.updatePlan).toHaveBeenCalledWith("plan-1", {
        forceIncludeWorkIds: ["w2"],
        forceExcludeWorkIds: ["w1"],
      })
    );
  });
});
