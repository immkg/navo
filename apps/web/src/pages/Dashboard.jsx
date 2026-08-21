import { useMemo, useRef, useState } from "react";
import { useNotifications } from "../hooks/useNotifications";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import PrioritySelect from "../modules/intents/PrioritySelect";
import AddIntentPanel from "../modules/intents/AddIntentPanel";
import IntentCard from "../modules/intents/IntentCard";
import {
  useBulkDeleteIntents,
  useBulkUpdateIntentStatus,
  useCreateIntent,
  useIntents,
} from "../modules/intents/hooks";
import {
  BULK_STATUS_OPTIONS,
  PRIORITY_ORDER,
  startOfToday,
} from "../modules/intents/utils";
import { useDraftIntent } from "../modules/ai/hooks";

export default function Dashboard() {
  const { notify, confirm } = useNotifications();

  const {
    data: intents = [],
    isLoading: loading,
    isError: intentsFailed,
    error: intentsError,
    refetch: refetchIntents,
  } = useIntents();

  const createIntentMutation = useCreateIntent();
  const bulkStatusMutation = useBulkUpdateIntentStatus();
  const bulkDeleteMutation = useBulkDeleteIntents();
  const draftIntentMutation = useDraftIntent();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newIntentTitle, setNewIntentTitle] = useState("");
  const [newIntentDescription, setNewIntentDescription] = useState("");
  const [newIntentPriority, setNewIntentPriority] = useState("medium");
  const [newIntentStartDate, setNewIntentStartDate] = useState("");
  const [newIntentDueDate, setNewIntentDueDate] = useState("");
  const isSubmitting = createIntentMutation.isPending;
  const [addAnotherIntent, setAddAnotherIntent] = useState(false);
  const [keepPreviousDetails, setKeepPreviousDetails] = useState(false);
  const titleInputRef = useRef(null);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [isBulkWorking, setIsBulkWorking] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const visibleIntents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return intents.filter(
      (intent) =>
        !query ||
        intent.title.toLowerCase().includes(query) ||
        (intent.description || "").toLowerCase().includes(query)
    );
  }, [intents, searchQuery]);

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

  const handleOpenDetails = (prefilledTitle) => {
    setNewIntentTitle(prefilledTitle || "");
    setIsModalOpen(true);
  };

  const handleDraftWithAi = async () => {
    if (!newIntentTitle.trim()) {
      notify("Enter a title first, then AI can draft the rest.");
      return;
    }

    try {
      const draft = await draftIntentMutation.mutateAsync({
        title: newIntentTitle,
        description: newIntentDescription || undefined,
      });
      if (draft.description) setNewIntentDescription(draft.description);
      setNewIntentPriority(draft.priority);
      if (draft.dueDate) setNewIntentDueDate(draft.dueDate);
    } catch (error) {
      console.error("Failed to draft intent with AI", error);
      notify(
        error.response?.data?.error || "Failed to draft intent right now."
      );
    }
  };

  const handleCreateIntent = async (e) => {
    e.preventDefault();
    if (!newIntentTitle.trim()) return;

    try {
      await createIntentMutation.mutateAsync({
        title: newIntentTitle,
        description: newIntentDescription,
        priority: newIntentPriority,
        startDate: newIntentStartDate || null,
        dueDate: newIntentDueDate || null,
      });

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
    }
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

  const handleEnterSelectionMode = (intentId) => {
    setSelectionMode((prev) => (prev ? prev : true));
    toggleSelected(intentId);
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(visibleIntents.map((intent) => intent.id)));
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkStatusChange = async (status) => {
    if (!status || selectedIds.size === 0) return;

    setIsBulkWorking(true);
    const ids = Array.from(selectedIds);
    try {
      const { results } = await bulkStatusMutation.mutateAsync({ ids, status });

      const succeededIds = ids.filter(
        (_, index) => results[index].status === "fulfilled"
      );
      const failedCount = ids.length - succeededIds.length;

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
      const { results } = await bulkDeleteMutation.mutateAsync(ids);

      const succeededIds = ids.filter(
        (_, index) => results[index].status === "fulfilled"
      );
      const failedCount = ids.length - succeededIds.length;

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

    visibleIntents.forEach((intent) => {
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
  }, [visibleIntents]);

  const renderSection = (title, sectionIntents) => {
    if (sectionIntents.length === 0) return null;

    return (
      <section className="mb-4 sm:mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground sm:text-sm">
            {title}
          </h2>
          <span className="rounded-full bg-surface-alt px-2.5 py-1 text-[11px] font-medium text-muted-foreground sm:text-xs">
            {sectionIntents.length}
          </span>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,380px))] gap-3 sm:gap-4">
          {sectionIntents.map((intent) => (
            <IntentCard
              key={intent.id}
              intent={intent}
              selectionMode={selectionMode}
              isSelected={selectedIds.has(intent.id)}
              onToggleSelected={toggleSelected}
              onEnterSelectionMode={handleEnterSelectionMode}
            />
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="w-full px-2.5 pb-4 pt-2 sm:px-4 sm:pb-7 sm:pt-4">
      <AddIntentPanel onOpenDetails={handleOpenDetails} />

      {intents.length > 0 && (
        <div className="relative mb-3">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search intents…"
            className="block w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-3 text-sm text-foreground outline-none focus:ring focus:ring-primary/30"
          />
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            🔍
          </span>
        </div>
      )}

      {selectionMode && (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-primary">
            <button
              type="button"
              onClick={toggleSelectionMode}
              className="min-h-9 rounded-full border border-primary/30 bg-surface px-3 text-xs font-semibold text-primary transition hover:bg-primary/20"
            >
              Done
            </button>
            <span>{selectedIds.size} selected</span>
            <button
              type="button"
              onClick={handleSelectAll}
              disabled={selectedIds.size === visibleIntents.length}
              className="min-h-9 rounded-full border border-primary/30 bg-surface px-3 text-xs font-semibold text-primary transition hover:bg-primary/20 disabled:opacity-50"
            >
              Select all ({visibleIntents.length})
            </button>
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={handleClearSelection}
                className="min-h-9 rounded-full border border-primary/30 bg-surface px-3 text-xs font-semibold text-primary transition hover:bg-primary/20"
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
              className="min-h-9 rounded-full border border-primary/30 bg-surface px-3 text-xs font-semibold text-primary outline-none disabled:opacity-50"
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
            <Button
              variant="danger"
              size="sm"
              disabled={selectedIds.size === 0 || isBulkWorking}
              onClick={handleBulkDelete}
            >
              {isBulkWorking
                ? "Working…"
                : `Delete${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`}
            </Button>
          </div>
        </div>
      )}

      {intentsFailed ? (
        <div className="rounded-2xl border border-dashed border-danger/40 bg-danger/10 p-6 text-center sm:p-12">
          <p className="mb-1 font-medium text-danger">
            Couldn't load your intents.
          </p>
          <p className="mb-4 text-sm text-muted-foreground">
            {intentsError?.message || "The API may be unreachable."}
          </p>
          <Button variant="secondary" pill={false} onClick={refetchIntents}>
            Try again
          </Button>
        </div>
      ) : loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading intents...
        </div>
      ) : visibleIntents.length > 0 ? (
        <>
          {renderSection("Overdue", groupedIntents.overdue)}
          {renderSection("Upcoming", groupedIntents.upcoming)}
          {renderSection("Active", groupedIntents.active)}
          {renderSection("Closed", groupedIntents.closed)}
        </>
      ) : intents.length > 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface-alt p-6 text-center sm:p-12">
          <p className="text-muted-foreground mb-4">
            No intents match “{searchQuery.trim()}”.
          </p>
          <Button
            variant="secondary"
            pill={false}
            className="min-h-11"
            onClick={() => setSearchQuery("")}
          >
            Clear search
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-surface-alt p-6 text-center sm:p-12">
          <p className="text-muted-foreground mb-4">
            You have no active intents.
          </p>
          <Button
            variant="primary"
            pill={false}
            className="min-h-11"
            onClick={() => setIsModalOpen(true)}
          >
            + Create your first Intent
          </Button>
        </div>
      )}

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title="Create New Intent"
        footer={
          <>
            <Button variant="ghost" pill={false} onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-intent-form"
              variant="primary"
              pill={false}
              disabled={isSubmitting || !newIntentTitle.trim()}
            >
              {isSubmitting
                ? "Creating..."
                : addAnotherIntent
                  ? "Create & Add Another"
                  : "Create Intent"}
            </Button>
          </>
        }
      >
        <form id="create-intent-form" onSubmit={handleCreateIntent}>
          <div className="mb-4">
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="block text-sm font-medium text-foreground">
                What is your intent?
              </label>
              <Button
                type="button"
                variant="accent-outline"
                size="sm"
                onClick={handleDraftWithAi}
                disabled={
                  draftIntentMutation.isPending || !newIntentTitle.trim()
                }
              >
                {draftIntentMutation.isPending
                  ? "Drafting…"
                  : "✨ Draft with AI"}
              </Button>
            </div>
            <input
              ref={titleInputRef}
              type="text"
              autoFocus
              required
              placeholder="e.g., Plan a vacation"
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:ring focus:ring-primary/30"
              value={newIntentTitle}
              onChange={(e) => setNewIntentTitle(e.target.value)}
            />
          </div>
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-foreground">
              Priority
            </label>
            <PrioritySelect
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:ring focus:ring-primary/30"
              value={newIntentPriority}
              onChange={(e) => setNewIntentPriority(e.target.value)}
            />
          </div>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Start date
              </label>
              <input
                type="date"
                className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:ring focus:ring-primary/30"
                value={newIntentStartDate}
                onChange={(e) => setNewIntentStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Due date
              </label>
              <input
                type="date"
                className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:ring focus:ring-primary/30"
                value={newIntentDueDate}
                onChange={(e) => setNewIntentDueDate(e.target.value)}
              />
            </div>
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-foreground mb-1">
              Description (optional)
            </label>
            <textarea
              placeholder="Add some details about what you want to achieve"
              className="min-h-[100px] w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:ring focus:ring-primary/30"
              value={newIntentDescription}
              onChange={(e) => setNewIntentDescription(e.target.value)}
            />
          </div>
          <div className="mb-4 space-y-2">
            <label className="flex min-h-9 items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={addAnotherIntent}
                onChange={(e) => handleToggleAddAnother(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              Add another after this one (keep the form open)
            </label>
            <label
              className={`flex min-h-9 items-center gap-2 text-sm ${addAnotherIntent ? "text-foreground" : "text-muted-foreground"}`}
            >
              <input
                type="checkbox"
                checked={keepPreviousDetails}
                disabled={!addAnotherIntent}
                onChange={(e) => setKeepPreviousDetails(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary disabled:opacity-50"
              />
              Keep the same priority, start, and due date for the next one
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
}
