import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import Badge from "../../components/ui/Badge";
import { useNotifications } from "../../hooks/useNotifications";
import { useBulkDeleteIntents, usePatchIntent } from "./hooks";
import { formatDate, getDueMeta, toDateInputValue } from "./utils";

const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_TOLERANCE = 10;
const SWIPE_ACTIVATE_PX = 12;
const SWIPE_ACTION_PX = 88;

// The whole card is one clickable region — an invisible full-bleed Link
// sits behind everything so tapping anywhere (not just the title) opens the
// intent's detail page. Priority/date/status controls stay directly
// clickable by punching through the passive content's `pointer-events-none`
// with their own `pointer-events-auto`. A press-and-hold anywhere else
// enters bulk-selection mode, and on touch devices a horizontal drag
// completes or deletes the intent without leaving the list.
export default function IntentCard({
  intent,
  selectionMode,
  isSelected,
  onToggleSelected,
  onEnterSelectionMode,
}) {
  const { notify, confirm } = useNotifications();
  const patchIntentMutation = usePatchIntent();
  const deleteIntentMutation = useBulkDeleteIntents();

  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const gestureRef = useRef(null);
  const suppressClickRef = useRef(false);

  const isUpdating = patchIntentMutation.isPending;

  const handlePatch = async (patch, failureMessage) => {
    try {
      await patchIntentMutation.mutateAsync({ intentId: intent.id, patch });
    } catch (error) {
      console.error("Failed to update intent", error);
      notify(failureMessage);
    }
  };

  const handleUpdateStatus = (status) =>
    handlePatch({ status }, "Unable to update status right now.");
  const handleUpdatePriority = (priority) =>
    handlePatch({ priority }, "Unable to update priority right now.");
  const handleUpdateStartDate = (value) =>
    handlePatch(
      { startDate: value || null },
      "Unable to update start date right now."
    );
  const handleUpdateDueDate = (value) =>
    handlePatch(
      { dueDate: value || null },
      "Unable to update due date right now."
    );

  const handleSwipeDelete = async () => {
    const confirmed = await confirm(
      `Delete "${intent.title}"? This also deletes all of its work items and removes it from the planner. This can't be undone.`,
      { title: "Delete intent?", confirmLabel: "Delete", danger: true }
    );
    if (!confirmed) {
      setDragX(0);
      return;
    }
    try {
      await deleteIntentMutation.mutateAsync([intent.id]);
    } catch (error) {
      console.error("Failed to delete intent", error);
      notify("Unable to delete intent right now.");
      setDragX(0);
    }
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

  const clearLongPressTimer = () => {
    if (gestureRef.current?.timer) clearTimeout(gestureRef.current.timer);
  };

  const handlePointerDown = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (event.target.closest("button, select, input, label")) return;

    const state = {
      startX: event.clientX,
      startY: event.clientY,
      pointerType: event.pointerType,
      longPressTriggered: false,
      swiping: false,
    };
    state.timer = setTimeout(() => {
      state.longPressTriggered = true;
      navigator.vibrate?.(15);
      onEnterSelectionMode(intent.id);
    }, LONG_PRESS_MS);
    gestureRef.current = state;
  };

  const handlePointerMove = (event) => {
    const state = gestureRef.current;
    if (!state || state.longPressTriggered) return;

    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;

    if (state.swiping) {
      setDragX(dx);
      return;
    }

    if (
      state.pointerType === "touch" &&
      !selectionMode &&
      Math.abs(dx) > SWIPE_ACTIVATE_PX &&
      Math.abs(dx) > Math.abs(dy)
    ) {
      clearLongPressTimer();
      state.swiping = true;
      setIsDragging(true);
      setDragX(dx);
      return;
    }

    if (
      Math.abs(dx) > LONG_PRESS_MOVE_TOLERANCE ||
      Math.abs(dy) > LONG_PRESS_MOVE_TOLERANCE
    ) {
      clearLongPressTimer();
    }
  };

  const endGesture = () => {
    const state = gestureRef.current;
    clearLongPressTimer();

    if (state?.longPressTriggered || state?.swiping) {
      suppressClickRef.current = true;
    }

    if (state?.swiping) {
      setIsDragging(false);
      if (dragX > SWIPE_ACTION_PX) {
        setDragX(0);
        handleUpdateStatus(
          intent.status === "completed" ? "active" : "completed"
        );
      } else if (dragX < -SWIPE_ACTION_PX) {
        handleSwipeDelete();
      } else {
        setDragX(0);
      }
    }

    gestureRef.current = null;
  };

  const handleClickCapture = (event) => {
    if (suppressClickRef.current) {
      event.preventDefault();
      event.stopPropagation();
      suppressClickRef.current = false;
    }
  };

  const handleLinkClick = (event) => {
    if (selectionMode) {
      event.preventDefault();
      onToggleSelected(intent.id);
    }
  };

  const workCount = intent.workCount;
  const doneCount = intent.completedWorkCount;
  const placeCount = intent.placeCount;
  const completion =
    workCount > 0 ? Math.round((doneCount / workCount) * 100) : 0;
  const statusTone =
    intent.status === "completed"
      ? "success"
      : intent.status === "not_required"
        ? "neutral"
        : "primary";
  const actionConfigs =
    intent.status === "active"
      ? [
          {
            label: "Complete",
            value: "completed",
            style:
              "border-success/30 bg-success/10 text-success hover:bg-success/20",
          },
          {
            label: "Not Required",
            value: "not_required",
            style:
              "border-border bg-surface-alt text-muted-foreground hover:bg-border",
          },
        ]
      : intent.status === "completed"
        ? [
            {
              label: "Active",
              value: "active",
              style:
                "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20",
            },
            {
              label: "Not Required",
              value: "not_required",
              style:
                "border-border bg-surface-alt text-muted-foreground hover:bg-border",
            },
          ]
        : [
            {
              label: "Active",
              value: "active",
              style:
                "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20",
            },
            {
              label: "Complete",
              value: "completed",
              style:
                "border-success/30 bg-success/10 text-success hover:bg-success/20",
            },
          ];
  const priorityTone =
    intent.priority === "high"
      ? "danger"
      : intent.priority === "low"
        ? "neutral"
        : "warning";
  const priorityStyle = {
    danger: "bg-danger/15 text-danger",
    neutral: "bg-surface-alt text-muted-foreground",
    warning: "bg-warning/15 text-warning",
  }[priorityTone];
  const dueMeta = getDueMeta(intent.dueDate);
  const isOverdue = dueMeta.label.includes("overdue");
  const topMetaLabel = isOverdue
    ? dueMeta.label
    : intent.status === "active"
      ? dueMeta.label
      : intent.status.replace("_", " ");
  const topMetaTone = isOverdue
    ? dueMeta.tone
    : intent.status === "active"
      ? dueMeta.tone
      : statusTone;

  return (
    <article
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      onPointerLeave={endGesture}
      onClickCapture={handleClickCapture}
      onContextMenu={(event) => event.preventDefault()}
      style={{ WebkitTouchCallout: "none" }}
      className={`group relative flex flex-col gap-3 overflow-hidden rounded-2xl border bg-surface p-4 shadow-sm transition-all select-none hover:shadow-md sm:p-5 ${
        isSelected
          ? "border-primary ring-2 ring-primary/20"
          : "border-border hover:border-primary/50"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 flex items-center justify-between rounded-2xl">
        <span
          className={`flex h-full items-center bg-success px-4 text-sm font-semibold text-success-foreground transition-opacity ${
            dragX > 10 ? "opacity-100" : "opacity-0"
          }`}
        >
          {intent.status === "completed" ? "Reactivate" : "Complete"}
        </span>
        <span
          className={`flex h-full items-center bg-danger px-4 text-sm font-semibold text-danger-foreground transition-opacity ${
            dragX < -10 ? "opacity-100" : "opacity-0"
          }`}
        >
          Delete
        </span>
      </div>

      <Link
        to={`/intent/${intent.id}`}
        onClick={handleLinkClick}
        aria-label={intent.title}
        className="absolute inset-0 z-0 rounded-2xl focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
      />

      <div
        className="relative z-10 flex flex-1 flex-col gap-3 pointer-events-none"
        style={{
          transform: `translateX(${dragX}px)`,
          transition: isDragging ? "none" : "transform 200ms ease",
        }}
      >
        <div className="flex items-start gap-3">
          {selectionMode && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelected(intent.id)}
              aria-label={`Select ${intent.title}`}
              className="pointer-events-auto mt-1.5 h-5 w-5 shrink-0 rounded border-border text-primary focus:ring-primary"
            />
          )}

          <div className="min-w-0 flex-1">
            <h2 className="line-clamp-2 text-lg font-semibold text-foreground transition-colors group-hover:text-primary sm:text-xl">
              {intent.title}
            </h2>
            {intent.description && (
              <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                {intent.description}
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <select
              value={intent.priority}
              onChange={(e) => handleUpdatePriority(e.target.value)}
              disabled={isUpdating}
              className={`pointer-events-auto h-8 rounded-full border-0 px-3 text-xs font-semibold uppercase tracking-wide outline-none disabled:opacity-60 ${priorityStyle}`}
              title="Set priority"
            >
              <option value="high">high</option>
              <option value="medium">medium</option>
              <option value="low">low</option>
            </select>
            <Badge tone={topMetaTone}>{topMetaLabel}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Start
            </span>
            <button
              type="button"
              onClick={() => openDateInput(`start-date-${intent.id}`)}
              disabled={isUpdating}
              className="pointer-events-auto relative h-10 w-full rounded-lg border border-border bg-surface-alt px-2.5 text-left text-sm font-medium text-foreground transition hover:bg-border disabled:opacity-60"
            >
              <span className="flex h-full items-center">
                {formatDate(intent.startDate)}
              </span>
              <input
                id={`start-date-${intent.id}`}
                type="date"
                value={toDateInputValue(intent.startDate)}
                onChange={(e) => handleUpdateStartDate(e.target.value)}
                disabled={isUpdating}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                title="Set start date"
              />
            </button>
          </label>

          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Due
            </span>
            <button
              type="button"
              onClick={() => openDateInput(`due-date-${intent.id}`)}
              disabled={isUpdating}
              className="pointer-events-auto relative h-10 w-full rounded-lg border border-border bg-surface-alt px-2.5 text-left text-sm font-medium text-foreground transition hover:bg-border disabled:opacity-60"
            >
              <span className="flex h-full items-center">
                {formatDate(intent.dueDate)}
              </span>
              <input
                id={`due-date-${intent.id}`}
                type="date"
                value={toDateInputValue(intent.dueDate)}
                onChange={(e) => handleUpdateDueDate(e.target.value)}
                disabled={isUpdating}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                title="Set due date"
              />
            </button>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <span
            className="whitespace-nowrap text-sm text-muted-foreground"
            title={`${doneCount} of ${workCount} work items complete, ${placeCount} place${placeCount === 1 ? "" : "s"}`}
          >
            {doneCount}/{workCount} work · {placeCount} place
            {placeCount === 1 ? "" : "s"}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-alt">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${completion}%` }}
            />
          </div>
          <span className="whitespace-nowrap text-sm font-semibold text-foreground">
            {completion}%
          </span>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          {actionConfigs.map((action) => (
            <button
              key={action.value}
              type="button"
              onClick={() => handleUpdateStatus(action.value)}
              disabled={isUpdating || intent.status === action.value}
              className={`pointer-events-auto inline-flex h-9 flex-1 items-center justify-center rounded-lg border px-3 text-sm font-semibold transition disabled:opacity-50 ${action.style}`}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}
