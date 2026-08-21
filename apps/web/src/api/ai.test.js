import { describe, expect, it, vi } from "vitest";
import apiClient from "./client";
import {
  draftIntent,
  optimizeRoute,
  suggestPlaceTypes,
  suggestWork,
} from "./ai";

vi.mock("./client", () => ({
  default: { post: vi.fn() },
}));

describe("suggestWork", () => {
  it("posts the intentId and returns the response body", async () => {
    apiClient.post.mockResolvedValue({ data: { suggestions: [] } });

    const result = await suggestWork("intent-1");

    expect(apiClient.post).toHaveBeenCalledWith("/api/ai/suggest-work", {
      intentId: "intent-1",
    });
    expect(result).toEqual({ suggestions: [] });
  });
});

describe("draftIntent", () => {
  it("posts the title and description and returns the response body", async () => {
    apiClient.post.mockResolvedValue({
      data: { description: "A draft.", priority: "medium", dueDate: null },
    });

    const result = await draftIntent("Renew passport", "existing description");

    expect(apiClient.post).toHaveBeenCalledWith("/api/ai/draft-intent", {
      title: "Renew passport",
      description: "existing description",
    });
    expect(result.priority).toBe("medium");
  });
});

describe("suggestPlaceTypes", () => {
  it("posts the title and notes and returns the response body", async () => {
    apiClient.post.mockResolvedValue({ data: { suggestions: ["pharmacy"] } });

    const result = await suggestPlaceTypes(
      "Pick up prescription",
      "ask for generic"
    );

    expect(apiClient.post).toHaveBeenCalledWith("/api/ai/suggest-place-types", {
      title: "Pick up prescription",
      notes: "ask for generic",
    });
    expect(result.suggestions).toEqual(["pharmacy"]);
  });
});

describe("optimizeRoute", () => {
  it("posts the startPoint and stops and returns the response body", async () => {
    apiClient.post.mockResolvedValue({
      data: { order: ["w2", "w1"], reasoning: "closer first" },
    });
    const startPoint = { latitude: 1, longitude: 1 };
    const stops = [{ id: "w1" }, { id: "w2" }];

    const result = await optimizeRoute(startPoint, stops);

    expect(apiClient.post).toHaveBeenCalledWith("/api/ai/optimize-route", {
      startPoint,
      stops,
    });
    expect(result.order).toEqual(["w2", "w1"]);
  });
});
