// `<input type="datetime-local">` reads/writes local wall-clock time with no
// timezone info, but toISOString() always renders UTC — so the naive
// approach shifts the displayed value by the viewer's UTC offset. Shifting
// the Date by that same offset before formatting cancels it out. Shared by
// every plan form (create and edit) so they can't drift into the same
// timezone bug independently.
export function toDateTimeLocalValue(date) {
  const d = new Date(date);
  d.setSeconds(0, 0);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

const EARTH_RADIUS_KM = 6371;

function haversineKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * sinLng * sinLng;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const DEFAULT_OPPORTUNITY_RADIUS_KM = 2;

// "Opportunity" per ARCHITECTURE.md: work that becomes possible or easier
// because of where you currently are, surfaced automatically rather than
// something anyone has to notice or create — and it naturally disappears
// the moment the caller stops passing a matching currentLocation (e.g. once
// a stop is no longer in_progress), since nothing here is persisted.
export function findNearbyOpportunities(
  currentLocation,
  unselectedWork,
  maxKm = DEFAULT_OPPORTUNITY_RADIUS_KM
) {
  if (!currentLocation || currentLocation.latitude == null) return [];

  const opportunities = [];
  for (const work of unselectedWork) {
    const chosenOption =
      work.locationOptions?.find(
        (option) => option.id === work.selectedLocationOptionId
      ) || work.locationOptions?.[0];
    const locations = chosenOption?.locations || [];

    let nearestKm = null;
    for (const location of locations) {
      if (location.latitude == null || location.longitude == null) continue;
      const km = haversineKm(currentLocation, location);
      if (km <= maxKm && (nearestKm === null || km < nearestKm)) {
        nearestKm = km;
      }
    }

    if (nearestKm !== null) {
      opportunities.push({ work, distanceKm: nearestKm });
    }
  }

  return opportunities.sort((a, b) => a.distanceKm - b.distanceKm);
}

export const PLAN_ENERGY_LEVEL_OPTIONS = [
  { value: "high", label: "High — I can tackle anything" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low — keep it easy" },
];

// Single fallback so a plan without a title reads identically in the list
// and detail views, instead of "Aug 22, 2026" in one and literal "Plan" in
// the other for the same plan.
export function getPlanDisplayTitle(plan) {
  return plan.title || new Date(plan.startAt).toLocaleDateString();
}

const ON_TIME_TOLERANCE_MINUTES = 5;

// Compares an actual timestamp against its planned counterpart. Returns
// null when there's nothing to compare yet (actual not recorded).
export function describeTimingDelta(actualIso, plannedIso) {
  if (!actualIso || !plannedIso) return null;

  const deltaMinutes = Math.round(
    (new Date(actualIso).getTime() - new Date(plannedIso).getTime()) / 60000
  );

  if (Math.abs(deltaMinutes) <= ON_TIME_TOLERANCE_MINUTES) {
    return { label: "On time", tone: "success" };
  }
  if (deltaMinutes > 0) {
    return { label: `${deltaMinutes} min late`, tone: "danger" };
  }
  return { label: `${Math.abs(deltaMinutes)} min early`, tone: "primary" };
}
