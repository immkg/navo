const { test, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../src/app");
const prisma = require("../src/db/client");
const { cleanDatabase } = require("../test-support/helpers");

beforeEach(cleanDatabase);
after(cleanDatabase);

test("POST /api/intents creates an intent with defaults", async () => {
  const response = await request(app)
    .post("/api/intents")
    .send({ title: "Plan a trip" });

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.title, "Plan a trip");
  assert.equal(response.body.status, "active");
  assert.equal(response.body.priority, "medium");
});

test("POST /api/intents requires a title", async () => {
  const response = await request(app).post("/api/intents").send({});

  assert.equal(response.statusCode, 400);
  assert.match(response.body.error, /title/i);
});

test("POST /api/intents rejects an invalid priority", async () => {
  const response = await request(app)
    .post("/api/intents")
    .send({ title: "Plan a trip", priority: "urgent" });

  assert.equal(response.statusCode, 400);
});

test("POST /api/intents rejects a start date after the due date", async () => {
  const response = await request(app).post("/api/intents").send({
    title: "Plan a trip",
    startDate: "2026-02-10",
    dueDate: "2026-02-01",
  });

  assert.equal(response.statusCode, 400);
});

test("GET /api/intents lists non-archived intents with summary fields", async () => {
  const active = await prisma.intent.create({
    data: { title: "Active intent", status: "active" },
  });
  await prisma.intent.create({
    data: { title: "Archived intent", status: "archived" },
  });
  await prisma.work.create({
    data: { title: "Do a thing", intentId: active.id, status: "done" },
  });
  await prisma.work.create({
    data: { title: "Do another thing", intentId: active.id, status: "todo" },
  });

  const response = await request(app).get("/api/intents");

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.length, 1);
  assert.equal(response.body[0].id, active.id);
  assert.equal(response.body[0].workCount, 2);
  assert.equal(response.body[0].completedWorkCount, 1);
});

test("GET /api/intents/:id returns the intent with its work graph", async () => {
  const intent = await prisma.intent.create({
    data: { title: "Plan a trip" },
  });
  const work = await prisma.work.create({
    data: { title: "Book flights", intentId: intent.id },
  });

  const response = await request(app).get(`/api/intents/${intent.id}`);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.id, intent.id);
  assert.equal(response.body.workItems.length, 1);
  assert.equal(response.body.workItems[0].id, work.id);
});

test("GET /api/intents/:id returns 404 for a missing intent", async () => {
  const response = await request(app).get("/api/intents/missing-id");

  assert.equal(response.statusCode, 404);
});

test("PATCH /api/intents/:id updates only the provided fields", async () => {
  const intent = await prisma.intent.create({
    data: { title: "Plan a trip", priority: "low" },
  });

  const response = await request(app)
    .patch(`/api/intents/${intent.id}`)
    .send({ status: "completed" });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, "completed");
  assert.equal(response.body.priority, "low");
  assert.equal(response.body.title, "Plan a trip");
});

test("PATCH /api/intents/:id rejects an invalid status", async () => {
  const intent = await prisma.intent.create({ data: { title: "Plan a trip" } });

  const response = await request(app)
    .patch(`/api/intents/${intent.id}`)
    .send({ status: "bogus" });

  assert.equal(response.statusCode, 400);
});

test("PATCH /api/intents/:id returns 404 for a missing intent", async () => {
  const response = await request(app)
    .patch("/api/intents/missing-id")
    .send({ status: "completed" });

  assert.equal(response.statusCode, 404);
});

test("DELETE /api/intents/:id cascades to its work items and location options", async () => {
  const intent = await prisma.intent.create({ data: { title: "Plan a trip" } });
  const work = await prisma.work.create({
    data: { title: "Book a hotel", intentId: intent.id },
  });
  const location = await prisma.location.create({
    data: { name: "Grand Hotel" },
  });
  await prisma.locationOption.create({
    data: {
      workId: work.id,
      locations: { connect: { id: location.id } },
    },
  });

  const response = await request(app).delete(`/api/intents/${intent.id}`);

  assert.equal(response.statusCode, 204);
  assert.equal(
    await prisma.intent.findUnique({ where: { id: intent.id } }),
    null
  );
  assert.equal(await prisma.work.findUnique({ where: { id: work.id } }), null);
  const remainingOptions = await prisma.locationOption.findMany({
    where: { workId: work.id },
  });
  assert.equal(remainingOptions.length, 0);
});

test("DELETE /api/intents/:id returns 404 for a missing intent", async () => {
  const response = await request(app).delete("/api/intents/missing-id");

  assert.equal(response.statusCode, 404);
});
