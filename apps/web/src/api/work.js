import apiClient from "./client";

export async function getWorkItems() {
  const response = await apiClient.get("/api/work");
  return response.data;
}

export async function createWorkItem(data) {
  const response = await apiClient.post("/api/work", data);
  return response.data;
}

export async function updateWorkItem(id, patch) {
  const response = await apiClient.patch(`/api/work/${id}`, patch);
  return response.data;
}

export async function deleteWorkItem(id) {
  await apiClient.delete(`/api/work/${id}`);
}

export async function createLocationOption(workId, data) {
  const response = await apiClient.post(
    `/api/work/${workId}/location-option`,
    data
  );
  return response.data;
}

export async function deleteLocationOption(workId, optionId) {
  const response = await apiClient.delete(
    `/api/work/${workId}/location-option/${optionId}`
  );
  return response.data;
}

export async function addLocationToOption(workId, optionId, data) {
  const response = await apiClient.post(
    `/api/work/${workId}/location-option/${optionId}/location`,
    data
  );
  return response.data;
}

export async function removeLocationFromOption(workId, optionId, locationId) {
  const response = await apiClient.delete(
    `/api/work/${workId}/location-option/${optionId}/location/${locationId}`
  );
  return response.data;
}
