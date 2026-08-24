import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import * as plansApi from "../api/plans";
import * as workApi from "../api/work";
import * as intentsApi from "../api/intents";
import * as planTemplatesApi from "../api/planTemplates";
import PlansListPage from "./PlansListPage";

function renderPage({ route = "/" } = {}) {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<PlansListPage />} />
      <Route path="/plan/:id" element={<div>Plan detail stub</div>} />
    </Routes>,
    { route }
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

  it("auto-detects the start location so only End needs a manual pick", async () => {
    navigator.geolocation = {
      getCurrentPosition: (onSuccess) =>
        onSuccess({ coords: { latitude: 10, longitude: 20 } }),
    };
    vi.spyOn(plansApi, "getPlans").mockResolvedValue([]);
    vi.spyOn(plansApi, "createPlan").mockResolvedValue({
      id: "plan-new",
      stops: [],
    });

    renderPage();

    fireEvent.click(await screen.findByText("+ New plan"));

    // Start's auto-detect is deferred a tick and goes through an async
    // geolocation callback — wait for it to actually land before relying
    // on it.
    await screen.findByDisplayValue("Current location");

    // Only End's manual-entry fallback is needed now — Start should already
    // be filled in from geolocation.
    fireEvent.click(screen.getAllByText("Enter coordinates manually")[1]);
    fireEvent.change(screen.getAllByLabelText("Latitude")[1], {
      target: { value: "56" },
    });
    fireEvent.change(screen.getAllByLabelText("Longitude")[1], {
      target: { value: "78" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create plan" }));

    await waitFor(() => expect(plansApi.createPlan).toHaveBeenCalled());
    const [payload] = plansApi.createPlan.mock.calls[0];
    expect(payload.startLatitude).toBe(10);
    expect(payload.startLongitude).toBe(20);
    expect(payload.endLatitude).toBe(56);
    expect(payload.endLongitude).toBe(78);

    delete navigator.geolocation;
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
    expect(payload.energyLevel).toBe("high");
    expect(payload.useAccurateTravelTime).toBe(false);
    expect(await screen.findByText("Plan detail stub")).toBeInTheDocument();
  });

  it("sends useAccurateTravelTime: true when the toggle is checked", async () => {
    vi.spyOn(plansApi, "getPlans").mockResolvedValue([]);
    vi.spyOn(plansApi, "createPlan").mockResolvedValue({
      id: "plan-new",
      stops: [],
    });

    renderPage();

    fireEvent.click(await screen.findByText("+ New plan"));

    const summaries = screen.getAllByText("Enter coordinates manually");
    summaries.forEach((summary) => fireEvent.click(summary));
    screen
      .getAllByLabelText("Latitude")
      .forEach((input) => fireEvent.change(input, { target: { value: "1" } }));
    screen
      .getAllByLabelText("Longitude")
      .forEach((input) => fireEvent.change(input, { target: { value: "1" } }));

    fireEvent.click(
      screen.getByText(
        "Use real driving time (Google Maps) instead of straight-line distance"
      )
    );
    fireEvent.click(screen.getByRole("button", { name: "Create plan" }));

    await waitFor(() => expect(plansApi.createPlan).toHaveBeenCalled());
    expect(plansApi.createPlan.mock.calls[0][0]).toEqual(
      expect.objectContaining({ useAccurateTravelTime: true })
    );
  });

  it("sends the chosen energy level in the create payload", async () => {
    vi.spyOn(plansApi, "getPlans").mockResolvedValue([]);
    vi.spyOn(plansApi, "createPlan").mockResolvedValue({
      id: "plan-new",
      stops: [],
    });

    renderPage();

    fireEvent.click(await screen.findByText("+ New plan"));

    const summaries = screen.getAllByText("Enter coordinates manually");
    summaries.forEach((summary) => fireEvent.click(summary));
    screen
      .getAllByLabelText("Latitude")
      .forEach((input) => fireEvent.change(input, { target: { value: "1" } }));
    screen
      .getAllByLabelText("Longitude")
      .forEach((input) => fireEvent.change(input, { target: { value: "1" } }));

    fireEvent.change(screen.getByLabelText("Energy level"), {
      target: { value: "low" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create plan" }));

    await waitFor(() => expect(plansApi.createPlan).toHaveBeenCalled());
    expect(plansApi.createPlan.mock.calls[0][0]).toEqual(
      expect.objectContaining({ energyLevel: "low" })
    );
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

  it("auto-opens the create form and includes the intent's work when arriving with ?intentId=", async () => {
    vi.spyOn(plansApi, "getPlans").mockResolvedValue([]);
    vi.spyOn(workApi, "getWorkItems").mockResolvedValue([
      { id: "work-1", intentId: "intent-1", status: "todo" },
      { id: "work-2", intentId: "intent-1", status: "done" },
      { id: "work-3", intentId: "intent-2", status: "todo" },
    ]);
    vi.spyOn(intentsApi, "getIntent").mockResolvedValue({
      id: "intent-1",
      title: "Plan the trip",
    });
    vi.spyOn(plansApi, "createPlan").mockResolvedValue({
      id: "plan-new",
      stops: [],
    });
    vi.spyOn(plansApi, "updatePlan").mockResolvedValue({
      id: "plan-new",
      stops: [],
    });

    renderPage({ route: "/?intentId=intent-1" });

    expect(
      await screen.findByText('Including 1 work item from "Plan the trip".')
    ).toBeInTheDocument();

    const summaries = await screen.findAllByText("Enter coordinates manually");
    summaries.forEach((summary) => fireEvent.click(summary));
    screen
      .getAllByLabelText("Latitude")
      .forEach((input) => fireEvent.change(input, { target: { value: "1" } }));
    screen
      .getAllByLabelText("Longitude")
      .forEach((input) => fireEvent.change(input, { target: { value: "1" } }));

    fireEvent.click(screen.getByRole("button", { name: "Create plan" }));

    await waitFor(() =>
      expect(plansApi.updatePlan).toHaveBeenCalledWith("plan-new", {
        forceIncludeWorkIds: ["work-1"],
      })
    );
    expect(await screen.findByText("Plan detail stub")).toBeInTheDocument();
  });

  it("defaults End to a smart estimate from eligible work duration instead of a flat +8h", async () => {
    vi.spyOn(plansApi, "getPlans").mockResolvedValue([]);
    vi.spyOn(workApi, "getWorkItems").mockResolvedValue([
      { id: "w1", status: "todo", durationMinutes: 30 },
      { id: "w2", status: "todo", durationMinutes: 45 },
      { id: "w3", status: "done", durationMinutes: 999 },
    ]);

    renderPage({ route: "/?new=1" });

    // (30 + 10) + (45 + 10) = 95 minutes — the done item is excluded, and
    // this is nowhere near the flat 8-hour (480-minute) default.
    expect(
      await screen.findByText(/Window: 1 hr 35 min\./)
    ).toBeInTheDocument();
  });

  it("keeps a manually-edited End instead of overwriting it once work items load", async () => {
    vi.spyOn(plansApi, "getPlans").mockResolvedValue([]);
    let resolveWorkItems;
    vi.spyOn(workApi, "getWorkItems").mockReturnValue(
      new Promise((resolve) => {
        resolveWorkItems = resolve;
      })
    );

    renderPage({ route: "/?new=1" });

    const endDateTimeInputs = await screen.findAllByLabelText(/date/i);
    fireEvent.change(endDateTimeInputs[1], {
      target: { value: "2026-08-22T20:00" },
    });

    resolveWorkItems([{ id: "w1", status: "todo", durationMinutes: 30 }]);
    await waitFor(() =>
      expect(screen.getAllByLabelText(/date/i)[1]).toHaveValue(
        "2026-08-22T20:00"
      )
    );
  });

  it("auto-opens the create form when arriving with ?new=1, with no intent involved", async () => {
    vi.spyOn(plansApi, "getPlans").mockResolvedValue([]);

    renderPage({ route: "/?new=1" });

    expect(
      await screen.findByRole("button", { name: "Create plan" })
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Including /)).not.toBeInTheDocument();
  });

  describe("plan templates", () => {
    it("saves the current window shape as a named template", async () => {
      vi.spyOn(plansApi, "getPlans").mockResolvedValue([]);
      vi.spyOn(planTemplatesApi, "getPlanTemplates").mockResolvedValue([]);
      vi.spyOn(planTemplatesApi, "createPlanTemplate").mockResolvedValue({
        id: "tmpl-1",
        name: "Morning errands",
        durationMinutes: 480,
        energyLevel: "high",
        useAccurateTravelTime: false,
      });

      renderPage({ route: "/?new=1" });

      fireEvent.click(await screen.findByText("💾 Save as template"));
      fireEvent.change(
        screen.getByPlaceholderText("Template name, e.g. Morning errands"),
        { target: { value: "Morning errands" } }
      );
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() =>
        expect(planTemplatesApi.createPlanTemplate).toHaveBeenCalled()
      );
      expect(planTemplatesApi.createPlanTemplate.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          name: "Morning errands",
          energyLevel: "high",
          useAccurateTravelTime: false,
        })
      );
      expect(
        await screen.findByText('Saved "Morning errands" as a template.')
      ).toBeInTheDocument();
    });

    it("pre-fills the form when a saved template is chosen", async () => {
      vi.spyOn(plansApi, "getPlans").mockResolvedValue([]);
      vi.spyOn(planTemplatesApi, "getPlanTemplates").mockResolvedValue([
        {
          id: "tmpl-1",
          name: "Gym + market loop",
          durationMinutes: 90,
          energyLevel: "low",
          useAccurateTravelTime: true,
        },
      ]);

      renderPage({ route: "/?new=1" });

      fireEvent.click(await screen.findByText("Gym + market loop"));

      expect(screen.getByDisplayValue("Gym + market loop")).toBeInTheDocument();
      expect(screen.getByLabelText("Energy level")).toHaveValue("low");
      expect(
        screen.getByLabelText(
          "Use real driving time (Google Maps) instead of straight-line distance"
        )
      ).toBeChecked();
      expect(screen.getByText(/Window: 1 hr 30 min/)).toBeInTheDocument();
    });

    it("deletes a saved template", async () => {
      vi.spyOn(plansApi, "getPlans").mockResolvedValue([]);
      vi.spyOn(planTemplatesApi, "getPlanTemplates").mockResolvedValue([
        {
          id: "tmpl-1",
          name: "Gym + market loop",
          durationMinutes: 90,
          energyLevel: "low",
          useAccurateTravelTime: true,
        },
      ]);
      vi.spyOn(planTemplatesApi, "deletePlanTemplate").mockResolvedValue();

      renderPage({ route: "/?new=1" });

      await screen.findByText("Gym + market loop");
      fireEvent.click(
        screen.getByLabelText("Delete template Gym + market loop")
      );

      await waitFor(() =>
        expect(planTemplatesApi.deletePlanTemplate).toHaveBeenCalledWith(
          "tmpl-1"
        )
      );
    });
  });
});
