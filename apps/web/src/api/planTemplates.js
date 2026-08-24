import apiClient from "./client";

export async function getPlanTemplates() {
  const response = await apiClient.get("/api/plan-templates");
  return response.data;
}

export async function createPlanTemplate(data) {
  const response = await apiClient.post("/api/plan-templates", data);
  return response.data;
}

export async function deletePlanTemplate(id) {
  await apiClient.delete(`/api/plan-templates/${id}`);
}
