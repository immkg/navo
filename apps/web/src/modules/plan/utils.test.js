import { describe, expect, it } from "vitest";
import { findNearbyOpportunities } from "./utils";

function work(overrides = {}) {
  return {
    id: "w1",
    title: "Work",
    priority: "medium",
    locationOptions: [],
    ...overrides,
  };
}

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

    const opportunities = findNearbyOpportunities(current, [
      farther,
      nearer,
    ]);

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
