const PRIORITY_POINTS = { low: 1, medium: 2, high: 3 };
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Urgency is judged by calendar day, not by exact elapsed hours — a due
// date of "today" should score as due-today at 8am and at 11pm alike.
function urgencyScore(dueDate, now) {
  if (!dueDate) return 0;

  const due = new Date(dueDate);
  const startOfDueDay = Date.UTC(
    due.getUTCFullYear(),
    due.getUTCMonth(),
    due.getUTCDate()
  );
  const startOfNowDay = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  const daysUntilDue = Math.round((startOfDueDay - startOfNowDay) / MS_PER_DAY);

  if (daysUntilDue < 0) return 6; // overdue
  if (daysUntilDue === 0) return 5; // due today
  if (daysUntilDue <= 3) return 3;
  if (daysUntilDue <= 7) return 1;
  return 0;
}

function priorityPoints(priority) {
  return PRIORITY_POINTS[priority] ?? PRIORITY_POINTS.medium;
}

// A work item's own priority counts double vs. its parent intent's — it's
// the more specific signal (a low-priority intent can still have one
// urgent errand in it).
function scoreWork(work, intent, now) {
  return (
    2 * priorityPoints(work?.priority) +
    priorityPoints(intent?.priority) +
    urgencyScore(intent?.dueDate, now)
  );
}

const EARTH_RADIUS_KM = 6371;
const DEFAULT_TRAVEL_MIN_PER_KM = 8;

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

// Straight-line distance — a deliberately rough estimate. Real road/traffic
// time is an explicit per-plan opt-in (Plan.useAccurateTravelTime), not
// implemented here; see the design spec's "Open items" section.
function haversineKm(a, b) {
  if (
    !a ||
    !b ||
    a.latitude == null ||
    a.longitude == null ||
    b.latitude == null ||
    b.longitude == null
  ) {
    return null;
  }

  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const radLatA = toRadians(a.latitude);
  const radLatB = toRadians(b.latitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);

  const h =
    sinLat * sinLat + Math.cos(radLatA) * Math.cos(radLatB) * sinLng * sinLng;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function estimateTravelMinutes(a, b) {
  const km = haversineKm(a, b);
  if (km === null) return 8;
  return Math.max(3, Math.round(km * DEFAULT_TRAVEL_MIN_PER_KM));
}

module.exports = {
  PRIORITY_POINTS,
  scoreWork,
  urgencyScore,
  haversineKm,
  estimateTravelMinutes,
};
