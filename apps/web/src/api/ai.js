import apiClient from "./client";

export async function suggestWork(intentId) {
  const response = await apiClient.post("/api/ai/suggest-work", { intentId });
  return response.data;
}
