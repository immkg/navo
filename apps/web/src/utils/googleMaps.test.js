import { afterEach, describe, expect, it, vi } from "vitest";
import { distanceLabel } from "./googleMaps";

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
