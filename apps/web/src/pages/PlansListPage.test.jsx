import { fireEvent, screen, waitFor } from "@testing-library/react";
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
    fireEvent.click(screen.getByRole("button", { name: "Create plan" }));

    await waitFor(() => expect(plansApi.createPlan).toHaveBeenCalled());
    const [payload] = plansApi.createPlan.mock.calls[0];
    expect(payload.startAt).toBeTruthy();
    expect(payload.endAt).toBeTruthy();
    expect(await screen.findByText("Plan detail stub")).toBeInTheDocument();
  });
});
