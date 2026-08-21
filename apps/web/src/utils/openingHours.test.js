import { describe, expect, it } from "vitest";
import { getOpenStatus } from "./openingHours";

// Google's day index: 0 = Sunday.
const MON_9_TO_5 = [
  { open: { day: 1, time: "0900" }, close: { day: 1, time: "1700" } },
];

const FRI_NIGHT_OVERNIGHT = [
  { open: { day: 5, time: "2200" }, close: { day: 6, time: "0200" } },
];

const ALWAYS_OPEN = [{ open: { day: 0, time: "0000" } }];

describe("getOpenStatus", () => {
  it("returns unknown status when there are no periods", () => {
    expect(getOpenStatus(null)).toEqual({ isOpen: null, label: null });
    expect(getOpenStatus([])).toEqual({ isOpen: null, label: null });
  });

  it("reports open 24 hours", () => {
    const now = new Date(2026, 0, 5, 3, 0); // any time at all
    expect(getOpenStatus(ALWAYS_OPEN, now)).toEqual({
      isOpen: true,
      label: "Open 24 hours",
    });
  });

  it("reports closing soon within the same day", () => {
    // Monday 2026-01-05, 4:30 PM — 30 minutes before a 5 PM close.
    const now = new Date(2026, 0, 5, 16, 30);
    const result = getOpenStatus(MON_9_TO_5, now);
    expect(result.isOpen).toBe(true);
    expect(result.label).toBe("Closes in 30m");
  });

  it("reports open now (far from closing) as a generic label", () => {
    const now = new Date(2026, 0, 5, 9, 30);
    const result = getOpenStatus(MON_9_TO_5, now);
    expect(result.isOpen).toBe(true);
    expect(result.label).toBe("Closes in 7h 30m");
  });

  it("reports opens later today when closed before opening", () => {
    // Monday 7:00 AM, opens at 9:00 AM.
    const now = new Date(2026, 0, 5, 7, 0);
    const result = getOpenStatus(MON_9_TO_5, now);
    expect(result.isOpen).toBe(false);
    expect(result.label).toBe("Opens at 9:00 AM");
  });

  it("reports opens tomorrow when closed for the rest of today", () => {
    // Monday 6:00 PM (after the 5 PM close), next period is next Monday.
    const now = new Date(2026, 0, 5, 18, 0);
    const result = getOpenStatus(MON_9_TO_5, now);
    expect(result.isOpen).toBe(false);
    expect(result.label).toMatch(/^Opens (tomorrow|Monday) at 9:00 AM$/);
  });

  it("handles an overnight period spanning midnight", () => {
    // Friday 11:00 PM — inside the Fri 22:00 -> Sat 02:00 window.
    const fridayNight = new Date(2026, 0, 2, 23, 0);
    const openResult = getOpenStatus(FRI_NIGHT_OVERNIGHT, fridayNight);
    expect(openResult.isOpen).toBe(true);
    expect(openResult.label).toBe("Closes in 3h 0m");

    // Saturday 1:00 AM — still inside the same overnight window.
    const saturdayEarly = new Date(2026, 0, 3, 1, 0);
    const stillOpen = getOpenStatus(FRI_NIGHT_OVERNIGHT, saturdayEarly);
    expect(stillOpen.isOpen).toBe(true);
    expect(stillOpen.label).toBe("Closes in 1h 0m");

    // Saturday 3:00 AM — after the window has closed.
    const saturdayLate = new Date(2026, 0, 3, 3, 0);
    const closed = getOpenStatus(FRI_NIGHT_OVERNIGHT, saturdayLate);
    expect(closed.isOpen).toBe(false);
  });
});
