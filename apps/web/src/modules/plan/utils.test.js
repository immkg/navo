import { describe, expect, it } from "vitest";
import {
  computeSmartDefaultDurationMinutes,
  findBehindScheduleStop,
  findNearbyOpportunities,
  findUnresolvedDependency,
} from "./utils";

function work(overrides = {}) {
  return {
    id: "w1",
    title: "Work",
    priority: "medium",
    locationOptions: [],
    ...overrides,
  };
}

describe("computeSmartDefaultDurationMinutes", () => {
  it("returns null when there is no eligible work", () => {
    expect(computeSmartDefaultDurationMinutes([])).toBe(null);
    expect(computeSmartDefaultDurationMinutes([work({ status: "done" })])).toBe(
      null
    );
  });

  it("sums eligible work duration plus a rough per-item travel allowance", () => {
    const minutes = computeSmartDefaultDurationMinutes([
      work({ id: "w1", durationMinutes: 30, status: "todo" }),
      work({ id: "w2", durationMinutes: 45, status: "todo" }),
      work({ id: "w3", durationMinutes: 20, status: "done" }),
    ]);
    // (30 + 10) + (45 + 10) — the done item is excluded entirely.
    expect(minutes).toBe(95);
  });

  it("defaults a missing durationMinutes to 30", () => {
    const minutes = computeSmartDefaultDurationMinutes([
      work({ id: "w1", status: "todo", durationMinutes: undefined }),
      work({ id: "w2", status: "todo", durationMinutes: undefined }),
    ]);
    // (30 + 10) * 2 = 80, above the 60-minute floor.
    expect(minutes).toBe(80);
  });

  it("floors at 1 hour for a light backlog", () => {
    const minutes = computeSmartDefaultDurationMinutes([
      work({ status: "todo", durationMinutes: 5 }),
    ]);
    expect(minutes).toBe(60);
  });

  it("caps at 10 hours for a heavy backlog", () => {
    const heavyBacklog = Array.from({ length: 50 }, (_, index) =>
      work({ id: `w${index}`, status: "todo", durationMinutes: 60 })
    );
    expect(computeSmartDefaultDurationMinutes(heavyBacklog)).toBe(600);
  });
});

describe("findNearbyOpportunities", () => {
  it("returns nothing when the current location is unknown", () => {
    const opportunities = findNearbyOpportunities(null, [work()]);
    expect(opportunities).toEqual([]);
  });

  it("surfaces unselected work whose location is within the radius", () => {
    const current = { latitude: 0, longitude: 0 };
    const near = work({
      id: "near",
      locationOptions: [
        { id: "o1", locations: [{ id: "l1", latitude: 0.005, longitude: 0 }] },
      ],
    });
    const far = work({
      id: "far",
      locationOptions: [
        { id: "o2", locations: [{ id: "l2", latitude: 5, longitude: 0 }] },
      ],
    });

    const opportunities = findNearbyOpportunities(current, [near, far]);

    const ids = opportunities.map((o) => o.work.id);
    expect(ids).toEqual(["near"]);
    expect(opportunities[0].distanceKm).toBeLessThan(2);
  });

  it("ignores work with no resolvable location", () => {
    const current = { latitude: 0, longitude: 0 };
    const noLocation = work({ id: "no-loc", locationOptions: [] });

    expect(findNearbyOpportunities(current, [noLocation])).toEqual([]);
  });

  it("sorts multiple opportunities by distance, nearest first", () => {
    const current = { latitude: 0, longitude: 0 };
    const farther = work({
      id: "farther",
      locationOptions: [
        { id: "o1", locations: [{ id: "l1", latitude: 0.01, longitude: 0 }] },
      ],
    });
    const nearer = work({
      id: "nearer",
      locationOptions: [
        { id: "o2", locations: [{ id: "l2", latitude: 0.002, longitude: 0 }] },
      ],
    });

    const opportunities = findNearbyOpportunities(current, [farther, nearer]);

    expect(opportunities.map((o) => o.work.id)).toEqual(["nearer", "farther"]);
  });

  it("respects a custom radius", () => {
    const current = { latitude: 0, longitude: 0 };
    const justOutside = work({
      id: "outside",
      locationOptions: [
        { id: "o1", locations: [{ id: "l1", latitude: 0.02, longitude: 0 }] },
      ],
    });

    expect(findNearbyOpportunities(current, [justOutside], 1)).toEqual([]);
    expect(
      findNearbyOpportunities(current, [justOutside], 5).map((o) => o.work.id)
    ).toEqual(["outside"]);
  });

  it("uses the work item's selected location option when it has several", () => {
    const current = { latitude: 0, longitude: 0 };
    const multiOption = work({
      id: "multi",
      selectedLocationOptionId: "o2",
      locationOptions: [
        { id: "o1", locations: [{ id: "l1", latitude: 5, longitude: 0 }] },
        { id: "o2", locations: [{ id: "l2", latitude: 0.001, longitude: 0 }] },
      ],
    });

    const opportunities = findNearbyOpportunities(current, [multiOption]);
    expect(opportunities.map((o) => o.work.id)).toEqual(["multi"]);
  });
});

