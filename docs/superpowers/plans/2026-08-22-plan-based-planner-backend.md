# Plan-Based Planner — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the entire server-side half of the plan-based planner: a `Work.priority` field, the `Plan`/`PlanStop`/`PlanStopWork` schema, the deterministic selection algorithm, the full `/api/plans` REST surface, and the advisory `/api/ai/plan-variations` route — all independently testable via `supertest`/`node:test`, with no frontend changes.

**Architecture:** A pure, dependency-free scoring/routing module (`planBuilder.js`) is the algorithmic core; a thin persistence layer (`planPersistence.js`) wraps it in a Prisma transaction that knows how to freeze already-resolved stops and rebuild the rest; `routes/plans.js` and a `plan-variations` addition to `routes/ai.js` expose it over HTTP. Each layer is tested at the level that doesn't need the layer above it (pure functions with no DB, persistence with Prisma but no HTTP, routes with `supertest`).

**Tech Stack:** Node 20, Express 5, Prisma 6 (SQLite, `db push` workflow — no migrations), `node:test` + `node:assert/strict` + `supertest`, CommonJS (`require`/`module.exports`) throughout `apps/api`.

**Spec:** `docs/superpowers/specs/2026-08-22-plan-based-planner-design.md`

## Global Constraints

- This plan implements the **backend only**. A companion plan,
  `docs/superpowers/plans/2026-08-22-plan-based-planner-frontend.md`, covers
  the two new pages and depends on every endpoint here already being merged
  to `main`. The spec covers one cohesive feature but is split into two
  plans because the backend alone (3 new models, a routing algorithm, ~9
  endpoints) is large enough to be independently mergeable and testable
  before any UI exists.
- Before any lint/test/build command: `source ~/.nvm/nvm.sh && nvm use
20.19.3` (repo requires Node ≥22; environment default is 18.20.2 and 20.19.3
  is the version this session has used successfully all along).
- No `prisma/migrations` history exists in this repo — schema changes are
  applied with `npx prisma db push` directly (dev database) and via the
  existing `pretest`/`test:db:push` npm scripts (test database, automatic).
  Run `npx prisma db push` against the dev database manually after Task 2.
- All work happens on one branch, `feat/plan-based-planner-backend`, created
  from an up-to-date `main`. Commit after each task (as each task's Step
  "Commit" describes). Open the PR only after Task 13 is done and the full
  verification in Task 13's last step passes. Then: push, `gh pr create`,
  `gh pr checks <N> --watch` until green, `gh pr merge <N> --squash
--delete-branch`, confirm `main` is back to clean/up-to-date. Never commit
  directly to `main`.
- Run the **full** existing test suite (`npm test` in `apps/api`, from the
  repo root or `apps/api`) after every task that touches shared files
  (`schema.prisma`, `app.js`, `test-support/helpers.js`) — not just the new
  tests — to catch regressions early.
- Run `npm run lint` (in `apps/api`) and `npx prettier --check` (from the
  repo root, scoped to changed files or the whole repo) before every commit;
  fix anything they flag before moving on.
- Every new Express route follows the existing error-handling shape in
  `apps/api/src/routes/work.js` and `apps/api/src/routes/ai.js`: a
  try/catch per handler, `console.error(error)` on unexpected failures, and
  a `{ error: "..." }` JSON body with an appropriate status code.

---

### Task 1: `Work.priority` field

**Files:**

- Modify: `apps/api/prisma/schema.prisma` (`Work` model)
- Modify: `apps/api/src/routes/work.js:56-150` (POST handler), `apps/api/src/routes/work.js:153-198` (PATCH handler)
- Test: `apps/api/test/work.test.js`

**Interfaces:**

- Produces: `Work.priority` (`"low" | "medium" | "high"`, default `"medium"`)
  — every later task that reads a `Work` row can rely on this field being
  present.

- [ ] **Step 1: Create the branch**

```bash
git checkout main
git pull
git checkout -b feat/plan-based-planner-backend
```

- [ ] **Step 2: Write the failing tests**

Add to `apps/api/test/work.test.js` (anywhere after the existing PATCH
tests, e.g. right after the `"PATCH /api/work/:id returns 404..."` test):

```js
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
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
source ~/.nvm/nvm.sh && nvm use 20.19.3
cd apps/api
npm test
```

Expected: the five new tests fail (schema has no `priority` column yet, so
`response.body.priority` is `undefined`, and nothing validates it).

- [ ] **Step 4: Add the field to the schema and push it**

In `apps/api/prisma/schema.prisma`, in the `Work` model, add `priority`
right after `status`:

```prisma
model Work {
  id                      String           @id @default(uuid())
  title                   String
  type                    String           @default("task") // task, decision, etc.
  status                  String           @default("todo") // todo, in_progress, done
  priority                String           @default("medium") // low, medium, high — independent of intent.priority
  durationMinutes         Int              @default(30)
  notes                   String?
  createdAt               DateTime         @default(now())
  updatedAt               DateTime         @updatedAt

  intentId                String?
  intent                  Intent?          @relation(fields: [intentId], references: [id])

  contexts                Context[]
  locationOptions         LocationOption[]
  selectedLocationOptionId String?

  // Self-relations for dependencies (DAG)
  dependsOn               WorkDependency[] @relation("DependsOn")
  dependedBy              WorkDependency[] @relation("DependedBy")
}
```

```bash
npx prisma db push
```

Expected output: `Your database is now in sync with your Prisma schema.`
(applies to the dev database; the test database is pushed automatically by
the `pretest` npm script before tests run).

- [ ] **Step 5: Extend the POST and PATCH handlers**

In `apps/api/src/routes/work.js`, add a validation set near the existing
`VALID_STATUSES` (top of file):

```js
const VALID_STATUSES = new Set(["todo", "in_progress", "done"]);
const VALID_PRIORITIES = new Set(["low", "medium", "high"]);
```

In the `POST "/"` handler, destructure and validate `priority`, then pass
it through to `data`:

```js
const {
  title,
  type,
  intentId,
  durationMinutes,
  notes,
  locationOptions,
  priority,
} = req.body;

if (!title) {
  return res.status(400).json({ error: "Title is required" });
}

if (priority !== undefined && !VALID_PRIORITIES.has(priority)) {
  return res
    .status(400)
    .json({ error: "Priority must be low, medium, or high" });
}
```

```js
const data = {
  title,
  type: type || "task",
  priority: priority || "medium",
  durationMinutes: typeof durationMinutes === "number" ? durationMinutes : 30,
  notes,
  intentId: intentId || null,
  locationOptions:
    locationOptions &&
    Array.isArray(locationOptions) &&
    locationOptions.length > 0
      ? {
          create: locationOptions.map(createLocationOption),
        }
      : undefined,
};
```

In the `PATCH "/:id"` handler, destructure `priority`, validate it alongside
`status`, and include it in the update:

```js
const {
  title,
  type,
  status,
  priority,
  durationMinutes,
  notes,
  selectedLocationOptionId,
} = req.body;

if (status !== undefined && !VALID_STATUSES.has(status)) {
  return res
    .status(400)
    .json({ error: "Status must be todo, in_progress, or done" });
}

if (priority !== undefined && !VALID_PRIORITIES.has(priority)) {
  return res
    .status(400)
    .json({ error: "Priority must be low, medium, or high" });
}
```

