import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { createTestQueryClient } from "../../test/renderWithProviders";
import { intentQueryKey } from "../intents/hooks";
import * as workApi from "../../api/work";
import {
  useAddLocationToOption,
  useCreateLocationOption,
  useCreateWorkItem,
  useDeleteLocationOption,
  useDeleteWorkItem,
  useRemoveLocationFromOption,
  useUpdateWorkItem,
  useWorkItems,
  WORK_QUERY_KEY,
} from "./hooks";

function withQueryClient(queryClient) {
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useWorkItems", () => {
  it("fetches the flat work list", async () => {
    vi.spyOn(workApi, "getWorkItems").mockResolvedValue([{ id: "w1" }]);
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useWorkItems(), {
      wrapper: withQueryClient(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: "w1" }]);
  });
});

describe("useCreateWorkItem", () => {
  it("prepends the new work item into both the work list and its intent's cache", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(WORK_QUERY_KEY, [{ id: "existing" }]);
    queryClient.setQueryData(intentQueryKey("intent-1"), {
      id: "intent-1",
      workItems: [{ id: "existing" }],
    });
    vi.spyOn(workApi, "createWorkItem").mockResolvedValue({
      id: "new",
      intentId: "intent-1",
    });

    const { result } = renderHook(() => useCreateWorkItem(), {
      wrapper: withQueryClient(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ title: "New work", intentId: "intent-1" });
    });

    expect(queryClient.getQueryData(WORK_QUERY_KEY)).toEqual([
      { id: "new", intentId: "intent-1" },
      { id: "existing" },
    ]);
    expect(queryClient.getQueryData(intentQueryKey("intent-1")).workItems).toEqual([
      { id: "new", intentId: "intent-1" },
      { id: "existing" },
    ]);
  });

  it("does not touch an intent cache that isn't the new item's intent", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(intentQueryKey("other-intent"), {
      id: "other-intent",
      workItems: [],
    });
    vi.spyOn(workApi, "createWorkItem").mockResolvedValue({
      id: "new",
      intentId: "intent-1",
    });

    const { result } = renderHook(() => useCreateWorkItem(), {
      wrapper: withQueryClient(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ title: "New work", intentId: "intent-1" });
    });

    expect(queryClient.getQueryData(intentQueryKey("other-intent")).workItems).toEqual(
      []
    );
  });
});

describe("useUpdateWorkItem", () => {
  it("patches the work item in the flat list AND in every cached intent that contains it", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(WORK_QUERY_KEY, [
      { id: "w1", status: "todo" },
      { id: "w2", status: "todo" },
    ]);
    // Simulate the exact drift scenario: this work item is also cached inside
    // an intent query (as if the user had visited IntentView for it).
    queryClient.setQueryData(intentQueryKey("intent-1"), {
      id: "intent-1",
      workItems: [{ id: "w1", status: "todo" }],
    });
    vi.spyOn(workApi, "updateWorkItem").mockResolvedValue({
      id: "w1",
      status: "done",
    });

    const { result } = renderHook(() => useUpdateWorkItem(), {
      wrapper: withQueryClient(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ workId: "w1", patch: { status: "done" } });
    });

    expect(queryClient.getQueryData(WORK_QUERY_KEY)).toEqual([
      { id: "w1", status: "done" },
      { id: "w2", status: "todo" },
    ]);
    expect(
      queryClient.getQueryData(intentQueryKey("intent-1")).workItems
    ).toEqual([{ id: "w1", status: "done" }]);
  });

  it("is a no-op on caches that don't contain the work item", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(intentQueryKey("unrelated-intent"), {
      id: "unrelated-intent",
      workItems: [{ id: "some-other-work", status: "todo" }],
    });
    vi.spyOn(workApi, "updateWorkItem").mockResolvedValue({
      id: "w1",
      status: "done",
    });

    const { result } = renderHook(() => useUpdateWorkItem(), {
      wrapper: withQueryClient(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ workId: "w1", patch: { status: "done" } });
    });

    expect(
      queryClient.getQueryData(intentQueryKey("unrelated-intent")).workItems
    ).toEqual([{ id: "some-other-work", status: "todo" }]);
  });
});

