const { buildPlan } = require("./planBuilder");

const RESOLVED_STOP_STATUSES = new Set(["done", "skipped"]);

const PLAN_STOP_INCLUDE = {
  location: true,
  works: { include: { work: true } },
};

function loadEligibleWork(client) {
  return client.work.findMany({
    where: { status: { not: "done" } },
    include: {
      intent: true,
      locationOptions: { include: { locations: true } },
    },
  });
}

// Rebuilds a plan's not-yet-resolved stops from the current pool of
// eligible work, leaving any stop already marked done/skipped completely
// untouched — and excluding the work items handled at those frozen stops
// from being reconsidered, so a plan never flip-flops on what it already
// resolved. Runs as one transaction so a partial rebuild can never land
// half-written.
async function rebuildPlanStops(
  prisma,
  planId,
  { asOfAt, asOfLocation, forceIncludeWorkIds = [], forceExcludeWorkIds = [] }
) {
  return prisma.$transaction(async (tx) => {
    const plan = await tx.plan.findUnique({
      where: { id: planId },
      include: { stops: { include: { works: true } } },
    });
    if (!plan) return null;

    const frozenStops = plan.stops.filter((stop) =>
      RESOLVED_STOP_STATUSES.has(stop.status)
    );
    const resolvedWorkIds = frozenStops.flatMap((stop) =>
      stop.works.map((work) => work.workId)
    );

    const staleStopIds = plan.stops
      .filter((stop) => !RESOLVED_STOP_STATUSES.has(stop.status))
      .map((stop) => stop.id);
    if (staleStopIds.length > 0) {
      await tx.planStop.deleteMany({ where: { id: { in: staleStopIds } } });
    }

    const workItems = await loadEligibleWork(tx);
    const { stops, unselectedWork } = buildPlan({
      workItems,
      start: asOfLocation,
      end: { latitude: plan.endLatitude, longitude: plan.endLongitude },
      startAt: asOfAt,
      endAt: plan.endAt,
      forceIncludeWorkIds,
      forceExcludeWorkIds: [...forceExcludeWorkIds, ...resolvedWorkIds],
      now: asOfAt,
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
