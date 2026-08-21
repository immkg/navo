import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { createTestQueryClient } from "../../test/renderWithProviders";
import { intentQueryKey } from "../intents/hooks";
import * as workApi from "../../api/work";
import {
  useCreateWorkItem,
  useDeleteWorkItem,
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
      await result.current.mutateAsync({
        title: "New work",
        intentId: "intent-1",
      });
    });

    expect(queryClient.getQueryData(WORK_QUERY_KEY)).toEqual([
      { id: "new", intentId: "intent-1" },
      { id: "existing" },
    ]);
    expect(
      queryClient.getQueryData(intentQueryKey("intent-1")).workItems
    ).toEqual([{ id: "new", intentId: "intent-1" }, { id: "existing" }]);
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
      await result.current.mutateAsync({
        title: "New work",
        intentId: "intent-1",
      });
    });

    expect(
      queryClient.getQueryData(intentQueryKey("other-intent")).workItems
    ).toEqual([]);
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
    // an intent query (as if the user had visited IntentPage for it).
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
      await result.current.mutateAsync({
        workId: "w1",
        patch: { status: "done" },
      });
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
      await result.current.mutateAsync({
        workId: "w1",
        patch: { status: "done" },
      });
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
    expect(
      queryClient.getQueryData(intentQueryKey("intent-1")).workItems
    ).toEqual([]);
  });
});
