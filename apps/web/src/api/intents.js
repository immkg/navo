import apiClient from "./client";

export async function getIntents() {
  const response = await apiClient.get("/api/intents");
  return response.data;
}

export async function getIntent(id) {
  const response = await apiClient.get(`/api/intents/${id}`);
  return response.data;
}

export async function createIntent(data) {
  const response = await apiClient.post("/api/intents", data);
  return response.data;
}

export async function updateIntent(id, patch) {
  const response = await apiClient.patch(`/api/intents/${id}`, patch);
  return response.data;
}

export async function deleteIntent(id) {
  await apiClient.delete(`/api/intents/${id}`);
}
