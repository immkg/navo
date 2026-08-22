const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  PRIORITY_POINTS,
  scoreWork,
  urgencyScore,
  haversineKm,
  estimateTravelMinutes,
  buildEligibleEntries,
  groupEntriesByLocation,
  buildRoute,
  computeStopTimings,
  buildPlan,
} = require("../src/services/planBuilder");

test("urgencyScore returns 0 when there is no due date", () => {
  assert.equal(urgencyScore(null, new Date("2026-08-22T09:00:00Z")), 0);
});

test("urgencyScore scores an overdue due date highest", () => {
  const now = new Date("2026-08-22T09:00:00Z");
  assert.equal(urgencyScore("2026-08-20", now), 6);
});

test("urgencyScore scores a due-today date as 5, regardless of time of day", () => {
  const now = new Date("2026-08-22T23:00:00Z");
  assert.equal(urgencyScore("2026-08-22", now), 5);
});

test("urgencyScore scores due within 3 days as 3, and within 7 days as 1", () => {
  const now = new Date("2026-08-22T09:00:00Z");
  assert.equal(urgencyScore("2026-08-24", now), 3);
  assert.equal(urgencyScore("2026-08-28", now), 1);
});

test("urgencyScore scores anything more than 7 days out as 0", () => {
  const now = new Date("2026-08-22T09:00:00Z");
  assert.equal(urgencyScore("2026-09-10", now), 0);
});

test("scoreWork combines work priority (x2), intent priority (x1), and urgency", () => {
  const now = new Date("2026-08-22T09:00:00Z");
  const work = { priority: "high" };
  const intent = { priority: "low", dueDate: "2026-08-22" };
  // 2*3 (work high) + 1*1 (intent low) + 5 (due today) = 12
  assert.equal(scoreWork(work, intent, now), 12);
});

test("scoreWork defaults to medium priority when work or intent priority is missing", () => {
  const now = new Date("2026-08-22T09:00:00Z");
  const expected = 2 * PRIORITY_POINTS.medium + PRIORITY_POINTS.medium;
  assert.equal(scoreWork({}, null, now), expected);
});

test("haversineKm returns null when any coordinate is missing", () => {
  assert.equal(
    haversineKm(
      { latitude: 1, longitude: 1 },
      { latitude: null, longitude: 2 }
    ),
    null
  );
});

test("haversineKm computes a plausible distance between two known points", () => {
  // San Francisco to Oakland is roughly 13km apart.
  const km = haversineKm(
    { latitude: 37.7749, longitude: -122.4194 },
    { latitude: 37.8044, longitude: -122.2712 }
  );
  assert.ok(km > 10 && km < 16, `expected ~13km, got ${km}`);
});

test("estimateTravelMinutes falls back to a flat 8 minutes when coordinates are missing", () => {
  assert.equal(
    estimateTravelMinutes(
      { latitude: null, longitude: null },
      { latitude: 1, longitude: 1 }
    ),
    8
  );
});

test("estimateTravelMinutes has a 3-minute floor for very short hops", () => {
  const minutes = estimateTravelMinutes(
    { latitude: 1, longitude: 1 },
    { latitude: 1.0001, longitude: 1.0001 }
  );
  assert.equal(minutes, 3);
});

test("estimateTravelMinutes scales with distance", () => {
  const minutes = estimateTravelMinutes(
    { latitude: 37.7749, longitude: -122.4194 },
    { latitude: 37.8044, longitude: -122.2712 }
  );
  assert.ok(minutes >= 80 && minutes <= 130, `expected 80-130, got ${minutes}`);
});

function makeWork(overrides = {}) {
  return {
    id: "w1",
    status: "todo",
    durationMinutes: 30,
    priority: "medium",
    intent: { priority: "medium", dueDate: null },
    selectedLocationOptionId: null,
    locationOptions: [],
    ...overrides,
  };
}

test("buildEligibleEntries uses the selected location option, or the first when none is selected", () => {
  const location = { id: "loc1", latitude: 1, longitude: 1 };
  const work = makeWork({
    locationOptions: [{ id: "opt1", locations: [location] }],
  });

  const entries = buildEligibleEntries([work], new Date(), new Set());

  assert.equal(entries.length, 1);
  assert.equal(entries[0].location.id, "loc1");
  assert.equal(entries[0].work.id, "w1");
});

