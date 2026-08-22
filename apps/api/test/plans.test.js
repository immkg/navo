const { test, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../src/app");
const prisma = require("../src/db/client");
const { cleanDatabase } = require("../test-support/helpers");

beforeEach(cleanDatabase);
after(cleanDatabase);

// Mirrors the helper in test/ai.test.js — swaps global.fetch for the
// duration of one test (recheck's AI call goes through the same
// callGroqJson -> fetch path) and returns a restorer to call in a finally
// block.
function mockFetchOnce(implementation) {
  const originalFetch = global.fetch;
  global.fetch = implementation;
  return () => {
    global.fetch = originalFetch;
  };
}

// Runs fn with GROQ_API_KEY set to a fake key, restoring whatever value (or
// absence) it had beforehand — buildPlanVariations short-circuits to []
// whenever isGroqConfigured() is false, so any test that needs to actually
// exercise the AI call needs the key present.
async function withGroqConfigured(fn) {
  const originalGroqKey = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = "test-groq-key";
  try {
    await fn();
  } finally {
    if (originalGroqKey === undefined) {
      delete process.env.GROQ_API_KEY;
    } else {
      process.env.GROQ_API_KEY = originalGroqKey;
    }
  }
}

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

async function seedPlanWithStop({ workId, locationId } = {}) {
  const location = locationId
    ? await prisma.location.findUnique({ where: { id: locationId } })
    : await prisma.location.create({
        data: { name: "Pharmacy", latitude: 0, longitude: 0 },
      });
  const plan = await prisma.plan.create({
    data: {
      status: "active",
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
      works: { create: { workId } },
    },
  });
  return { plan, stop, location };
}

test("PATCH /api/plans/:id/stops/:stopId updates status and actual times", async () => {
  const work = await prisma.work.create({
    data: { title: "Pick up prescription" },
  });
  const { plan, stop } = await seedPlanWithStop({ workId: work.id });

  const response = await request(app)
    .patch(`/api/plans/${plan.id}/stops/${stop.id}`)
    .send({
      status: "done",
      actualArrivalAt: "2026-08-22T09:12:00.000Z",
      actualDepartureAt: "2026-08-22T09:22:00.000Z",
    });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, "done");
  assert.equal(response.body.actualArrivalAt, "2026-08-22T09:12:00.000Z");
});

test("PATCH /api/plans/:id/stops/:stopId rejects an invalid status", async () => {
  const work = await prisma.work.create({
    data: { title: "Pick up prescription" },
  });
  const { plan, stop } = await seedPlanWithStop({ workId: work.id });

  const response = await request(app)
    .patch(`/api/plans/${plan.id}/stops/${stop.id}`)
    .send({ status: "bogus" });

  assert.equal(response.statusCode, 400);
});

test("PATCH /api/plans/:id/stops/:stopId returns 404 for a missing stop", async () => {
  const plan = await prisma.plan.create({
    data: { startAt: new Date(), endAt: new Date(Date.now() + 3600000) },
  });

  const response = await request(app)
    .patch(`/api/plans/${plan.id}/stops/missing-stop`)
    .send({ status: "done" });

  assert.equal(response.statusCode, 404);
});

test("PATCH .../work/:workId marks the work item done when it's the only assignment", async () => {
  const work = await prisma.work.create({
    data: { title: "Pick up prescription" },
  });
  const { plan, stop } = await seedPlanWithStop({ workId: work.id });

  const response = await request(app)
    .patch(`/api/plans/${plan.id}/stops/${stop.id}/work/${work.id}`)
    .send({ status: "done" });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, "done");
  const updatedWork = await prisma.work.findUnique({ where: { id: work.id } });
  assert.equal(updatedWork.status, "done");
});

test("PATCH .../work/:workId skipping leaves the work item todo", async () => {
  const work = await prisma.work.create({
    data: { title: "Pick up prescription" },
  });
  const { plan, stop } = await seedPlanWithStop({ workId: work.id });

  const response = await request(app)
    .patch(`/api/plans/${plan.id}/stops/${stop.id}/work/${work.id}`)
    .send({ status: "skipped" });

  assert.equal(response.statusCode, 200);
  const updatedWork = await prisma.work.findUnique({ where: { id: work.id } });
  assert.equal(updatedWork.status, "todo");
});

test("PATCH .../work/:workId does not mark a work item done while it still has another planned stop in the same plan", async () => {
  const work = await prisma.work.create({
    data: { title: "Visit two branches" },
  });
  const branchA = await prisma.location.create({
    data: { name: "Branch A", latitude: 0, longitude: 0 },
  });
  const branchB = await prisma.location.create({
    data: { name: "Branch B", latitude: 1, longitude: 1 },
  });
  const { plan, stop: stopA } = await seedPlanWithStop({
    workId: work.id,
    locationId: branchA.id,
  });
  const stopB = await prisma.planStop.create({
    data: {
      planId: plan.id,
      locationId: branchB.id,
      order: 1,
      plannedArrivalAt: new Date("2026-08-22T10:00:00Z"),
      plannedDepartureAt: new Date("2026-08-22T10:10:00Z"),
      works: { create: { workId: work.id } },
    },
  });

  const firstResponse = await request(app)
    .patch(`/api/plans/${plan.id}/stops/${stopA.id}/work/${work.id}`)
    .send({ status: "done" });
  assert.equal(firstResponse.statusCode, 200);
  const stillOpenWork = await prisma.work.findUnique({
    where: { id: work.id },
  });
  assert.equal(stillOpenWork.status, "todo");

  const secondResponse = await request(app)
    .patch(`/api/plans/${plan.id}/stops/${stopB.id}/work/${work.id}`)
    .send({ status: "done" });
  assert.equal(secondResponse.statusCode, 200);
  const finishedWork = await prisma.work.findUnique({ where: { id: work.id } });
  assert.equal(finishedWork.status, "done");
});

