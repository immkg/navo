import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import Badge from "../../components/ui/Badge";
import { useNotifications } from "../../hooks/useNotifications";
import { useBulkDeleteIntents, usePatchIntent } from "./hooks";
import { getDueMeta } from "./utils";

const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_TOLERANCE = 10;
const SWIPE_ACTIVATE_PX = 12;
const SWIPE_ACTION_PX = 88;

const PRIORITY_ACCENT = {
  high: "bg-danger",
  medium: "bg-warning",
  low: "bg-muted-foreground/40",
};

// A display-only summary for scanning a list of many intents — title,
// priority, due/urgency, and progress. Editing priority/status/dates lives
// on the detail page, not here. The whole card is one clickable region (an
// invisible full-bleed link behind the passive content) so tapping
// anywhere opens the detail page; the checkbox punches through via its own
// `pointer-events-auto`. A press-and-hold enters bulk-selection mode, and
// on touch devices a horizontal drag completes or deletes the intent
// without leaving the list.
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

  const handleUpdateStatus = async (status) => {
    try {
      await patchIntentMutation.mutateAsync({
        intentId: intent.id,
        patch: { status },
      });
    } catch (error) {
      console.error("Failed to update intent", error);
      notify("Unable to update status right now.");
    }
  };

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
  const completion =
    workCount > 0 ? Math.round((doneCount / workCount) * 100) : 0;
  const statusTone =
    intent.status === "completed"
      ? "success"
      : intent.status === "not_required"
        ? "neutral"
        : "primary";
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
  const priorityAccent =
    PRIORITY_ACCENT[intent.priority] || PRIORITY_ACCENT.medium;

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
      className={`group relative flex flex-col gap-2.5 overflow-hidden rounded-2xl border bg-surface p-4 shadow-sm transition-all select-none hover:shadow-md ${
        isSelected
          ? "border-primary ring-2 ring-primary/20"
          : "border-border hover:border-primary/50"
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 left-0 w-1.5 ${priorityAccent}`}
        title={`${intent.priority} priority`}
      />

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
        className="relative z-10 flex flex-1 flex-col gap-2.5 pointer-events-none"
        style={{
          transform: `translateX(${dragX}px)`,
          transition: isDragging ? "none" : "transform 200ms ease",
        }}
      >
        <div className="flex items-start gap-3 pl-1.5">
          {selectionMode && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelected(intent.id)}
              aria-label={`Select ${intent.title}`}
              className="pointer-events-auto mt-1 h-5 w-5 shrink-0 rounded border-border text-primary focus:ring-primary"
            />
          )}

          <h2 className="line-clamp-2 min-w-0 flex-1 text-base font-semibold text-foreground transition-colors group-hover:text-primary">
            {intent.title}
          </h2>

          <Badge tone={topMetaTone} className="shrink-0">
            {topMetaLabel}
          </Badge>
        </div>

        <div className="flex items-center gap-2 pl-1.5">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-alt">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${completion}%` }}
            />
          </div>
          <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">
            {doneCount}/{workCount}
          </span>
        </div>
      </div>
    </article>
  );
}
