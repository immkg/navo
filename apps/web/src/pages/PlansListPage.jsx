import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { useNotifications } from "../hooks/useNotifications";
import { useCreatePlan, usePlans } from "../modules/plan/hooks";
import PlanLocationPicker from "../modules/plan/PlanLocationPicker";

const STATUS_TONE = {
  draft: "neutral",
  active: "primary",
  completed: "success",
  abandoned: "danger",
};

// `<input type="datetime-local">` reads/writes local wall-clock time with no
// timezone info, but toISOString() always renders UTC — so the naive
// approach shifts the displayed default by the viewer's UTC offset. Shifting
// the Date by that same offset before formatting cancels it out.
function defaultDateTime(hoursFromNow) {
  const date = new Date(Date.now() + hoursFromNow * 3600000);
  date.setSeconds(0, 0);
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localTime.toISOString().slice(0, 16);
}

function emptyLocation(hoursFromNow) {
  return {
    dateTime: defaultDateTime(hoursFromNow),
    label: "",
    latitude: null,
    longitude: null,
  };
}

export default function PlansListPage() {
  const { notify } = useNotifications();
  const navigate = useNavigate();
  const { data: plans = [], isLoading } = usePlans();
  const createPlanMutation = useCreatePlan();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(emptyLocation(0));
  const [end, setEnd] = useState(emptyLocation(8));

  const resetForm = () => {
    setTitle("");
    setStart(emptyLocation(0));
    setEnd(emptyLocation(8));
    setShowCreateForm(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!start.dateTime || !end.dateTime) {
      notify("Start and end date/time are required.");
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
            />
            <PlanLocationPicker legend="End" value={end} onChange={setEnd} />

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
              as="button"
              onClick={() => navigate(`/plan/${plan.id}`)}
              className="text-left transition hover:bg-surface-alt"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-foreground">
                    {plan.title || new Date(plan.startAt).toLocaleDateString()}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {new Date(plan.startAt).toLocaleString()} →{" "}
                    {new Date(plan.endAt).toLocaleString()}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {plan.stops.length} stop{plan.stops.length === 1 ? "" : "s"}
                  </div>
                </div>
                <Badge tone={STATUS_TONE[plan.status] || "neutral"}>
                  {plan.status}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