```js
const updatedWork = await prisma.work.update({
  where: { id },
  data: {
    title,
    type,
    status,
    priority,
    durationMinutes,
    notes,
    selectedLocationOptionId,
  },
  include: {
    locationOptions: {
      include: { locations: true },
    },
  },
});
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
npm test
```

Expected: all tests pass, including the five new ones.

- [ ] **Step 7: Lint, format, commit**

```bash
npm run lint
cd ../.. && npx prettier --check apps/api/prisma/schema.prisma apps/api/src/routes/work.js apps/api/test/work.test.js
```

Fix anything flagged, then:

```bash
git add apps/api/prisma/schema.prisma apps/api/src/routes/work.js apps/api/test/work.test.js
git commit -m "Add Work.priority, independent of its intent's priority"
```

---

### Task 2: `Plan`/`PlanStop`/`PlanStopWork` schema

**Files:**

- Modify: `apps/api/prisma/schema.prisma` (`Location` model, new `Plan`/`PlanStop`/`PlanStopWork` models)
- Modify: `apps/api/test-support/helpers.js`

**Interfaces:**

- Produces: `prisma.plan`, `prisma.planStop`, `prisma.planStopWork` Prisma
  Client models, with the fields and relations shown below — every later
  task relies on these exact field names.

- [ ] **Step 1: Add the models**

In `apps/api/prisma/schema.prisma`, add `planStops PlanStop[]` to the
existing `Location` model (find the model and add the line inside it, e.g.
right after its `locationOptions` field):

```prisma
model Location {
  // ...existing fields unchanged...
  locationOptions LocationOption[] @relation("LocationOptionLocations")
  planStops       PlanStop[]
}
```

Add `planStopWorks PlanStopWork[]` to the existing `Work` model (added in
Task 1), e.g. right after `dependedBy`:

```prisma
model Work {
  // ...existing fields from Task 1 unchanged...
  dependsOn               WorkDependency[] @relation("DependsOn")
  dependedBy              WorkDependency[] @relation("DependedBy")
  planStopWorks           PlanStopWork[]
}
```

Append three new models at the end of the file:

```prisma
model Plan {
  id                     String   @id @default(uuid())
  title                  String?
  status                 String   @default("draft") // draft, active, completed, abandoned

  startAt                DateTime
  startLabel             String?
  startLatitude          Float?
  startLongitude         Float?

  endAt                  DateTime
  endLabel               String?
  endLatitude            Float?
  endLongitude           Float?

  useAccurateTravelTime  Boolean  @default(false)

  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  stops                  PlanStop[]
}

model PlanStop {
  id                  String    @id @default(uuid())
  planId              String
  plan                Plan      @relation(fields: [planId], references: [id], onDelete: Cascade)

  locationId          String
  location            Location  @relation(fields: [locationId], references: [id])

  order               Int
  status              String    @default("planned") // planned, in_progress, done, skipped

  plannedArrivalAt    DateTime
  plannedDepartureAt  DateTime
  actualArrivalAt     DateTime?
  actualDepartureAt   DateTime?

  works               PlanStopWork[]
}

model PlanStopWork {
  id          String   @id @default(uuid())
  planStopId  String
  planStop    PlanStop @relation(fields: [planStopId], references: [id], onDelete: Cascade)

  workId      String
  work        Work     @relation(fields: [workId], references: [id])

  status      String   @default("planned") // planned, done, skipped

  @@unique([planStopId, workId])
}
```

- [ ] **Step 2: Push the schema and regenerate the client**

```bash
source ~/.nvm/nvm.sh && nvm use 20.19.3
cd apps/api
npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.` This also
regenerates `@prisma/client`'s types, so `prisma.plan`/`prisma.planStop`/
`prisma.planStopWork` become available.

- [ ] **Step 3: Update `cleanDatabase` for the new models**

`PlanStopWork` references `Work`, and `PlanStop` references `Location` —
both must be cleared before `work.deleteMany()`/`location.deleteMany()` run.
Edit `apps/api/test-support/helpers.js`:

```js
const prisma = require("../src/db/client");

async function cleanDatabase() {
  await prisma.planStopWork.deleteMany();
  await prisma.planStop.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.workDependency.deleteMany();
  await prisma.locationOption.deleteMany();
  await prisma.location.deleteMany();
  await prisma.context.deleteMany();
  await prisma.work.deleteMany();
  await prisma.intent.deleteMany();
}

module.exports = { cleanDatabase };
```

- [ ] **Step 4: Run the full existing test suite to confirm no regression**

```bash
npm test
```

Expected: every existing test still passes (79 passing before this task —
confirm the same count, or more if Task 1 already added tests).

- [ ] **Step 5: Lint, format, commit**

```bash
npm run lint
cd ../.. && npx prettier --check apps/api/prisma/schema.prisma apps/api/test-support/helpers.js
```

```bash
git add apps/api/prisma/schema.prisma apps/api/test-support/helpers.js
git commit -m "Add Plan, PlanStop, and PlanStopWork models"
```

---

### Task 3: `planBuilder.js` — scoring

**Files:**

- Create: `apps/api/src/services/planBuilder.js`
- Test: `apps/api/test/planBuilder.test.js`

**Interfaces:**

- Produces: `PRIORITY_POINTS` (`{low:1, medium:2, high:3}`), `scoreWork(work,
intent, now)` → `number`, `urgencyScore(dueDate, now)` → `number`. Later
  tasks in this module and `planPersistence.js` import these from
  `./planBuilder`.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/test/planBuilder.test.js`:

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  PRIORITY_POINTS,
  scoreWork,
  urgencyScore,
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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
source ~/.nvm/nvm.sh && nvm use 20.19.3
cd apps/api
npm test
```

Expected: `Cannot find module '../src/services/planBuilder'`.

- [ ] **Step 3: Write the implementation**

Create `apps/api/src/services/planBuilder.js`:

```js
const PRIORITY_POINTS = { low: 1, medium: 2, high: 3 };
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Urgency is judged by calendar day, not by exact elapsed hours — a due
// date of "today" should score as due-today at 8am and at 11pm alike.
function urgencyScore(dueDate, now) {
  if (!dueDate) return 0;

  const due = new Date(dueDate);
  const startOfDueDay = Date.UTC(
    due.getUTCFullYear(),
    due.getUTCMonth(),
    due.getUTCDate()
  );
  const startOfNowDay = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  const daysUntilDue = Math.round((startOfDueDay - startOfNowDay) / MS_PER_DAY);

  if (daysUntilDue < 0) return 6; // overdue
  if (daysUntilDue === 0) return 5; // due today
  if (daysUntilDue <= 3) return 3;
  if (daysUntilDue <= 7) return 1;
  return 0;
}

function priorityPoints(priority) {
  return PRIORITY_POINTS[priority] ?? PRIORITY_POINTS.medium;
}

// A work item's own priority counts double vs. its parent intent's — it's
// the more specific signal (a low-priority intent can still have one
// urgent errand in it).
function scoreWork(work, intent, now) {
  return (
    2 * priorityPoints(work?.priority) +
    priorityPoints(intent?.priority) +
    urgencyScore(intent?.dueDate, now)
  );
}

module.exports = { PRIORITY_POINTS, scoreWork, urgencyScore };
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test
```

Expected: all `planBuilder.test.js` tests pass.

- [ ] **Step 5: Lint, format, commit**

```bash
npm run lint
cd ../.. && npx prettier --check apps/api/src/services/planBuilder.js apps/api/test/planBuilder.test.js
```

