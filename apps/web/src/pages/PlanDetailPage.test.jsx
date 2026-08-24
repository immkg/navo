import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import * as plansApi from "../api/plans";
import * as workApi from "../api/work";
import * as aiApi from "../api/ai";
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
  beforeEach(() => {
    vi.spyOn(workApi, "getWorkItems").mockResolvedValue([]);
  });

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

  it("links to a single Maps route covering start, every stop, and end", async () => {
    vi.spyOn(plansApi, "getPlan").mockResolvedValue(
      basePlan({
        status: "active",
        endLatitude: 2,
        endLongitude: 2,
        stops: [
          {
            id: "stop-1",
            status: "planned",
            plannedArrivalAt: "2026-08-22T09:10:00.000Z",
            plannedDepartureAt: "2026-08-22T09:20:00.000Z",
            location: { id: "loc-1", name: "Pharmacy", latitude: 1, longitude: 1 },
            works: [],
          },
        ],
      })
    );

    renderPage();

    const link = await screen.findByText("Open full route in Maps");
    expect(link.closest("a")).toHaveAttribute(
      "href",
      expect.stringContaining("origin=0,0")
    );
    expect(link.closest("a")).toHaveAttribute(
      "href",
      expect.stringContaining("destination=2,2")
    );
    expect(link.closest("a")).toHaveAttribute(
      "href",
      expect.stringContaining("waypoints=1,1")
    );
  });

  it("asks for confirmation before skipping a work item", async () => {
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
      status: "skipped",
      work: plan.stops[0].works[0].work,
    });

    renderPage();

    fireEvent.click(await screen.findByText("Skip"));
    const confirmDialog = await screen.findByRole("dialog", {
      name: "Skip work item?",
    });
    expect(plansApi.updatePlanStopWork).not.toHaveBeenCalled();

    fireEvent.click(within(confirmDialog).getByRole("button", { name: "Skip" }));

    await waitFor(() =>
      expect(plansApi.updatePlanStopWork).toHaveBeenCalledWith(
        "plan-1",
        "stop-1",
        "w1",
        { status: "skipped" }
      )
    );
  });

  it("hides Done/Skip controls for a draft plan's work items", async () => {
    vi.spyOn(plansApi, "getPlan").mockResolvedValue(
      basePlan({
        status: "draft",
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
      })
    );

    renderPage();

    expect(await screen.findByText("Pick up prescription")).toBeInTheDocument();
    expect(screen.queryByText("Done")).not.toBeInTheDocument();
    expect(screen.queryByText("Skip")).not.toBeInTheDocument();
    expect(screen.queryByText("Arrived")).not.toBeInTheDocument();
  });

  it("records arrival and departure for an active plan's stop", async () => {
    const plan = basePlan({
      status: "active",
      stops: [
        {
          id: "stop-1",
          status: "planned",
          plannedArrivalAt: "2026-08-22T09:10:00.000Z",
          plannedDepartureAt: "2026-08-22T09:20:00.000Z",
          location: { id: "loc-1", name: "Pharmacy" },
          works: [],
        },
      ],
    });
    vi.spyOn(plansApi, "getPlan").mockResolvedValue(plan);
    vi.spyOn(plansApi, "updatePlanStop").mockResolvedValue({
      ...plan.stops[0],
      status: "in_progress",
      actualArrivalAt: "2026-08-22T09:12:00.000Z",
    });

    renderPage();

    fireEvent.click(await screen.findByText("Arrived"));

    await waitFor(() =>
      expect(plansApi.updatePlanStop).toHaveBeenCalledWith(
        "plan-1",
        "stop-1",
        expect.objectContaining({
          status: "in_progress",
          actualArrivalAt: expect.any(String),
        })
      )
    );

    expect(await screen.findByText("Leave stop")).toBeInTheDocument();
  });

  it("surfaces a nearby opportunity while a stop is in progress, and can add it to the plan", async () => {
    const plan = basePlan({
      status: "active",
      stops: [
        {
          id: "stop-1",
          status: "in_progress",
          plannedArrivalAt: "2026-08-22T09:10:00.000Z",
          plannedDepartureAt: "2026-08-22T09:20:00.000Z",
          location: {
            id: "loc-1",
            name: "Pharmacy",
            latitude: 0,
            longitude: 0,
          },
          works: [],
        },
      ],
    });
    vi.spyOn(plansApi, "getPlan").mockResolvedValue(plan);
    workApi.getWorkItems.mockResolvedValue([
      {
        id: "w-nearby",
        title: "Grab coffee",
        status: "todo",
        priority: "low",
        intent: { priority: "low", dueDate: null },
        locationOptions: [
          {
            id: "o1",
            locations: [{ id: "l1", latitude: 0.001, longitude: 0 }],
          },
        ],
      },
      {
        id: "w-far",
        title: "Visit the other side of town",
        status: "todo",
        priority: "low",
        intent: { priority: "low", dueDate: null },
        locationOptions: [
          { id: "o2", locations: [{ id: "l2", latitude: 5, longitude: 5 }] },
        ],
      },
    ]);
    vi.spyOn(plansApi, "updatePlan").mockResolvedValue(plan);

    renderPage();

    const heading = await screen.findByText("While you're here");
    const opportunitySection = heading.parentElement;
    expect(
      within(opportunitySection).getByText("Grab coffee")
    ).toBeInTheDocument();
    expect(
      within(opportunitySection).queryByText("Visit the other side of town")
    ).not.toBeInTheDocument();

    fireEvent.click(within(opportunitySection).getByText("Add to plan"));

    await waitFor(() =>
      expect(plansApi.updatePlan).toHaveBeenCalledWith("plan-1", {
        forceIncludeWorkIds: ["w-nearby"],
      })
    );
  });

  it("shows an on-time/late badge once a stop's actual arrival is recorded", async () => {
    vi.spyOn(plansApi, "getPlan").mockResolvedValue(
      basePlan({
        status: "active",
        stops: [
          {
            id: "stop-1",
            status: "in_progress",
            plannedArrivalAt: "2026-08-22T09:10:00.000Z",
            plannedDepartureAt: "2026-08-22T09:20:00.000Z",
            actualArrivalAt: "2026-08-22T09:25:00.000Z",
            location: { id: "loc-1", name: "Pharmacy" },
            works: [],
          },
        ],
      })
    );

    renderPage();

    expect(await screen.findByText("Arrived 15 min late")).toBeInTheDocument();
  });

  it("shows work not included in the plan and can request AI variations for it manually", async () => {
    const plan = basePlan({ status: "draft", stops: [] });
    vi.spyOn(plansApi, "getPlan").mockResolvedValue(plan);
    workApi.getWorkItems.mockResolvedValue([
      {
        id: "w-unselected",
        title: "Return library books",
        status: "todo",
        priority: "low",
        intent: { priority: "low", dueDate: null },
      },
    ]);
    vi.spyOn(aiApi, "planVariations").mockResolvedValue({
      variations: [
        {
          addWorkIds: ["w-unselected"],
          removeWorkIds: [],
          reasoning: "Swap in the library errand.",
        },
      ],
    });

    renderPage();

    expect(
      await screen.findByText("Return library books")
    ).toBeInTheDocument();
    expect(
      screen.getByText("1 work item not included in this plan.")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Suggest variations"));

    await waitFor(() => expect(aiApi.planVariations).toHaveBeenCalled());
    const [selectedWork, unselectedWork] = aiApi.planVariations.mock.calls[0];
    expect(selectedWork).toEqual([]);
    expect(unselectedWork).toEqual([
      expect.objectContaining({ id: "w-unselected" }),
    ]);
    expect(
      await screen.findByText("Swap in the library errand.")
    ).toBeInTheDocument();
  });

  it("edits a draft plan's start/end window", async () => {
    const plan = basePlan({ status: "draft" });
    vi.spyOn(plansApi, "getPlan").mockResolvedValue(plan);
    vi.spyOn(plansApi, "updatePlan").mockResolvedValue(plan);

    renderPage();

    fireEvent.click(await screen.findByText("Edit window"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(plansApi.updatePlan).toHaveBeenCalledWith(
        "plan-1",
        expect.objectContaining({
          startAt: "2026-08-22T09:00:00.000Z",
          endAt: "2026-08-22T12:00:00.000Z",
          startLatitude: 0,
          startLongitude: 0,
          endLatitude: 0,
          endLongitude: 0,
        })
      )
    );
  });
});