function stop(overrides = {}) {
  return {
    id: "stop-1",
    status: "planned",
    plannedArrivalAt: "2026-08-22T09:00:00.000Z",
    plannedDepartureAt: "2026-08-22T09:20:00.000Z",
    ...overrides,
  };
}

describe("findBehindScheduleStop", () => {
  it("returns null when there is no not-yet-resolved stop", () => {
    const now = new Date("2026-08-22T09:00:00.000Z");
    expect(findBehindScheduleStop([], now)).toBeNull();
    expect(
      findBehindScheduleStop(
        [stop({ status: "done" }), stop({ status: "skipped" })],
        now
      )
    ).toBeNull();
  });

  it("returns null when comfortably within the tolerance of a planned stop's arrival", () => {
    const now = new Date("2026-08-22T09:02:00.000Z");
    expect(findBehindScheduleStop([stop()], now)).toBeNull();
  });

  it("flags a planned stop once arrival is more than the tolerance late", () => {
    const now = new Date("2026-08-22T09:25:00.000Z"); // 25 min after plannedArrivalAt
    const result = findBehindScheduleStop([stop()], now);
    expect(result).not.toBeNull();
    expect(result.stop.id).toBe("stop-1");
    expect(result.minutesLate).toBe(25);
  });

  it("checks an in_progress stop against its planned departure, not arrival", () => {
    const inProgress = stop({ status: "in_progress" });
    const now = new Date("2026-08-22T09:35:00.000Z"); // 15 min after plannedDepartureAt

    const result = findBehindScheduleStop([inProgress], now);
    expect(result).not.toBeNull();
    expect(result.minutesLate).toBe(15);
  });

  it("only ever checks the first not-yet-resolved stop", () => {
    const stops = [
      stop({ id: "done-1", status: "done" }),
      stop({
        id: "current",
        status: "planned",
        plannedArrivalAt: "2026-08-22T09:00:00.000Z",
      }),
      stop({
        id: "later",
        status: "planned",
        plannedArrivalAt: "2026-08-22T08:00:00.000Z", // would look "very late" but isn't next
      }),
    ];
    const now = new Date("2026-08-22T09:25:00.000Z");

    const result = findBehindScheduleStop(stops, now);
    expect(result.stop.id).toBe("current");
  });

  it("respects a custom tolerance", () => {
    const now = new Date("2026-08-22T09:05:00.000Z"); // 5 min late
    expect(findBehindScheduleStop([stop()], now, 10)).toBeNull();
    expect(findBehindScheduleStop([stop()], now, 2)?.minutesLate).toBe(5);
  });
});

describe("findUnresolvedDependency", () => {
  it("returns null for a work item with no dependencies", () => {
    expect(findUnresolvedDependency(work())).toBeNull();
  });

  it("returns the prerequisite when it isn't done yet", () => {
    const prereq = { id: "prereq", title: "Decide on caterer", status: "todo" };
    const blocked = work({ dependsOn: [{ dependsOn: prereq }] });

    expect(findUnresolvedDependency(blocked)).toEqual(prereq);
  });

  it("returns null once the prerequisite is done", () => {
    const prereq = { id: "prereq", title: "Decide on caterer", status: "done" };
    const unblocked = work({ dependsOn: [{ dependsOn: prereq }] });

    expect(findUnresolvedDependency(unblocked)).toBeNull();
  });

  it("returns the first unresolved prerequisite when there are several", () => {
    const doneOne = { id: "done-one", title: "Done thing", status: "done" };
    const pending = { id: "pending", title: "Pending thing", status: "todo" };
    const blocked = work({
      dependsOn: [{ dependsOn: doneOne }, { dependsOn: pending }],
    });

    expect(findUnresolvedDependency(blocked)).toEqual(pending);
  });
});
