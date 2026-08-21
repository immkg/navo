export const PRIORITY_OPTIONS = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export const PRIORITY_ORDER = {
  high: 0,
  medium: 1,
  low: 2,
};

export const BULK_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "not_required", label: "Not Required" },
  { value: "archived", label: "Archived" },
];

export function normalizeIntent(intent) {
  return {
    ...intent,
    workCount: intent.workCount ?? 0,
    completedWorkCount: intent.completedWorkCount ?? 0,
    placeCount: intent.placeCount ?? 0,
    priority: intent.priority ?? "medium",
    status: intent.status ?? "active",
  };
}

export function startOfToday() {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
}

export function formatDate(dateValue) {
  if (!dateValue) return "-";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function toDateInputValue(dateValue) {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function getDueMeta(dueDate) {
  if (!dueDate) {
    return { label: "No due", tone: "neutral" };
  }

  const today = startOfToday();
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((due.getTime() - today.getTime()) / dayMs);

  if (diffDays < 0) {
    return {
      label: `${Math.abs(diffDays)}d overdue`,
      tone: "danger",
    };
  }

  if (diffDays === 0) {
    return { label: "Due today", tone: "warning" };
  }

  return {
    label: `${diffDays}d left`,
    tone: "success",
  };
}
