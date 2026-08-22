const { test, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../src/app");
const prisma = require("../src/db/client");
const { cleanDatabase } = require("../test-support/helpers");

beforeEach(cleanDatabase);
after(cleanDatabase);

test("POST /api/plans requires startAt and endAt", async () => {
  const response = await request(app).post("/api/plans").send({});

  assert.equal(response.statusCode, 400);
});

test("POST /api/plans rejects an end at or before the start", async () => {
  const response = await request(app).post("/api/plans").send({
    startAt: "2026-08-22T09:00:00.000Z",
    endAt: "2026-08-22T08:00:00.000Z",
  });

  assert.equal(response.statusCode, 400);
});

test("POST /api/plans creates a draft plan and builds its stops", async () => {
  const intent = await prisma.intent.create({ data: { title: "Errands" } });
  const work = await prisma.work.create({
    data: {
      title: "Pick up prescription",
      intentId: intent.id,
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

  const response = await request(app).post("/api/plans").send({
    startAt: "2026-08-22T09:00:00.000Z",
    startLatitude: 0,
    startLongitude: 0,
    endAt: "2026-08-22T10:00:00.000Z",
    endLatitude: 0,
    endLongitude: 0,
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.status, "draft");
  assert.equal(response.body.stops.length, 1);
  assert.equal(response.body.stops[0].works[0].work.id, work.id);
});

test("GET /api/plans lists plans with stops expanded", async () => {
  await prisma.plan.create({
    data: {
      startAt: new Date("2026-08-22T09:00:00Z"),
      endAt: new Date("2026-08-22T10:00:00Z"),
    },
  });

  const response = await request(app).get("/api/plans");

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.length, 1);
  assert.deepEqual(response.body[0].stops, []);
});

test("GET /api/plans/:id returns a plan's full detail", async () => {
  const plan = await prisma.plan.create({
    data: {
      title: "Saturday errands",
      startAt: new Date("2026-08-22T09:00:00Z"),
      endAt: new Date("2026-08-22T10:00:00Z"),
    },
  });

  const response = await request(app).get(`/api/plans/${plan.id}`);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.title, "Saturday errands");
});

test("GET /api/plans/:id returns 404 for a missing plan", async () => {
  const response = await request(app).get("/api/plans/missing-id");

  assert.equal(response.statusCode, 404);
});

test("PATCH /api/plans/:id rejects an invalid status", async () => {
  const plan = await prisma.plan.create({
    data: { startAt: new Date(), endAt: new Date(Date.now() + 3600000) },
  });

  const response = await request(app)
    .patch(`/api/plans/${plan.id}`)
    .send({ status: "bogus" });

  assert.equal(response.statusCode, 400);
});

test("PATCH /api/plans/:id returns 404 for a missing plan", async () => {
  const response = await request(app)
    .patch("/api/plans/missing-id")
    .send({ title: "New title" });

  assert.equal(response.statusCode, 404);
});

test("PATCH /api/plans/:id updates a field without rebuilding untouched stops", async () => {
  const created = await request(app).post("/api/plans").send({
    startAt: "2026-08-22T09:00:00.000Z",
    endAt: "2026-08-22T10:00:00.000Z",
  });
  assert.equal(created.body.stops.length, 0);

  const response = await request(app)
    .patch(`/api/plans/${created.body.id}`)
    .send({ title: "Renamed plan" });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.title, "Renamed plan");
});

test("PATCH /api/plans/:id rebuilds stops when the time window widens", async () => {
  const work = await prisma.work.create({
    data: {
      title: "Far errand",
      durationMinutes: 10,
      locationOptions: {
        create: {
          locations: {
            create: { name: "Far shop", latitude: 0.05, longitude: 0 },
          },
        },
      },
    },
  });
  const created = await request(app).post("/api/plans").send({
    startAt: "2026-08-22T09:00:00.000Z",
    startLatitude: 0,
    startLongitude: 0,
    endAt: "2026-08-22T09:30:00.000Z",
    endLatitude: 0,
    endLongitude: 0,
  });
  assert.equal(created.body.stops.length, 0);

  const response = await request(app)
    .patch(`/api/plans/${created.body.id}`)
    .send({ endAt: "2026-08-23T09:00:00.000Z" });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.stops.length, 1);
  assert.equal(response.body.stops[0].works[0].work.id, work.id);
});

test("PATCH /api/plans/:id freezes already-resolved stops during a rebuild", async () => {
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

  const response = await request(app)
    .patch(`/api/plans/${plan.id}`)
    .send({ forceExcludeWorkIds: [] });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.stops.length, 1);
  assert.equal(response.body.stops[0].id, doneStop.id);
  assert.equal(response.body.stops[0].status, "done");
});

test("DELETE /api/plans/:id removes the plan and its stops", async () => {
  const created = await request(app).post("/api/plans").send({
    startAt: "2026-08-22T09:00:00.000Z",
    endAt: "2026-08-22T10:00:00.000Z",
  });

  const response = await request(app).delete(`/api/plans/${created.body.id}`);

  assert.equal(response.statusCode, 204);
  assert.equal(
    await prisma.plan.findUnique({ where: { id: created.body.id } }),
    null
  );
});

test("DELETE /api/plans/:id returns 404 for a missing plan", async () => {
  const response = await request(app).delete("/api/plans/missing-id");

  assert.equal(response.statusCode, 404);
});