```bash
git add apps/api/src/services/planBuilder.js apps/api/test/planBuilder.test.js
git commit -m "Add planBuilder work-item scoring"
```

---

### Task 4: `planBuilder.js` — travel time

**Files:**

- Modify: `apps/api/src/services/planBuilder.js`
- Test: `apps/api/test/planBuilder.test.js`

**Interfaces:**

- Consumes: nothing new.
- Produces: `haversineKm(a, b)` → `number | null`, `estimateTravelMinutes(a,
b)` → `number`. `a`/`b` are `{latitude, longitude}`-shaped points. Later
  tasks (`buildRoute`, `computeStopTimings`) call `estimateTravelMinutes`.

- [ ] **Step 1: Write the failing tests**

Append to `apps/api/test/planBuilder.test.js` (add `haversineKm,
estimateTravelMinutes` to the existing `require` destructure at the top):

```js
const {
  PRIORITY_POINTS,
  scoreWork,
  urgencyScore,
  haversineKm,
  estimateTravelMinutes,
} = require("../src/services/planBuilder");
```

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
source ~/.nvm/nvm.sh && nvm use 20.19.3
cd apps/api
npm test
```

Expected: `haversineKm is not a function` / `estimateTravelMinutes is not a
function`.

- [ ] **Step 3: Write the implementation**

Append to `apps/api/src/services/planBuilder.js` (before the `module.exports`
line):

```js
const EARTH_RADIUS_KM = 6371;
const DEFAULT_TRAVEL_MIN_PER_KM = 8;

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