describe("useDeleteWorkItem", () => {
  it("removes the work item from both the flat list and any cached intent", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(WORK_QUERY_KEY, [{ id: "w1" }, { id: "w2" }]);
    queryClient.setQueryData(intentQueryKey("intent-1"), {
      id: "intent-1",
      workItems: [{ id: "w1" }],
    });
    vi.spyOn(workApi, "deleteWorkItem").mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteWorkItem(), {
      wrapper: withQueryClient(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync("w1");
    });

    expect(queryClient.getQueryData(WORK_QUERY_KEY)).toEqual([{ id: "w2" }]);
    expect(queryClient.getQueryData(intentQueryKey("intent-1")).workItems).toEqual([]);
  });
});

describe("useCreateLocationOption", () => {
  it("appends the new option into the work item wherever it's cached, without changing the selection", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(WORK_QUERY_KEY, [
      { id: "w1", locationOptions: [], selectedLocationOptionId: null },
    ]);
    queryClient.setQueryData(intentQueryKey("intent-1"), {
      id: "intent-1",
      workItems: [{ id: "w1", locationOptions: [], selectedLocationOptionId: null }],
    });
    vi.spyOn(workApi, "createLocationOption").mockResolvedValue({ id: "opt1" });

    const { result } = renderHook(() => useCreateLocationOption(), {
      wrapper: withQueryClient(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ workId: "w1", data: { locations: [] } });
    });

    const flat = queryClient.getQueryData(WORK_QUERY_KEY)[0];
    expect(flat.locationOptions).toEqual([{ id: "opt1" }]);
    // Adding an option never auto-selects it — the user chooses explicitly.
    expect(flat.selectedLocationOptionId).toBe(null);

    const nested = queryClient.getQueryData(intentQueryKey("intent-1")).workItems[0];
    expect(nested.locationOptions).toEqual([{ id: "opt1" }]);
    expect(nested.selectedLocationOptionId).toBe(null);
  });
});

describe("useDeleteLocationOption", () => {
  it("removes the option and applies the server's reassigned selection", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(WORK_QUERY_KEY, [
      {
        id: "w1",
        locationOptions: [{ id: "opt0" }, { id: "opt1" }],
        selectedLocationOptionId: "opt0",
      },
    ]);
    vi.spyOn(workApi, "deleteLocationOption").mockResolvedValue({
      deletedOptionId: "opt0",
      selectedLocationOptionId: "opt1",
    });

    const { result } = renderHook(() => useDeleteLocationOption(), {
      wrapper: withQueryClient(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ workId: "w1", optionId: "opt0" });
    });

    const updated = queryClient.getQueryData(WORK_QUERY_KEY)[0];
    expect(updated.locationOptions).toEqual([{ id: "opt1" }]);
    expect(updated.selectedLocationOptionId).toBe("opt1");
  });
});

describe("useAddLocationToOption / useRemoveLocationFromOption", () => {
  it("replaces the option's locations wherever the work item is cached", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(WORK_QUERY_KEY, [
      { id: "w1", locationOptions: [{ id: "opt0", locations: [] }] },
    ]);
    vi.spyOn(workApi, "addLocationToOption").mockResolvedValue({
      id: "opt0",
      locations: [{ id: "loc1" }],
    });

    const { result } = renderHook(() => useAddLocationToOption(), {
      wrapper: withQueryClient(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        workId: "w1",
        optionId: "opt0",
        data: { name: "A place" },
      });
    });

    expect(
      queryClient.getQueryData(WORK_QUERY_KEY)[0].locationOptions[0].locations
    ).toEqual([{ id: "loc1" }]);
  });

  it("removeLocationFromOption also replaces the option in cache", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(WORK_QUERY_KEY, [
      {
        id: "w1",
        locationOptions: [{ id: "opt0", locations: [{ id: "loc1" }] }],
      },
    ]);
    vi.spyOn(workApi, "removeLocationFromOption").mockResolvedValue({
      id: "opt0",
      locations: [],
    });

    const { result } = renderHook(() => useRemoveLocationFromOption(), {
      wrapper: withQueryClient(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        workId: "w1",
        optionId: "opt0",
        locationId: "loc1",
      });
    });

    expect(
      queryClient.getQueryData(WORK_QUERY_KEY)[0].locationOptions[0].locations
    ).toEqual([]);
  });
});
