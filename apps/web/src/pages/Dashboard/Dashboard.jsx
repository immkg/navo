import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { useNotifications } from "../../hooks/useNotifications";

const PRIORITY_ORDER = {
  high: 0,
  medium: 1,
  low: 2,
};

const BULK_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "not_required", label: "Not Required" },
  { value: "archived", label: "Archived" },
];

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
  const { notify, confirm } = useNotifications();
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
  const [addAnotherIntent, setAddAnotherIntent] = useState(false);
  const [keepPreviousDetails, setKeepPreviousDetails] = useState(false);
  const titleInputRef = useRef(null);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [isBulkWorking, setIsBulkWorking] = useState(false);

  const closeModal = () => {
    setIsModalOpen(false);
    setNewIntentTitle("");
    setNewIntentDescription("");
    setNewIntentPriority("medium");
    setNewIntentStartDate("");
    setNewIntentDueDate("");
    setAddAnotherIntent(false);
    setKeepPreviousDetails(false);
  };

  const handleToggleAddAnother = (checked) => {
    setAddAnotherIntent(checked);
    if (!checked) {
      setKeepPreviousDetails(false);
    }
  };

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
      setIntents((previous) => [normalizeIntent(res.data), ...previous]);

      setNewIntentTitle("");
      setNewIntentDescription("");

      if (addAnotherIntent) {
        if (!keepPreviousDetails) {
          setNewIntentPriority("medium");
          setNewIntentStartDate("");
          setNewIntentDueDate("");
        }
        titleInputRef.current?.focus();
      } else {
        closeModal();
      }
    } catch (error) {
      console.error("Failed to create intent", error);
      notify("Failed to create intent. Make sure the API is running.");
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
      notify(failureMessage);
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

  const toggleSelectionMode = () => {
    setSelectionMode((prev) => !prev);
    setSelectedIds(new Set());
  };

  const toggleSelected = (intentId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(intentId)) {
        next.delete(intentId);
      } else {
        next.add(intentId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(intents.map((intent) => intent.id)));
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkStatusChange = async (status) => {
    if (!status || selectedIds.size === 0) return;

    setIsBulkWorking(true);
    const ids = Array.from(selectedIds);
    try {
      const results = await Promise.allSettled(
        ids.map((id) =>
          axios.patch(`http://localhost:3001/api/intents/${id}`, { status })
        )
      );

      const succeededIds = ids.filter(
        (_, index) => results[index].status === "fulfilled"
      );
      const failedCount = ids.length - succeededIds.length;

      setIntents((previous) =>
        previous.map((intent) =>
          succeededIds.includes(intent.id)
            ? normalizeIntent({ ...intent, status })
            : intent
        )
      );
      setSelectedIds(new Set());

      if (failedCount > 0) {
        notify(
          `Updated ${succeededIds.length} intent(s), but ${failedCount} failed. Please try again.`
        );
      }
    } finally {
      setIsBulkWorking(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    const confirmed = await confirm(
      `Delete ${selectedIds.size} intent(s)? This also deletes all of their work items and removes them from the planner. This can't be undone.`,
      { title: "Delete intents?", confirmLabel: "Delete", danger: true }
    );
    if (!confirmed) return;

    setIsBulkWorking(true);
    const ids = Array.from(selectedIds);
    try {
      const results = await Promise.allSettled(
        ids.map((id) => axios.delete(`http://localhost:3001/api/intents/${id}`))
      );

      const succeededIds = ids.filter(
        (_, index) => results[index].status === "fulfilled"
      );
      const failedCount = ids.length - succeededIds.length;

      setIntents((previous) =>
        previous.filter((intent) => !succeededIds.includes(intent.id))
      );
      setSelectedIds(new Set());

      if (failedCount > 0) {
        notify(
          `Deleted ${succeededIds.length} intent(s), but ${failedCount} failed. Please try again.`
        );
      }
    } finally {
      setIsBulkWorking(false);
    }
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
    const isSelected = selectedIds.has(intent.id);

    return (
      <article
        key={intent.id}
        className={`flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm transition-all hover:shadow-md sm:p-5 ${
          isSelected
            ? "border-blue-400 ring-2 ring-blue-100"
            : "border-gray-200 hover:border-blue-300"
        }`}
      >
        <div className="flex items-start gap-3">
          {selectionMode && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleSelected(intent.id)}
              aria-label={`Select ${intent.title}`}
              className="mt-1.5 h-5 w-5 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          )}

          <Link
            to={`/intent/${intent.id}`}
            className="group -mx-1.5 -my-1 block min-w-0 flex-1 rounded-lg px-1.5 py-1 transition hover:bg-blue-50"
          >
            <h2 className="line-clamp-2 text-lg font-semibold text-gray-900 transition-colors group-hover:text-blue-600 sm:text-xl">
              {intent.title}
            </h2>
            {intent.description && (
              <p className="mt-1 line-clamp-1 text-sm text-gray-500">
                {intent.description}
              </p>
            )}
          </Link>

          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <select
              value={intent.priority}
              onChange={(e) => handleUpdatePriority(intent.id, e.target.value)}
              disabled={updatingIntentId === intent.id}
              className={`h-8 rounded-full border-0 px-3 text-xs font-semibold uppercase tracking-wide outline-none disabled:opacity-60 ${priorityStyle}`}
              title="Set priority"
            >
              <option value="high">high</option>
              <option value="medium">medium</option>
              <option value="low">low</option>
            </select>
            <span
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${topMetaStyle}`}
            >
              {topMetaLabel}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Start
            </span>
            <button
              type="button"
              onClick={() => openDateInput(`start-date-${intent.id}`)}
              disabled={updatingIntentId === intent.id}
              className="relative h-10 w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-60"
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

          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Due
            </span>
            <button
              type="button"
              onClick={() => openDateInput(`due-date-${intent.id}`)}
              disabled={updatingIntentId === intent.id}
              className="relative h-10 w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-60"
            >
              <span className="flex h-full items-center">
                {formatDate(intent.dueDate)}
              </span>
              <input
                id={`due-date-${intent.id}`}
                type="date"
                value={toDateInputValue(intent.dueDate)}
                onChange={(e) => handleUpdateDueDate(intent.id, e.target.value)}
                disabled={updatingIntentId === intent.id}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                title="Set due date"
              />
            </button>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <span
            className="whitespace-nowrap text-sm text-gray-600"
            title={`${doneCount} of ${workCount} work items complete, ${placeCount} place${placeCount === 1 ? "" : "s"}`}
          >
            {doneCount}/{workCount} work · {placeCount} place
            {placeCount === 1 ? "" : "s"}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${completion}%` }}
            />
          </div>
          <span className="whitespace-nowrap text-sm font-semibold text-gray-700">
            {completion}%
          </span>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
          {actionConfigs.map((action) => (
            <button
              key={action.value}
              type="button"
              onClick={() => handleUpdateIntentStatus(intent.id, action.value)}
              disabled={
                updatingIntentId === intent.id || intent.status === action.value
              }
              className={`inline-flex h-9 flex-1 items-center justify-center rounded-lg border px-3 text-sm font-semibold transition disabled:opacity-50 ${action.style}`}
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
      <section className="mb-4 sm:mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-700 sm:text-sm">
            {title}
          </h2>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600 sm:text-xs">
            {sectionIntents.length}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          {sectionIntents.map(renderIntentCard)}
        </div>
      </section>
    );
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-2.5 pb-4 pt-2 sm:px-4 sm:pb-7 sm:pt-4">
      <div className="mb-3 flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-2.5 shadow-sm sm:mb-4 sm:flex-row sm:items-center sm:justify-between sm:p-3.5">
        <h1 className="hidden text-lg font-bold text-gray-900 sm:block">
          Intents
        </h1>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:w-auto">
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 sm:text-sm"
          >
            + New Intent
          </button>
          {intents.length > 0 && (
            <button
              onClick={toggleSelectionMode}
              className={`inline-flex min-h-10 items-center justify-center rounded-lg border px-4 py-2 text-xs font-semibold shadow-sm transition sm:text-sm ${
                selectionMode
                  ? "border-gray-300 bg-gray-100 text-gray-800 hover:bg-gray-200"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {selectionMode ? "Cancel Selecting" : "Select"}
            </button>
          )}
        </div>
      </div>

      {selectionMode && (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-blue-900">
            <span>{selectedIds.size} selected</span>
            <button
              type="button"
              onClick={handleSelectAll}
              disabled={selectedIds.size === intents.length}
              className="min-h-9 rounded-full border border-blue-300 bg-white px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
            >
              Select all ({intents.length})
            </button>
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={handleClearSelection}
                className="min-h-9 rounded-full border border-blue-300 bg-white px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value=""
              disabled={selectedIds.size === 0 || isBulkWorking}
              onChange={(e) => handleBulkStatusChange(e.target.value)}
              className="min-h-9 rounded-full border border-blue-300 bg-white px-3 text-xs font-semibold text-blue-700 outline-none disabled:opacity-50"
            >
              <option value="" disabled>
                Set status…
              </option>
              {BULK_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={selectedIds.size === 0 || isBulkWorking}
              className="inline-flex min-h-9 items-center justify-center rounded-full bg-red-600 px-4 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {isBulkWorking
                ? "Working…"
                : `Delete${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`}
            </button>
          </div>
        </div>
      )}

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
                  ref={titleInputRef}
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
              <div className="mb-4 space-y-2">
                <label className="flex min-h-9 items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={addAnotherIntent}
                    onChange={(e) => handleToggleAddAnother(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Add another after this one (keep the form open)
                </label>
                <label
                  className={`flex min-h-9 items-center gap-2 text-sm ${addAnotherIntent ? "text-gray-700" : "text-gray-400"}`}
                >
                  <input
                    type="checkbox"
                    checked={keepPreviousDetails}
                    disabled={!addAnotherIntent}
                    onChange={(e) => setKeepPreviousDetails(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                  />
                  Keep the same priority, start, and due date for the next one
                </label>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newIntentTitle.trim()}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting
                    ? "Creating..."
                    : addAnotherIntent
                      ? "Create & Add Another"
                      : "Create Intent"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
