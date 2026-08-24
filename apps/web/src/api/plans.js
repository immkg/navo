import apiClient from "./client";

export async function getPlans() {
  const response = await apiClient.get("/api/plans");
  return response.data;
}

export async function createPlan(data) {
  const response = await apiClient.post("/api/plans", data);
  return response.data;
}

export async function getPlan(id) {
  const response = await apiClient.get(`/api/plans/${id}`);
  return response.data;
}

export async function updatePlan(id, patch) {
  const response = await apiClient.patch(`/api/plans/${id}`, patch);
  return response.data;
}

export async function deletePlan(id) {
  await apiClient.delete(`/api/plans/${id}`);
}

export async function recheckPlan(id, data) {
  const response = await apiClient.post(`/api/plans/${id}/recheck`, data);
  return response.data;
}

export async function updatePlanStop(planId, stopId, patch) {
  const response = await apiClient.patch(
    `/api/plans/${planId}/stops/${stopId}`,
    patch
  );
  return response.data;
}

export async function reorderPlanStop(planId, stopId, direction) {
  const response = await apiClient.patch(
    `/api/plans/${planId}/stops/${stopId}/reorder`,
    { direction }
  );
  return response.data;
}

export async function updatePlanStopWork(planId, stopId, workId, patch) {
  const response = await apiClient.patch(
    `/api/plans/${planId}/stops/${stopId}/work/${workId}`,
    patch
  );
  return response.data;
}
