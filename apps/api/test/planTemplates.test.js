const { test, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../src/app");
const prisma = require("../src/db/client");
const { cleanDatabase } = require("../test-support/helpers");

beforeEach(cleanDatabase);
after(cleanDatabase);

test("POST /api/plan-templates requires a name and a positive durationMinutes", async () => {
  const missingName = await request(app)
    .post("/api/plan-templates")
    .send({ durationMinutes: 60 });
  assert.equal(missingName.statusCode, 400);

  const badDuration = await request(app)
    .post("/api/plan-templates")
    .send({ name: "Morning errands", durationMinutes: 0 });
  assert.equal(badDuration.statusCode, 400);
});

test("POST /api/plan-templates rejects an invalid energyLevel", async () => {
  const response = await request(app).post("/api/plan-templates").send({
    name: "Morning errands",
    durationMinutes: 60,
    energyLevel: "extreme",
  });

  assert.equal(response.statusCode, 400);
});

test("POST /api/plan-templates creates a template with defaults applied", async () => {
  const response = await request(app).post("/api/plan-templates").send({
    name: "Morning errands",
    durationMinutes: 90,
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.name, "Morning errands");
  assert.equal(response.body.durationMinutes, 90);
  assert.equal(response.body.energyLevel, "high");
  assert.equal(response.body.useAccurateTravelTime, false);
});

test("POST /api/plan-templates accepts an explicit energyLevel and useAccurateTravelTime", async () => {
  const response = await request(app).post("/api/plan-templates").send({
    name: "Gym + market loop",
    durationMinutes: 45,
    energyLevel: "low",
    useAccurateTravelTime: true,
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.energyLevel, "low");
  assert.equal(response.body.useAccurateTravelTime, true);
});

test("GET /api/plan-templates lists templates newest first", async () => {
  await prisma.planTemplate.create({
    data: { name: "First", durationMinutes: 60 },
  });
  await prisma.planTemplate.create({
    data: { name: "Second", durationMinutes: 30 },
  });

  const response = await request(app).get("/api/plan-templates");

  assert.equal(response.statusCode, 200);
  assert.deepEqual(
    response.body.map((template) => template.name),
    ["Second", "First"]
  );
});

test("DELETE /api/plan-templates/:id removes the template", async () => {
  const template = await prisma.planTemplate.create({
    data: { name: "Morning errands", durationMinutes: 60 },
  });

  const response = await request(app).delete(
    `/api/plan-templates/${template.id}`
  );

  assert.equal(response.statusCode, 204);
  assert.equal(
    await prisma.planTemplate.findUnique({ where: { id: template.id } }),
    null
  );
});

test("DELETE /api/plan-templates/:id returns 404 for a missing template", async () => {
  const response = await request(app).delete("/api/plan-templates/missing-id");

  assert.equal(response.statusCode, 404);
});
