# Plan-based planner — design

Date: 2026-08-22
Status: approved by user, ready for implementation planning

## 1. Problem

Today's `/planner` page (`apps/web/src/pages/PlannerPage.jsx`) is a stateless,
computed-on-the-fly view: it pulls every not-done Work item that has a chosen
location, orders the resulting stops by straight-line distance from a
manually-entered or device-detected "current location" (or by an AI-suggested
order via `/api/ai/optimize-route`), and estimates travel time with a rough
haversine heuristic (8 min/km). Nothing is persisted — there's no notion of
"today's plan" you can save, no time-boxed start/end, no decision about which
subset of work you'll actually get done in the time you have, and no
execution/tracking mode.

We're replacing this with a real **Plan** concept: you declare a start
(location + date/time) and an end (location + date/time), and the system
selects and orders as much location-based work as reasonably fits in that
window — accounting for travel time between stops and time spent doing the
work itself — then lets you execute against it, re-check it when reality
diverges, and ask for AI-suggested trade-off variations.

## 2. Scope decisions (from requirements discussion)

These were confirmed with the user before this design was written:

- **Persisted entity.** A Plan is saved in the database, not recomputed from
  scratch each session. Plans have a lifecycle (draft → active →
  completed/abandoned) and history.
- **Multiple plans allowed.** You can have several plans in flight (e.g. a
  draft for Saturday alongside an active one for today). A list view shows
  all of them.
- **Deterministic algorithm + AI variations**, not "AI decides everything."
  A local, explainable heuristic picks the default schedule; the AI is asked
  separately for 1-2 alternative trade-offs, mirroring the existing
  "AI-optimize route" pattern (advisory, sanitized, client/server decides
  whether to apply).
- **Travel time defaults to the existing haversine heuristic.** Real
  road/traffic time (Google Distance Matrix) is an explicit per-plan opt-in
  (`useAccurateTravelTime`), not the default — avoids extra API cost/latency
  unless the user asks for it.
- **Reality-check is manual.** A "Re-check plan" action, not background
  geolocation tracking or push notifications (neither exists in navo today).
- **Execution navigation is in-app overview + per-leg deep link.** Not full
  in-app turn-by-turn — that would mean reimplementing what Google/Apple Maps
  already do well.
- **Arbitrary date/time span.** A plan's start/end aren't locked to "today,
  right now" — you can plan a future day in advance.
- **Full eligible pool, algorithm filters.** No pre-scoping by intent; every
  not-done, located work item is a candidate and the algorithm decides what
  fits. Manual add/exclude remains available afterward.
- **Location-only for v1.** Work items without a chosen location are not
  time-slotted into a plan (same as today's behavior) — they stay visible as
  an informational side list.
- **Execution syncs to `Work.status`.** Marking a work item done inside a
  plan sets `Work.status = "done"` directly (single source of truth); skipping
  leaves it `"todo"` so it remains plannable later.
- **New `Work.priority` field.** Selection scoring needs a work-item-level
  priority distinct from its parent intent's priority (e.g. one urgent errand
  under an otherwise low-priority intent).

## 3. Data model

