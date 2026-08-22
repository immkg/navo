import { act, renderHook } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { createTestQueryClient } from "../../test/renderWithProviders";
import * as plansApi from "../../api/plans";
import {
  useCreatePlan,
  useDeletePlan,
  usePlan,
  usePlans,
  useRecheckPlan,
  useUpdatePlan,
  useUpdatePlanStop,
  useUpdatePlanStopWork,
} from "./hooks";

function withQueryClient(queryClient) {
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("usePlans", () => {
  it("fetches the plan list", async () => {
    vi.spyOn(plansApi, "getPlans").mockResolvedValue([{ id: "plan-1" }]);
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => usePlans(), {
      wrapper: withQueryClient(queryClient),
    });

    await vi.waitFor(() =>
      expect(result.current.data).toEqual([{ id: "plan-1" }])
    );
  });
});

describe("usePlan", () => {
  it("fetches one plan and skips the request when id is missing", async () => {
    vi.spyOn(plansApi, "getPlan").mockResolvedValue({ id: "plan-1" });
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => usePlan("plan-1"), {
      wrapper: withQueryClient(queryClient),
    });

    await vi.waitFor(() =>
      expect(result.current.data).toEqual({ id: "plan-1" })
    );
    expect(plansApi.getPlan).toHaveBeenCalledWith("plan-1");
  });
});

describe("useCreatePlan", () => {
  it("creates a plan and adds it to the plans list cache", async () => {
    vi.spyOn(plansApi, "createPlan").mockResolvedValue({ id: "plan-new" });
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["plans"], []);

    const { result } = renderHook(() => useCreatePlan(), {
      wrapper: withQueryClient(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ startAt: "2026-08-22T09:00:00.000Z" });
    });

    expect(queryClient.getQueryData(["plans"])).toEqual([{ id: "plan-new" }]);
  });
});

describe("useUpdatePlan", () => {
  it("updates the plan detail cache", async () => {
    vi.spyOn(plansApi, "updatePlan").mockResolvedValue({
      id: "plan-1",
      title: "Renamed",
    });
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useUpdatePlan(), {
      wrapper: withQueryClient(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        planId: "plan-1",
        patch: { title: "Renamed" },
      });
    });

    expect(queryClient.getQueryData(["plan", "plan-1"]).title).toBe("Renamed");
  });
});

describe("useDeletePlan", () => {
  it("removes the plan from the list and detail caches", async () => {
    vi.spyOn(plansApi, "deletePlan").mockResolvedValue();
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["plans"], [{ id: "plan-1" }]);
    queryClient.setQueryData(["plan", "plan-1"], { id: "plan-1" });

    const { result } = renderHook(() => useDeletePlan(), {
      wrapper: withQueryClient(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync("plan-1");
    });

    expect(queryClient.getQueryData(["plans"])).toEqual([]);
    expect(queryClient.getQueryData(["plan", "plan-1"])).toBeUndefined();
  });
});

describe("useRecheckPlan", () => {
  it("replaces the plan detail cache with the rechecked plan", async () => {
    vi.spyOn(plansApi, "recheckPlan").mockResolvedValue({
      plan: { id: "plan-1", stops: [] },
      variations: [],
    });
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useRecheckPlan(), {
      wrapper: withQueryClient(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        planId: "plan-1",
        data: { latitude: 1, longitude: 1 },
      });
    });

    expect(queryClient.getQueryData(["plan", "plan-1"])).toEqual({
      id: "plan-1",
      stops: [],
    });
  });
});

describe("useUpdatePlanStop", () => {
  it("replaces the matching stop inside the plan detail cache", async () => {
    vi.spyOn(plansApi, "updatePlanStop").mockResolvedValue({
      id: "stop-1",
      status: "done",
    });
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["plan", "plan-1"], {
      id: "plan-1",
      stops: [{ id: "stop-1", status: "planned" }],
    });

    const { result } = renderHook(() => useUpdatePlanStop(), {
      wrapper: withQueryClient(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        planId: "plan-1",
        stopId: "stop-1",
        patch: { status: "done" },
      });
    });

    expect(queryClient.getQueryData(["plan", "plan-1"]).stops[0].status).toBe(
      "done"
    );
  });
});

describe("useUpdatePlanStopWork", () => {
  it("replaces the matching work assignment and, when done, patches the work list cache", async () => {
    vi.spyOn(plansApi, "updatePlanStopWork").mockResolvedValue({
      id: "psw-1",
      status: "done",
      work: { id: "work-1" },
    });
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["plan", "plan-1"], {
      id: "plan-1",
      stops: [
        {
          id: "stop-1",
          works: [{ id: "psw-1", status: "planned" }],
        },
      ],
    });
    queryClient.setQueryData(["work"], [{ id: "work-1", status: "todo" }]);

    const { result } = renderHook(() => useUpdatePlanStopWork(), {
      wrapper: withQueryClient(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        planId: "plan-1",
        stopId: "stop-1",
        workId: "work-1",
        patch: { status: "done" },
      });
    });

    expect(
      queryClient.getQueryData(["plan", "plan-1"]).stops[0].works[0].status
    ).toBe("done");
    expect(queryClient.getQueryData(["work"])[0].status).toBe("done");
  });
});
