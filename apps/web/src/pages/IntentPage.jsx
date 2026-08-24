import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useNotifications } from "../hooks/useNotifications";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import LocationCard from "../modules/location/LocationCard";
import { getChosenOption } from "../modules/location/utils";
import { useIntent, usePatchIntent } from "../modules/intents/hooks";
import { BULK_STATUS_OPTIONS, formatDate } from "../modules/intents/utils";
import PrioritySelect from "../modules/intents/PrioritySelect";
import {
  useCreateWorkItem,
  useDeleteWorkItem,
  useUpdateWorkItem,
} from "../modules/work/hooks";
import { WORK_STATUS_OPTIONS } from "../modules/work/utils";
import WorkFormModal from "../modules/work/WorkFormModal";
import { useSuggestWork } from "../modules/ai/hooks";
import { usePlans, useUpdatePlan } from "../modules/plan/hooks";
import { getPlanDisplayTitle } from "../modules/plan/utils";

function formatMinutes(totalMinutes) {
  if (!totalMinutes) return "0 min";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr${hours === 1 ? "" : "s"}`;
  return `${hours} hr${hours === 1 ? "" : "s"} ${minutes} min`;
}

const STATUS_TONE = {
  todo: "neutral",
  in_progress: "primary",
  done: "success",
};

function IntentSummaryCard({ intent, onPatchIntent, updatingIntent }) {
  const [intentTitle, setIntentTitle] = useState(intent.title || "");
  const [intentDescription, setIntentDescription] = useState(
    intent.description || ""
  );
  const [intentPriority, setIntentPriority] = useState(
    intent.priority || "medium"
  );
  const [intentStatus, setIntentStatus] = useState(intent.status || "active");
  const [intentStartDate, setIntentStartDate] = useState(
    intent.startDate
      ? new Date(intent.startDate).toISOString().slice(0, 10)
      : ""
  );
  const [intentDueDate, setIntentDueDate] = useState(
    intent.dueDate ? new Date(intent.dueDate).toISOString().slice(0, 10) : ""
  );
  const descriptionRef = useRef(null);
  const [showDetailsMenu, setShowDetailsMenu] = useState(false);

  useEffect(() => {
    const el = descriptionRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [intentDescription]);

  const handleUpdateStartDate = async (startDateValue) => {
    setIntentStartDate(startDateValue);
    await onPatchIntent({ startDate: startDateValue || null });
  };

  const handleUpdateDueDate = async (dueDateValue) => {
    setIntentDueDate(dueDateValue);
    await onPatchIntent({ dueDate: dueDateValue || null });
  };

  const handleUpdatePriority = async (priority) => {
    setIntentPriority(priority);
    await onPatchIntent({ priority });
  };

  const handleUpdateStatus = async (status) => {
    setIntentStatus(status);
    await onPatchIntent({ status });
  };

  const handleTitleBlur = async () => {
    const nextTitle = intentTitle.trim();
    if (!nextTitle) {
      setIntentTitle(intent.title || "");
      return;
    }
    if (nextTitle === (intent.title || "")) return;
    await onPatchIntent({ title: nextTitle });
  };

  const handleDescriptionBlur = async () => {
    const nextDescription = intentDescription.trim();
    if (nextDescription === (intent.description || "")) return;
    await onPatchIntent({ description: nextDescription || null });
  };

  const priorityAccent =
    intentPriority === "high"
      ? "bg-danger"
      : intentPriority === "low"
        ? "bg-muted-foreground/40"
        : "bg-warning";

  const statusDot =
    intentStatus === "completed"
      ? "bg-success"
      : intentStatus === "active"
        ? "bg-primary"
        : "bg-muted-foreground/40";

  return (
    <Card
      as="section"
      className="relative mb-3 overflow-hidden sm:mb-4"
      padding="sm"
    >
      <span
        aria-hidden="true"
        title={`${intentPriority} priority`}
        className={`absolute inset-y-0 left-0 w-1.5 ${priorityAccent}`}
      />
      <span
        aria-hidden="true"
        title={intentStatus.replace("_", " ")}
        className={`absolute inset-x-0 top-0 h-1 ${statusDot}`}
      />
      <div className="flex items-start gap-2 pl-2 pt-1">
        <div className="min-w-0 flex-1">
          <input
            value={intentTitle}
            onChange={(e) => setIntentTitle(e.target.value)}
            onBlur={handleTitleBlur}
            disabled={updatingIntent}
            placeholder="Untitled intent"
            className="-mx-2 w-full min-w-0 rounded-xl border border-transparent px-2 py-1 text-lg font-bold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 sm:text-xl"
          />
          <textarea
            ref={descriptionRef}
            value={intentDescription}
            onChange={(e) => setIntentDescription(e.target.value)}
            onBlur={handleDescriptionBlur}
            disabled={updatingIntent}
            rows={1}
            placeholder="Add a short description"
            className="scrollbar-hide -mx-2 mt-0.5 max-h-32 w-full resize-none overflow-y-auto rounded-xl border border-transparent px-2 py-1 text-sm text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowDetailsMenu(true)}
          aria-label="Edit priority, status, and dates"
          className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-surface-alt hover:text-foreground"
        >
          ⋮
        </button>
      </div>

      <button
        type="button"
        onClick={() => setShowDetailsMenu(true)}
        className="mt-2 flex w-full items-center gap-2 border-t border-border pt-2 pl-2 text-left text-xs text-muted-foreground"
      >
        <span className="truncate">
          {intentStartDate ? formatDate(intentStartDate) : "No start"} →{" "}
          {intentDueDate ? formatDate(intentDueDate) : "No due date"}
        </span>
      </button>

      <Modal
        open={showDetailsMenu}
        onClose={() => setShowDetailsMenu(false)}
        title="Priority, status & dates"
        size="sm"
      >
        <div className="space-y-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-foreground">
              Priority
            </span>
            <PrioritySelect
              value={intentPriority}
              onChange={(e) => handleUpdatePriority(e.target.value)}
              disabled={updatingIntent}
              className="block w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-primary disabled:opacity-60"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-foreground">Status</span>
            <select
              value={intentStatus}
              onChange={(e) => handleUpdateStatus(e.target.value)}
              disabled={updatingIntent}
              className="block w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary disabled:opacity-60"
            >
              {BULK_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-foreground">
                Start date
              </span>
              <input
                type="date"
                value={intentStartDate}
                onChange={(e) => handleUpdateStartDate(e.target.value)}
                disabled={updatingIntent}
                className="block w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-primary disabled:opacity-60"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-foreground">
                Due date
              </span>
              <input
                type="date"
                value={intentDueDate}
                onChange={(e) => handleUpdateDueDate(e.target.value)}
                disabled={updatingIntent}
                className="block w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-primary disabled:opacity-60"
              />
            </label>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

function WorkQuickAddBar({ intentId, onOpenDetails }) {
  const { notify } = useNotifications();
  const createWorkMutation = useCreateWorkItem();
  const [title, setTitle] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle) return;

    try {
      await createWorkMutation.mutateAsync({ title: nextTitle, intentId });
      setTitle("");
    } catch (error) {
      console.error("Failed to create work", error);
      notify("Failed to create work");
    }
  };

  return (
    <div className="mb-4">
      <form className="flex items-end gap-2" onSubmit={handleSubmit}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs to happen?"
          className="block w-full min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground focus:border-primary focus:ring-primary"
        />
        <Button
          type="submit"
          variant="primary"
          pill={false}
          className="shrink-0"
          disabled={createWorkMutation.isPending || !title.trim()}
        >
          Add
        </Button>
      </form>
      <button
        type="button"
        onClick={onOpenDetails}
        className="mt-1.5 min-h-8 text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline"
      >
        + Add details (duration, notes, location)
      </button>
    </div>
  );
}

export default function IntentPage() {
  const { notify, confirm } = useNotifications();
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: intent, isLoading: loading } = useIntent(id);
  const [deletingWorkId, setDeletingWorkId] = useState(null);
  const [workModalTarget, setWorkModalTarget] = useState(null);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [isSuggestingWork, setIsSuggestingWork] = useState(false);
  const [addingSuggestionIndex, setAddingSuggestionIndex] = useState(null);
  const [showPlanModal, setShowPlanModal] = useState(false);

  const patchIntentMutation = usePatchIntent();
  const { data: plans = [] } = usePlans();
  const updatePlanMutation = useUpdatePlan();

  const handlePatchIntent = async (patch) => {
    try {
      return await patchIntentMutation.mutateAsync({ intentId: id, patch });
    } catch (error) {
      console.error("Failed to update intent", error);
      notify("Unable to update intent right now.");
      throw error;
    }
  };

  const patchWorkMutation = useUpdateWorkItem();

  const handleCycleWorkStatus = async (work) => {
    const currentIndex = WORK_STATUS_OPTIONS.findIndex(
      (option) => option.value === work.status
    );
    const next =
      WORK_STATUS_OPTIONS[(currentIndex + 1) % WORK_STATUS_OPTIONS.length];
    try {
      await patchWorkMutation.mutateAsync({
        workId: work.id,
        patch: { status: next.value },
      });
    } catch (error) {
      console.error("Failed to update work status", error);
      notify("Unable to update work right now.");
    }
  };

  const deleteWorkMutation = useDeleteWorkItem();

  const handleDeleteWork = async (work) => {
    const confirmed = await confirm(
      `Delete "${work.title}"? This can't be undone.`,
      {
        title: "Delete work item?",
        confirmLabel: "Delete",
        danger: true,
      }
    );
    if (!confirmed) return;

    setDeletingWorkId(work.id);
    try {
      await deleteWorkMutation.mutateAsync(work.id);
    } catch (error) {
      console.error("Failed to delete work item", error);
      notify("Failed to delete work item.");
    } finally {
      setDeletingWorkId(null);
    }
  };

  const suggestWorkMutation = useSuggestWork();

  const handleSuggestWork = async () => {
    setIsSuggestingWork(true);
    try {
      const data = await suggestWorkMutation.mutateAsync(id);
      const suggestions = data?.suggestions || [];
      setAiSuggestions(suggestions);
      if (suggestions.length === 0) {
        notify("No suggestions this time - try adding a description.", {
          type: "info",
        });
      }
    } catch (error) {
      console.error("Failed to get AI suggestions", error);
      notify(
        error.response?.data?.error || "Failed to get AI suggestions right now."
      );
    } finally {
      setIsSuggestingWork(false);
    }
  };

  const dismissSuggestion = (index) => {
    setAiSuggestions((prev) => prev.filter((_, i) => i !== index));
  };

  const createWorkMutation = useCreateWorkItem();

  const addSuggestionAsWork = async (index) => {
    const suggestion = aiSuggestions[index];
    if (!suggestion) return;

    setAddingSuggestionIndex(index);
    try {
      await createWorkMutation.mutateAsync({
        title: suggestion.title,
        notes: suggestion.notes || undefined,
        durationMinutes: suggestion.durationMinutes || 30,
        intentId: id,
      });
      dismissSuggestion(index);
    } catch (error) {
      console.error("Failed to add suggested work", error);
      notify("Failed to add this suggestion.");
    } finally {
      setAddingSuggestionIndex(null);
    }
  };

  const placesToVisit = useMemo(() => {
    const seen = new Set();
    const result = [];
    (intent?.workItems || []).forEach((work) => {
      const chosen = getChosenOption(work);
      (chosen?.locations || []).forEach((location) => {
        const key = location.id || location.placeId || location.name;
        if (seen.has(key)) return;
        seen.add(key);
        result.push(location);
      });
    });
    return result;
  }, [intent?.workItems]);

  if (loading)
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading intent...
      </div>
    );

  if (!intent)
    return <div className="p-8 text-center text-danger">Intent not found</div>;

  const eligibleWorkIds = (intent.workItems || [])
    .filter((work) => work.status !== "done")
    .map((work) => work.id);
  const plannablePlans = plans.filter(
    (plan) => plan.status === "draft" || plan.status === "active"
  );

  const handleAddIntentToPlan = async (planId) => {
    try {
      await updatePlanMutation.mutateAsync({
        planId,
        patch: { forceIncludeWorkIds: eligibleWorkIds },
      });
      setShowPlanModal(false);
      navigate(`/plan/${planId}`);
    } catch (error) {
      console.error("Failed to add intent's work to plan", error);
      notify(error.response?.data?.error || "Failed to add work to that plan");
    }
  };

  const handleCreateNewPlanForIntent = () => {
    setShowPlanModal(false);
    navigate(`/planner?intentId=${id}`);
  };

  const workCount = intent.workItems?.length || 0;
  const completedCount =
    intent.workItems?.filter((work) => work.status === "done").length || 0;
  const totalMinutes = (intent.workItems || []).reduce(
    (sum, work) => sum + (work.durationMinutes || 0),
    0
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
      <Link
        to="/"
        className="mb-3 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        ← Back to Intents
      </Link>

      <IntentSummaryCard
        intent={intent}
        onPatchIntent={handlePatchIntent}
        updatingIntent={patchIntentMutation.isPending}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)]">
        <section>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
                Work
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                What needs to happen?
              </p>
            </div>
            <Button
              variant="accent-outline"
              size="sm"
              onClick={handleSuggestWork}
              disabled={isSuggestingWork}
            >
              {isSuggestingWork ? "Thinking…" : "✨ Suggest Work"}
            </Button>
          </div>

          <WorkQuickAddBar
            intentId={id}
            onOpenDetails={() => setWorkModalTarget("new")}
          />

          {aiSuggestions.length > 0 && (
            <div className="mb-4 space-y-2 rounded-3xl border border-accent/30 bg-accent/10 p-4">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-accent">
                  ✨ AI suggestions
                </h3>
                <button
                  type="button"
                  onClick={() => setAiSuggestions([])}
                  className="min-h-8 text-xs font-semibold text-accent hover:underline"
                >
                  Dismiss all
                </button>
              </div>
              {aiSuggestions.map((suggestion, index) => (
                <div
                  key={`${suggestion.title}-${index}`}
                  className="flex flex-col gap-2 rounded-2xl border border-accent/20 bg-surface p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-foreground">
                      {suggestion.title}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {suggestion.durationMinutes} min
                      {suggestion.needsLocation ? " · might need a place" : ""}
                      {suggestion.notes ? ` · ${suggestion.notes}` : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => dismissSuggestion(index)}
                      disabled={addingSuggestionIndex === index}
                    >
                      Dismiss
                    </Button>
                    <Button
                      variant="accent"
                      size="sm"
                      onClick={() => addSuggestionAsWork(index)}
                      disabled={addingSuggestionIndex === index}
                    >
                      {addingSuggestionIndex === index ? "Adding…" : "+ Add"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {intent.workItems && intent.workItems.length > 0 ? (
            <div className="grid gap-2">
              {intent.workItems.map((work) => {
                const placeCount = work.locationOptions?.reduce(
                  (sum, option) => sum + (option.locations?.length || 0),
                  0
                );
                return (
                  <div
                    key={work.id}
                    onClick={() => setWorkModalTarget(work)}
                    className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-sm transition hover:border-primary/50 hover:shadow-md sm:p-4"
                  >
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleCycleWorkStatus(work);
                      }}
                      title="Click to change status"
                      className="shrink-0"
                    >
                      <Badge tone={STATUS_TONE[work.status] || "neutral"}>
                        {work.status.replace("_", " ")}
                      </Badge>
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-foreground sm:text-base">
                        {work.title}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{work.durationMinutes || 30} min</span>
                        <span>
                          {placeCount > 0
                            ? `📍 ${placeCount} place${placeCount === 1 ? "" : "s"}`
                            : "No location"}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDeleteWork(work);
                      }}
                      disabled={deletingWorkId === work.id}
                      aria-label={`Delete ${work.title}`}
                      title="Delete work item"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-danger/30 bg-danger/10 text-danger transition hover:bg-danger/20 disabled:opacity-50"
                    >
                      {deletingWorkId === work.id ? "…" : "✕"}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-surface-alt p-6 text-center sm:p-12">
              <p className="text-muted-foreground mb-4">
                No work has been added yet.
              </p>
              <p className="text-sm text-muted-foreground">
                Add something that needs to happen and optionally describe where
                it can be done.
              </p>
            </div>
          )}
        </section>

        <Card
          as="aside"
          padding="lg"
          className="order-first sm:p-6 lg:order-none"
        >
          <div className="mb-4 flex flex-col gap-3 sm:mb-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Summary</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {workCount} work · {completedCount} done ·{" "}
                {formatMinutes(totalMinutes)}
              </p>
            </div>
            <Button
              variant="primary"
              pill={false}
              onClick={() => setShowPlanModal(true)}
            >
              Plan this Intent
            </Button>
          </div>

          <h3 className="mb-2 text-sm font-semibold text-foreground">
            Places to visit
            {placesToVisit.length > 0 ? ` (${placesToVisit.length})` : ""}
          </h3>
          {placesToVisit.length > 0 ? (
            <div className="space-y-2">
              {placesToVisit.map((location) => (
                <LocationCard
                  key={location.id || location.placeId || location.name}
                  location={location}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Derived automatically from the locations you choose for work
              items.
            </p>
          )}
        </Card>
      </div>

      {workModalTarget !== null && (
        <WorkFormModal
          key={workModalTarget === "new" ? "new" : workModalTarget.id}
          open
          onClose={() => setWorkModalTarget(null)}
          intentId={id}
          work={workModalTarget === "new" ? null : workModalTarget}
        />
      )}

      <Modal
        open={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        title="Plan this Intent"
        size="sm"
      >
        {eligibleWorkIds.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This intent has no remaining work to plan.
          </p>
        ) : (
          <div className="space-y-4">
            <Button
              variant="primary"
              pill={false}
              className="w-full"
              onClick={handleCreateNewPlanForIntent}
            >
              + Create a new plan
            </Button>

            {plannablePlans.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Or add to an existing plan
                </p>
                <div className="space-y-2">
                  {plannablePlans.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => handleAddIntentToPlan(plan.id)}
                      disabled={updatePlanMutation.isPending}
                      className="block w-full rounded-xl border border-border bg-surface px-3 py-2 text-left text-sm text-foreground transition hover:border-primary/50 disabled:opacity-50"
                    >
                      {getPlanDisplayTitle(plan)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
