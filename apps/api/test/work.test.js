const { test, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../src/app");
const prisma = require("../src/db/client");
const { cleanDatabase } = require("../test-support/helpers");

beforeEach(cleanDatabase);
after(cleanDatabase);

test("POST /api/work requires a title", async () => {
  const response = await request(app).post("/api/work").send({});

  assert.equal(response.statusCode, 400);
  assert.match(response.body.error, /title/i);
});

test("POST /api/work applies defaults for type and durationMinutes", async () => {
  const response = await request(app)
    .post("/api/work")
    .send({ title: "Book flights" });

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.type, "task");
  assert.equal(response.body.durationMinutes, 30);
  assert.equal(response.body.intentId, null);
});

test("POST /api/work creates inline location options and locations", async () => {
  const response = await request(app)
    .post("/api/work")
    .send({
      title: "Book a hotel",
      locationOptions: [
        {
          title: "Option 1",
          locations: [{ name: "Grand Hotel", address: "1 Main St" }],
        },
      ],
    });

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.locationOptions.length, 1);
  assert.equal(response.body.locationOptions[0].title, "Option 1");
  assert.equal(response.body.locationOptions[0].locations.length, 1);
  assert.equal(
    response.body.locationOptions[0].locations[0].name,
    "Grand Hotel"
  );
});

test("GET /api/work/:id returns the work item with related data", async () => {
  const intent = await prisma.intent.create({ data: { title: "Plan a trip" } });
  const work = await prisma.work.create({
    data: {
      title: "Book flights",
      intentId: intent.id,
      contexts: { create: { name: "Home", type: "location" } },
    },
  });

  const response = await request(app).get(`/api/work/${work.id}`);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.id, work.id);
  assert.equal(response.body.intent.id, intent.id);
  assert.equal(response.body.contexts.length, 1);
  assert.deepEqual(response.body.locationOptions, []);
});

test("GET /api/work/:id returns 404 for a missing work item", async () => {
  const response = await request(app).get("/api/work/missing-id");

  assert.equal(response.statusCode, 404);
});

test("PATCH /api/work/:id updates a valid status", async () => {
  const work = await prisma.work.create({ data: { title: "Book flights" } });

  const response = await request(app)
    .patch(`/api/work/${work.id}`)
    .send({ status: "in_progress" });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, "in_progress");
});

test("PATCH /api/work/:id rejects an invalid status", async () => {
  const work = await prisma.work.create({ data: { title: "Book flights" } });

  const response = await request(app)
    .patch(`/api/work/${work.id}`)
    .send({ status: "bogus" });

  assert.equal(response.statusCode, 400);
});

test("PATCH /api/work/:id returns 404 for a missing work item", async () => {
  const response = await request(app)
    .patch("/api/work/missing-id")
    .send({ status: "done" });

  assert.equal(response.statusCode, 404);
});

test("DELETE /api/work/:id removes the work item and its location options", async () => {
  const work = await prisma.work.create({ data: { title: "Book a hotel" } });
  await prisma.locationOption.create({ data: { workId: work.id } });

  const response = await request(app).delete(`/api/work/${work.id}`);

  assert.equal(response.statusCode, 204);
  assert.equal(await prisma.work.findUnique({ where: { id: work.id } }), null);
  const remainingOptions = await prisma.locationOption.findMany({
    where: { workId: work.id },
  });
  assert.equal(remainingOptions.length, 0);
});

test("DELETE /api/work/:id returns 404 for a missing work item", async () => {
  const response = await request(app).delete("/api/work/missing-id");

  assert.equal(response.statusCode, 404);
});

// PlanStopWork.work used to default to Prisma's RESTRICT, so deleting any
// work item that had ever appeared in a plan stop failed with P2003 (a 500).
// The relation cascades now — deleting the work item takes its plan-stop
// assignments with it.
test("DELETE /api/work/:id also removes the work item's plan stop assignments", async () => {
  const work = await prisma.work.create({ data: { title: "Book a hotel" } });
  const location = await prisma.location.create({
    data: { name: "Grand Hotel", latitude: 0, longitude: 0 },
  });
  const plan = await prisma.plan.create({
    data: {
      startAt: new Date("2026-08-22T09:00:00Z"),
      endAt: new Date("2026-08-22T12:00:00Z"),
    },
  });
  const stop = await prisma.planStop.create({
    data: {
      planId: plan.id,
      locationId: location.id,
      order: 0,
      plannedArrivalAt: new Date("2026-08-22T09:10:00Z"),
      plannedDepartureAt: new Date("2026-08-22T09:20:00Z"),
      works: { create: { workId: work.id } },
    },
  });

  const response = await request(app).delete(`/api/work/${work.id}`);

  assert.equal(response.statusCode, 204);
  assert.equal(await prisma.work.findUnique({ where: { id: work.id } }), null);
  const remainingAssignments = await prisma.planStopWork.findMany({
    where: { planStopId: stop.id },
  });
  assert.equal(remainingAssignments.length, 0);
  // The stop itself is untouched — only the assignment goes away.
  assert.ok(await prisma.planStop.findUnique({ where: { id: stop.id } }));
});