```prisma
model Work {
  // ...existing fields...
  priority       String         @default("medium") // low, medium, high — independent of intent.priority
  planStopWorks  PlanStopWork[] // required back-relation for PlanStopWork.work
}

model Plan {
  id                     String   @id @default(uuid())
  title                  String?  // optional; UI can default to a date-based label
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

// The existing Location model also needs a new back-relation field
// (`planStops PlanStop[]`) added to it — Prisma requires both sides of a
// relation to be declared. Omitted here since Location itself is unchanged
// otherwise; see apps/api/prisma/schema.prisma for its current full shape.
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

Notes:

- `Plan.start*`/`end*` are freeform (label + optional lat/lng), not a FK to
  `Location` — matching today's manual-start entry. The create form can use
  the existing Places-search UI to fill them in, but a Plan's start/end isn't
  a "saved place" the way a Work's location option is.
- A `PlanStop` always points at a real `Location` row (the same ones used by
  `LocationOption`). Grouping by location, not by work item, mirrors the
  existing `routeStops` computation in `PlannerPage.jsx` — if a work item's
  chosen option lists two locations, it produces two `PlanStopWork` rows (one
  per stop), one for each location; if two work items share a location, they
  bundle into a single stop with two `PlanStopWork` rows.
- Marking a `PlanStopWork` done syncs the underlying `Work.status` to
  `"done"` **only if no other `PlanStopWork` row for that same work item in
  this plan is still `planned`/`in_progress`** — otherwise a work item that
  legitimately spans two stops would be marked done prematurely after just
  the first.
- No new migration file is needed — this repo has no `prisma/migrations`
  history and uses `prisma db push` directly (see `apps/api/package.json`'s
  `pretest`/`test:db:push` scripts); the dev database needs a manual
  `npx prisma db push`.

## 4. Selection algorithm

Lives server-side as a standalone, unit-testable module (proposed:
`apps/api/src/services/planBuilder.js`), separate from the Express route
handlers, so it can be exercised directly in tests without HTTP.

**Step 1 — score every eligible work item.** Eligible = `status != "done"`
and has a chosen location option with at least one location. Score combines:

- Work's own priority: low=1, medium=2, high=3 (weight ×2 — more specific
  than the intent's priority)
- Parent intent's priority: low=1, medium=2, high=3 (weight ×1)
- Due-date urgency (from the intent's `dueDate`, since due dates live on
  Intent, not Work): overdue=6, due today=5, due within 3 days=3, due within
  7 days=1, no due date or further out=0

  ```
  value = 2 * workPriorityPoints + 1 * intentPriorityPoints + urgencyPoints
  ```

  These exact weights are a tunable starting point, not a locked contract —
  they live in one small pure function so they're easy to adjust based on
  real usage, without a schema change.

**Step 2 — build candidate stops.** Group eligible work by
`(chosen option's) location.id`, same grouping `PlannerPage.jsx` already
does. Each candidate stop's duration = sum of its work items'
`durationMinutes`; its value = sum of its work items' scores.

**Step 3 — greedy cheapest-insertion.** Starting from a route of just
`[start] → [end]`, repeatedly:

1. For every not-yet-included candidate stop, find its cheapest insertion
   position in the current route (the position that adds the least travel
   time — i.e. `travel(prev, candidate) + travel(candidate, next) -
travel(prev, next)`).
2. Insertion cost = that added travel time + the stop's total work duration.
3. Check feasibility: would the route's total elapsed time (all travel legs
   - all stop durations, start to end) still fit within `endAt - startAt` if
     this stop were inserted at its best position?
4. Among all feasible candidates, insert the one with the best
   value-per-insertion-cost ratio. Repeat until no remaining candidate is
   feasible.

This is a standard heuristic for the "orienteering problem" (prize-collecting
routing under a time budget) — not optimal, but fast, deterministic, and easy
to reason about. Complexity is roughly O(n³) in the number of candidate
stops, which is fine at the scale of a personal day-planner (tens of stops,
not thousands).

**Step 4 — compute timing.** Walk the final route computing
`plannedArrivalAt`/`plannedDepartureAt` per stop from cumulative travel +
work time, starting from `Plan.startAt`.

**Travel time source:** haversine estimate (today's `DEFAULT_TRAVEL_MIN_PER_KM`
heuristic) by default. When `Plan.useAccurateTravelTime` is true, the builder
calls Google's Distance Matrix REST API from the server instead. This
requires a **new server-side env var** (e.g. `GOOGLE_MAPS_SERVER_API_KEY`),
distinct from the browser-restricted `VITE_GOOGLE_MAPS_API_KEY` already used
client-side — flagged here as a setup dependency, not yet configured.

**Empty/infeasible result:** if nothing fits (e.g. the window is too short),
the builder returns zero stops. This is a valid, non-error result — the UI
shows "Nothing fits in this window" rather than failing.

## 5. AI variations

New route: `POST /api/ai/plan-variations`. Input: the deterministic result
(selected stops with their work items/values) + the leftover eligible-but-
unselected work items (with priority/intent-priority/due-date) + the time
budget. Output, following the existing advisory pattern used by
`optimize-route`/`suggest-place-types`:

```json
{"variations": [{"addWorkIds": [string], "removeWorkIds": [string], "reasoning": string}]}
```

The model **never** returns times or ordering — only which work item ids to
swap in/out. The server sanitizes the ids against the real candidate/selected
sets (dropping anything invented or already gone, same defensive pattern as
`sanitizeOptimizedRoute`), then re-runs the same deterministic builder with
those items force-included/excluded to produce a concrete, trustworthy
schedule for that variation. At most 2 variations, one sentence of reasoning
each. Each variation is independent and always expressed relative to the
_current_ deterministic baseline — never cumulative with another variation.

