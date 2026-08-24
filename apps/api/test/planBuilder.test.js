const { test, beforeEach, afterEach } = require("node:test");
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
  resolveAnchorLocation,
  ANCHOR_LOCATION_ID,
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

test("scoreWork applies no energy penalty when the plan's energy level is high (the default)", () => {
  const now = new Date("2026-08-22T09:00:00Z");
  const work = { priority: "medium", energyLevel: "high" };
  const withoutPlanEnergy = scoreWork(work, null, now);
  const withHighPlanEnergy = scoreWork(work, null, now, "high");
  assert.equal(withoutPlanEnergy, withHighPlanEnergy);
});

test("scoreWork applies no penalty when work's energy level fits within the plan's energy level", () => {
  const now = new Date("2026-08-22T09:00:00Z");
  const lowEnergyWork = { priority: "medium", energyLevel: "low" };
  const baseline = scoreWork(lowEnergyWork, null, now, "high");
  assert.equal(scoreWork(lowEnergyWork, null, now, "low"), baseline);
  assert.equal(scoreWork(lowEnergyWork, null, now, "medium"), baseline);
});

test("scoreWork discounts work whose energy requirement exceeds the plan's energy level", () => {
  const now = new Date("2026-08-22T09:00:00Z");
  const highEnergyWork = { priority: "medium", energyLevel: "high" };
  const baseline = scoreWork(highEnergyWork, null, now, "high");
  const onLowEnergyPlan = scoreWork(highEnergyWork, null, now, "low");
  const onMediumEnergyPlan = scoreWork(highEnergyWork, null, now, "medium");

  assert.ok(onLowEnergyPlan < onMediumEnergyPlan);
  assert.ok(onMediumEnergyPlan < baseline);
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

test("buildEligibleEntries skips a location whose (work, location) pair is already resolved", () => {
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

  const entries = buildEligibleEntries(
    [work],
    new Date(),
    new Set(),
    new Set(["w1:loc1"])
  );

  assert.equal(entries.length, 1);
  assert.equal(entries[0].location.id, "loc2");
});

test("buildEligibleEntries only skips the resolved work item's own pair, not another work item at the same location", () => {
  const locations = [{ id: "loc1", latitude: 1, longitude: 1 }];
  const resolved = makeWork({
    id: "w1",
    locationOptions: [{ id: "opt1", locations }],
  });
  const other = makeWork({
    id: "w2",
    locationOptions: [{ id: "opt2", locations }],
  });

  const entries = buildEligibleEntries(
    [resolved, other],
    new Date(),
    new Set(),
    new Set(["w1:loc1"])
  );

  assert.equal(entries.length, 1);
  assert.equal(entries[0].work.id, "w2");
});

test("buildEligibleEntries proposes every location when resolvedAssignmentKeys is omitted", () => {
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

  assert.equal(buildEligibleEntries([work], new Date(), new Set()).length, 2);
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

test("resolveAnchorLocation pins to the start point when it has coordinates", () => {
  const anchor = resolveAnchorLocation(
    { latitude: 1, longitude: 2 },
    { latitude: 3, longitude: 4 }
  );
  assert.equal(anchor.id, ANCHOR_LOCATION_ID);
  assert.equal(anchor.latitude, 1);
  assert.equal(anchor.longitude, 2);
});

test("resolveAnchorLocation falls back to the end point when the start has no coordinates", () => {
  const anchor = resolveAnchorLocation(
    { latitude: null, longitude: null },
    { latitude: 3, longitude: 4 }
  );
  assert.equal(anchor.latitude, 3);
  assert.equal(anchor.longitude, 4);
});

test("resolveAnchorLocation returns null when neither start nor end has coordinates", () => {
  assert.equal(
    resolveAnchorLocation(
      { latitude: null, longitude: null },
      { latitude: null, longitude: null }
    ),
    null
  );
});

test("buildEligibleEntries pins a work item with no location options to the anchor location, when given one", () => {
  const work = makeWork({ locationOptions: [] });
  const anchor = { id: ANCHOR_LOCATION_ID, latitude: 0, longitude: 0 };

  const withoutAnchor = buildEligibleEntries([work], new Date(), new Set());
  const withAnchor = buildEligibleEntries(
    [work],
    new Date(),
    new Set(),
    new Set(),
    "high",
    anchor
  );

  assert.equal(withoutAnchor.length, 0);
  assert.equal(withAnchor.length, 1);
  assert.equal(withAnchor[0].location.id, ANCHOR_LOCATION_ID);
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

test("buildPlan selects eligible work within budget and reports the rest as unselected", async () => {
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

  const result = await buildPlan({
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

test("buildPlan schedules location-less work at the start anchor instead of dropping it", async () => {
  const now = new Date("2026-08-22T09:00:00Z");
  const remote = makeWork({
    id: "remote",
    durationMinutes: 10,
    locationOptions: [],
  });

  const result = await buildPlan({
    workItems: [remote],
    start: { latitude: 12, longitude: 34 },
    end: { latitude: 12, longitude: 34 },
    startAt: now,
    endAt: new Date(now.getTime() + 60 * 60000),
    now,
  });

  assert.equal(result.unselectedWork.length, 0);
  assert.equal(result.stops.length, 1);
  assert.equal(result.stops[0].location.id, ANCHOR_LOCATION_ID);
  assert.equal(result.stops[0].location.latitude, 12);
  assert.equal(result.stops[0].location.longitude, 34);
  assert.equal(result.stops[0].entries[0].work.id, "remote");
});

test("buildPlan excludes done work and force-excluded work ids from the candidate pool entirely", async () => {
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

  const result = await buildPlan({
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

test("buildPlan never schedules work whose dependency isn't done yet", async () => {
  const now = new Date("2026-08-22T09:00:00Z");
  const blocked = makeWork({
    id: "blocked",
    locationOptions: [
      { id: "o1", locations: [{ id: "l1", latitude: 0.001, longitude: 0 }] },
    ],
    dependsOn: [{ dependsOn: { id: "prereq", status: "todo" } }],
  });

  const result = await buildPlan({
    workItems: [blocked],
    start: { latitude: 0, longitude: 0 },
    end: { latitude: 0, longitude: 0 },
    startAt: now,
    endAt: new Date(now.getTime() + 60 * 60000),
    now,
  });

  assert.equal(result.stops.length, 0);
  // Excluded outright, same tier as a done work item — not merely
  // "didn't fit the budget".
  assert.equal(result.unselectedWork.length, 0);
});

test("buildPlan schedules work once its dependency is done", async () => {
  const now = new Date("2026-08-22T09:00:00Z");
  const unblocked = makeWork({
    id: "unblocked",
    locationOptions: [
      { id: "o1", locations: [{ id: "l1", latitude: 0.001, longitude: 0 }] },
    ],
    dependsOn: [{ dependsOn: { id: "prereq", status: "done" } }],
  });

  const result = await buildPlan({
    workItems: [unblocked],
    start: { latitude: 0, longitude: 0 },
    end: { latitude: 0, longitude: 0 },
    startAt: now,
    endAt: new Date(now.getTime() + 60 * 60000),
    now,
  });

  assert.equal(result.stops.length, 1);
});

test("buildPlan ignores forceIncludeWorkIds for a dependency-blocked work item — force-include can't bypass a hard constraint", async () => {
  const now = new Date("2026-08-22T09:00:00Z");
  const blocked = makeWork({
    id: "blocked",
    locationOptions: [
      { id: "o1", locations: [{ id: "l1", latitude: 0.001, longitude: 0 }] },
    ],
    dependsOn: [{ dependsOn: { id: "prereq", status: "todo" } }],
  });

  const result = await buildPlan({
    workItems: [blocked],
    start: { latitude: 0, longitude: 0 },
    end: { latitude: 0, longitude: 0 },
    startAt: now,
    endAt: new Date(now.getTime() + 60 * 60000),
    forceIncludeWorkIds: ["blocked"],
    now,
  });

  assert.equal(result.stops.length, 0);
});

test("buildPlan threads resolvedAssignmentKeys through, routing only to the unresolved location", async () => {
  const now = new Date("2026-08-22T09:00:00Z");
  const twoBranches = makeWork({
    id: "w1",
    durationMinutes: 10,
    locationOptions: [
      {
        id: "o1",
        locations: [
          { id: "branch-a", latitude: 0.001, longitude: 0 },
          { id: "branch-b", latitude: 0.002, longitude: 0 },
        ],
      },
    ],
  });

  const result = await buildPlan({
    workItems: [twoBranches],
    start: { latitude: 0, longitude: 0 },
    end: { latitude: 0, longitude: 0 },
    startAt: now,
    endAt: new Date(now.getTime() + 120 * 60000),
    resolvedAssignmentKeys: new Set(["w1:branch-a"]),
    now,
  });

  assert.equal(result.stops.length, 1);
  assert.equal(result.stops[0].location.id, "branch-b");
  // Still counted as selected — it made it into the route somewhere.
  assert.deepEqual(result.unselectedWork, []);
});

test("buildPlan lets a force-included work item win over a higher-scoring competitor when only one fits", async () => {
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

  const result = await buildPlan({
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

test("buildPlan prefers a lower-energy work item over a higher-priority, high-energy one when the plan's energy level is low", async () => {
  const now = new Date("2026-08-22T09:00:00Z");
  const highPriorityHighEnergy = makeWork({
    id: "demanding",
    durationMinutes: 10,
    priority: "high",
    energyLevel: "high",
    locationOptions: [
      { id: "o1", locations: [{ id: "l1", latitude: 0.001, longitude: 0 }] },
    ],
  });
  const lowPriorityLowEnergy = makeWork({
    id: "easy",
    durationMinutes: 10,
    priority: "low",
    energyLevel: "low",
    locationOptions: [
      { id: "o2", locations: [{ id: "l2", latitude: 0.002, longitude: 0 }] },
    ],
  });

  const highEnergyPlanResult = await buildPlan({
    workItems: [highPriorityHighEnergy, lowPriorityLowEnergy],
    start: { latitude: 0, longitude: 0 },
    end: { latitude: 0, longitude: 0 },
    startAt: now,
    endAt: new Date(now.getTime() + 20 * 60000),
    now,
    planEnergyLevel: "high",
  });
  assert.equal(highEnergyPlanResult.stops[0].location.id, "l1");

  const lowEnergyPlanResult = await buildPlan({
    workItems: [highPriorityHighEnergy, lowPriorityLowEnergy],
    start: { latitude: 0, longitude: 0 },
    end: { latitude: 0, longitude: 0 },
    startAt: now,
    endAt: new Date(now.getTime() + 20 * 60000),
    now,
    planEnergyLevel: "low",
  });
  assert.equal(lowEnergyPlanResult.stops[0].location.id, "l2");
});

let originalGoogleMapsKey;

beforeEach(() => {
  originalGoogleMapsKey = process.env.GOOGLE_MAPS_API_KEY;
});

afterEach(() => {
  if (originalGoogleMapsKey === undefined) {
    delete process.env.GOOGLE_MAPS_API_KEY;
  } else {
    process.env.GOOGLE_MAPS_API_KEY = originalGoogleMapsKey;
  }
});

test("buildPlan never calls the routing matrix when useAccurateTravelTime is false", async () => {
  delete process.env.GOOGLE_MAPS_API_KEY;
  const now = new Date("2026-08-22T09:00:00Z");
  const work = makeWork({
    locationOptions: [
      { id: "o1", locations: [{ id: "l1", latitude: 0.01, longitude: 0 }] },
    ],
  });

  const result = await buildPlan({
    workItems: [work],
    start: { latitude: 0, longitude: 0 },
    end: { latitude: 0, longitude: 0 },
    startAt: now,
    endAt: new Date(now.getTime() + 60 * 60000),
    now,
    useAccurateTravelTime: false,
    fetchTravelTimeMatrix: async () => {
      throw new Error("should not be called");
    },
  });

  assert.equal(result.stops.length, 1);
});

test("buildPlan never calls the routing matrix when GOOGLE_MAPS_API_KEY is not configured, even if useAccurateTravelTime is true", async () => {
  delete process.env.GOOGLE_MAPS_API_KEY;
  const now = new Date("2026-08-22T09:00:00Z");
  const work = makeWork({
    locationOptions: [
      { id: "o1", locations: [{ id: "l1", latitude: 0.01, longitude: 0 }] },
    ],
  });

  const result = await buildPlan({
    workItems: [work],
    start: { latitude: 0, longitude: 0 },
    end: { latitude: 0, longitude: 0 },
    startAt: now,
    endAt: new Date(now.getTime() + 60 * 60000),
    now,
    useAccurateTravelTime: true,
    fetchTravelTimeMatrix: async () => {
      throw new Error("should not be called");
    },
  });

  assert.equal(result.stops.length, 1);
});

test("buildPlan uses real routing minutes from the matrix over the haversine estimate", async () => {
  process.env.GOOGLE_MAPS_API_KEY = "test-key";
  const now = new Date("2026-08-22T09:00:00Z");
  // Haversine would estimate this hop as a few minutes (tiny lat/lng delta),
  // comfortably inside the 20-minute budget. The mocked matrix instead says
  // it's a 45-minute real drive each way — over budget — proving the stop
  // gets excluded because the matrix value was actually used, not haversine.
  const work = makeWork({
    durationMinutes: 5,
    locationOptions: [
      { id: "o1", locations: [{ id: "l1", latitude: 0.001, longitude: 0 }] },
    ],
  });

  const result = await buildPlan({
    workItems: [work],
    start: { latitude: 0, longitude: 0 },
    end: { latitude: 0, longitude: 0 },
    startAt: now,
    endAt: new Date(now.getTime() + 20 * 60000),
    now,
    useAccurateTravelTime: true,
    fetchTravelTimeMatrix: async () =>
      new Map([
        ["0,0:0.001,0", 45],
        ["0.001,0:0,0", 45],
      ]),
  });

  assert.equal(result.stops.length, 0);
  assert.equal(result.unselectedWork.length, 1);
});

test("buildPlan falls back to haversine per-pair when the matrix is missing that pair", async () => {
  process.env.GOOGLE_MAPS_API_KEY = "test-key";
  const now = new Date("2026-08-22T09:00:00Z");
  const work = makeWork({
    durationMinutes: 5,
    locationOptions: [
      { id: "o1", locations: [{ id: "l1", latitude: 0.001, longitude: 0 }] },
    ],
  });

  const result = await buildPlan({
    workItems: [work],
    start: { latitude: 0, longitude: 0 },
    end: { latitude: 0, longitude: 0 },
    startAt: now,
    endAt: new Date(now.getTime() + 20 * 60000),
    now,
    useAccurateTravelTime: true,
    fetchTravelTimeMatrix: async () => new Map(),
  });

  assert.equal(result.stops.length, 1);
});

test("buildPlan falls back to haversine entirely when the matrix fetch throws", async () => {
  process.env.GOOGLE_MAPS_API_KEY = "test-key";
  const now = new Date("2026-08-22T09:00:00Z");
  const work = makeWork({
    durationMinutes: 5,
    locationOptions: [
      { id: "o1", locations: [{ id: "l1", latitude: 0.001, longitude: 0 }] },
    ],
  });

  const result = await buildPlan({
    workItems: [work],
    start: { latitude: 0, longitude: 0 },
    end: { latitude: 0, longitude: 0 },
    startAt: now,
    endAt: new Date(now.getTime() + 20 * 60000),
    now,
    useAccurateTravelTime: true,
    fetchTravelTimeMatrix: async () => {
      throw new Error("network error");
    },
  });

  assert.equal(result.stops.length, 1);
});