test("POST /api/work/:id/link requires intentId", async () => {
  const work = await prisma.work.create({ data: { title: "Book flights" } });

  const response = await request(app)
    .post(`/api/work/${work.id}/link`)
    .send({});

  assert.equal(response.statusCode, 400);
});

test("POST /api/work/:id/link returns 404 for a missing work item", async () => {
  const intent = await prisma.intent.create({ data: { title: "Plan a trip" } });

  const response = await request(app)
    .post("/api/work/missing-id/link")
    .send({ intentId: intent.id });

  assert.equal(response.statusCode, 404);
});

test("POST /api/work/:id/link attaches the work item to an intent", async () => {
  const intent = await prisma.intent.create({ data: { title: "Plan a trip" } });
  const work = await prisma.work.create({ data: { title: "Book flights" } });

  const response = await request(app)
    .post(`/api/work/${work.id}/link`)
    .send({ intentId: intent.id });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.intentId, intent.id);
});

test("POST /api/work/:id/dependency requires dependsOnId", async () => {
  const work = await prisma.work.create({ data: { title: "Book flights" } });

  const response = await request(app)
    .post(`/api/work/${work.id}/dependency`)
    .send({});

  assert.equal(response.statusCode, 400);
});

test("POST /api/work/:id/dependency creates a dependency", async () => {
  const work = await prisma.work.create({ data: { title: "Book flights" } });
  const dependsOn = await prisma.work.create({
    data: { title: "Get passport" },
  });

  const response = await request(app)
    .post(`/api/work/${work.id}/dependency`)
    .send({ dependsOnId: dependsOn.id });

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.workId, work.id);
  assert.equal(response.body.dependsOnId, dependsOn.id);
});

test("POST /api/work/:id/dependency returns 404 when the work item doesn't exist", async () => {
  const dependsOn = await prisma.work.create({
    data: { title: "Get passport" },
  });

  const response = await request(app)
    .post("/api/work/missing-id/dependency")
    .send({ dependsOnId: dependsOn.id });

  assert.equal(response.statusCode, 404);
});

test("POST /api/work/:id/context requires name and type", async () => {
  const work = await prisma.work.create({ data: { title: "Book flights" } });

  const response = await request(app)
    .post(`/api/work/${work.id}/context`)
    .send({ name: "Home" });

  assert.equal(response.statusCode, 400);
});

test("POST /api/work/:id/context adds a context to the work item", async () => {
  const work = await prisma.work.create({ data: { title: "Book flights" } });

  const response = await request(app)
    .post(`/api/work/${work.id}/context`)
    .send({ name: "Home", type: "location" });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.contexts.length, 1);
  assert.equal(response.body.contexts[0].name, "Home");
});

test("POST /api/work/:id/context returns 404 for a missing work item", async () => {
  const response = await request(app)
    .post("/api/work/missing-id/context")
    .send({ name: "Home", type: "location" });

  assert.equal(response.statusCode, 404);
});

test("POST /api/work/:id/location-option requires at least one location", async () => {
  const work = await prisma.work.create({ data: { title: "Book a hotel" } });

  const response = await request(app)
    .post(`/api/work/${work.id}/location-option`)
    .send({ title: "Option 1", locations: [] });

  assert.equal(response.statusCode, 400);
});

test("POST /api/work/:id/location-option creates the option and its locations", async () => {
  const work = await prisma.work.create({ data: { title: "Book a hotel" } });

  const response = await request(app)
    .post(`/api/work/${work.id}/location-option`)
    .send({
      title: "Option 1",
      locations: [{ name: "Grand Hotel", address: "1 Main St" }],
    });

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.title, "Option 1");
  assert.equal(response.body.locations.length, 1);
  assert.equal(response.body.locations[0].name, "Grand Hotel");
});

test("POST /api/work/:id/location-option persists phone, rating, and hours", async () => {
  const work = await prisma.work.create({ data: { title: "Book a hotel" } });

  const response = await request(app)
    .post(`/api/work/${work.id}/location-option`)
    .send({
      title: "Option 1",
      locations: [
        {
          name: "Grand Hotel",
          address: "1 Main St",
          placeId: "place-grand-hotel",
          phoneNumber: "+1 555-0100",
          rating: 4.5,
          ratingsCount: 120,
          openingHoursText: ["Monday: 9:00 AM – 5:00 PM"],
          openingPeriods: [
            { open: { day: 1, time: "0900" }, close: { day: 1, time: "1700" } },
          ],
        },
      ],
    });

  assert.equal(response.statusCode, 201);
  const [location] = response.body.locations;
  assert.equal(location.phoneNumber, "+1 555-0100");
  assert.equal(location.rating, 4.5);
  assert.equal(location.ratingsCount, 120);
  assert.deepEqual(location.openingHoursText, ["Monday: 9:00 AM – 5:00 PM"]);
  assert.deepEqual(location.openingPeriods, [
    { open: { day: 1, time: "0900" }, close: { day: 1, time: "1700" } },
  ]);
});

