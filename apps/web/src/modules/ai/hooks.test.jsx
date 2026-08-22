import { act, renderHook } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { createTestQueryClient } from "../../test/renderWithProviders";
import * as aiApi from "../../api/ai";
import {
  useDraftIntent,
  useSplitIntent,
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
      undefined,
      undefined
    );
    expect(resolved.suggestions).toEqual(["pharmacy"]);
  });
});

describe("useSplitIntent", () => {
  it("calls splitIntent with the text and returns its result", async () => {
    vi.spyOn(aiApi, "splitIntent").mockResolvedValue({
      intents: [{ title: "Renew passport", priority: "high" }],
    });
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useSplitIntent(), {
      wrapper: withQueryClient(queryClient),
    });

    let resolved;
    await act(async () => {
      resolved = await result.current.mutateAsync(
        "renew passport, book flights"
      );
    });

    expect(aiApi.splitIntent).toHaveBeenCalledWith(
      "renew passport, book flights"
    );
    expect(resolved.intents).toEqual([
      { title: "Renew passport", priority: "high" },
    ]);
  });
});
