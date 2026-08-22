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

// Work items that are force-included (e.g. applying an AI-suggested
// variation) always win the greedy insertion's value-per-cost comparison,
// as long as they fit within the time budget at all — there's no sane way
// to "force" something into a schedule that has no room for it.
const FORCE_INCLUDE_VALUE_BOOST = 1_000_000;

// One entry per (work item, location) pair — a work item whose chosen
// option lists several locations produces several entries, one per
// location, matching how PlannerPage.jsx's routeStops grouping already
// treats "visit each of these places for this work" cases.
//
// resolvedAssignmentKeys holds "${workId}:${locationId}" strings for
// (work, location) pairs the caller has already settled elsewhere in the
// plan. Those pairs are skipped, but the work item's *other* locations
// still get entries — a work item half-done across two branches must not
// be re-proposed at the branch it already finished, nor dropped from the
// branch it hasn't reached yet.
function buildEligibleEntries(
  workItems,
  now,
  forceIncludeSet,
  resolvedAssignmentKeys = new Set()
) {
  const entries = [];

  for (const work of workItems) {
    const chosenOption =
      work.locationOptions?.find(
        (option) => option.id === work.selectedLocationOptionId
      ) || work.locationOptions?.[0];
    const locations = chosenOption?.locations || [];
    const value = forceIncludeSet.has(work.id)
      ? FORCE_INCLUDE_VALUE_BOOST
      : scoreWork(work, work.intent, now);

    for (const location of locations) {
      if (resolvedAssignmentKeys.has(`${work.id}:${location.id}`)) continue;
      entries.push({ work, location, value });
    }
  }

  return entries;
}

// Groups entries by location — a stop's total duration/value is the sum
// across every work item bundled there.
function groupEntriesByLocation(entries) {
  const byLocationId = new Map();

  for (const entry of entries) {
    const existing = byLocationId.get(entry.location.id);
    const duration = entry.work.durationMinutes || 30;

    if (existing) {
      existing.entries.push(entry);
      existing.durationMinutes += duration;
      existing.value += entry.value;
    } else {
      byLocationId.set(entry.location.id, {
        location: entry.location,
        entries: [entry],
        durationMinutes: duration,
        value: entry.value,
      });
    }
  }

  return Array.from(byLocationId.values());
}

function routeTotalMinutes(route, start, end) {
  let total = 0;
  let previous = start;

  for (const stop of route) {
    total +=
      estimateTravelMinutes(previous, stop.location) + stop.durationMinutes;
    previous = stop.location;
  }

  return total + estimateTravelMinutes(previous, end);
}

// Greedy cheapest-insertion heuristic for the "orienteering problem"
// (prize-collecting routing under a time budget): repeatedly insert
// whichever remaining candidate stop has the best value-per-added-cost
// ratio, at whichever position in the current route adds the least travel
// time, as long as the whole route still fits the budget. Not optimal, but
// fast, deterministic, and easy to reason about — acceptable at the scale
// of a personal day-planner (tens of stops, not thousands).
function buildRoute(candidateStops, start, end, budgetMinutes) {
  let route = [];
  let remaining = [...candidateStops];

  while (remaining.length > 0) {
    let best = null;

    for (const candidate of remaining) {
      for (let position = 0; position <= route.length; position += 1) {
        const trialRoute = [
          ...route.slice(0, position),
          candidate,
          ...route.slice(position),
        ];
        const totalMinutes = routeTotalMinutes(trialRoute, start, end);
        if (totalMinutes > budgetMinutes) continue;

        const insertionCost =
          totalMinutes - routeTotalMinutes(route, start, end);
        const ratio = candidate.value / Math.max(1, insertionCost);

        if (!best || ratio > best.ratio) {
          best = { candidate, position, ratio };
        }
      }
    }

    if (!best) break;

    route = [
      ...route.slice(0, best.position),
      best.candidate,
      ...route.slice(best.position),
    ];
    remaining = remaining.filter((stop) => stop !== best.candidate);
  }

  return route;
}

const MINUTE_MS = 60000;

function computeStopTimings(route, start, startAt) {
  let previous = start;
  let cursor = new Date(startAt);

  return route.map((stop) => {
    const travelMinutes = estimateTravelMinutes(previous, stop.location);
    const plannedArrivalAt = new Date(
      cursor.getTime() + travelMinutes * MINUTE_MS
    );
    const plannedDepartureAt = new Date(
      plannedArrivalAt.getTime() + stop.durationMinutes * MINUTE_MS
    );

    previous = stop.location;
    cursor = plannedDepartureAt;

    return { ...stop, plannedArrivalAt, plannedDepartureAt };
  });
}

// The single entry point: scores eligible work, groups it into candidate
// stops, greedily fits as much as possible into the start->end time budget,
// and returns the selected+timed stops plus whatever didn't make the cut.
//
// forceExcludeWorkIds drops a work item from consideration outright;
// resolvedAssignmentKeys is the finer-grained sibling that drops only
// specific (work, location) pairs — see buildEligibleEntries.
function buildPlan({
  workItems,
  start,
  end,
  startAt,
  endAt,
  forceIncludeWorkIds = [],
  forceExcludeWorkIds = [],
  resolvedAssignmentKeys = new Set(),
  now = new Date(),
}) {
  const budgetMinutes = Math.max(
    0,
    Math.round(
      (new Date(endAt).getTime() - new Date(startAt).getTime()) / MINUTE_MS
    )
  );
  const excludeSet = new Set(forceExcludeWorkIds);
  const includeSet = new Set(forceIncludeWorkIds);

  const eligibleWork = workItems.filter(
    (work) => work.status !== "done" && !excludeSet.has(work.id)
  );
  const entries = buildEligibleEntries(
    eligibleWork,
    now,
    includeSet,
    resolvedAssignmentKeys
  );
  const candidateStops = groupEntriesByLocation(entries);
  const route = buildRoute(candidateStops, start, end, budgetMinutes);
  const stops = computeStopTimings(route, start, startAt);

  const selectedWorkIds = new Set(
    stops.flatMap((stop) => stop.entries.map((entry) => entry.work.id))
  );
  const unselectedWork = eligibleWork.filter(
    (work) => !selectedWorkIds.has(work.id)
  );

  return { stops, unselectedWork };
}

module.exports = {
  PRIORITY_POINTS,
  scoreWork,
  urgencyScore,
  haversineKm,
  estimateTravelMinutes,
  buildEligibleEntries,
  groupEntriesByLocation,
  buildRoute,
  computeStopTimings,
  buildPlan,
};
