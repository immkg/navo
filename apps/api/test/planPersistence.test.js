const { test, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const prisma = require("../src/db/client");
const { cleanDatabase } = require("../test-support/helpers");
const { rebuildPlanStops } = require("../src/services/planPersistence");

beforeEach(cleanDatabase);
after(cleanDatabase);

test("rebuildPlanStops returns null for a missing plan", async () => {
  const result = await rebuildPlanStops(prisma, "missing-id", {
    asOfAt: new Date(),
    asOfLocation: { latitude: 0, longitude: 0 },
  });

  assert.equal(result, null);
});

test("rebuildPlanStops builds and persists stops for eligible work", async () => {
  const work = await prisma.work.create({
    data: {
      title: "Pick up prescription",
      durationMinutes: 10,
      locationOptions: {
        create: {
          locations: {
            create: { name: "Pharmacy", latitude: 0.001, longitude: 0 },
          },
        },
      },
    },
  });
  const plan = await prisma.plan.create({
    data: {
      startAt: new Date("2026-08-22T09:00:00Z"),
      startLatitude: 0,
      startLongitude: 0,
      endAt: new Date("2026-08-22T10:00:00Z"),
      endLatitude: 0,
      endLongitude: 0,
    },
  });

  const result = await rebuildPlanStops(prisma, plan.id, {
    asOfAt: plan.startAt,
    asOfLocation: { latitude: 0, longitude: 0 },
  });

  assert.equal(result.plan.stops.length, 1);
  assert.equal(result.plan.stops[0].works[0].work.id, work.id);
  assert.equal(result.unselectedWork.length, 0);
});

test("rebuildPlanStops persists location-less work at a real anchor Location instead of dropping it", async () => {
  const work = await prisma.work.create({
    data: { title: "Call the dentist to reschedule", durationMinutes: 10 },
  });
  const plan = await prisma.plan.create({
    data: {
      startAt: new Date("2026-08-22T09:00:00Z"),
      startLatitude: 12,
      startLongitude: 34,
      endAt: new Date("2026-08-22T10:00:00Z"),
      endLatitude: 12,
      endLongitude: 34,
    },
  });

  const result = await rebuildPlanStops(prisma, plan.id, {
    asOfAt: plan.startAt,
    asOfLocation: { latitude: 12, longitude: 34 },
  });

  assert.equal(result.unselectedWork.length, 0);
  assert.equal(result.plan.stops.length, 1);
  const [stop] = result.plan.stops;
  assert.equal(stop.works[0].work.id, work.id);
  assert.ok(stop.locationId, "stop must reference a real, persisted Location");
  const persistedLocation = await prisma.location.findUnique({
    where: { id: stop.locationId },
  });
  assert.ok(persistedLocation, "anchor Location must actually exist in the DB");
  assert.equal(persistedLocation.latitude, 12);
  assert.equal(persistedLocation.longitude, 34);
});

test("rebuildPlanStops still builds stops when useAccurateTravelTime is on but no routing API key is configured (falls back to haversine)", async () => {
  delete process.env.GOOGLE_MAPS_API_KEY;
  const work = await prisma.work.create({
    data: {
      title: "Pick up prescription",
      durationMinutes: 10,
      locationOptions: {
        create: {
          locations: {
            create: { name: "Pharmacy", latitude: 0.001, longitude: 0 },
          },
        },
      },
    },
  });
  const plan = await prisma.plan.create({
    data: {
      startAt: new Date("2026-08-22T09:00:00Z"),
      startLatitude: 0,
      startLongitude: 0,
      endAt: new Date("2026-08-22T10:00:00Z"),
      endLatitude: 0,
      endLongitude: 0,
      useAccurateTravelTime: true,
    },
  });

  const result = await rebuildPlanStops(prisma, plan.id, {
    asOfAt: plan.startAt,
    asOfLocation: { latitude: 0, longitude: 0 },
  });

  assert.equal(result.plan.stops.length, 1);
  assert.equal(result.plan.stops[0].works[0].work.id, work.id);
});

test("rebuildPlanStops leaves already-resolved stops untouched and excludes their work from reconsideration", async () => {
  const work = await prisma.work.create({
    data: { title: "Pick up prescription", durationMinutes: 10 },
  });
  const location = await prisma.location.create({
    data: { name: "Pharmacy", latitude: 0.001, longitude: 0 },
  });
  const plan = await prisma.plan.create({
    data: {
      status: "active",
      startAt: new Date("2026-08-22T09:00:00Z"),
      endAt: new Date("2026-08-22T10:00:00Z"),
    },
  });
  const doneStop = await prisma.planStop.create({
    data: {
      planId: plan.id,
      locationId: location.id,
      order: 0,
      status: "done",
      plannedArrivalAt: new Date("2026-08-22T09:05:00Z"),
      plannedDepartureAt: new Date("2026-08-22T09:15:00Z"),
      works: { create: { workId: work.id, status: "done" } },
    },
  });

  const result = await rebuildPlanStops(prisma, plan.id, {
    asOfAt: new Date("2026-08-22T09:20:00Z"),
    asOfLocation: { latitude: 0.001, longitude: 0 },
  });

  assert.equal(result.plan.stops.length, 1);
  assert.equal(result.plan.stops[0].id, doneStop.id);
  assert.equal(result.plan.stops[0].status, "done");
  assert.equal(result.unselectedWork.length, 0);
});

test("rebuildPlanStops never drops a stop the person is currently standing at (in_progress), even with an unresolved work item on it", async () => {
  // Reproduces a real scenario: arrive at a stop (in_progress), its one
  // work item is still "planned" (not done/skipped yet) — then force-include
  // a different, nearby work item (e.g. via "Add to plan" on a surfaced
  // opportunity). The in-progress stop must survive the rebuild; only
  // done/skipped stops being "frozen" isn't enough, since nothing here is
  // resolved yet.
  const currentWork = await prisma.work.create({
    data: { title: "Currently doing this", durationMinutes: 5 },
  });
  const currentLocation = await prisma.location.create({
    data: { name: "Loc A", latitude: 30.7, longitude: 76.7 },
  });
  const nearbyWork = await prisma.work.create({
    data: {
      title: "Nearby opportunity",
      durationMinutes: 5,
      locationOptions: {
        create: {
          locations: {
            create: { name: "Loc B", latitude: 30.701, longitude: 76.7 },
          },
        },
      },
    },
  });
  const plan = await prisma.plan.create({
    data: {
      status: "active",
      startAt: new Date("2026-08-22T09:00:00Z"),
      startLatitude: 30.7,
      startLongitude: 76.7,
      endAt: new Date("2026-08-22T09:15:00Z"),
      endLatitude: 30.7,
      endLongitude: 76.7,
    },
  });
  const currentStop = await prisma.planStop.create({
    data: {
      planId: plan.id,
      locationId: currentLocation.id,
      order: 0,
      status: "in_progress",
      actualArrivalAt: new Date("2026-08-22T09:03:00Z"),
      plannedArrivalAt: new Date("2026-08-22T09:03:00Z"),
      plannedDepartureAt: new Date("2026-08-22T09:08:00Z"),
      works: { create: { workId: currentWork.id, status: "planned" } },
    },
  });

  const result = await rebuildPlanStops(prisma, plan.id, {
    asOfAt: plan.startAt,
    asOfLocation: { latitude: 30.7, longitude: 76.7 },
    forceIncludeWorkIds: [nearbyWork.id],
  });

  const currentStopStillPresent = result.plan.stops.some(
    (stop) => stop.id === currentStop.id
  );
  assert.ok(
    currentStopStillPresent,
    "the in-progress stop should never be deleted by a rebuild"
  );
  const currentStopAfter = result.plan.stops.find(
    (stop) => stop.id === currentStop.id
  );
  assert.equal(currentStopAfter.status, "in_progress");
  assert.equal(currentStopAfter.works[0].work.id, currentWork.id);
});

test("rebuildPlanStops does not collide orders when a stop resolves out of sequence", async () => {
  const staleLocationA = await prisma.location.create({
    data: { name: "Stale A", latitude: 0.002, longitude: 0 },
  });
  const frozenLocation = await prisma.location.create({
    data: { name: "Frozen", latitude: 0.001, longitude: 0 },
  });
  const staleLocationB = await prisma.location.create({
    data: { name: "Stale B", latitude: 0.003, longitude: 0 },
  });
  const frozenWork = await prisma.work.create({
    data: { title: "Already handled", durationMinutes: 10, status: "done" },
  });
  const newWork = await prisma.work.create({
    data: {
      title: "Errand",
      durationMinutes: 10,
      locationOptions: {
        create: {
          locations: {
            create: { name: "Errand Shop", latitude: 0.004, longitude: 0 },
          },
        },
      },
    },
  });
  const plan = await prisma.plan.create({
    data: {
      startAt: new Date("2026-08-22T09:00:00Z"),
      endAt: new Date("2026-08-22T10:00:00Z"),
    },
  });

  // Stop at order 0 and order 2 are still stale/unresolved; the stop at
  // order 1 — sandwiched between them — is the one that resolved first,
  // out of sequence. frozenStops.length would be 1 here, which must not
  // be confused with "the next free order is 1".
  await prisma.planStop.create({
    data: {
      planId: plan.id,
      locationId: staleLocationA.id,
      order: 0,
      status: "planned",
      plannedArrivalAt: new Date("2026-08-22T09:05:00Z"),
      plannedDepartureAt: new Date("2026-08-22T09:15:00Z"),
    },
  });
  const frozenStop = await prisma.planStop.create({
    data: {
      planId: plan.id,
      locationId: frozenLocation.id,
      order: 1,
      status: "done",
      plannedArrivalAt: new Date("2026-08-22T09:20:00Z"),
      plannedDepartureAt: new Date("2026-08-22T09:30:00Z"),
      works: { create: { workId: frozenWork.id, status: "done" } },
    },
  });
  await prisma.planStop.create({
    data: {
      planId: plan.id,
      locationId: staleLocationB.id,
      order: 2,
      status: "planned",
      plannedArrivalAt: new Date("2026-08-22T09:35:00Z"),
      plannedDepartureAt: new Date("2026-08-22T09:45:00Z"),
    },
  });

  const result = await rebuildPlanStops(prisma, plan.id, {
    asOfAt: new Date("2026-08-22T09:20:00Z"),
    asOfLocation: { latitude: 0.001, longitude: 0 },
  });

  const orders = result.plan.stops.map((stop) => stop.order);
  assert.equal(
    new Set(orders).size,
    orders.length,
    `expected no duplicate order values, got: ${orders.join(", ")}`
  );

  const frozen = result.plan.stops.find((stop) => stop.id === frozenStop.id);
  assert.equal(frozen.order, 1);
  assert.equal(frozen.status, "done");

  const rebuiltStop = result.plan.stops.find(
    (stop) => stop.id !== frozenStop.id
  );
  assert.ok(rebuiltStop, "expected a freshly built stop for the new work");
  assert.notEqual(rebuiltStop.order, frozen.order);
  assert.equal(rebuiltStop.works[0].work.id, newWork.id);
});

// The (work, location) freezing case: a work item whose chosen option lists
// two branches gets a stop each. Finishing it at branch A — through the
// work-item route, which never touches PlanStop.status — used to be lost on
// the next rebuild (stop A wasn't frozen, so it was deleted and rebuilt),
// while explicitly marking stop A done instead force-excluded the work item
// outright and abandoned branch B. Neither may happen.
test("rebuildPlanStops keeps a work item's resolved branch and still schedules its unresolved one", async () => {
  const branchA = await prisma.location.create({
    data: { name: "Branch A", latitude: 0.001, longitude: 0 },
  });
  const branchB = await prisma.location.create({
    data: { name: "Branch B", latitude: 0.002, longitude: 0 },
  });
  const work = await prisma.work.create({
    data: {
      title: "Visit two branches",
      durationMinutes: 10,
      locationOptions: {
        create: {
          locations: { connect: [{ id: branchA.id }, { id: branchB.id }] },
        },
      },
    },
  });
  const plan = await prisma.plan.create({
    data: {
      status: "active",
      startAt: new Date("2026-08-22T09:00:00Z"),
      startLatitude: 0,
      startLongitude: 0,
      endAt: new Date("2026-08-22T12:00:00Z"),
      endLatitude: 0,
      endLongitude: 0,
    },
  });
  const stopA = await prisma.planStop.create({
    data: {
      planId: plan.id,
      locationId: branchA.id,
      order: 0,
      status: "planned",
      plannedArrivalAt: new Date("2026-08-22T09:05:00Z"),
      plannedDepartureAt: new Date("2026-08-22T09:15:00Z"),
      works: { create: { workId: work.id } },
    },
  });
  const stopB = await prisma.planStop.create({
    data: {
      planId: plan.id,
      locationId: branchB.id,
      order: 1,
      status: "planned",
      plannedArrivalAt: new Date("2026-08-22T09:20:00Z"),
      plannedDepartureAt: new Date("2026-08-22T09:30:00Z"),
      works: { create: { workId: work.id } },
    },
  });

  // Done at branch A only, via the work-item route's effect: PlanStopWork
  // flips, the parent stop's own status deliberately stays "planned".
  await prisma.planStopWork.updateMany({
    where: { planStopId: stopA.id, workId: work.id },
    data: { status: "done" },
  });

  const result = await rebuildPlanStops(prisma, plan.id, {
    asOfAt: plan.startAt,
    asOfLocation: { latitude: 0, longitude: 0 },
  });

  // Stop A survived untouched, with its completion intact.
  const survivingA = result.plan.stops.find((stop) => stop.id === stopA.id);
  assert.ok(survivingA, "expected stop A to be frozen, not rebuilt");
  assert.equal(survivingA.locationId, branchA.id);
  assert.equal(survivingA.works.length, 1);
  assert.equal(survivingA.works[0].workId, work.id);
  assert.equal(survivingA.works[0].status, "done");

  // Branch B is still on the plan — whether stop B survived as-is or was
  // rebuilt, the assignment must not have been silently dropped.
  const branchBStop = result.plan.stops.find(
    (stop) => stop.locationId === branchB.id
  );
  assert.ok(
    branchBStop,
    "expected branch B to still be scheduled after the rebuild"
  );
  assert.ok(
    branchBStop.works.some((assignment) => assignment.workId === work.id),
    "expected the work item to still be assigned at branch B"
  );

  // Branch A must not be proposed a second time.
  const branchAStops = result.plan.stops.filter(
    (stop) => stop.locationId === branchA.id
  );
  assert.equal(branchAStops.length, 1);

  const orders = result.plan.stops.map((stop) => stop.order);
  assert.equal(new Set(orders).size, orders.length);

  // Not fully settled yet, so the work item is still open.
  const refreshedWork = await prisma.work.findUnique({
    where: { id: work.id },
  });
  assert.equal(refreshedWork.status, "todo");
  assert.deepEqual(result.unselectedWork, []);
  assert.ok(stopB, "stop B was seeded");
});

test("rebuildPlanStops drops a work item entirely once every one of its assignments is resolved", async () => {
  const branchA = await prisma.location.create({
    data: { name: "Branch A", latitude: 0.001, longitude: 0 },
  });
  const branchB = await prisma.location.create({
    data: { name: "Branch B", latitude: 0.002, longitude: 0 },
  });
  const work = await prisma.work.create({
    data: {
      title: "Visit two branches",
      durationMinutes: 10,
      locationOptions: {
        create: {
          locations: { connect: [{ id: branchA.id }, { id: branchB.id }] },
        },
      },
    },
  });
  const plan = await prisma.plan.create({
    data: {
      status: "active",
      startAt: new Date("2026-08-22T09:00:00Z"),
      startLatitude: 0,
      startLongitude: 0,
      endAt: new Date("2026-08-22T12:00:00Z"),
      endLatitude: 0,
      endLongitude: 0,
    },
  });
  for (const [index, location] of [branchA, branchB].entries()) {
    await prisma.planStop.create({
      data: {
        planId: plan.id,
        locationId: location.id,
        order: index,
        status: "planned",
        plannedArrivalAt: new Date("2026-08-22T09:05:00Z"),
        plannedDepartureAt: new Date("2026-08-22T09:15:00Z"),
        works: { create: { workId: work.id, status: "done" } },
      },
    });
  }

  const result = await rebuildPlanStops(prisma, plan.id, {
    asOfAt: plan.startAt,
    asOfLocation: { latitude: 0, longitude: 0 },
  });

  // Both stops frozen, nothing new proposed, and the work item is out of the
  // eligible pool rather than sitting in unselectedWork.
  assert.equal(result.plan.stops.length, 2);
  assert.deepEqual(result.unselectedWork, []);
});

test("rebuildPlanStops never schedules a new stop before the last frozen stop departs", async () => {
  const frozenLocation = await prisma.location.create({
    data: { name: "Already visited", latitude: 0.001, longitude: 0 },
  });
  const doneWork = await prisma.work.create({
    data: { title: "Already handled", durationMinutes: 10, status: "done" },
  });
  await prisma.work.create({
    data: {
      title: "Nearby errand",
      durationMinutes: 10,
      locationOptions: {
        create: {
          locations: {
            create: { name: "Corner shop", latitude: 0.002, longitude: 0 },
          },
        },
      },
    },
  });
  const plan = await prisma.plan.create({
    data: {
      status: "active",
      startAt: new Date("2026-08-22T09:00:00Z"),
      startLatitude: 0,
      startLongitude: 0,
      endAt: new Date("2026-08-22T18:00:00Z"),
      endLatitude: 0,
      endLongitude: 0,
    },
  });
  const frozenDeparture = new Date("2026-08-22T11:30:00Z");
  await prisma.planStop.create({
    data: {
      planId: plan.id,
      locationId: frozenLocation.id,
      order: 0,
      status: "done",
      plannedArrivalAt: new Date("2026-08-22T11:00:00Z"),
      plannedDepartureAt: new Date("2026-08-22T11:15:00Z"),
      actualArrivalAt: new Date("2026-08-22T11:05:00Z"),
      actualDepartureAt: frozenDeparture,
      works: { create: { workId: doneWork.id, status: "done" } },
    },
  });

  // A naive caller (this is exactly what PATCH /api/plans/:id passes) hands
  // over the plan's original startAt, hours before the frozen stop departed.
  const result = await rebuildPlanStops(prisma, plan.id, {
    asOfAt: plan.startAt,
    asOfLocation: { latitude: 0, longitude: 0 },
  });

  const newStop = result.plan.stops.find((stop) => stop.status === "planned");
  assert.ok(newStop, "expected the nearby errand to be scheduled");
  assert.ok(
    newStop.plannedArrivalAt.getTime() >= frozenDeparture.getTime(),
    `expected arrival at/after ${frozenDeparture.toISOString()}, got ${newStop.plannedArrivalAt.toISOString()}`
  );
});

// A frozen stop is immutable *in its entirety*, so nothing sitting on it may
// be re-proposed elsewhere. Marking the stop itself done (PATCH
// /:id/stops/:stopId) never cascades down to its PlanStopWork rows, so the
// assignment stays "planned" — which used to leave its (work, location) pair
// out of the resolved set and get a second stop built at the same place.
test("rebuildPlanStops does not duplicate a stop whose own status is resolved while its assignment stays planned", async () => {
  const location = await prisma.location.create({
    data: { name: "Pharmacy", latitude: 0.001, longitude: 0 },
  });
  const work = await prisma.work.create({
    data: {
      title: "Pick up prescription",
      durationMinutes: 10,
      locationOptions: {
        create: { locations: { connect: [{ id: location.id }] } },
      },
    },
  });
  const plan = await prisma.plan.create({
    data: {
      status: "active",
      startAt: new Date("2026-08-22T09:00:00Z"),
      startLatitude: 0,
      startLongitude: 0,
      endAt: new Date("2026-08-22T12:00:00Z"),
      endLatitude: 0,
      endLongitude: 0,
    },
  });
  // Exactly what PATCH /:id/stops/:stopId writes: the stop resolves, the
  // assignment underneath it is left alone.
  const doneStop = await prisma.planStop.create({
    data: {
      planId: plan.id,
      locationId: location.id,
      order: 0,
      status: "done",
      plannedArrivalAt: new Date("2026-08-22T09:05:00Z"),
      plannedDepartureAt: new Date("2026-08-22T09:15:00Z"),
      works: { create: { workId: work.id, status: "planned" } },
    },
  });

  const result = await rebuildPlanStops(prisma, plan.id, {
    asOfAt: plan.startAt,
    asOfLocation: { latitude: 0, longitude: 0 },
  });

  const stopsAtLocation = result.plan.stops.filter(
    (stop) => stop.locationId === location.id
  );
  assert.equal(
    stopsAtLocation.length,
    1,
    `expected the frozen stop only, got ${stopsAtLocation.length} stops at the same location`
  );
  assert.equal(stopsAtLocation[0].id, doneStop.id);
  assert.equal(stopsAtLocation[0].status, "done");
});

// Same rule, the bundled-stop case: one work item at a shared stop resolves
// through the work-item route, which freezes the stop. The *other* work item
// there is still "planned", but it may not be re-proposed either — the whole
// frozen stop is settled.
test("rebuildPlanStops does not duplicate a still-planned work bundled onto a frozen stop", async () => {
  const location = await prisma.location.create({
    data: { name: "Mall", latitude: 0.001, longitude: 0 },
  });
  const doneWork = await prisma.work.create({
    data: {
      title: "Collect parcel",
      durationMinutes: 10,
      locationOptions: {
        create: { locations: { connect: [{ id: location.id }] } },
      },
    },
  });
  const plannedWork = await prisma.work.create({
    data: {
      title: "Buy socks",
      durationMinutes: 10,
      locationOptions: {
        create: { locations: { connect: [{ id: location.id }] } },
      },
    },
  });
  const plan = await prisma.plan.create({
    data: {
      status: "active",
      startAt: new Date("2026-08-22T09:00:00Z"),
      startLatitude: 0,
      startLongitude: 0,
      endAt: new Date("2026-08-22T12:00:00Z"),
      endLatitude: 0,
      endLongitude: 0,
    },
  });
  const bundledStop = await prisma.planStop.create({
    data: {
      planId: plan.id,
      locationId: location.id,
      order: 0,
      status: "planned",
      plannedArrivalAt: new Date("2026-08-22T09:05:00Z"),
      plannedDepartureAt: new Date("2026-08-22T09:25:00Z"),
      works: {
        create: [{ workId: doneWork.id }, { workId: plannedWork.id }],
      },
    },
  });
  // The work-item route only ever writes PlanStopWork.status.
  await prisma.planStopWork.updateMany({
    where: { planStopId: bundledStop.id, workId: doneWork.id },
    data: { status: "done" },
  });

  const result = await rebuildPlanStops(prisma, plan.id, {
    asOfAt: plan.startAt,
    asOfLocation: { latitude: 0, longitude: 0 },
  });

  const stopsAtLocation = result.plan.stops.filter(
    (stop) => stop.locationId === location.id
  );
  assert.equal(
    stopsAtLocation.length,
    1,
    `expected the frozen stop only, got ${stopsAtLocation.length} stops at the same location`
  );
  assert.equal(stopsAtLocation[0].id, bundledStop.id);

  const statusByWorkId = new Map(
    stopsAtLocation[0].works.map((assignment) => [
      assignment.workId,
      assignment.status,
    ])
  );
  assert.equal(statusByWorkId.size, 2);
  assert.equal(statusByWorkId.get(doneWork.id), "done");
  assert.equal(statusByWorkId.get(plannedWork.id), "planned");
});

// plannedDepartureAt is a *scheduled* time, not a thing that happened. A stop
// skipped at 09:30 but scheduled to leave at 15:10 must not drag the
// rebuild's clock to 15:10 and burn the whole remaining day's budget.
test("rebuildPlanStops ignores a frozen stop's future planned departure when clamping", async () => {
  const frozenLocation = await prisma.location.create({
    data: { name: "Skipped errand", latitude: 0.001, longitude: 0 },
  });
  const skippedWork = await prisma.work.create({
    data: { title: "Abandoned", durationMinutes: 10, status: "done" },
  });
  await prisma.work.create({
    data: {
      title: "Nearby errand",
      durationMinutes: 10,
      locationOptions: {
        create: {
          locations: {
            create: { name: "Corner shop", latitude: 0.002, longitude: 0 },
          },
        },
      },
    },
  });
  const plan = await prisma.plan.create({
    data: {
      status: "active",
      startAt: new Date("2026-08-22T09:00:00Z"),
      startLatitude: 0,
      startLongitude: 0,
      endAt: new Date("2026-08-22T18:00:00Z"),
      endLatitude: 0,
      endLongitude: 0,
    },
  });
  await prisma.planStop.create({
    data: {
      planId: plan.id,
      locationId: frozenLocation.id,
      order: 0,
      status: "skipped",
      plannedArrivalAt: new Date("2026-08-22T15:00:00Z"),
      plannedDepartureAt: new Date("2026-08-22T15:10:00Z"),
      actualDepartureAt: null,
      works: { create: { workId: skippedWork.id, status: "skipped" } },
    },
  });

  const asOfAt = new Date("2026-08-22T09:30:00Z");
  const result = await rebuildPlanStops(prisma, plan.id, {
    asOfAt,
    asOfLocation: { latitude: 0.001, longitude: 0 },
  });

  const newStop = result.plan.stops.find((stop) => stop.status === "planned");
  assert.ok(newStop, "expected the nearby errand to be scheduled");
  assert.ok(
    newStop.plannedArrivalAt.getTime() < asOfAt.getTime() + 30 * 60000,
    `expected arrival shortly after ${asOfAt.toISOString()}, got ${newStop.plannedArrivalAt.toISOString()}`
  );
});

test("rebuildPlanStops replaces not-yet-resolved stops when called again", async () => {
  const workA = await prisma.work.create({
    data: {
      title: "Errand A",
      durationMinutes: 10,
      locationOptions: {
        create: {
          locations: {
            create: { name: "Shop A", latitude: 0.001, longitude: 0 },
          },
        },
      },
    },
  });
  const plan = await prisma.plan.create({
    data: {
      startAt: new Date("2026-08-22T09:00:00Z"),
      endAt: new Date("2026-08-22T10:00:00Z"),
    },
  });

  const first = await rebuildPlanStops(prisma, plan.id, {
    asOfAt: plan.startAt,
    asOfLocation: { latitude: 0, longitude: 0 },
  });
  assert.equal(first.plan.stops.length, 1);

  await prisma.work.update({
    where: { id: workA.id },
    data: { status: "done" },
  });

  const second = await rebuildPlanStops(prisma, plan.id, {
    asOfAt: plan.startAt,
    asOfLocation: { latitude: 0, longitude: 0 },
  });
  assert.equal(second.plan.stops.length, 0);
});