test("POST /api/work/:id/location-option returns 404 for a missing work item", async () => {
  const response = await request(app)
    .post("/api/work/missing-id/location-option")
    .send({ locations: [{ name: "Grand Hotel" }] });

  assert.equal(response.statusCode, 404);
});

test("POST /api/work/:id/location-option/:optionId/location attaches a new location", async () => {
  const work = await prisma.work.create({ data: { title: "Book a hotel" } });
  const option = await prisma.locationOption.create({
    data: { workId: work.id, title: "Option 1" },
  });

  const response = await request(app)
    .post(`/api/work/${work.id}/location-option/${option.id}/location`)
    .send({ name: "Grand Hotel", address: "1 Main St" });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.locations.length, 1);
  assert.equal(response.body.locations[0].name, "Grand Hotel");
});

test("POST /api/work/:id/location-option/:optionId/location persists phone, rating, and hours", async () => {
  const work = await prisma.work.create({ data: { title: "Book a hotel" } });
  const option = await prisma.locationOption.create({
    data: { workId: work.id, title: "Option 1" },
  });

  const response = await request(app)
    .post(`/api/work/${work.id}/location-option/${option.id}/location`)
    .send({
      name: "Grand Hotel",
      address: "1 Main St",
      placeId: "place-grand-hotel-2",
      phoneNumber: "+1 555-0100",
      rating: 4.5,
      ratingsCount: 120,
      openingHoursText: ["Monday: 9:00 AM – 5:00 PM"],
      openingPeriods: [
        { open: { day: 1, time: "0900" }, close: { day: 1, time: "1700" } },
      ],
    });

  assert.equal(response.statusCode, 200);
  const [location] = response.body.locations;
  assert.equal(location.phoneNumber, "+1 555-0100");
  assert.equal(location.rating, 4.5);
  assert.equal(location.ratingsCount, 120);
  assert.deepEqual(location.openingHoursText, ["Monday: 9:00 AM – 5:00 PM"]);
});

test("POST /api/work/:id/location-option/:optionId/location attaches an existing location by id", async () => {
  const work = await prisma.work.create({ data: { title: "Book a hotel" } });
  const option = await prisma.locationOption.create({
    data: { workId: work.id, title: "Option 1" },
  });
  const location = await prisma.location.create({
    data: { name: "Grand Hotel" },
  });

  const response = await request(app)
    .post(`/api/work/${work.id}/location-option/${option.id}/location`)
    .send({ locationId: location.id });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.locations.length, 1);
  assert.equal(response.body.locations[0].id, location.id);
});

test("POST /api/work/:id/location-option/:optionId/location returns 404 for a missing option", async () => {
  const work = await prisma.work.create({ data: { title: "Book a hotel" } });

  const response = await request(app)
    .post(`/api/work/${work.id}/location-option/missing-option/location`)
    .send({ name: "Grand Hotel" });

  assert.equal(response.statusCode, 404);
});

test("DELETE .../location-option/:optionId/location/:locationId disconnects without deleting the location", async () => {
  const work = await prisma.work.create({ data: { title: "Book a hotel" } });
  const location = await prisma.location.create({
    data: { name: "Grand Hotel" },
  });
  const option = await prisma.locationOption.create({
    data: {
      workId: work.id,
      locations: { connect: { id: location.id } },
    },
  });

  const response = await request(app).delete(
    `/api/work/${work.id}/location-option/${option.id}/location/${location.id}`
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.locations.length, 0);
  const stillExists = await prisma.location.findUnique({
    where: { id: location.id },
  });
  assert.ok(stillExists, "the Location row itself should not be deleted");
});

test("DELETE .../location-option/:optionId/location/:locationId returns 404 for a missing combination", async () => {
  const work = await prisma.work.create({ data: { title: "Book a hotel" } });
  const option = await prisma.locationOption.create({
    data: { workId: work.id },
  });

  const response = await request(app).delete(
    `/api/work/${work.id}/location-option/${option.id}/location/missing-location`
  );

  assert.equal(response.statusCode, 404);
});

test("DELETE /api/work/:id/location-option/:optionId returns 404 for a missing option", async () => {
  const work = await prisma.work.create({ data: { title: "Book a hotel" } });

  const response = await request(app).delete(
    `/api/work/${work.id}/location-option/missing-option`
  );

  assert.equal(response.statusCode, 404);
});