Applying a variation (§7) is just calling `PATCH /api/plans/:id` with that
variation's `addWorkIds`/`removeWorkIds` passed through as
`forceIncludeWorkIds`/`forceExcludeWorkIds`, which reruns the builder with
those work items pinned in/out of the candidate pool before the normal
greedy insertion runs over everything else.

## 6. API surface

- `PATCH /api/work/:id` — extend existing handler to accept `priority`.
- `GET /api/plans` — list plans, each with stops → works → location expanded.
- `POST /api/plans` — create a draft plan (title?, startAt, start
  label/lat/lng, endAt, end label/lat/lng, useAccurateTravelTime) and
  immediately run the builder, persisting the resulting stops.
- `GET /api/plans/:id` — full detail.
- `PATCH /api/plans/:id` — update start/end/title/`useAccurateTravelTime`/
  status; editing start/end or status→`active` triggers a rebuild of any
  stops that aren't yet `done`/`skipped` (already-resolved stops are frozen
  and excluded from the rebuild's candidate pool and time budget). Also
  accepts optional `forceIncludeWorkIds`/`forceExcludeWorkIds` (used when
  applying an AI variation, or a manual add/exclude from the UI) — the
  builder pins those work items in/out of the candidate pool before running
  its normal greedy insertion over everything else.
- `DELETE /api/plans/:id`.
- `POST /api/plans/:id/recheck` — body: current actual location + "as of"
  time (defaults to now). Recomputes remaining (not-done/skipped) stops'
  timing from that point, and returns fresh AI variations scoped to the
  remaining budget.
- `PATCH /api/plans/:id/stops/:stopId` — update stop status
  (`in_progress`/`done`/`skipped`), recording `actualArrivalAt`/
  `actualDepartureAt`.
- `PATCH /api/plans/:id/stops/:stopId/work/:workId` — update one work item's
  status within a stop (`done`/`skipped`); `done` syncs `Work.status` per the
  rule in §3.

## 7. Frontend

- **`/planner` → Plans list.** Cards per plan: title, date range, status
  badge, stop/work counts. "New plan" opens a form for start (location via
  the existing Places-search UI, device geolocation, or manual lat/lng — plus
  date/time) and end (same, defaulting to the same day). Submitting creates
  and builds the plan, then navigates to its detail page.
- **`/plan/:id` → Plan detail/execution.** Map + ordered stop list (reusing
  the existing Google Maps JS rendering from today's `PlannerPage`), each
  stop showing planned arrival/departure and its work items
  (priority/duration). "Re-check plan" button drives the reality-check flow.
  AI-variation cards appear after a build or recheck, each with an "Apply"
  button that calls `PATCH /api/plans/:id` with that variation's
  `forceIncludeWorkIds`/`forceExcludeWorkIds` (see §6), rebuilding the plan
  with those items pinned in/out. Per-work-item "Done"/"Skip" controls.
  Per-leg "Open in Maps" deep link (reusing `buildGoogleMapsDirectionsUrl`,
  scoped to just the next leg). An on-track/behind indicator compares actual
  vs. planned times once execution has started. Status controls: Start
  (draft→active), Complete, Abandon — "Complete" is always available and
  doesn't require every stop to be done/skipped first; any work left
  planned/in_progress simply stays `"todo"` and remains eligible for a future
  plan. Unplaced (no-location) work keeps its existing informational
  side-list treatment from today's `PlannerPage`.

## 8. Testing

- `planBuilder.js`: unit tests (no HTTP) covering scoring math, greedy
  insertion respecting the time budget, location-grouping/bundling, and the
  empty-result case — pattern matches existing pure-function tests like
  `openingHours.test.js`.
- `apps/api/test/plans.test.js`: route tests mirroring `work.test.js`'s
  style — create/build, recheck, stop/work status transitions and their
  `Work.status` sync, rebuild-freezes-done-stops behavior.
- `apps/api/test/ai.test.js`: add cases for `plan-variations` sanitization
  (invented ids dropped, budget respected via re-run) mirroring the existing
  `optimize-route` sanitization tests.
- Frontend: new `PlansListPage.test.jsx` and `PlanDetailPage.test.jsx`
  mirroring `PlannerPage.test.jsx`'s existing patterns.

## 9. Open items to resolve during implementation

- `GOOGLE_MAPS_SERVER_API_KEY` needs to be provisioned (Distance Matrix API
  enabled, server-side/no-referrer-restriction key) before
  `useAccurateTravelTime` can actually work end-to-end; until then that
  option should be disabled/hidden in the UI or clearly marked "coming soon."
- Exact scoring weights (§4) are a starting point; expect to tune after
  real usage.
