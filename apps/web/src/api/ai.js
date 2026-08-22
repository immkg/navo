import apiClient from "./client";

export async function suggestWork(intentId) {
  const response = await apiClient.post("/api/ai/suggest-work", { intentId });
  return response.data;
}

export async function draftIntent(title, description) {
  const response = await apiClient.post("/api/ai/draft-intent", {
    title,
    description,
  });
  return response.data;
}

export async function suggestPlaceTypes(title, notes, location) {
  const response = await apiClient.post("/api/ai/suggest-place-types", {
    title,
    notes,
    location,
  });
  return response.data;
}

export async function optimizeRoute(startPoint, stops) {
  const response = await apiClient.post("/api/ai/optimize-route", {
    startPoint,
    stops,
  });
  return response.data;
}

export async function splitIntent(text) {
  const response = await apiClient.post("/api/ai/split-intent", { text });
  return response.data;
}

export async function planVariations(
  selectedWork,
  unselectedWork,
  budgetMinutes
) {
  const response = await apiClient.post("/api/ai/plan-variations", {
    selectedWork,
    unselectedWork,
    budgetMinutes,
  });
  return response.data;
}
