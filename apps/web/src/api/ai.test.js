import { describe, expect, it, vi } from "vitest";
import apiClient from "./client";
import {
  draftIntent,
  planVariations,
  splitIntent,
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

describe("splitIntent", () => {
  it("posts the text and returns the response body", async () => {
    apiClient.post.mockResolvedValue({
      data: { intents: [{ title: "Renew passport", priority: "high" }] },
    });

    const result = await splitIntent("renew passport, book flights");

    expect(apiClient.post).toHaveBeenCalledWith("/api/ai/split-intent", {
      text: "renew passport, book flights",
    });
    expect(result.intents).toEqual([
      { title: "Renew passport", priority: "high" },
    ]);
  });
});

describe("planVariations", () => {
  it("posts the selected/unselected work and budget, and returns the response body", async () => {
    apiClient.post.mockResolvedValue({
      data: { variations: [{ addWorkIds: ["w2"], removeWorkIds: ["w1"] }] },
    });

    const result = await planVariations([{ id: "w1" }], [{ id: "w2" }], 60);

    expect(apiClient.post).toHaveBeenCalledWith("/api/ai/plan-variations", {
      selectedWork: [{ id: "w1" }],
      unselectedWork: [{ id: "w2" }],
      budgetMinutes: 60,
    });
    expect(result.variations.length).toBe(1);
  });
});
