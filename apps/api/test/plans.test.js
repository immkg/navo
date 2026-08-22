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
