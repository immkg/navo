import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { useNotifications } from "../hooks/useNotifications";
import { useCreatePlan, useDeletePlan, usePlans } from "../modules/plan/hooks";
import { useWorkItems } from "../modules/work/hooks";
import PlanLocationPicker from "../modules/plan/PlanLocationPicker";
import {
  getPlanDisplayTitle,
  PLAN_ENERGY_LEVEL_OPTIONS,
  toDateTimeLocalValue,
} from "../modules/plan/utils";

const STATUS_TONE = {
  draft: "neutral",
  active: "primary",
  completed: "success",
  abandoned: "danger",
};

function emptyLocation(hoursFromNow) {
  return {
    dateTime: toDateTimeLocalValue(Date.now() + hoursFromNow * 3600000),
    label: "",
    latitude: null,
    longitude: null,
  };
}

function formatPlanDuration(startDateTime, endDateTime) {
  if (!startDateTime || !endDateTime) return null;
  const minutes = Math.round(
    (new Date(endDateTime).getTime() - new Date(startDateTime).getTime()) /
      60000
  );
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder} min`;
  if (remainder === 0) return `${hours} hr${hours === 1 ? "" : "s"}`;
  return `${hours} hr${hours === 1 ? "" : "s"} ${remainder} min`;
}

export default function PlansListPage() {
  const { notify, confirm } = useNotifications();
  const navigate = useNavigate();
  const { data: plans = [], isLoading } = usePlans();
  const { data: workItems = [] } = useWorkItems();
  const createPlanMutation = useCreatePlan();
  const deletePlanMutation = useDeletePlan();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(emptyLocation(0));
  const [end, setEnd] = useState(emptyLocation(8));
  const [energyLevel, setEnergyLevel] = useState("high");
  const [useAccurateTravelTime, setUseAccurateTravelTime] = useState(false);

  const eligibleWorkCount = useMemo(
    () => workItems.filter((item) => item.status !== "done").length,
    [workItems]
  );
  const planDuration = useMemo(
    () => formatPlanDuration(start.dateTime, end.dateTime),
    [start.dateTime, end.dateTime]
  );

  const resetForm = () => {
    setTitle("");
    setStart(emptyLocation(0));
    setEnd(emptyLocation(8));
    setEnergyLevel("high");
    setUseAccurateTravelTime(false);
    setShowCreateForm(false);
  };

  const handleDelete = async (event, plan) => {
    event.stopPropagation();
    const confirmed = await confirm(
      `Delete "${getPlanDisplayTitle(plan)}"? This can't be undone.`,
      { title: "Delete plan?", confirmLabel: "Delete", danger: true }
    );
    if (!confirmed) return;

    try {
      await deletePlanMutation.mutateAsync(plan.id);
    } catch (error) {
      console.error("Failed to delete plan", error);
      notify(error.response?.data?.error || "Failed to delete plan");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!start.dateTime || !end.dateTime) {
      notify("Start and end date/time are required.");
      return;
    }
    if (start.latitude == null || start.longitude == null) {
      notify(
        "Pick a start location (use current location, search, or enter coordinates)."
      );
      return;
    }
    if (end.latitude == null || end.longitude == null) {
      notify(
        "Pick an end location (use current location, search, or enter coordinates)."
      );
      return;
    }

    try {
      const plan = await createPlanMutation.mutateAsync({
        title: title.trim() || undefined,
        startAt: new Date(start.dateTime).toISOString(),
        startLabel: start.label || undefined,
        startLatitude: start.latitude,
        startLongitude: start.longitude,
        endAt: new Date(end.dateTime).toISOString(),
        endLabel: end.label || undefined,
        endLatitude: end.latitude,
        endLongitude: end.longitude,
        energyLevel,
        useAccurateTravelTime,
      });
      resetForm();
      navigate(`/plan/${plan.id}`);
    } catch (error) {
      console.error("Failed to create plan", error);
      notify(error.response?.data?.error || "Failed to create plan");
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-3 py-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between sm:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            Plans
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Time-boxed plans that fit as much work as reasonably possible
            between a start and an end.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowCreateForm((open) => !open)}
        >
          {showCreateForm ? "Cancel" : "+ New plan"}
        </Button>
      </div>

      {showCreateForm && (
        <Card padding="lg" className="mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Title (optional)
              </span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g., Saturday errands"
                className="block w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-primary"
              />
            </label>

            <PlanLocationPicker
              legend="Start"
              value={start}
              onChange={setStart}
              autoDetectOnMount
            />
            <PlanLocationPicker legend="End" value={end} onChange={setEnd} />

            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Energy level
              </span>
              <select
                value={energyLevel}
                onChange={(event) => setEnergyLevel(event.target.value)}
                className="block w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-primary"
              >
                {PLAN_ENERGY_LEVEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={useAccurateTravelTime}
                onChange={(event) =>
                  setUseAccurateTravelTime(event.target.checked)
                }
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              Use real driving time (Google Maps) instead of straight-line
              distance
            </label>

            {(planDuration || eligibleWorkCount > 0) && (
              <p className="text-sm text-muted-foreground">
                {planDuration && <>Window: {planDuration}. </>}
                {eligibleWorkCount} eligible work item
                {eligibleWorkCount === 1 ? "" : "s"} to fit in.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={resetForm}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={createPlanMutation.isPending}
              >
                {createPlanMutation.isPending ? "Building…" : "Create plan"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">
          Loading plans…
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-3xl bg-surface-alt p-6 text-muted-foreground">
          No plans yet. Create one to get started.
        </div>
      ) : (
        <div className="grid gap-4">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className="text-left transition hover:bg-surface-alt"
            >
              <div className="flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => navigate(`/plan/${plan.id}`)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="font-semibold text-foreground">
                    {getPlanDisplayTitle(plan)}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {new Date(plan.startAt).toLocaleString()} →{" "}
                    {new Date(plan.endAt).toLocaleString()}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {plan.stops.length} stop{plan.stops.length === 1 ? "" : "s"}
                  </div>
                </button>
                <div className="flex flex-col items-end gap-2">
                  <Badge tone={STATUS_TONE[plan.status] || "neutral"}>
                    {plan.status}
                  </Badge>
                  <Button
                    variant="danger-outline"
                    size="sm"
                    onClick={(event) => handleDelete(event, plan)}
                    disabled={deletePlanMutation.isPending}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