// Straight-line distance — a deliberately rough estimate. Real road/traffic
// time is an explicit per-plan opt-in (Plan.useAccurateTravelTime), not
// implemented here; see the design spec's "Open items" section.
function haversineKm(a, b) {
  if (
    !a ||
    !b ||
    a.latitude == null ||
    a.longitude == null ||
    b.latitude == null ||
    b.longitude == null
  ) {
    return null;
  }

  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const radLatA = toRadians(a.latitude);
  const radLatB = toRadians(b.latitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);

  const h =
    sinLat * sinLat + Math.cos(radLatA) * Math.cos(radLatB) * sinLng * sinLng;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function estimateTravelMinutes(a, b) {
  const km = haversineKm(a, b);
  if (km === null) return 8;
  return Math.max(3, Math.round(km * DEFAULT_TRAVEL_MIN_PER_KM));
}
```

Update the `module.exports` line at the bottom:

```js
module.exports = {
  PRIORITY_POINTS,
  scoreWork,
  urgencyScore,
  haversineKm,
  estimateTravelMinutes,
};
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test
```

- [ ] **Step 5: Lint, format, commit**

```bash
npm run lint
cd ../.. && npx prettier --check apps/api/src/services/planBuilder.js apps/api/test/planBuilder.test.js
```

```bash
git add apps/api/src/services/planBuilder.js apps/api/test/planBuilder.test.js
git commit -m "Add planBuilder haversine travel-time estimate"
```

---

### Task 5: `planBuilder.js` — eligible work grouping

**Files:**

- Modify: `apps/api/src/services/planBuilder.js`
- Test: `apps/api/test/planBuilder.test.js`

**Interfaces:**

- Consumes: `scoreWork` (Task 3).
- Produces: `buildEligibleEntries(workItems, now, forceIncludeSet)` →
  `Array<{work, location, value}>`; `groupEntriesByLocation(entries)` →
  `Array<{location, entries, durationMinutes, value}>`. `workItems` is an
  array of Prisma `Work` rows each including `intent` and
  `locationOptions.locations` (the shape `prisma.work.findMany({include:
{intent: true, locationOptions: {include: {locations: true}}}})`
  produces). Task 6/7 consume both of these; the route/persistence layer
  (Task 8+) supplies `workItems` from a real Prisma query.

- [ ] **Step 1: Write the failing tests**

Append to `apps/api/test/planBuilder.test.js`, updating the top `require` to
add `buildEligibleEntries, groupEntriesByLocation`:

```js
const {
  PRIORITY_POINTS,
  scoreWork,
  urgencyScore,
  haversineKm,
  estimateTravelMinutes,
  buildEligibleEntries,
  groupEntriesByLocation,
} = require("../src/services/planBuilder");

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
```

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
source ~/.nvm/nvm.sh && nvm use 20.19.3
cd apps/api
npm test
```

Expected: `buildEligibleEntries is not a function` / `groupEntriesByLocation
is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `apps/api/src/services/planBuilder.js` (before `module.exports`):

```js
// Work items that are force-included (e.g. applying an AI-suggested
// variation) always win the greedy insertion's value-per-cost comparison,
// as long as they fit within the time budget at all — there's no sane way
// to "force" something into a schedule that has no room for it.
const FORCE_INCLUDE_VALUE_BOOST = 1_000_000;

// One entry per (work item, location) pair — a work item whose chosen
// option lists several locations produces several entries, one per
// location, matching how PlannerPage.jsx's routeStops grouping already
// treats "visit each of these places for this work" cases.
function buildEligibleEntries(workItems, now, forceIncludeSet) {
  const entries = [];

  for (const work of workItems) {
    const chosenOption =
      work.locationOptions?.find(
        (option) => option.id === work.selectedLocationOptionId
      ) || work.locationOptions?.[0];
    const locations = chosenOption?.locations || [];
    const value = forceIncludeSet.has(work.id)
      ? FORCE_INCLUDE_VALUE_BOOST
      : scoreWork(work, work.intent, now);

    for (const location of locations) {
      entries.push({ work, location, value });
    }
  }

  return entries;
}

// Groups entries by location — a stop's total duration/value is the sum
// across every work item bundled there.
function groupEntriesByLocation(entries) {
  const byLocationId = new Map();

  for (const entry of entries) {
    const existing = byLocationId.get(entry.location.id);
    const duration = entry.work.durationMinutes || 30;

    if (existing) {
      existing.entries.push(entry);
      existing.durationMinutes += duration;
      existing.value += entry.value;
    } else {
      byLocationId.set(entry.location.id, {
        location: entry.location,
        entries: [entry],
        durationMinutes: duration,
        value: entry.value,
      });
    }
  }

  return Array.from(byLocationId.values());
}
```

Update `module.exports`:

```js
module.exports = {
  PRIORITY_POINTS,
  scoreWork,
  urgencyScore,
  haversineKm,
  estimateTravelMinutes,
  buildEligibleEntries,
  groupEntriesByLocation,
};
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test
```

- [ ] **Step 5: Lint, format, commit**

```bash
npm run lint
cd ../.. && npx prettier --check apps/api/src/services/planBuilder.js apps/api/test/planBuilder.test.js
```

```bash
git add apps/api/src/services/planBuilder.js apps/api/test/planBuilder.test.js
git commit -m "Add planBuilder eligible-work grouping"
```

---

### Task 6: `planBuilder.js` — greedy cheapest-insertion (`buildRoute`)

**Files:**

- Modify: `apps/api/src/services/planBuilder.js`
- Test: `apps/api/test/planBuilder.test.js`

**Interfaces:**

- Consumes: `estimateTravelMinutes` (Task 4).
- Produces: `buildRoute(candidateStops, start, end, budgetMinutes)` →
  `Array<candidateStop>` (a subset of `candidateStops`, in visiting order).
  `start`/`end` are `{latitude, longitude}` points; `budgetMinutes` is the
  total time available, start to end. Task 7's `buildPlan` calls this.

- [ ] **Step 1: Write the failing tests**

Append to `apps/api/test/planBuilder.test.js`, adding `buildRoute` to the
top `require`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
source ~/.nvm/nvm.sh && nvm use 20.19.3
cd apps/api
npm test
```

Expected: `buildRoute is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `apps/api/src/services/planBuilder.js` (before `module.exports`):

```js
function routeTotalMinutes(route, start, end) {
  let total = 0;
  let previous = start;

  for (const stop of route) {
    total +=
      estimateTravelMinutes(previous, stop.location) + stop.durationMinutes;
    previous = stop.location;
  }

  return total + estimateTravelMinutes(previous, end);
}

// Greedy cheapest-insertion heuristic for the "orienteering problem"
// (prize-collecting routing under a time budget): repeatedly insert
// whichever remaining candidate stop has the best value-per-added-cost
// ratio, at whichever position in the current route adds the least travel
// time, as long as the whole route still fits the budget. Not optimal, but
// fast, deterministic, and easy to reason about — acceptable at the scale
// of a personal day-planner (tens of stops, not thousands).
function buildRoute(candidateStops, start, end, budgetMinutes) {
  let route = [];
  let remaining = [...candidateStops];

  while (remaining.length > 0) {
    let best = null;

    for (const candidate of remaining) {
      for (let position = 0; position <= route.length; position += 1) {
        const trialRoute = [
          ...route.slice(0, position),
          candidate,
          ...route.slice(position),
        ];
        const totalMinutes = routeTotalMinutes(trialRoute, start, end);
        if (totalMinutes > budgetMinutes) continue;

        const insertionCost =
          totalMinutes - routeTotalMinutes(route, start, end);
        const ratio = candidate.value / Math.max(1, insertionCost);

        if (!best || ratio > best.ratio) {
          best = { candidate, position, ratio };
        }
      }
    }

    if (!best) break;

    route = [
      ...route.slice(0, best.position),
      best.candidate,
      ...route.slice(best.position),
    ];
    remaining = remaining.filter((stop) => stop !== best.candidate);
  }

  return route;
}
```

Update `module.exports` to add `buildRoute`.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test
```

- [ ] **Step 5: Lint, format, commit**

```bash
npm run lint
cd ../.. && npx prettier --check apps/api/src/services/planBuilder.js apps/api/test/planBuilder.test.js
```

```bash
git add apps/api/src/services/planBuilder.js apps/api/test/planBuilder.test.js
git commit -m "Add planBuilder greedy cheapest-insertion routing"
```

---

### Task 7: `planBuilder.js` — timing and top-level `buildPlan`

**Files:**

- Modify: `apps/api/src/services/planBuilder.js`
- Test: `apps/api/test/planBuilder.test.js`

**Interfaces:**

- Consumes: `buildEligibleEntries`, `groupEntriesByLocation` (Task 5),
  `buildRoute`, `estimateTravelMinutes` (Task 4/6).
- Produces: `computeStopTimings(route, start, startAt)` →
  `Array<candidateStop & {plannedArrivalAt: Date, plannedDepartureAt:
Date}>`; `buildPlan({workItems, start, end, startAt, endAt,
forceIncludeWorkIds, forceExcludeWorkIds, now})` →
  `{stops: Array<timedStop>, unselectedWork: Array<Work>}`. This is the
  single entry point `planPersistence.js` (Task 8) calls.

- [ ] **Step 1: Write the failing tests**

Append to `apps/api/test/planBuilder.test.js`, adding `computeStopTimings,
buildPlan` to the top `require`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
source ~/.nvm/nvm.sh && nvm use 20.19.3
cd apps/api
npm test
```

Expected: `computeStopTimings is not a function` / `buildPlan is not a
function`.

- [ ] **Step 3: Write the implementation**

Append to `apps/api/src/services/planBuilder.js` (before `module.exports`):

```js
const MINUTE_MS = 60000;

function computeStopTimings(route, start, startAt) {
  let previous = start;
  let cursor = new Date(startAt);

  return route.map((stop) => {
    const travelMinutes = estimateTravelMinutes(previous, stop.location);
    const plannedArrivalAt = new Date(
      cursor.getTime() + travelMinutes * MINUTE_MS
    );
    const plannedDepartureAt = new Date(
      plannedArrivalAt.getTime() + stop.durationMinutes * MINUTE_MS
    );

    previous = stop.location;
    cursor = plannedDepartureAt;

    return { ...stop, plannedArrivalAt, plannedDepartureAt };
  });
}

// The single entry point: scores eligible work, groups it into candidate
// stops, greedily fits as much as possible into the start->end time budget,
// and returns the selected+timed stops plus whatever didn't make the cut.
function buildPlan({
  workItems,
  start,
  end,
  startAt,
  endAt,
  forceIncludeWorkIds = [],
  forceExcludeWorkIds = [],
  now = new Date(),
}) {
  const budgetMinutes = Math.max(
    0,
    Math.round(
      (new Date(endAt).getTime() - new Date(startAt).getTime()) / MINUTE_MS
    )
  );
  const excludeSet = new Set(forceExcludeWorkIds);
  const includeSet = new Set(forceIncludeWorkIds);

  const eligibleWork = workItems.filter(
    (work) => work.status !== "done" && !excludeSet.has(work.id)
  );
  const entries = buildEligibleEntries(eligibleWork, now, includeSet);
  const candidateStops = groupEntriesByLocation(entries);
  const route = buildRoute(candidateStops, start, end, budgetMinutes);
  const stops = computeStopTimings(route, start, startAt);

  const selectedWorkIds = new Set(
    stops.flatMap((stop) => stop.entries.map((entry) => entry.work.id))
  );
  const unselectedWork = eligibleWork.filter(
    (work) => !selectedWorkIds.has(work.id)
  );

  return { stops, unselectedWork };
}
```

Update `module.exports`:

```js
module.exports = {
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
};
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test
```

Expected: all `planBuilder.test.js` tests pass (20+ tests across Tasks
3–7).

- [ ] **Step 5: Lint, format, commit**

```bash
npm run lint
cd ../.. && npx prettier --check apps/api/src/services/planBuilder.js apps/api/test/planBuilder.test.js
```

```bash
git add apps/api/src/services/planBuilder.js apps/api/test/planBuilder.test.js
git commit -m "Add planBuilder timing and top-level buildPlan orchestration"
```

---

### Task 8: `planPersistence.js` — `rebuildPlanStops`

**Files:**

- Create: `apps/api/src/services/planPersistence.js`
- Test: `apps/api/test/planPersistence.test.js`

**Interfaces:**

- Consumes: `buildPlan` (Task 7).
- Produces: `rebuildPlanStops(prisma, planId, {asOfAt, asOfLocation,
forceIncludeWorkIds, forceExcludeWorkIds})` →
  `Promise<{plan, unselectedWork} | null>` (`null` when `planId` doesn't
  exist). `plan` is the full `Plan` row with `stops` (ordered, each
  including `location` and `works.work`). Tasks 9–13's routes call this for
  every create/rebuild/recheck operation.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/test/planPersistence.test.js`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
source ~/.nvm/nvm.sh && nvm use 20.19.3
cd apps/api
npm test
```

Expected: `Cannot find module '../src/services/planPersistence'`.

- [ ] **Step 3: Write the implementation**

Create `apps/api/src/services/planPersistence.js`:

```js
const { buildPlan } = require("./planBuilder");

const RESOLVED_STOP_STATUSES = new Set(["done", "skipped"]);

const PLAN_STOP_INCLUDE = {
  location: true,
  works: { include: { work: true } },
};

function loadEligibleWork(client) {
  return client.work.findMany({
    where: { status: { not: "done" } },
    include: {
      intent: true,
      locationOptions: { include: { locations: true } },
    },
  });
}

// Rebuilds a plan's not-yet-resolved stops from the current pool of
// eligible work, leaving any stop already marked done/skipped completely
// untouched — and excluding the work items handled at those frozen stops
// from being reconsidered, so a plan never flip-flops on what it already
// resolved. Runs as one transaction so a partial rebuild can never land
// half-written.
async function rebuildPlanStops(
  prisma,
  planId,
  { asOfAt, asOfLocation, forceIncludeWorkIds = [], forceExcludeWorkIds = [] }
) {
  return prisma.$transaction(async (tx) => {
    const plan = await tx.plan.findUnique({
      where: { id: planId },
      include: { stops: { include: { works: true } } },
    });
    if (!plan) return null;

    const frozenStops = plan.stops.filter((stop) =>
      RESOLVED_STOP_STATUSES.has(stop.status)
    );
    const resolvedWorkIds = frozenStops.flatMap((stop) =>
      stop.works.map((work) => work.workId)
    );

    const staleStopIds = plan.stops
      .filter((stop) => !RESOLVED_STOP_STATUSES.has(stop.status))
      .map((stop) => stop.id);
    if (staleStopIds.length > 0) {
      await tx.planStop.deleteMany({ where: { id: { in: staleStopIds } } });
    }

    const workItems = await loadEligibleWork(tx);
    const { stops, unselectedWork } = buildPlan({
      workItems,
      start: asOfLocation,
      end: { latitude: plan.endLatitude, longitude: plan.endLongitude },
      startAt: asOfAt,
      endAt: plan.endAt,
      forceIncludeWorkIds,
      forceExcludeWorkIds: [...forceExcludeWorkIds, ...resolvedWorkIds],
      now: asOfAt,
    });

    let order = frozenStops.length;
    for (const stop of stops) {
      const uniqueWorkIds = [
        ...new Set(stop.entries.map((entry) => entry.work.id)),
      ];
      await tx.planStop.create({
        data: {
          planId,
          locationId: stop.location.id,
          order,
          plannedArrivalAt: stop.plannedArrivalAt,
          plannedDepartureAt: stop.plannedDepartureAt,
          works: { create: uniqueWorkIds.map((workId) => ({ workId })) },
        },
      });
      order += 1;
    }

    const refreshedPlan = await tx.plan.findUnique({
      where: { id: planId },
      include: {
        stops: { orderBy: { order: "asc" }, include: PLAN_STOP_INCLUDE },
      },
    });

    return { plan: refreshedPlan, unselectedWork };
  });
}

module.exports = { rebuildPlanStops, loadEligibleWork, PLAN_STOP_INCLUDE };
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test
```

- [ ] **Step 5: Lint, format, commit**

```bash
npm run lint
cd ../.. && npx prettier --check apps/api/src/services/planPersistence.js apps/api/test/planPersistence.test.js
```

```bash
git add apps/api/src/services/planPersistence.js apps/api/test/planPersistence.test.js
git commit -m "Add planPersistence.rebuildPlanStops"
```

---

### Task 9: `routes/plans.js` — create, list, get

**Files:**

- Create: `apps/api/src/routes/plans.js`
- Modify: `apps/api/src/app.js`
- Test: `apps/api/test/plans.test.js`

**Interfaces:**

- Consumes: `rebuildPlanStops`, `PLAN_STOP_INCLUDE` (Task 8).
- Produces: `POST /api/plans`, `GET /api/plans`, `GET /api/plans/:id`.
  Later tasks add more handlers to the same router (exported as `router`
  from this file).

- [ ] **Step 1: Write the failing tests**

Create `apps/api/test/plans.test.js`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
source ~/.nvm/nvm.sh && nvm use 20.19.3
cd apps/api
npm test
```

Expected: every request 404s (no `/api/plans` route mounted yet).

- [ ] **Step 3: Write the implementation**

Create `apps/api/src/routes/plans.js`:

```js
const express = require("express");
const prisma = require("../db/client");
const {
  rebuildPlanStops,
  PLAN_STOP_INCLUDE,
} = require("../services/planPersistence");

const router = express.Router();

// Create a new plan and immediately build its stops.
router.post("/", async (req, res) => {
  try {
    const {
      title,
      startAt,
      startLabel,
      startLatitude,
      startLongitude,
      endAt,
      endLabel,
      endLatitude,
      endLongitude,
      useAccurateTravelTime,
    } = req.body;

    if (!startAt || !endAt) {
      return res.status(400).json({ error: "startAt and endAt are required" });
    }
    if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
      return res.status(400).json({ error: "endAt must be after startAt" });
    }

    const plan = await prisma.plan.create({
      data: {
        title,
        startAt: new Date(startAt),
        startLabel,
        startLatitude,
        startLongitude,
        endAt: new Date(endAt),
        endLabel,
        endLatitude,
        endLongitude,
        useAccurateTravelTime: Boolean(useAccurateTravelTime),
      },
    });

    const { plan: builtPlan } = await rebuildPlanStops(prisma, plan.id, {
      asOfAt: plan.startAt,
      asOfLocation: {
        latitude: plan.startLatitude,
        longitude: plan.startLongitude,
      },
    });

    res.status(201).json(builtPlan);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create plan" });
  }
});

// List every plan.
router.get("/", async (req, res) => {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        stops: { orderBy: { order: "asc" }, include: PLAN_STOP_INCLUDE },
      },
    });
    res.json(plans);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch plans" });
  }
});

// Get one plan's full detail.
router.get("/:id", async (req, res) => {
  try {
    const plan = await prisma.plan.findUnique({
      where: { id: req.params.id },
      include: {
        stops: { orderBy: { order: "asc" }, include: PLAN_STOP_INCLUDE },
      },
    });
    if (!plan) {
      return res.status(404).json({ error: "Plan not found" });
    }
    res.json(plan);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch plan" });
  }
});

module.exports = router;
```

Mount it in `apps/api/src/app.js`:

```js
const intentsRouter = require("./routes/intents");
const workRouter = require("./routes/work");
const aiRouter = require("./routes/ai");
const plansRouter = require("./routes/plans");

app.use("/api/intents", intentsRouter);
app.use("/api/work", workRouter);
app.use("/api/ai", aiRouter);
app.use("/api/plans", plansRouter);
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test
```

- [ ] **Step 5: Lint, format, commit**

```bash
npm run lint
cd ../.. && npx prettier --check apps/api/src/routes/plans.js apps/api/src/app.js apps/api/test/plans.test.js
```

```bash
git add apps/api/src/routes/plans.js apps/api/src/app.js apps/api/test/plans.test.js
git commit -m "Add POST/GET /api/plans and GET /api/plans/:id"
```

---

### Task 10: `routes/plans.js` — update, rebuild, delete

**Files:**

- Modify: `apps/api/src/routes/plans.js`
- Test: `apps/api/test/plans.test.js`

**Interfaces:**

- Consumes: `rebuildPlanStops`, `PLAN_STOP_INCLUDE` (Task 8).
- Produces: `PATCH /api/plans/:id`, `DELETE /api/plans/:id`.

- [ ] **Step 1: Write the failing tests**

Append to `apps/api/test/plans.test.js`:

```js
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
            create: { name: "Far shop", latitude: 5, longitude: 0 },
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
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
source ~/.nvm/nvm.sh && nvm use 20.19.3
cd apps/api
npm test
```

Expected: `PATCH`/`DELETE` requests 404 (no handlers registered for those
methods on `/api/plans/:id` yet).

- [ ] **Step 3: Write the implementation**

Add to `apps/api/src/routes/plans.js`, after the `GET "/:id"` handler and
before `module.exports`:

```js
const VALID_PLAN_STATUSES = new Set([
  "draft",
  "active",
  "completed",
  "abandoned",
]);

// Update a plan's fields. Changing the time window or activating it
// triggers a rebuild of every not-yet-resolved stop; so does passing
// forceIncludeWorkIds/forceExcludeWorkIds (used when applying an
// AI-suggested variation, or a manual add/exclude from the UI).
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      startAt,
      startLabel,
      startLatitude,
      startLongitude,
      endAt,
      endLabel,
      endLatitude,
      endLongitude,
      useAccurateTravelTime,
      status,
      forceIncludeWorkIds,
      forceExcludeWorkIds,
    } = req.body;

    if (status !== undefined && !VALID_PLAN_STATUSES.has(status)) {
      return res.status(400).json({ error: "Invalid plan status" });
    }

    const existingPlan = await prisma.plan.findUnique({ where: { id } });
    if (!existingPlan) {
      return res.status(404).json({ error: "Plan not found" });
    }

    const timingChanged = startAt !== undefined || endAt !== undefined;
    const activating = status === "active" && existingPlan.status !== "active";
    const shouldRebuild =
      timingChanged || activating || forceIncludeWorkIds || forceExcludeWorkIds;

    await prisma.plan.update({
      where: { id },
      data: {
        title,
        startAt: startAt !== undefined ? new Date(startAt) : undefined,
        startLabel,
        startLatitude,
        startLongitude,
        endAt: endAt !== undefined ? new Date(endAt) : undefined,
        endLabel,
        endLatitude,
        endLongitude,
        useAccurateTravelTime,
        status,
      },
    });

    if (!shouldRebuild) {
      const plan = await prisma.plan.findUnique({
        where: { id },
        include: {
          stops: { orderBy: { order: "asc" }, include: PLAN_STOP_INCLUDE },
        },
      });
      return res.json(plan);
    }

    const refreshedPlan = await prisma.plan.findUnique({ where: { id } });
    const { plan: rebuiltPlan } = await rebuildPlanStops(prisma, id, {
      asOfAt: refreshedPlan.startAt,
      asOfLocation: {
        latitude: refreshedPlan.startLatitude,
        longitude: refreshedPlan.startLongitude,
      },
      forceIncludeWorkIds: forceIncludeWorkIds || [],
      forceExcludeWorkIds: forceExcludeWorkIds || [],
    });

    res.json(rebuiltPlan);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update plan" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const existingPlan = await prisma.plan.findUnique({
      where: { id: req.params.id },
    });
    if (!existingPlan) {
      return res.status(404).json({ error: "Plan not found" });
    }
    await prisma.plan.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete plan" });
  }
});
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test
```

- [ ] **Step 5: Lint, format, commit**

```bash
npm run lint
cd ../.. && npx prettier --check apps/api/src/routes/plans.js apps/api/test/plans.test.js
```

```bash
git add apps/api/src/routes/plans.js apps/api/test/plans.test.js
git commit -m "Add PATCH/DELETE /api/plans/:id with rebuild-on-change"
```

---

### Task 11: `routes/plans.js` — stop and work-item status transitions

**Files:**

- Modify: `apps/api/src/routes/plans.js`
- Test: `apps/api/test/plans.test.js`

**Interfaces:**

- Produces: `PATCH /api/plans/:id/stops/:stopId`, `PATCH
/api/plans/:id/stops/:stopId/work/:workId`.

- [ ] **Step 1: Write the failing tests**

Append to `apps/api/test/plans.test.js`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
source ~/.nvm/nvm.sh && nvm use 20.19.3
cd apps/api
npm test
```

Expected: every new request 404s (routes don't exist yet).

- [ ] **Step 3: Write the implementation**

Add to `apps/api/src/routes/plans.js`, before `module.exports`:

```js
const VALID_STOP_STATUSES = new Set([
  "planned",
  "in_progress",
  "done",
  "skipped",
]);
const VALID_PLAN_STOP_WORK_STATUSES = new Set(["planned", "done", "skipped"]);

router.patch("/:id/stops/:stopId", async (req, res) => {
  try {
    const { id, stopId } = req.params;
    const { status, actualArrivalAt, actualDepartureAt } = req.body;

    if (status !== undefined && !VALID_STOP_STATUSES.has(status)) {
      return res.status(400).json({ error: "Invalid stop status" });
    }

    const stop = await prisma.planStop.findFirst({
      where: { id: stopId, planId: id },
    });
    if (!stop) {
      return res.status(404).json({ error: "Plan stop not found" });
    }

    const updatedStop = await prisma.planStop.update({
      where: { id: stopId },
      data: {
        status,
        actualArrivalAt:
          actualArrivalAt !== undefined ? new Date(actualArrivalAt) : undefined,
        actualDepartureAt:
          actualDepartureAt !== undefined
            ? new Date(actualDepartureAt)
            : undefined,
      },
      include: PLAN_STOP_INCLUDE,
    });

    res.json(updatedStop);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update plan stop" });
  }
});

// Marking a work item done syncs Work.status to "done" — but only once
// every PlanStopWork row for that same work item, in this same plan, is no
// longer "planned". A work item legitimately spanning two stops (its
// chosen option lists two locations) must not be marked done after just
// the first stop.
router.patch("/:id/stops/:stopId/work/:workId", async (req, res) => {
  try {
    const { id, stopId, workId } = req.params;
    const { status } = req.body;

    if (!VALID_PLAN_STOP_WORK_STATUSES.has(status)) {
      return res.status(400).json({ error: "Invalid work status" });
    }

    const planStopWork = await prisma.planStopWork.findFirst({
      where: { workId, planStop: { id: stopId, planId: id } },
    });
    if (!planStopWork) {
      return res.status(404).json({ error: "Plan stop work item not found" });
    }

    const updated = await prisma.planStopWork.update({
      where: { id: planStopWork.id },
      data: { status },
      include: { work: true },
    });

    if (status === "done") {
      const otherOpenAssignments = await prisma.planStopWork.count({
        where: {
          workId,
          planStop: { planId: id },
          status: "planned",
          id: { not: planStopWork.id },
        },
      });
      if (otherOpenAssignments === 0) {
        await prisma.work.update({
          where: { id: workId },
          data: { status: "done" },
        });
      }
    }

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update plan stop work item" });
  }
});
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test
```

- [ ] **Step 5: Lint, format, commit**

```bash
npm run lint
cd ../.. && npx prettier --check apps/api/src/routes/plans.js apps/api/test/plans.test.js
```

```bash
git add apps/api/src/routes/plans.js apps/api/test/plans.test.js
git commit -m "Add plan stop and work-item status transitions"
```

---

### Task 12: `services/planVariations.js` + `POST /api/ai/plan-variations`

**Files:**

- Create: `apps/api/src/services/planVariations.js`
- Modify: `apps/api/src/routes/ai.js`
- Test: `apps/api/test/ai.test.js`

**Interfaces:**

- Consumes: `callGroqJson`, `isGroqConfigured`, `sendGroqError` (existing,
  from `apps/api/src/services/groqClient.js`).
- Produces: `buildPlanVariations({selectedWork, unselectedWork,
budgetMinutes})` → `Promise<Array<{addWorkIds, removeWorkIds,
reasoning}>>`. Both the new `POST /api/ai/plan-variations` route (this
  task) and Task 13's `POST /api/plans/:id/recheck` call this directly (an
  in-process function call, not an HTTP round-trip) — that's why it's a
  separate service module rather than logic inlined in `routes/ai.js`.
  `selectedWork`/`unselectedWork` are arrays of `{id, title, priority,
intent: {priority, dueDate} | null}`.

- [ ] **Step 1: Write the failing tests**

Append to `apps/api/test/ai.test.js` (after the existing `optimize-route`
tests, following the same `mockFetchOnce` pattern used throughout this
file):

```js
test("POST /api/ai/plan-variations returns 503 when GROQ_API_KEY is not configured", async () => {
  delete process.env.GROQ_API_KEY;

  const response = await request(app)
    .post("/api/ai/plan-variations")
    .send({ selectedWork: [], unselectedWork: [], budgetMinutes: 60 });

  assert.equal(response.statusCode, 503);
});

test("POST /api/ai/plan-variations requires selectedWork and unselectedWork arrays", async () => {
  const response = await request(app).post("/api/ai/plan-variations").send({});

  assert.equal(response.statusCode, 400);
});

test("POST /api/ai/plan-variations sanitizes ids the model invented or that aren't in the given pools", async () => {
  const restoreFetch = mockFetchOnce(async () => ({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              variations: [
                {
                  addWorkIds: ["unselected-1", "invented-id"],
                  removeWorkIds: ["selected-1", "invented-id-2"],
                  reasoning: "Swap in the overdue errand.",
                },
              ],
            }),
          },
        },
      ],
    }),
  }));

  try {
    const response = await request(app)
      .post("/api/ai/plan-variations")
      .send({
        selectedWork: [
          { id: "selected-1", title: "Buy groceries", priority: "low" },
        ],
        unselectedWork: [
          { id: "unselected-1", title: "Renew passport", priority: "high" },
        ],
        budgetMinutes: 60,
      });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.variations.length, 1);
    assert.deepEqual(response.body.variations[0].addWorkIds, ["unselected-1"]);
    assert.deepEqual(response.body.variations[0].removeWorkIds, ["selected-1"]);
    assert.equal(
      response.body.variations[0].reasoning,
      "Swap in the overdue errand."
    );
  } finally {
    restoreFetch();
  }
});