test("PATCH .../work/:workId returns 404 for a missing assignment", async () => {
  const work = await prisma.work.create({
    data: { title: "Pick up prescription" },
  });
  const { plan, stop } = await seedPlanWithStop({ workId: work.id });
  const otherWork = await prisma.work.create({ data: { title: "Unrelated" } });

  const response = await request(app)
    .patch(`/api/plans/${plan.id}/stops/${stop.id}/work/${otherWork.id}`)
    .send({ status: "done" });

  assert.equal(response.statusCode, 404);
});

test("POST /api/plans/:id/recheck returns 404 for a missing plan", async () => {
  const response = await request(app)
    .post("/api/plans/missing-id/recheck")
    .send({ latitude: 0, longitude: 0 });

  assert.equal(response.statusCode, 404);
});

test("POST /api/plans/:id/recheck recomputes remaining stops from the given location/time", async () => {
  const work = await prisma.work.create({
    data: {
      title: "Nearby errand",
      durationMinutes: 10,
      locationOptions: {
        create: {
          locations: {
            create: { name: "Shop", latitude: 0.01, longitude: 0.01 },
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

  const response = await request(app)
    .post(`/api/plans/${plan.id}/recheck`)
    .send({
      asOfAt: "2026-08-22T09:30:00.000Z",
      latitude: 0.01,
      longitude: 0.01,
    });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.plan.stops.length, 1);
  assert.equal(response.body.plan.stops[0].works[0].work.id, work.id);
  assert.ok(Array.isArray(response.body.variations));
});

test("POST /api/plans/:id/recheck omits variations when nothing is left unselected", async () => {
  const plan = await prisma.plan.create({
    data: {
      status: "active",
      startAt: new Date("2026-08-22T09:00:00Z"),
      endAt: new Date("2026-08-22T10:00:00Z"),
    },
  });

  const response = await request(app)
    .post(`/api/plans/${plan.id}/recheck`)
    .send({ latitude: 0, longitude: 0 });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.variations, []);
});

test("POST /api/plans/:id/recheck calls buildPlanVariations when something is left unselected", async () => {
  await withGroqConfigured(async () => {
    // "near" easily fits the 30-minute budget; "far" is 5 degrees away
    // (~550km), so no plausible budget lets it fit — it is guaranteed to
    // land in unselectedWork, mirroring the same near/far setup used in
    // planBuilder.test.js's "reports the rest as unselected" case.
    const near = await prisma.work.create({
      data: {
        title: "Nearby errand",
        durationMinutes: 10,
        locationOptions: {
          create: {
            locations: {
              create: { name: "Corner shop", latitude: 0.001, longitude: 0 },
            },
          },
        },
      },
    });
    const far = await prisma.work.create({
      data: {
        title: "Cross-country errand",
        durationMinutes: 10,
        locationOptions: {
          create: {
            locations: {
              create: { name: "Distant shop", latitude: 5, longitude: 0 },
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
        endAt: new Date("2026-08-22T09:30:00Z"),
        endLatitude: 0,
        endLongitude: 0,
      },
    });

    const restoreFetch = mockFetchOnce(async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                variations: [
                  {
                    addWorkIds: [far.id],
                    removeWorkIds: [near.id],
                    reasoning: "Swap in the overdue distant errand.",
                  },
                ],
              }),
            },
          },
        ],
      }),
    }));

    let response;
    try {
      response = await request(app).post(`/api/plans/${plan.id}/recheck`).send({
        asOfAt: "2026-08-22T09:00:00.000Z",
        latitude: 0,
        longitude: 0,
      });
    } finally {
      restoreFetch();
    }

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.plan.stops.length, 1);
    assert.equal(response.body.plan.stops[0].works[0].work.id, near.id);
    assert.equal(response.body.variations.length, 1);
    assert.deepEqual(response.body.variations[0].addWorkIds, [far.id]);
    assert.deepEqual(response.body.variations[0].removeWorkIds, [near.id]);
    assert.equal(
      response.body.variations[0].reasoning,
      "Swap in the overdue distant errand."
    );
  });
});

test("POST /api/plans/:id/recheck still returns the rebuilt plan when buildPlanVariations fails", async () => {
  await withGroqConfigured(async () => {
    const near = await prisma.work.create({
      data: {
        title: "Nearby errand",
        durationMinutes: 10,
        locationOptions: {
          create: {
            locations: {
              create: { name: "Corner shop", latitude: 0.001, longitude: 0 },
            },
          },
        },
      },
    });
    await prisma.work.create({
      data: {
        title: "Cross-country errand",
        durationMinutes: 10,
        locationOptions: {
          create: {
            locations: {
              create: { name: "Distant shop", latitude: 5, longitude: 0 },
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
        endAt: new Date("2026-08-22T09:30:00Z"),
        endLatitude: 0,
        endLongitude: 0,
      },
    });

    const restoreFetch = mockFetchOnce(async () => {
      throw new Error("network down");
    });

    let response;
    try {
      response = await request(app).post(`/api/plans/${plan.id}/recheck`).send({
        asOfAt: "2026-08-22T09:00:00.000Z",
        latitude: 0,
        longitude: 0,
      });
    } finally {
      restoreFetch();
    }

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.plan.stops.length, 1);
    assert.equal(response.body.plan.stops[0].works[0].work.id, near.id);
    assert.deepEqual(response.body.variations, []);
  });
});