test("buildEligibleEntries produces one entry per location when a work item's chosen option lists several", () => {
  const work = makeWork({
    locationOptions: [
      {
        id: "opt1",
        locations: [
          { id: "loc1", latitude: 1, longitude: 1 },
          { id: "loc2", latitude: 2, longitude: 2 },
        ],
      },
    ],
  });

  const entries = buildEligibleEntries([work], new Date(), new Set());

  assert.equal(entries.length, 2);
});

test("buildEligibleEntries boosts value for force-included work ids", () => {
  const work = makeWork({
    priority: "low",
    intent: { priority: "low", dueDate: null },
    locationOptions: [
      { id: "opt1", locations: [{ id: "loc1", latitude: 1, longitude: 1 }] },
    ],
  });

  const normal = buildEligibleEntries([work], new Date(), new Set());
  const forced = buildEligibleEntries([work], new Date(), new Set(["w1"]));

  assert.ok(forced[0].value > normal[0].value);
});

test("groupEntriesByLocation bundles work items that share a location and sums duration/value", () => {
  const location = { id: "loc1", latitude: 1, longitude: 1 };
  const entries = [
    { work: makeWork({ id: "w1", durationMinutes: 20 }), location, value: 4 },
    { work: makeWork({ id: "w2", durationMinutes: 10 }), location, value: 3 },
  ];

  const [stop] = groupEntriesByLocation(entries);

  assert.equal(stop.durationMinutes, 30);
  assert.equal(stop.value, 7);
  assert.equal(stop.entries.length, 2);
});

test("groupEntriesByLocation produces one candidate stop per distinct location", () => {
  const entries = [
    {
      work: makeWork({ id: "w1" }),
      location: { id: "loc1", latitude: 1, longitude: 1 },
      value: 4,
    },
    {
      work: makeWork({ id: "w2" }),
      location: { id: "loc2", latitude: 2, longitude: 2 },
      value: 3,
    },
  ];

  const stops = groupEntriesByLocation(entries);

  assert.equal(stops.length, 2);
});

test("buildRoute inserts every candidate stop when the budget is generous", () => {
  const start = { latitude: 0, longitude: 0 };
  const end = { latitude: 0, longitude: 0 };
  const stops = [
    {
      location: { latitude: 0.01, longitude: 0 },
      durationMinutes: 10,
      value: 5,
      entries: [],
    },
    {
      location: { latitude: 0.02, longitude: 0 },
      durationMinutes: 10,
      value: 5,
      entries: [],
    },
  ];

  const route = buildRoute(stops, start, end, 10000);

  assert.equal(route.length, 2);
});

test("buildRoute returns an empty route when there are no candidate stops", () => {
  const route = buildRoute(
    [],
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 0 },
    100
  );

  assert.deepEqual(route, []);
});

test("buildRoute excludes a stop that would blow the time budget, even if another fits comfortably", () => {
  const start = { latitude: 0, longitude: 0 };
  const end = { latitude: 0, longitude: 0 };
  const nearby = {
    location: { latitude: 0.001, longitude: 0 },
    durationMinutes: 5,
    value: 10,
    entries: [],
  };
  const faraway = {
    location: { latitude: 5, longitude: 0 },
    durationMinutes: 60,
    value: 1,
    entries: [],
  };

  const route = buildRoute([nearby, faraway], start, end, 30);

  assert.equal(route.length, 1);
  assert.equal(route[0], nearby);
});

test("buildRoute prefers the higher value-per-cost stop when the budget allows only one", () => {
  const start = { latitude: 0, longitude: 0 };
  const end = { latitude: 0, longitude: 0 };
  const highValue = {
    location: { latitude: 0.001, longitude: 0 },
    durationMinutes: 10,
    value: 100,
    entries: [],
  };
  const lowValue = {
    location: { latitude: 0.002, longitude: 0 },
    durationMinutes: 10,
    value: 1,
    entries: [],
  };

  // Each stop alone fits in 20 minutes (3 min there + 3 min back + 10 min
  // work); both together would exceed it.
  const route = buildRoute([highValue, lowValue], start, end, 20);

  assert.equal(route.length, 1);
  assert.equal(route[0], highValue);
});

