import { describe, expect, it, vi } from "vitest";
import apiClient from "./client";
import {
  createPlan,
  deletePlan,
  getPlan,
  getPlans,
  recheckPlan,
  updatePlan,
  updatePlanStop,
  updatePlanStopWork,
} from "./plans";

vi.mock("./client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("getPlans", () => {
  it("fetches the plan list", async () => {
    apiClient.get.mockResolvedValue({ data: [{ id: "plan-1" }] });

    const result = await getPlans();

    expect(apiClient.get).toHaveBeenCalledWith("/api/plans");
    expect(result).toEqual([{ id: "plan-1" }]);
  });
});

describe("createPlan", () => {
  it("posts the plan data and returns the response body", async () => {
    apiClient.post.mockResolvedValue({ data: { id: "plan-1" } });
    const data = { startAt: "2026-08-22T09:00:00.000Z" };

    const result = await createPlan(data);

    expect(apiClient.post).toHaveBeenCalledWith("/api/plans", data);
    expect(result).toEqual({ id: "plan-1" });
  });
});

describe("getPlan", () => {
  it("fetches one plan by id", async () => {
    apiClient.get.mockResolvedValue({ data: { id: "plan-1" } });

    const result = await getPlan("plan-1");

    expect(apiClient.get).toHaveBeenCalledWith("/api/plans/plan-1");
    expect(result).toEqual({ id: "plan-1" });
  });
});

describe("updatePlan", () => {
  it("patches the plan and returns the response body", async () => {
    apiClient.patch.mockResolvedValue({
      data: { id: "plan-1", title: "Renamed" },
    });

    const result = await updatePlan("plan-1", { title: "Renamed" });

    expect(apiClient.patch).toHaveBeenCalledWith("/api/plans/plan-1", {
      title: "Renamed",
    });
    expect(result.title).toBe("Renamed");
  });
});

describe("deletePlan", () => {
  it("deletes the plan", async () => {
    apiClient.delete.mockResolvedValue({});

    await deletePlan("plan-1");

    expect(apiClient.delete).toHaveBeenCalledWith("/api/plans/plan-1");
  });
});

describe("recheckPlan", () => {
  it("posts the recheck payload and returns the response body", async () => {
    apiClient.post.mockResolvedValue({
      data: { plan: { id: "plan-1" }, variations: [] },
    });

    const result = await recheckPlan("plan-1", { latitude: 1, longitude: 1 });

    expect(apiClient.post).toHaveBeenCalledWith("/api/plans/plan-1/recheck", {
      latitude: 1,
      longitude: 1,
    });
    expect(result.variations).toEqual([]);
  });
});

describe("updatePlanStop", () => {
  it("patches a plan stop", async () => {
    apiClient.patch.mockResolvedValue({
      data: { id: "stop-1", status: "done" },
    });

    const result = await updatePlanStop("plan-1", "stop-1", { status: "done" });

    expect(apiClient.patch).toHaveBeenCalledWith(
      "/api/plans/plan-1/stops/stop-1",
      { status: "done" }
    );
    expect(result.status).toBe("done");
  });
});

describe("updatePlanStopWork", () => {
  it("patches a plan stop's work item", async () => {
    apiClient.patch.mockResolvedValue({
      data: { id: "psw-1", status: "done" },
    });

    const result = await updatePlanStopWork("plan-1", "stop-1", "work-1", {
      status: "done",
    });

    expect(apiClient.patch).toHaveBeenCalledWith(
      "/api/plans/plan-1/stops/stop-1/work/work-1",
      { status: "done" }
    );
    expect(result.status).toBe("done");
  });
});
