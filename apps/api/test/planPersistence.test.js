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
