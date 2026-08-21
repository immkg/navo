import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { createTestQueryClient } from "../../test/renderWithProviders";
import * as intentsApi from "../../api/intents";
import {
  useBulkDeleteIntents,
  useBulkUpdateIntentStatus,
  useCreateIntent,
  useIntent,
  useIntents,
  usePatchIntent,
  INTENTS_QUERY_KEY,
  intentQueryKey,
} from "./hooks";

function withQueryClient(queryClient) {
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useIntents", () => {
  it("normalizes each intent returned by the API", async () => {
    vi.spyOn(intentsApi, "getIntents").mockResolvedValue([
      { id: "1", title: "Untouched" },
    ]);
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useIntents(), {
      wrapper: withQueryClient(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      {
        id: "1",
        title: "Untouched",
        workCount: 0,
        completedWorkCount: 0,
        placeCount: 0,
        priority: "medium",
        status: "active",
      },
    ]);
  });
});

describe("useIntent", () => {
  it("fetches a single intent by id", async () => {
    vi.spyOn(intentsApi, "getIntent").mockResolvedValue({
      id: "42",
      title: "Plan a trip",
      workItems: [],
    });
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useIntent("42"), {
      wrapper: withQueryClient(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(intentsApi.getIntent).toHaveBeenCalledWith("42");
    expect(result.current.data.title).toBe("Plan a trip");
  });

  it("does not fetch when no id is given", () => {
    const getIntentSpy = vi.spyOn(intentsApi, "getIntent");
    const queryClient = createTestQueryClient();

    renderHook(() => useIntent(undefined), {
      wrapper: withQueryClient(queryClient),
    });

    expect(getIntentSpy).not.toHaveBeenCalled();
  });
});

describe("useCreateIntent", () => {
  it("prepends the normalized new intent into the intents list cache", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(INTENTS_QUERY_KEY, [{ id: "existing" }]);
    vi.spyOn(intentsApi, "createIntent").mockResolvedValue({
      id: "new",
      title: "New intent",
    });

    const { result } = renderHook(() => useCreateIntent(), {
      wrapper: withQueryClient(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ title: "New intent" });
    });

    const cached = queryClient.getQueryData(INTENTS_QUERY_KEY);
    expect(cached).toHaveLength(2);
    expect(cached[0]).toMatchObject({ id: "new", status: "active" });
    expect(cached[1]).toEqual({ id: "existing" });
  });
});

describe("usePatchIntent", () => {
  it("merges the patch into both the list cache and the single-intent cache", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(INTENTS_QUERY_KEY, [
      { id: "1", status: "active", priority: "medium" },
    ]);
    queryClient.setQueryData(intentQueryKey("1"), {
      id: "1",
      status: "active",
      workItems: [{ id: "w1" }],
    });
    vi.spyOn(intentsApi, "updateIntent").mockResolvedValue({
      id: "1",
      status: "completed",
    });

    const { result } = renderHook(() => usePatchIntent(), {
      wrapper: withQueryClient(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        intentId: "1",
        patch: { status: "completed" },
      });
    });

    expect(queryClient.getQueryData(INTENTS_QUERY_KEY)[0]).toMatchObject({
      status: "completed",
    });
    const singleCached = queryClient.getQueryData(intentQueryKey("1"));
    expect(singleCached.status).toBe("completed");
    // the merge must not wipe out fields the PATCH response doesn't include
    expect(singleCached.workItems).toEqual([{ id: "w1" }]);
  });
});

describe("useBulkUpdateIntentStatus", () => {
  it("only merges the status for ids whose update succeeded", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(INTENTS_QUERY_KEY, [
      { id: "1", status: "active" },
      { id: "2", status: "active" },
    ]);
    vi.spyOn(intentsApi, "updateIntent").mockImplementation((id) =>
      id === "1"
        ? Promise.resolve({ id, status: "completed" })
        : Promise.reject(new Error("boom"))
    );

    const { result } = renderHook(() => useBulkUpdateIntentStatus(), {
      wrapper: withQueryClient(queryClient),
    });

    let resolved;
    await act(async () => {
      resolved = await result.current.mutateAsync({
        ids: ["1", "2"],
        status: "completed",
      });
    });

    expect(resolved.results.map((r) => r.status)).toEqual([
      "fulfilled",
      "rejected",
    ]);
    const cached = queryClient.getQueryData(INTENTS_QUERY_KEY);
    expect(cached.find((i) => i.id === "1").status).toBe("completed");
    expect(cached.find((i) => i.id === "2").status).toBe("active");
  });
});

describe("useBulkDeleteIntents", () => {
  it("only removes ids whose delete succeeded", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(INTENTS_QUERY_KEY, [{ id: "1" }, { id: "2" }]);
    vi.spyOn(intentsApi, "deleteIntent").mockImplementation((id) =>
      id === "1" ? Promise.resolve() : Promise.reject(new Error("boom"))
    );

    const { result } = renderHook(() => useBulkDeleteIntents(), {
      wrapper: withQueryClient(queryClient),
    });

    let resolved;
    await act(async () => {
      resolved = await result.current.mutateAsync(["1", "2"]);
    });

    expect(resolved.results.map((r) => r.status)).toEqual([
      "fulfilled",
      "rejected",
    ]);
    const cached = queryClient.getQueryData(INTENTS_QUERY_KEY);
    expect(cached).toEqual([{ id: "2" }]);
  });
});
