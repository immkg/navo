import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { useNotifications } from "../hooks/useNotifications";
import { usePlan, useUpdatePlan } from "../modules/plan/hooks";
import { loadGoogleMaps } from "../utils/googleMaps";

const STATUS_TONE = {
  draft: "neutral",
  active: "primary",
  completed: "success",
  abandoned: "danger",
};

const ITEM_STATUS_TONE = {
  planned: "neutral",
  in_progress: "primary",
  done: "success",
  skipped: "warning",
};

function formatDateTime(iso) {
  return new Date(iso).toLocaleString([], {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function PlanDetailPage() {
  const { id } = useParams();
  const { notify } = useNotifications();
  const { data: plan, isLoading } = usePlan(id);
  const updatePlanMutation = useUpdatePlan();
  const mapRef = useRef(null);
  const [mapError, setMapError] = useState(null);
  const googleKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const stops = plan?.stops || [];

  useEffect(() => {
    if (!googleKey || !mapRef.current || stops.length === 0) return;

    setMapError(null);
    let mapInstance;

    loadGoogleMaps(googleKey)
      .then((maps) => {
        const center = stops[0].location;
        mapInstance = new maps.Map(mapRef.current, {
          center: { lat: center.latitude, lng: center.longitude },
          zoom: 12,
          disableDefaultUI: true,
        });

        const bounds = new maps.LatLngBounds();
        stops.forEach((stop, index) => {
          if (
            stop.location.latitude == null ||
            stop.location.longitude == null
          ) {
            return;
          }
          const position = {
            lat: stop.location.latitude,
            lng: stop.location.longitude,
          };
          new maps.Marker({
            position,
            map: mapInstance,
            label: String.fromCharCode(65 + (index % 26)),
            title: stop.location.name,
          });
          bounds.extend(position);
        });
        mapInstance.fitBounds(bounds, 80);
      })
      .catch((error) => {
        console.warn("Google Maps JS failed to load", error);
        setMapError(error.message || "Failed to load Google Maps");
      });

    return () => {
      mapInstance = null;
    };
  }, [googleKey, stops]);

  const handleStatusChange = async (status) => {
    try {
      await updatePlanMutation.mutateAsync({ planId: id, patch: { status } });
    } catch (error) {
      console.error("Failed to update plan status", error);
      notify(error.response?.data?.error || "Failed to update plan status");
    }
  };

  if (isLoading) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Loading plan…
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Plan not found.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-3 py-4 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            {plan.title || "Plan"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDateTime(plan.startAt)} → {formatDateTime(plan.endAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={STATUS_TONE[plan.status] || "neutral"}>
            {plan.status}
          </Badge>
          {plan.status === "draft" && (
            <Button
              variant="primary"
              onClick={() => handleStatusChange("active")}
            >
              Start
            </Button>
          )}
          {plan.status === "active" && (
            <>
              <Button
                variant="secondary"
                onClick={() => handleStatusChange("completed")}
              >
                Complete
              </Button>
              <Button
                variant="danger-outline"
                onClick={() => handleStatusChange("abandoned")}
              >
                Abandon
              </Button>
            </>
          )}
        </div>
      </div>

      <Card padding="lg" className="mb-6">
        {stops.length === 0 ? (
          <div className="rounded-3xl bg-surface-alt p-6 text-muted-foreground">
            Nothing fits in this window yet.
          </div>
        ) : googleKey ? (
          mapError ? (
            <div className="rounded-3xl border border-dashed border-border bg-surface-alt p-8 text-center text-muted-foreground">
              {mapError}
            </div>
          ) : (
            <div
              ref={mapRef}
              className="h-80 w-full rounded-3xl border border-border"
            />
          )
        ) : (
          <div className="rounded-3xl border border-dashed border-border bg-surface-alt p-8 text-center text-muted-foreground">
            Configure VITE_GOOGLE_MAPS_API_KEY to see a map preview.
          </div>
        )}
      </Card>

      <div className="grid gap-4">
        {stops.map((stop, index) => (
          <Card key={stop.id} padding="lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Stop {index + 1} · {formatDateTime(stop.plannedArrivalAt)} –{" "}
                  {formatDateTime(stop.plannedDepartureAt)}
                </div>
                <div className="text-lg font-semibold text-foreground">
                  {stop.location.name}
                </div>
                {stop.location.address && (
                  <div className="mt-1 text-sm text-muted-foreground">
                    {stop.location.address}
                  </div>
                )}
              </div>
              <Badge tone={ITEM_STATUS_TONE[stop.status] || "neutral"}>
                {stop.status}
              </Badge>
            </div>

            <div className="mt-4 grid gap-2">
              {stop.works.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-surface-alt p-3"
                >
                  <div>
                    <div className="font-medium text-foreground">
                      {assignment.work.title}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {assignment.work.priority} priority ·{" "}
                      {assignment.work.durationMinutes} min
                    </div>
                  </div>
                  <Badge
                    tone={ITEM_STATUS_TONE[assignment.status] || "neutral"}
                  >
                    {assignment.status}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
