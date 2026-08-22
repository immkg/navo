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
