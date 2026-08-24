import apiClient from "./client";

export async function getTravelTimeMinutes(origin, destinations) {
  const response = await apiClient.post("/api/routing/travel-time", {
    origin,
    destinations,
  });
  return response.data;
}
