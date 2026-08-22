// `<input type="datetime-local">` reads/writes local wall-clock time with no
// timezone info, but toISOString() always renders UTC — so the naive
// approach shifts the displayed value by the viewer's UTC offset. Shifting
// the Date by that same offset before formatting cancels it out. Shared by
// every plan form (create and edit) so they can't drift into the same
// timezone bug independently.
export function toDateTimeLocalValue(date) {
  const d = new Date(date);
  d.setSeconds(0, 0);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

// Single fallback so a plan without a title reads identically in the list
// and detail views, instead of "Aug 22, 2026" in one and literal "Plan" in
// the other for the same plan.
export function getPlanDisplayTitle(plan) {
  return plan.title || new Date(plan.startAt).toLocaleDateString();
}

const ON_TIME_TOLERANCE_MINUTES = 5;

// Compares an actual timestamp against its planned counterpart. Returns
// null when there's nothing to compare yet (actual not recorded).
export function describeTimingDelta(actualIso, plannedIso) {
  if (!actualIso || !plannedIso) return null;

  const deltaMinutes = Math.round(
    (new Date(actualIso).getTime() - new Date(plannedIso).getTime()) / 60000
  );

  if (Math.abs(deltaMinutes) <= ON_TIME_TOLERANCE_MINUTES) {
    return { label: "On time", tone: "success" };
  }
  if (deltaMinutes > 0) {
    return { label: `${deltaMinutes} min late`, tone: "danger" };
  }
  return { label: `${Math.abs(deltaMinutes)} min early`, tone: "primary" };
}
