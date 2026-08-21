export const WORK_STATUS_OPTIONS = [
  { value: "todo", label: "Todo" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

export function getChosenLocationOption(work) {
  if (!work?.locationOptions || work.locationOptions.length === 0) {
    return null;
  }

  if (work.selectedLocationOptionId) {
    const selected = work.locationOptions.find(
      (option) => option.id === work.selectedLocationOptionId
    );
    if (selected) return selected;
  }

  return work.locationOptions[0];
}

export function buildLocationOptionGroupsFromWork(work) {
  if (!work?.locationOptions) return [];
  return work.locationOptions.map((option) => ({
    id: option.id,
    title: option.title || "",
    locations: (option.locations || []).map((location) => ({
      id: location.id,
      name: location.name,
      address: location.address,
      latitude: location.latitude,
      longitude: location.longitude,
      placeId: location.placeId,
      provider: location.provider,
    })),
  }));
}
