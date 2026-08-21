import { act, renderHook } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { createTestQueryClient } from "../../test/renderWithProviders";
import * as aiApi from "../../api/ai";
import {
  useDraftIntent,
  useOptimizeRoute,
  useSuggestPlaceTypes,
  useSuggestWork,
} from "./hooks";

function withQueryClient(queryClient) {
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useSuggestWork", () => {
  it("calls suggestWork with the intent id and returns its result", async () => {
    vi.spyOn(aiApi, "suggestWork").mockResolvedValue({
      suggestions: [{ title: "Book flights" }],
    });
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useSuggestWork(), {
      wrapper: withQueryClient(queryClient),
    });

    let resolved;
    await act(async () => {
      resolved = await result.current.mutateAsync("intent-1");
    });

    expect(aiApi.suggestWork).toHaveBeenCalledWith("intent-1");
    expect(resolved.suggestions).toEqual([{ title: "Book flights" }]);
  });
});

describe("useDraftIntent", () => {
  it("calls draftIntent with the title and description", async () => {
    vi.spyOn(aiApi, "draftIntent").mockResolvedValue({
      description: "A draft.",
      priority: "medium",
      dueDate: null,
    });
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useDraftIntent(), {
      wrapper: withQueryClient(queryClient),
    });

    let resolved;
    await act(async () => {
      resolved = await result.current.mutateAsync({
        title: "Renew passport",
        description: undefined,
      });
    });

    expect(aiApi.draftIntent).toHaveBeenCalledWith("Renew passport", undefined);
    expect(resolved.priority).toBe("medium");
  });
});

describe("useSuggestPlaceTypes", () => {
  it("calls suggestPlaceTypes with the title and notes", async () => {
    vi.spyOn(aiApi, "suggestPlaceTypes").mockResolvedValue({
      suggestions: ["pharmacy"],
    });
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useSuggestPlaceTypes(), {
      wrapper: withQueryClient(queryClient),
    });

    let resolved;
    await act(async () => {
      resolved = await result.current.mutateAsync({
        title: "Pick up prescription",
        notes: undefined,
      });
    });

    expect(aiApi.suggestPlaceTypes).toHaveBeenCalledWith(
      "Pick up prescription",
      undefined
    );
    expect(resolved.suggestions).toEqual(["pharmacy"]);
  });
});

describe("useOptimizeRoute", () => {
  it("calls optimizeRoute with the start point and stops", async () => {
    vi.spyOn(aiApi, "optimizeRoute").mockResolvedValue({
      order: ["w2", "w1"],
      reasoning: "closer first",
    });
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useOptimizeRoute(), {
      wrapper: withQueryClient(queryClient),
    });

    const startPoint = { latitude: 1, longitude: 1 };
    const stops = [{ id: "w1" }, { id: "w2" }];

    let resolved;
    await act(async () => {
      resolved = await result.current.mutateAsync({ startPoint, stops });
    });

    expect(aiApi.optimizeRoute).toHaveBeenCalledWith(startPoint, stops);
    expect(resolved.order).toEqual(["w2", "w1"]);
  });
});