test("POST /api/ai/plan-variations drops a variation that ends up with nothing to add", async () => {
  const restoreFetch = mockFetchOnce(async () => ({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              variations: [
                {
                  addWorkIds: ["invented"],
                  removeWorkIds: [],
                  reasoning: "n/a",
                },
              ],
            }),
          },
        },
      ],
    }),
  }));

  try {
    const response = await request(app)
      .post("/api/ai/plan-variations")
      .send({
        selectedWork: [],
        unselectedWork: [
          { id: "real-1", title: "Renew passport", priority: "high" },
        ],
        budgetMinutes: 60,
      });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.variations, []);
  } finally {
    restoreFetch();
  }
});

test("POST /api/ai/plan-variations caps variations at 2", async () => {
  const restoreFetch = mockFetchOnce(async () => ({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              variations: [
                { addWorkIds: ["u1"], removeWorkIds: [], reasoning: "one" },
                { addWorkIds: ["u1"], removeWorkIds: [], reasoning: "two" },
                { addWorkIds: ["u1"], removeWorkIds: [], reasoning: "three" },
              ],
            }),
          },
        },
      ],
    }),
  }));

  try {
    const response = await request(app)
      .post("/api/ai/plan-variations")
      .send({
        selectedWork: [],
        unselectedWork: [
          { id: "u1", title: "Renew passport", priority: "high" },
        ],
        budgetMinutes: 60,
      });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.variations.length, 2);
  } finally {
    restoreFetch();
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
source ~/.nvm/nvm.sh && nvm use 20.19.3
cd apps/api
npm test
```

Expected: every request 404s (no `/plan-variations` route yet).

- [ ] **Step 3: Write `planVariations.js`**

Create `apps/api/src/services/planVariations.js`:

```js
const { callGroqJson, isGroqConfigured } = require("./groqClient");

const PLAN_VARIATIONS_SYSTEM_PROMPT = `You suggest trade-offs for a day plan that is short on time.

Rules:
- You are given the work items currently scheduled ("selected") and the ones that didn't fit ("unselected"), each with its priority, its intent's priority, and due date.
- Suggest at most 2 variations. Each variation names some currently-unselected work item ids to add and some currently-selected work item ids to remove, trading lower-value items for higher-value ones that don't currently fit.
- Only suggest a variation that plausibly improves the plan (e.g. swapping in something overdue or due today for something low-priority with no due date).
- reasoning is one short sentence per variation explaining the trade-off.
- Never invent work item ids that weren't given to you.

Respond with ONLY a JSON object of this exact shape, no other text:
{"variations": [{"addWorkIds": [string], "removeWorkIds": [string], "reasoning": string}]}`;

function summarizeWork(work) {
  return `- id: ${work.id}, title: ${work.title}, priority: ${work.priority}, intentPriority: ${work.intent?.priority || "medium"}, dueDate: ${work.intent?.dueDate || "none"}`;
}

function buildPlanVariationsUserPrompt(
  selectedWork,
  unselectedWork,
  budgetMinutes
) {
  return [
    `Time budget: ${budgetMinutes} minutes`,
    "Currently selected:",
    ...(selectedWork.length ? selectedWork.map(summarizeWork) : ["- none"]),
    "Currently unselected (didn't fit):",
    ...(unselectedWork.length ? unselectedWork.map(summarizeWork) : ["- none"]),
  ].join("\n");
}

function sanitizePlanVariations(parsed, selectedIds, unselectedIds) {
  if (!Array.isArray(parsed?.variations)) return [];

  return parsed.variations
    .slice(0, 2)
    .map((variation) => ({
      addWorkIds: Array.isArray(variation?.addWorkIds)
        ? variation.addWorkIds.filter((id) => unselectedIds.has(id))
        : [],
      removeWorkIds: Array.isArray(variation?.removeWorkIds)
        ? variation.removeWorkIds.filter((id) => selectedIds.has(id))
        : [],
      reasoning:
        typeof variation?.reasoning === "string" && variation.reasoning.trim()
          ? variation.reasoning.trim().slice(0, 300)
          : null,
    }))
    .filter((variation) => variation.addWorkIds.length > 0);
}

// Asks an LLM for 1-2 alternative work-item swaps for a plan that's short
// on time. The model only ever chooses *which* work item ids to swap,
// never times or ordering — the caller re-runs the deterministic builder
// (via PATCH /api/plans/:id's forceIncludeWorkIds/forceExcludeWorkIds) to
// get a concrete, trustworthy schedule for whichever variation is applied.
async function buildPlanVariations({
  selectedWork,
  unselectedWork,
  budgetMinutes,
}) {
  if (!isGroqConfigured() || unselectedWork.length === 0) return [];

  const selectedIds = new Set(selectedWork.map((work) => work.id));
  const unselectedIds = new Set(unselectedWork.map((work) => work.id));

  const parsed = await callGroqJson({
    systemPrompt: PLAN_VARIATIONS_SYSTEM_PROMPT,
    userPrompt: buildPlanVariationsUserPrompt(
      selectedWork,
      unselectedWork,
      budgetMinutes
    ),
  });

  return sanitizePlanVariations(parsed, selectedIds, unselectedIds);
}

module.exports = { buildPlanVariations, sanitizePlanVariations };
```

- [ ] **Step 4: Wire the route in `ai.js`**

In `apps/api/src/routes/ai.js`, add the import near the top (with the other
`require`s):

```js
const { buildPlanVariations } = require("../services/planVariations");
```

Add the route at the end of the file, right before `module.exports =
router;`:

```js
// Ask an LLM for alternative work-item swaps when a plan is short on time.
// Purely advisory — applying one is a separate PATCH /api/plans/:id call
// that reruns the real deterministic scheduler.
router.post("/plan-variations", async (req, res) => {
  if (!isGroqConfigured()) {
    return res
      .status(503)
      .json({ error: "AI features are not configured on this server." });
  }

  const { selectedWork, unselectedWork, budgetMinutes } = req.body;
  if (!Array.isArray(selectedWork) || !Array.isArray(unselectedWork)) {
    return res
      .status(400)
      .json({ error: "selectedWork and unselectedWork are required" });
  }

  try {
    const variations = await buildPlanVariations({
      selectedWork,
      unselectedWork,
      budgetMinutes: Number(budgetMinutes) || 0,
    });
    res.json({ variations });
  } catch (error) {
    const handled = sendGroqError(res, error);
    if (handled) return handled;

    console.error("Failed to build plan variations", error);
    res.status(500).json({ error: "Failed to build plan variations" });
  }
});
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npm test
```

- [ ] **Step 6: Lint, format, commit**

```bash
npm run lint
cd ../.. && npx prettier --check apps/api/src/services/planVariations.js apps/api/src/routes/ai.js apps/api/test/ai.test.js
```

```bash
git add apps/api/src/services/planVariations.js apps/api/src/routes/ai.js apps/api/test/ai.test.js
git commit -m "Add plan-variations AI suggestion route"
```

---

### Task 13: `POST /api/plans/:id/recheck`

**Files:**

- Modify: `apps/api/src/routes/plans.js`
- Test: `apps/api/test/plans.test.js`

**Interfaces:**

- Consumes: `rebuildPlanStops` (Task 8), `buildPlanVariations` (Task 12).
- Produces: `POST /api/plans/:id/recheck` → `{plan, variations}`.

- [ ] **Step 1: Write the failing tests**

Append to `apps/api/test/plans.test.js`:

```js
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
          locations: { create: { name: "Shop", latitude: 1, longitude: 1 } },
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
      latitude: 1,
      longitude: 1,
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
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
source ~/.nvm/nvm.sh && nvm use 20.19.3
cd apps/api
npm test
```

Expected: both requests 404 (no `/recheck` route yet).

- [ ] **Step 3: Write the implementation**

Add to `apps/api/src/routes/plans.js`. First, add the import at the top:

```js
const { buildPlanVariations } = require("../services/planVariations");
```

Add the route before `module.exports`:

```js
router.post("/:id/recheck", async (req, res) => {
  try {
    const { id } = req.params;
    const { asOfAt, latitude, longitude, label } = req.body;

    const existingPlan = await prisma.plan.findUnique({ where: { id } });
    if (!existingPlan) {
      return res.status(404).json({ error: "Plan not found" });
    }

    const asOf = asOfAt ? new Date(asOfAt) : new Date();
    const result = await rebuildPlanStops(prisma, id, {
      asOfAt: asOf,
      asOfLocation: { latitude, longitude, label },
    });

    let variations = [];
    if (result.unselectedWork.length > 0) {
      const selectedWork = result.plan.stops.flatMap((stop) =>
        stop.works.map((assignment) => assignment.work)
      );
      const budgetMinutes = Math.max(
        0,
        Math.round(
          (new Date(result.plan.endAt).getTime() - asOf.getTime()) / 60000
        )
      );

      try {
        variations = await buildPlanVariations({
          selectedWork,
          unselectedWork: result.unselectedWork,
          budgetMinutes,
        });
      } catch (error) {
        console.error("Failed to fetch plan variations during recheck", error);
      }
    }

    res.json({ plan: result.plan, variations });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to recheck plan" });
  }
});
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test
```

Expected: all tests in `plans.test.js`, `ai.test.js`, `planBuilder.test.js`,
and `planPersistence.test.js` pass, alongside every pre-existing test.

- [ ] **Step 5: Full verification before opening the PR**

```bash
source ~/.nvm/nvm.sh && nvm use 20.19.3
cd apps/api
npm run lint
npm test
cd ../../
npx prettier --check apps/api
```

Fix anything flagged. This is the last task in this plan — once everything
is green:

```bash
git add apps/api/src/routes/plans.js apps/api/test/plans.test.js
git commit -m "Add POST /api/plans/:id/recheck"
git push -u origin feat/plan-based-planner-backend
```

```bash
gh pr create --title "Add plan-based planner backend" --body "$(cat <<'EOF'
## Summary
- Adds Work.priority, the Plan/PlanStop/PlanStopWork schema, a deterministic
  greedy-insertion scheduling algorithm (planBuilder.js), and the full
  /api/plans REST surface (create+build, list, get, update+rebuild, delete,
  recheck, stop/work status transitions).
- Adds POST /api/ai/plan-variations, an advisory route suggesting work-item
  swaps for a time-constrained plan.
- No frontend changes — see docs/superpowers/specs/2026-08-22-plan-based-planner-design.md
  and the companion frontend plan.

## Test plan
- [x] npm test (apps/api) — all passing
- [x] npm run lint (apps/api) — clean
- [x] npx prettier --check apps/api — clean
EOF
)"
```

```bash
gh pr checks <N> --watch
```

Once green:

```bash
gh pr merge <N> --squash --delete-branch
git checkout main
git pull
```

---

## Self-Review Notes

- **Spec coverage:** §2 (scope decisions) → Tasks 1, 2, 7, 8, 10. §3 (data
  model) → Tasks 1, 2. §4 (algorithm) → Tasks 3–7. §5 (AI variations) →
  Task 12. §6 (API surface) → Tasks 1, 9–13. §8 (testing) → every task's
  test file matches the spec's named files (`planBuilder.js`,
  `plans.test.js`, `ai.test.js` additions). §9 (open items) —
  `GOOGLE_MAPS_SERVER_API_KEY`/`useAccurateTravelTime` is explicitly out of
  scope for this plan (the field exists and is accepted/stored, but the
  builder always uses the haversine estimate regardless of its value —
  wiring up the real Distance Matrix call is future work once that key is
  provisioned, per the spec's own "Open items" section).
- **Placeholder scan:** no TBDs; every step has real, runnable code.
- **Type consistency:** `buildPlan`'s return shape (`{stops, unselectedWork}`)
  is used identically in Tasks 7, 8, 13; `PLAN_STOP_INCLUDE` (Task 8) is
  reused verbatim in every route that returns a plan (Tasks 9–11) instead of
  being redefined; `PlanStopWork.status` never includes `"in_progress"`
  (only `PlanStop.status` does), consistent from the schema (Task 2) through
  the route validation (Task 11).
