const { buildPlan } = require("./planBuilder");

// Applies to PlanStop.status and PlanStopWork.status alike — both use the
// same vocabulary for "this is settled, stop reconsidering it".
const RESOLVED_STATUSES = new Set(["done", "skipped"]);

// The nested intent isn't decoration: recheck feeds these work items to the
// AI variations prompt, which reads intent priority and due date. Without it
// every *selected* work item looked like a default medium/no-due-date item
// while unselected ones (loaded separately, with their intent) showed real
// values — systematically biasing the model toward dropping urgent work.
const PLAN_STOP_INCLUDE = {
  location: true,
  works: { include: { work: { include: { intent: true } } } },
};

function loadEligibleWork(client) {
  return client.work.findMany({
    where: { status: { not: "done" } },
    orderBy: { createdAt: "asc" },
    include: {
      intent: true,
      locationOptions: { include: { locations: true } },
    },
  });
}

// A stop is frozen — kept as-is, never deleted and rebuilt — when the stop
// itself is resolved, OR when any single work item assigned to it is.
// Stop-level status alone isn't enough: PATCH /:id/stops/:stopId/work/:workId
// only ever writes PlanStopWork.status, so a stop can hold a completed work
// item while its own status is still "planned".
function isFrozen(stop) {
  return (
    RESOLVED_STATUSES.has(stop.status) ||
    stop.works.some((assignment) => RESOLVED_STATUSES.has(assignment.status))
  );
}

// "${workId}:${locationId}" for every already-resolved assignment in the
// plan. This is the granularity that matters for a work item whose chosen
// option lists several locations: finishing it at branch A must stop it
// being re-proposed at branch A without also abandoning branch B.
function collectResolvedAssignmentKeys(stops) {
  const keys = new Set();

  for (const stop of stops) {
    for (const assignment of stop.works) {
      if (RESOLVED_STATUSES.has(assignment.status)) {
        keys.add(`${assignment.workId}:${stop.locationId}`);
      }
    }
  }

  return keys;
}

// Work ids to drop from the eligible pool outright, because the *whole*
// work item is settled: every one of its assignments across this plan is
// resolved. Mirrors the "is this work item finished" test that
// PATCH /:id/stops/:stopId/work/:workId uses to sync Work.status. A work
// item with even one still-"planned" assignment stays in the pool, so the
// builder can re-propose the location it hasn't reached yet.
function collectFullyResolvedWorkIds(stops) {
  const statusesByWorkId = new Map();

  for (const stop of stops) {
    for (const assignment of stop.works) {
      const statuses = statusesByWorkId.get(assignment.workId) || [];
      statuses.push(assignment.status);
      statusesByWorkId.set(assignment.workId, statuses);
    }
  }

  return [...statusesByWorkId.entries()]
    .filter(([, statuses]) =>
      statuses.every((status) => RESOLVED_STATUSES.has(status))
    )
    .map(([workId]) => workId);
}

// The latest point in time the plan has demonstrably already reached, plus
// where it left the traveller. Prefers a stop's real departure over its
// planned one.
function latestFrozenDeparture(frozenStops) {
  let latest = null;

  for (const stop of frozenStops) {
    const departure = stop.actualDepartureAt || stop.plannedDepartureAt;
    if (!departure) continue;
    if (!latest || departure.getTime() > latest.departure.getTime()) {
      latest = { departure, location: stop.location };
    }
  }

  return latest;
}

// Rebuilds a plan's not-yet-resolved stops from the current pool of
// eligible work, leaving anything already resolved completely untouched —
// at the (work item, location) granularity, not merely the stop
// granularity, so a work item spanning two locations can be finished at one
// of them without either losing that fact or abandoning the other. Runs as
// one transaction so a partial rebuild can never land half-written.
async function rebuildPlanStops(
  prisma,
  planId,
  { asOfAt, asOfLocation, forceIncludeWorkIds = [], forceExcludeWorkIds = [] }
) {
  return prisma.$transaction(async (tx) => {
    const plan = await tx.plan.findUnique({
      where: { id: planId },
      include: { stops: { include: { works: true, location: true } } },
    });
    if (!plan) return null;

    const frozenStops = plan.stops.filter(isFrozen);
    // Both of these scan *every* stop, not just the frozen ones: an
    // unresolved assignment sitting on a stop that is about to be rebuilt is
    // exactly what keeps its work item eligible.
    const resolvedAssignmentKeys = collectResolvedAssignmentKeys(plan.stops);
    const resolvedWorkIds = collectFullyResolvedWorkIds(plan.stops);

    const frozenStopIds = new Set(frozenStops.map((stop) => stop.id));
    const staleStopIds = plan.stops
      .filter((stop) => !frozenStopIds.has(stop.id))
      .map((stop) => stop.id);
    if (staleStopIds.length > 0) {
      await tx.planStop.deleteMany({ where: { id: { in: staleStopIds } } });
    }

    // Frozen stops have already consumed real time, so a new stop can never
    // start before the last of them is departed. Callers don't all know
    // this — PATCH passes the plan's original startAt — so clamp here, where
    // every caller benefits: it's a no-op for a fresh POST (no frozen stops)
    // and a safety net for recheck (which already passes live data).
    const lastDeparture = latestFrozenDeparture(frozenStops);
    let effectiveAsOfAt = asOfAt;
    let effectiveAsOfLocation = asOfLocation;
    if (
      lastDeparture &&
      lastDeparture.departure.getTime() > new Date(asOfAt).getTime()
    ) {
      effectiveAsOfAt = lastDeparture.departure;
      // The origin has to match the moment we're now starting from: at that
      // departure time the traveller is at that stop, not wherever the
      // caller guessed. (When the caller's own asOfAt is the later of the
      // two, its location is the fresher one and is left alone.)
      effectiveAsOfLocation = lastDeparture.location;
    }

    const workItems = await loadEligibleWork(tx);
    const { stops, unselectedWork } = buildPlan({
      workItems,
      start: effectiveAsOfLocation,
      end: { latitude: plan.endLatitude, longitude: plan.endLongitude },
      startAt: effectiveAsOfAt,
      endAt: plan.endAt,
      forceIncludeWorkIds,
      forceExcludeWorkIds: [...forceExcludeWorkIds, ...resolvedWorkIds],
      resolvedAssignmentKeys,
      now: effectiveAsOfAt,
    });

    let order = Math.max(-1, ...frozenStops.map((stop) => stop.order)) + 1;
    for (const stop of stops) {
      const uniqueWorkIds = [
        ...new Set(stop.entries.map((entry) => entry.work.id)),
      ];
      await tx.planStop.create({
        data: {
          planId,
          locationId: stop.location.id,
          order,
          plannedArrivalAt: stop.plannedArrivalAt,
          plannedDepartureAt: stop.plannedDepartureAt,
          works: { create: uniqueWorkIds.map((workId) => ({ workId })) },
        },
      });
      order += 1;
    }

    const refreshedPlan = await tx.plan.findUnique({
      where: { id: planId },
      include: {
        stops: { orderBy: { order: "asc" }, include: PLAN_STOP_INCLUDE },
      },
    });

    return { plan: refreshedPlan, unselectedWork };
  });
}

module.exports = { rebuildPlanStops, loadEligibleWork, PLAN_STOP_INCLUDE };