test("computeStopTimings computes cumulative arrival/departure times from the plan's start", () => {
  const start = { latitude: 0, longitude: 0 };
  const startAt = new Date("2026-08-22T09:00:00Z");
  const stop = {
    location: { latitude: 0.001, longitude: 0 },
    durationMinutes: 15,
    value: 1,
    entries: [],
  };

  const [timed] = computeStopTimings([stop], start, startAt);

  assert.equal(
    timed.plannedArrivalAt.toISOString(),
    "2026-08-22T09:03:00.000Z"
  );
  assert.equal(
    timed.plannedDepartureAt.toISOString(),
    "2026-08-22T09:18:00.000Z"
  );
});

test("buildPlan selects eligible work within budget and reports the rest as unselected", () => {
  const now = new Date("2026-08-22T09:00:00Z");
  const near = makeWork({
    id: "near",
    durationMinutes: 10,
    locationOptions: [
      {
        id: "o1",
        locations: [{ id: "loc-near", latitude: 0.001, longitude: 0 }],
      },
    ],
  });
  const far = makeWork({
    id: "far",
    durationMinutes: 10,
    locationOptions: [
      { id: "o2", locations: [{ id: "loc-far", latitude: 5, longitude: 0 }] },
    ],
  });

  const result = buildPlan({
    workItems: [near, far],
    start: { latitude: 0, longitude: 0 },
    end: { latitude: 0, longitude: 0 },
    startAt: now,
    endAt: new Date(now.getTime() + 20 * 60000),
    now,
  });

  assert.equal(result.stops.length, 1);
  assert.equal(result.stops[0].location.id, "loc-near");
  assert.equal(result.unselectedWork.length, 1);
  assert.equal(result.unselectedWork[0].id, "far");
});

test("buildPlan excludes done work and force-excluded work ids from the candidate pool entirely", () => {
  const now = new Date("2026-08-22T09:00:00Z");
  const done = makeWork({
    id: "done1",
    status: "done",
    locationOptions: [
      { id: "o1", locations: [{ id: "l1", latitude: 0.001, longitude: 0 }] },
    ],
  });
  const excluded = makeWork({
    id: "excl1",
    locationOptions: [
      { id: "o2", locations: [{ id: "l2", latitude: 0.001, longitude: 0 }] },
    ],
  });

  const result = buildPlan({
    workItems: [done, excluded],
    start: { latitude: 0, longitude: 0 },
    end: { latitude: 0, longitude: 0 },
    startAt: now,
    endAt: new Date(now.getTime() + 60 * 60000),
    forceExcludeWorkIds: ["excl1"],
    now,
  });

  assert.equal(result.stops.length, 0);
  assert.equal(result.unselectedWork.length, 0);
});

test("buildPlan lets a force-included work item win over a higher-scoring competitor when only one fits", () => {
  const now = new Date("2026-08-22T09:00:00Z");
  const highScore = makeWork({
    id: "high",
    durationMinutes: 10,
    priority: "high",
    intent: { priority: "high", dueDate: "2026-08-20" }, // overdue
    locationOptions: [
      { id: "o1", locations: [{ id: "l1", latitude: 0.001, longitude: 0 }] },
    ],
  });
  const forced = makeWork({
    id: "forced",
    durationMinutes: 10,
    priority: "low",
    intent: { priority: "low", dueDate: null },
    locationOptions: [
      { id: "o2", locations: [{ id: "l2", latitude: 0.002, longitude: 0 }] },
    ],
  });

  const result = buildPlan({
    workItems: [highScore, forced],
    start: { latitude: 0, longitude: 0 },
    end: { latitude: 0, longitude: 0 },
    startAt: now,
    endAt: new Date(now.getTime() + 20 * 60000),
    forceIncludeWorkIds: ["forced"],
    now,
  });

  assert.equal(result.stops.length, 1);
  assert.equal(result.stops[0].location.id, "l2");
});