test("DELETE /api/work/:id/location-option/:optionId reassigns selectedLocationOptionId when the selected option is deleted", async () => {
  const work = await prisma.work.create({ data: { title: "Book a hotel" } });
  const optionA = await prisma.locationOption.create({
    data: { workId: work.id, title: "Option A" },
  });
  const optionB = await prisma.locationOption.create({
    data: { workId: work.id, title: "Option B" },
  });
  await prisma.work.update({
    where: { id: work.id },
    data: { selectedLocationOptionId: optionA.id },
  });

  const response = await request(app).delete(
    `/api/work/${work.id}/location-option/${optionA.id}`
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.deletedOptionId, optionA.id);
  assert.equal(response.body.selectedLocationOptionId, optionB.id);

  const updatedWork = await prisma.work.findUnique({ where: { id: work.id } });
  assert.equal(updatedWork.selectedLocationOptionId, optionB.id);
});

test("DELETE /api/work/:id/location-option/:optionId clears selectedLocationOptionId when no options remain", async () => {
  const work = await prisma.work.create({ data: { title: "Book a hotel" } });
  const option = await prisma.locationOption.create({
    data: { workId: work.id, title: "Only option" },
  });
  await prisma.work.update({
    where: { id: work.id },
    data: { selectedLocationOptionId: option.id },
  });

  const response = await request(app).delete(
    `/api/work/${work.id}/location-option/${option.id}`
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.selectedLocationOptionId, null);
});

test("POST /api/work defaults priority to medium", async () => {
  const response = await request(app)
    .post("/api/work")
    .send({ title: "Book flights" });

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.priority, "medium");
});

test("POST /api/work accepts an explicit priority", async () => {
  const response = await request(app)
    .post("/api/work")
    .send({ title: "Book flights", priority: "high" });

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.priority, "high");
});

test("POST /api/work rejects an invalid priority", async () => {
  const response = await request(app)
    .post("/api/work")
    .send({ title: "Book flights", priority: "urgent" });

  assert.equal(response.statusCode, 400);
});

test("PATCH /api/work/:id updates priority", async () => {
  const work = await prisma.work.create({ data: { title: "Book flights" } });

  const response = await request(app)
    .patch(`/api/work/${work.id}`)
    .send({ priority: "high" });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.priority, "high");
});

test("PATCH /api/work/:id rejects an invalid priority", async () => {
  const work = await prisma.work.create({ data: { title: "Book flights" } });

  const response = await request(app)
    .patch(`/api/work/${work.id}`)
    .send({ priority: "urgent" });

  assert.equal(response.statusCode, 400);
});

test("GET /api/work/recommended ranks work by priority and due-date urgency, highest first", async () => {
  const intent = await prisma.intent.create({
    data: { title: "Errands", priority: "medium" },
  });
  const lowPriorityNoDue = await prisma.work.create({
    data: { title: "Low priority", priority: "low", intentId: intent.id },
  });
  const overdueIntent = await prisma.intent.create({
    data: {
      title: "Overdue thing",
      priority: "medium",
      dueDate: new Date("2020-01-01"),
    },
  });
  const overdue = await prisma.work.create({
    data: {
      title: "Overdue work",
      priority: "medium",
      intentId: overdueIntent.id,
    },
  });
  const highPriority = await prisma.work.create({
    data: { title: "High priority", priority: "high", intentId: intent.id },
  });

  const response = await request(app).get("/api/work/recommended");

  assert.equal(response.statusCode, 200);
  const ids = response.body.map((work) => work.id);
  // Both overdue and high-priority should rank above the plain low-priority
  // item; exact ordering between the two isn't asserted here since it
  // depends on the same scoring function planBuilder already owns.
  assert.ok(ids.indexOf(overdue.id) < ids.indexOf(lowPriorityNoDue.id));
  assert.ok(ids.indexOf(highPriority.id) < ids.indexOf(lowPriorityNoDue.id));
});

test("GET /api/work/recommended excludes done work", async () => {
  const done = await prisma.work.create({
    data: { title: "Finished", status: "done" },
  });
  const todo = await prisma.work.create({ data: { title: "Not done yet" } });

  const response = await request(app).get("/api/work/recommended");

  const ids = response.body.map((work) => work.id);
  assert.ok(!ids.includes(done.id));
  assert.ok(ids.includes(todo.id));
});

test("GET /api/work/recommended respects a limit query param and defaults to a reasonable cap", async () => {
  for (let i = 0; i < 8; i += 1) {
    await prisma.work.create({ data: { title: `Work ${i}` } });
  }

  const limited = await request(app).get("/api/work/recommended?limit=3");
  assert.equal(limited.body.length, 3);

  const defaulted = await request(app).get("/api/work/recommended");
  assert.ok(defaulted.body.length <= 10);
});
