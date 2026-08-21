export function getChosenOption(work) {
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
  return (work?.locationOptions || []).map((option) => ({
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
      phoneNumber: location.phoneNumber,
      rating: location.rating,
      ratingsCount: location.ratingsCount,
      openingHoursText: location.openingHoursText,
      openingPeriods: location.openingPeriods,
    })),
  }));
}
