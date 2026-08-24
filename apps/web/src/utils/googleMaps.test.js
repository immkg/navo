import { afterEach, describe, expect, it, vi } from "vitest";
import { buildGoogleMapsDirectionsUrl, distanceLabel } from "./googleMaps";

describe("distanceLabel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when any coordinate is missing", () => {
    expect(distanceLabel(null, 0, 1, 1)).toBeNull();
    expect(distanceLabel(0, 0, null, 1)).toBeNull();
  });

  it("formats short distances in km outside en-US locales", () => {
    vi.stubGlobal("navigator", { language: "en-GB" });

    // ~1.11 km per degree of longitude at the equator.
    const label = distanceLabel(0, 0, 0, 0.01);

    expect(label).toMatch(/^\d+(\.\d)? km away$/);
  });

  it("formats distances in miles for en-US", () => {
    vi.stubGlobal("navigator", { language: "en-US" });

    const label = distanceLabel(0, 0, 0, 0.01);

    expect(label).toMatch(/^\d+(\.\d)? mi away$/);
  });

  it("rounds to whole units past 10", () => {
    vi.stubGlobal("navigator", { language: "en-GB" });

    const label = distanceLabel(0, 0, 0, 1);

    expect(label).toMatch(/^\d+ km away$/);
  });
});

describe("buildGoogleMapsDirectionsUrl", () => {
  it("returns a plain maps link when there are no stops", () => {
    expect(buildGoogleMapsDirectionsUrl({ latitude: 0, longitude: 0 }, [])).toBe(
      "https://www.google.com/maps"
    );
  });

  it("uses real coordinates for origin, destination, and waypoints when available", () => {
    const url = buildGoogleMapsDirectionsUrl(
      { latitude: 0, longitude: 0 },
      [
        { location: { latitude: 1, longitude: 1, name: "A" } },
        { location: { latitude: 2, longitude: 2, name: "B" } },
      ]
    );

    expect(url).toContain("origin=0,0");
    expect(url).toContain("destination=2,2");
    expect(url).toContain("waypoints=1,1");
  });

  // Regression: a single-leg link (exactly how PlanDetailPage requests each
  // stop's own "Open in Maps" link) used to fall back to the destination
  // stop's own name as the origin when the start point had no coordinates —
  // producing a route from a place to itself.
  it("never points a single-stop leg's origin at its own destination when the start has no coordinates", () => {
    const url = buildGoogleMapsDirectionsUrl({ latitude: null, longitude: null }, [
      { location: { latitude: 10, longitude: 20, name: "Pharmacy" } },
    ]);

    expect(url).not.toContain("origin=Pharmacy");
    expect(url).not.toMatch(/origin=[^&]*Pharmacy/);
    expect(url).toContain("destination=10,20");
    expect(url).not.toContain("origin=");
  });

  it("omits the origin param entirely when the start point has no coordinates", () => {
    const url = buildGoogleMapsDirectionsUrl(null, [
      { location: { latitude: 5, longitude: 5, name: "Somewhere" } },
    ]);

    expect(url).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=5,5"
    );
  });
});
