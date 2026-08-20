import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

const PRIORITY_ORDER = {
  high: 0,
  medium: 1,
  low: 2,
};

function startOfToday() {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
}

function formatDate(dateValue) {
  if (!dateValue) return "-";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getDueMeta(dueDate) {
  if (!dueDate) {
    return { label: "No due", tone: "bg-slate-100 text-slate-600" };
  }

  const today = startOfToday();
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((due.getTime() - today.getTime()) / dayMs);

  if (diffDays < 0) {
    return {
      label: `${Math.abs(diffDays)}d overdue`,
      tone: "bg-rose-100 text-rose-700",
    };
  }

  if (diffDays === 0) {
    return { label: "Due today", tone: "bg-amber-100 text-amber-800" };
  }

  return {
    label: `${diffDays}d left`,
    tone: "bg-emerald-100 text-emerald-700",
  };
}

function normalizeIntent(intent) {
  return {
    ...intent,
    workCount: intent.workCount ?? 0,
    completedWorkCount: intent.completedWorkCount ?? 0,
    placeCount: intent.placeCount ?? 0,
    priority: intent.priority ?? "medium",
    status: intent.status ?? "active",
  };
}

function toDateInputValue(dateValue) {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export default function Dashboard() {
  const [intents, setIntents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchIntents() {
      try {
        const response = await axios.get("http://localhost:3001/api/intents");
        setIntents(response.data.map(normalizeIntent));
      } catch (error) {
        console.error("Failed to fetch intents", error);
      } finally {
        setLoading(false);
      }
    }
    fetchIntents();
  }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newIntentTitle, setNewIntentTitle] = useState("");
  const [newIntentDescription, setNewIntentDescription] = useState("");
  const [newIntentPriority, setNewIntentPriority] = useState("medium");
  const [newIntentStartDate, setNewIntentStartDate] = useState("");
  const [newIntentDueDate, setNewIntentDueDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingIntentId, setUpdatingIntentId] = useState("");

  const handleCreateIntent = async (e) => {
    e.preventDefault();
    if (!newIntentTitle.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await axios.post("http://localhost:3001/api/intents", {
        title: newIntentTitle,
        description: newIntentDescription,
        priority: newIntentPriority,
        startDate: newIntentStartDate || null,
        dueDate: newIntentDueDate || null,
      });
      setIntents([normalizeIntent(res.data), ...intents]);
      setIsModalOpen(false);
      setNewIntentTitle("");
      setNewIntentDescription("");
      setNewIntentPriority("medium");
      setNewIntentStartDate("");
      setNewIntentDueDate("");
    } catch (error) {
      console.error("Failed to create intent", error);
      alert("Failed to create intent. Make sure the API is running.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePatchIntent = async (intentId, patch, failureMessage) => {
    setUpdatingIntentId(intentId);
    try {
      await axios.patch(`http://localhost:3001/api/intents/${intentId}`, patch);
      setIntents((previous) =>
        previous.map((intent) =>
          intent.id === intentId
            ? normalizeIntent({ ...intent, ...patch })
            : intent
        )
      );
    } catch (error) {
      console.error("Failed to patch intent", error);
      alert(failureMessage);
    } finally {
      setUpdatingIntentId("");
    }
  };

  const handleUpdateIntentStatus = async (intentId, status) => {
    await handlePatchIntent(
      intentId,
      { status },
      "Unable to update status right now."
    );
  };

  const handleUpdatePriority = async (intentId, priority) => {
    await handlePatchIntent(
      intentId,
      { priority },
      "Unable to update priority right now."
    );
  };

  const handleUpdateDueDate = async (intentId, dueDateValue) => {
    await handlePatchIntent(
      intentId,
      { dueDate: dueDateValue || null },
      "Unable to update due date right now."
    );
  };

  const handleUpdateStartDate = async (intentId, startDateValue) => {
    await handlePatchIntent(
      intentId,
      { startDate: startDateValue || null },
      "Unable to update start date right now."
    );
  };

  const openDateInput = (inputId) => {
    const element = document.getElementById(inputId);
    if (!element) return;

    if (typeof element.showPicker === "function") {
      element.showPicker();
      return;
    }

    element.focus();
    element.click();
  };

  const groupedIntents = useMemo(() => {
    const today = startOfToday();
    const next = {
      overdue: [],
      upcoming: [],
      active: [],
      closed: [],
    };

    intents.forEach((intent) => {
      const due = intent.dueDate ? new Date(intent.dueDate) : null;
      const start = intent.startDate ? new Date(intent.startDate) : null;

      if (intent.status === "completed" || intent.status === "not_required") {
        next.closed.push(intent);
        return;
      }

      if (due && due < today) {
        next.overdue.push(intent);
        return;
      }

      if (start && start > today) {
        next.upcoming.push(intent);
        return;
      }

      next.active.push(intent);
    });

    const byDueDateAsc = (a, b) => {
      const aDue = a.dueDate
        ? new Date(a.dueDate).getTime()
        : Number.MAX_SAFE_INTEGER;
      const bDue = b.dueDate
        ? new Date(b.dueDate).getTime()
        : Number.MAX_SAFE_INTEGER;
      if (aDue !== bDue) return aDue - bDue;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    };

    const byStartDateAsc = (a, b) => {
      const aStart = a.startDate
        ? new Date(a.startDate).getTime()
        : Number.MAX_SAFE_INTEGER;
      const bStart = b.startDate
        ? new Date(b.startDate).getTime()
        : Number.MAX_SAFE_INTEGER;
      if (aStart !== bStart) return aStart - bStart;
      return byDueDateAsc(a, b);
    };

    const byPriorityThenDue = (a, b) => {
      const aPriority = PRIORITY_ORDER[a.priority] ?? PRIORITY_ORDER.medium;
      const bPriority = PRIORITY_ORDER[b.priority] ?? PRIORITY_ORDER.medium;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return byDueDateAsc(a, b);
    };

    next.overdue.sort(byDueDateAsc);
    next.upcoming.sort(byStartDateAsc);
    next.active.sort(byPriorityThenDue);
    next.closed.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return next;
  }, [intents]);

  const renderIntentCard = (intent) => {
    const workCount = intent.workCount;
    const doneCount = intent.completedWorkCount;
    const placeCount = intent.placeCount;
    const completion =
      workCount > 0 ? Math.round((doneCount / workCount) * 100) : 0;
    const statusStyle =
      intent.status === "completed"
        ? "bg-emerald-100 text-emerald-800"
        : intent.status === "not_required"
          ? "bg-slate-200 text-slate-700"
          : "bg-blue-100 text-blue-800";
    const actionConfigs =
      intent.status === "active"
        ? [
            {
              label: "Complete",
              value: "completed",
              style:
                "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
            },
            {
              label: "Not Required",
              value: "not_required",
              style:
                "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200",
            },
          ]
        : intent.status === "completed"
          ? [
              {
                label: "Active",
                value: "active",
                style:
                  "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100",
              },
              {
                label: "Not Required",
                value: "not_required",
                style:
                  "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200",
              },
            ]
          : [
              {
                label: "Active",
                value: "active",
                style:
                  "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100",
              },
              {
                label: "Complete",
                value: "completed",
                style:
                  "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
              },
            ];
    const priorityStyle =
      intent.priority === "high"
        ? "bg-rose-100 text-rose-800"
        : intent.priority === "low"
          ? "bg-slate-100 text-slate-700"
          : "bg-amber-100 text-amber-800";
    const dueMeta = getDueMeta(intent.dueDate);
    const isOverdue = dueMeta.label.includes("overdue");
    const topMetaLabel = isOverdue
      ? dueMeta.label
      : intent.status === "active"
        ? dueMeta.label
        : intent.status.replace("_", " ");
    const topMetaStyle = isOverdue
      ? dueMeta.tone
      : intent.status === "active"
        ? dueMeta.tone
        : statusStyle;

    return (
      <article
        key={intent.id}
        className="grid grid-cols-1 gap-2 rounded-xl border border-gray-200 bg-white p-2.5 shadow-sm transition-all hover:border-blue-300 sm:grid-cols-[minmax(0,1fr)_auto] sm:p-3"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link to={`/intent/${intent.id}`} className="group min-w-0">
              <h2 className="line-clamp-1 text-sm font-semibold text-gray-900 transition-colors group-hover:text-blue-600 sm:text-base">
                {intent.title}
              </h2>
            </Link>
            <div className="flex shrink-0 items-center gap-1">
              <select
                value={intent.priority}
                onChange={(e) =>
                  handleUpdatePriority(intent.id, e.target.value)
                }
                disabled={updatingIntentId === intent.id}
                className={`h-8 rounded-full border-0 px-2 text-[10px] font-semibold uppercase tracking-wide outline-none disabled:opacity-60 ${priorityStyle}`}
                title="Set priority"
              >
                <option value="high">high</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
              </select>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${topMetaStyle}`}
              >
                {topMetaLabel}
              </span>
            </div>
          </div>

          {intent.description && (
            <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">
              {intent.description}
            </p>
          )}

          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <label className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                Start
              </span>
              <button
                type="button"
                onClick={() => openDateInput(`start-date-${intent.id}`)}
                disabled={updatingIntentId === intent.id}
                className="relative h-9 w-full rounded-md border border-gray-200 bg-gray-100 px-1.5 text-left text-xs font-medium text-gray-700 disabled:opacity-60"
              >
                <span className="flex h-full items-center">
                  {formatDate(intent.startDate)}
                </span>
                <input
                  id={`start-date-${intent.id}`}
                  type="date"
                  value={toDateInputValue(intent.startDate)}
                  onChange={(e) =>
                    handleUpdateStartDate(intent.id, e.target.value)
                  }
                  disabled={updatingIntentId === intent.id}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                  title="Set start date"
                />
              </button>
            </label>

            <label className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                Due
              </span>
              <button
                type="button"
                onClick={() => openDateInput(`due-date-${intent.id}`)}
                disabled={updatingIntentId === intent.id}
                className="relative h-9 w-full rounded-md border border-gray-200 bg-gray-100 px-1.5 text-left text-xs font-medium text-gray-700 disabled:opacity-60"
              >
                <span className="flex h-full items-center">
                  {formatDate(intent.dueDate)}
                </span>
                <input
                  id={`due-date-${intent.id}`}
                  type="date"
                  value={toDateInputValue(intent.dueDate)}
                  onChange={(e) =>
                    handleUpdateDueDate(intent.id, e.target.value)
                  }
                  disabled={updatingIntentId === intent.id}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                  title="Set due date"
                />
              </button>
            </label>
          </div>

          <div className="mt-2 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
            <span
              className="whitespace-nowrap text-xs text-gray-600"
              title={`${doneCount} of ${workCount} work items complete, ${placeCount} place${placeCount === 1 ? "" : "s"}`}
            >
              {doneCount}/{workCount} work · {placeCount} place
              {placeCount === 1 ? "" : "s"}
            </span>
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${completion}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-gray-700">
              {completion}%
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 sm:flex sm:w-16 sm:shrink-0 sm:flex-col sm:items-stretch sm:justify-center">
          {actionConfigs.map((action) => (
            <button
              key={action.value}
              type="button"
              onClick={() => handleUpdateIntentStatus(intent.id, action.value)}
              disabled={
                updatingIntentId === intent.id || intent.status === action.value
              }
              aria-label={`Set ${action.label.toLowerCase()}`}
              title={`Set ${action.label.toLowerCase()}`}
              className={`inline-flex h-9 w-full items-center justify-center rounded-md border px-1 text-[10px] font-semibold uppercase tracking-wide transition disabled:opacity-50 ${action.style}`}
            >
              {action.label}
            </button>
          ))}
        </div>
      </article>
    );
  };

  const renderSection = (title, sectionIntents) => {
    if (sectionIntents.length === 0) return null;

    return (
      <section className="mb-3 sm:mb-4">
        <div className="mb-1.5 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-700 sm:text-sm">
            {title}
          </h2>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600 sm:text-xs">
            {sectionIntents.length}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5 lg:grid-cols-3 lg:gap-3">
          {sectionIntents.map(renderIntentCard)}
        </div>
      </section>
    );
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-2.5 pb-4 pt-2 sm:px-4 sm:pb-7 sm:pt-4">
      <div className="mb-3 rounded-2xl border border-gray-200 bg-white p-2.5 shadow-sm sm:mb-4 sm:p-3.5">
        <div className="flex w-full sm:justify-end">
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 sm:w-auto sm:text-sm"
          >
            + New Intent
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">
          Loading intents...
        </div>
      ) : intents.length > 0 ? (
        <>
          {renderSection("Overdue", groupedIntents.overdue)}
          {renderSection("Upcoming", groupedIntents.upcoming)}
          {renderSection("Active", groupedIntents.active)}
          {renderSection("Closed", groupedIntents.closed)}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center sm:p-12">
          <p className="text-gray-500 mb-4">You have no active intents.</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition"
          >
            + Create your first Intent
          </button>
        </div>
      )}

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center sm:p-4"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-lg sm:p-6">
            <h2 className="mb-4 text-xl font-bold text-gray-900 sm:text-2xl">
              Create New Intent
            </h2>
            <form onSubmit={handleCreateIntent}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  What is your intent?
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="e.g., Plan a vacation"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:ring focus:ring-blue-200 outline-none"
                  value={newIntentTitle}
                  onChange={(e) => setNewIntentTitle(e.target.value)}
                />
              </div>
              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Priority
                </label>
                <select
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:ring focus:ring-blue-200 outline-none"
                  value={newIntentPriority}
                  onChange={(e) => setNewIntentPriority(e.target.value)}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Start date
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:ring focus:ring-blue-200 outline-none"
                    value={newIntentStartDate}
                    onChange={(e) => setNewIntentStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Due date
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:ring focus:ring-blue-200 outline-none"
                    value={newIntentDueDate}
                    onChange={(e) => setNewIntentDueDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  placeholder="Add some details about what you want to achieve"
                  className="min-h-[100px] w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:ring focus:ring-blue-200 outline-none"
                  value={newIntentDescription}
                  onChange={(e) => setNewIntentDescription(e.target.value)}
                />
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newIntentTitle.trim()}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "Create Intent"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
