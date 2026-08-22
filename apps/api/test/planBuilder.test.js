const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  PRIORITY_POINTS,
  scoreWork,
  urgencyScore,
  haversineKm,
  estimateTravelMinutes,
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
