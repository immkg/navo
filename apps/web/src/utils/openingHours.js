const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function timeStringToMinutes(time) {
  const hours = parseInt(time.slice(0, 2), 10);
  const minutes = parseInt(time.slice(2, 4), 10);
  return hours * 60 + minutes;
}

function formatClockTime(minuteOfDay) {
  const hours24 = Math.floor(minuteOfDay / 60) % 24;
  const minutes = minuteOfDay % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
}

// Computes a live "closes in X" / "opens at Y" label from Google's
// structured opening_hours.periods, evaluated against the device's local
// time (places are assumed to be in the user's timezone — see
// LocationOptionGroupsEditor's notes). Not routing/traffic-aware, and
// doesn't tick on its own — it's recomputed whenever the caller re-renders
// with a fresh `now`.
export function getOpenStatus(periods, now = new Date()) {
  if (!periods || periods.length === 0) {
    return { isOpen: null, label: null };
  }

  const isAlwaysOpen = periods.some(
    (period) =>
      period.open?.day === 0 && period.open?.time === "0000" && !period.close
  );
  if (isAlwaysOpen) {
    return { isOpen: true, label: "Open 24 hours" };
  }

  const nowDay = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowAbsolute = nowDay * MINUTES_PER_DAY + nowMinutes;

  const ranges = [];
  for (const period of periods) {
    if (!period.open || !period.close) continue;

    const openAbs =
      period.open.day * MINUTES_PER_DAY + timeStringToMinutes(period.open.time);
    let closeAbs =
      period.close.day * MINUTES_PER_DAY +
      timeStringToMinutes(period.close.time);
    if (closeAbs <= openAbs) closeAbs += MINUTES_PER_WEEK;

    // Include the occurrence in the previous/current/next week so a range
    // that started before this week's Sunday (or wraps past next Sunday)
    // is still found relative to `now`.
    ranges.push([openAbs - MINUTES_PER_WEEK, closeAbs - MINUTES_PER_WEEK]);
    ranges.push([openAbs, closeAbs]);
    ranges.push([openAbs + MINUTES_PER_WEEK, closeAbs + MINUTES_PER_WEEK]);
  }

  const activeRange = ranges.find(
    ([start, end]) => nowAbsolute >= start && nowAbsolute < end
  );
  if (activeRange) {
    const minutesUntilClose = activeRange[1] - nowAbsolute;
    if (minutesUntilClose > MINUTES_PER_DAY) {
      return { isOpen: true, label: "Open now" };
    }
    const hours = Math.floor(minutesUntilClose / 60);
    const minutes = minutesUntilClose % 60;
    const label =
      hours > 0 ? `Closes in ${hours}h ${minutes}m` : `Closes in ${minutes}m`;
    return { isOpen: true, label };
  }

  const nextOpen = ranges
    .map(([start]) => start)
    .filter((start) => start > nowAbsolute)
    .sort((a, b) => a - b)[0];

  if (nextOpen == null) {
    return { isOpen: false, label: "Closed" };
  }

  const minutesUntilOpen = nextOpen - nowAbsolute;
  const daysUntil = Math.floor(
    (minutesUntilOpen + nowMinutes) / MINUTES_PER_DAY
  );
  const minuteOfDay =
    ((nextOpen % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const clock = formatClockTime(minuteOfDay);

  if (daysUntil <= 0) {
    return { isOpen: false, label: `Opens at ${clock}` };
  }
  if (daysUntil === 1) {
    return { isOpen: false, label: `Opens tomorrow at ${clock}` };
  }
  const dayName = DAY_NAMES[(nowDay + daysUntil) % 7];
  return { isOpen: false, label: `Opens ${dayName} at ${clock}` };
}
