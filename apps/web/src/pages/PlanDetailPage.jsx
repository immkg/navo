import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { useNotifications } from "../hooks/useNotifications";
import {
  usePlan,
  usePlanVariationsSuggestion,
  useUpdatePlan,
  useUpdatePlanStop,
  useUpdatePlanStopWork,
  useRecheckPlan,
} from "../modules/plan/hooks";
import { useWorkItems } from "../modules/work/hooks";
import {
  describeTimingDelta,
  findBehindScheduleStop,
  findNearbyOpportunities,
  findUnresolvedDependency,
  getPlanDisplayTitle,
  toDateTimeLocalValue,
} from "../modules/plan/utils";
import PlanLocationPicker from "../modules/plan/PlanLocationPicker";
import {
  buildGoogleMapsDirectionsUrl,
  loadGoogleMaps,
} from "../utils/googleMaps";

const STATUS_TONE = {
  draft: "neutral",
  active: "primary",
  completed: "success",
  abandoned: "danger",
};

// A stable module-level reference for the no-plan-yet case, so `stops`
// itself doesn't get a fresh identity on every render when there's no
// plan — that was defeating the dependent useMemo hooks below (they'd
// recompute every render regardless of whether plan.stops had actually
// changed).
const EMPTY_STOPS = [];

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

function dedupeWorkById(workList) {
  return [...new Map(workList.map((work) => [work.id, work])).values()];
}

export default function PlanDetailPage() {
  const { id } = useParams();
  const { notify, confirm } = useNotifications();
  const { data: plan, isLoading } = usePlan(id);
  const { data: allWorkItems = [] } = useWorkItems();
  const updatePlanMutation = useUpdatePlan();
  const updatePlanStopMutation = useUpdatePlanStop();
  const updatePlanStopWorkMutation = useUpdatePlanStopWork();
  const recheckPlanMutation = useRecheckPlan();
  const suggestVariationsMutation = usePlanVariationsSuggestion();
  const [variations, setVariations] = useState([]);
  const [liveOrigin, setLiveOrigin] = useState(null);
  const [isEditingWindow, setIsEditingWindow] = useState(false);
  const [editStart, setEditStart] = useState(null);
  const [editEnd, setEditEnd] = useState(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [mapError, setMapError] = useState(null);
  const googleKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const [now, setNow] = useState(() => new Date());

  // Re-checks "are we behind schedule" once a minute — a nudge doesn't need
  // sub-minute precision, just to not require the person to remember to
  // look.
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const stops = plan?.stops ?? EMPTY_STOPS;

  // A stable primitive signature — only changes when a marker would actually
  // need to move — so an unrelated mutation (e.g. marking one work item
  // done) doesn't re-create the whole map and every marker on every render.
  const markerSignature = useMemo(
    () =>
      stops
        .map(
          (stop) =>
            `${stop.id}:${stop.location.latitude},${stop.location.longitude}`
        )
        .join("|"),
    [stops]
  );

  const assignedWorkIds = useMemo(
    () =>
      new Set(
        stops.flatMap((stop) =>
          stop.works.map((assignment) => assignment.work.id)
        )
      ),
    [stops]
  );
  const selectedWork = useMemo(
    () =>
      dedupeWorkById(
        stops.flatMap((stop) => stop.works.map((assignment) => assignment.work))
      ),
    [stops]
  );
  const eligibleWorkItems = useMemo(
    () => allWorkItems.filter((item) => item.status !== "done"),
    [allWorkItems]
  );
  const unselectedWork = useMemo(
    () => eligibleWorkItems.filter((item) => !assignedWorkIds.has(item.id)),
    [eligibleWorkItems, assignedWorkIds]
  );

  const hasMapPoint =
    stops.length > 0 ||
    (plan?.startLatitude != null && plan?.startLongitude != null) ||
    (plan?.endLatitude != null && plan?.endLongitude != null);

  // One shareable link covering the whole plan (start -> every stop -> end)
  // rather than the per-stop "Open in Maps" links below, which each cover
  // only a single leg. buildGoogleMapsDirectionsUrl's `stops` param treats
  // the last entry as the destination and the rest as waypoints, so the
  // plan's own end point is appended as a synthetic last "stop".
  const fullRouteUrl = useMemo(() => {
    if (!plan) return null;
    const hasEnd = plan.endLatitude != null && plan.endLongitude != null;
    const routeStops = hasEnd
      ? [
          ...stops,
          {
            location: {
              latitude: plan.endLatitude,
              longitude: plan.endLongitude,
              name: plan.endLabel || "End",
            },
          },
        ]
      : stops;
    if (routeStops.length === 0) return null;

    return buildGoogleMapsDirectionsUrl(
      { latitude: plan.startLatitude, longitude: plan.startLongitude },
      routeStops
    );
  }, [plan, stops]);

  useEffect(() => {
    if (!googleKey || !mapRef.current || !plan || !hasMapPoint) return;

    setMapError(null);
    let isCurrent = true;

    loadGoogleMaps(googleKey)
      .then((maps) => {
        if (!isCurrent) return;

        markersRef.current.forEach((marker) => marker.setMap(null));
        markersRef.current = [];

        const points = [];
        if (plan.startLatitude != null && plan.startLongitude != null) {
          points.push({
            lat: plan.startLatitude,
            lng: plan.startLongitude,
            label: "Start",
          });
        }
        stops.forEach((stop, index) => {
          if (
            stop.location.latitude == null ||
            stop.location.longitude == null
          ) {
            return;
          }
          points.push({
            lat: stop.location.latitude,
            lng: stop.location.longitude,
            label: String.fromCharCode(65 + (index % 26)),
            title: stop.location.name,
          });
        });
        if (plan.endLatitude != null && plan.endLongitude != null) {
          points.push({
            lat: plan.endLatitude,
            lng: plan.endLongitude,
            label: "End",
          });
        }
        if (points.length === 0) return;

        const mapInstance = new maps.Map(mapRef.current, {
          center: points[0],
          zoom: 12,
          disableDefaultUI: true,
        });

        const bounds = new maps.LatLngBounds();
        points.forEach((point) => {
          markersRef.current.push(
            new maps.Marker({
              position: point,
              map: mapInstance,
              label: point.label,
              title: point.title || point.label,
            })
          );
          bounds.extend(point);
        });
        mapInstance.fitBounds(bounds, 80);
      })
      .catch((error) => {
        console.warn("Google Maps JS failed to load", error);
        if (isCurrent) {
          setMapError(error.message || "Failed to load Google Maps");
        }
      });

    return () => {
      isCurrent = false;
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- markerSignature stands in for stops/start/end
  }, [
    googleKey,
    markerSignature,
    hasMapPoint,
    plan?.startLatitude,
    plan?.startLongitude,
    plan?.endLatitude,
    plan?.endLongitude,
  ]);

  const isActive = plan?.status === "active";
  const behindSchedule = isActive ? findBehindScheduleStop(stops, now) : null;

  const handleStatusChange = async (status) => {
    try {
      await updatePlanMutation.mutateAsync({ planId: id, patch: { status } });
    } catch (error) {
      console.error("Failed to update plan status", error);
      notify(error.response?.data?.error || "Failed to update plan status");
    }
  };

  const handleWorkStatusChange = async (stopId, workId, status) => {
    if (status === "skipped") {
      const confirmed = await confirm("Skip this work item?", {
        title: "Skip work item?",
        confirmLabel: "Skip",
        danger: true,
      });
      if (!confirmed) return;
    }

    try {
      await updatePlanStopWorkMutation.mutateAsync({
        planId: id,
        stopId,
        workId,
        patch: { status },
      });
    } catch (error) {
      console.error("Failed to update work item", error);
      notify(error.response?.data?.error || "Failed to update work item");
    }
  };

  const handleArrive = async (stopId) => {
    try {
      await updatePlanStopMutation.mutateAsync({
        planId: id,
        stopId,
        patch: {
          status: "in_progress",
          actualArrivalAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Failed to record arrival", error);
      notify(error.response?.data?.error || "Failed to record arrival");
    }
  };

  const handleLeaveStop = async (stopId) => {
    try {
      await updatePlanStopMutation.mutateAsync({
        planId: id,
        stopId,
        patch: {
          status: "done",
          actualDepartureAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Failed to record departure", error);
      notify(error.response?.data?.error || "Failed to record departure");
    }
  };

  const handleRecheck = () => {
    if (!navigator.geolocation) {
      notify("Your device doesn't support location detection.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const origin = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        try {
          const result = await recheckPlanMutation.mutateAsync({
            planId: id,
            data: origin,
          });
          setLiveOrigin(origin);
          setVariations(result.variations || []);
          if (result.variationsError) {
            notify(result.variationsError);
          }
        } catch (error) {
          console.error("Failed to recheck plan", error);
          notify(error.response?.data?.error || "Failed to recheck plan");
        }
      },
      () => notify("Couldn't get your current location.")
    );
  };

  const handleSuggestVariations = async () => {
    const asOf = isActive ? new Date() : new Date(plan.startAt);
    const budgetMinutes = Math.max(
      0,
      Math.round((new Date(plan.endAt).getTime() - asOf.getTime()) / 60000)
    );

    try {
      const result = await suggestVariationsMutation.mutateAsync({
        selectedWork,
        unselectedWork,
        budgetMinutes,
      });
      setVariations(result.variations || []);
      if ((result.variations || []).length === 0) {
        notify("AI didn't find any useful trade-offs to suggest.");
      }
    } catch (error) {
      console.error("Failed to suggest plan variations", error);
      notify(
        error.response?.data?.error || "Failed to get AI-suggested variations"
      );
    }
  };

  const handleAddOpportunity = async (workId) => {
    try {
      await updatePlanMutation.mutateAsync({
        planId: id,
        patch: { forceIncludeWorkIds: [workId] },
      });
    } catch (error) {
      console.error("Failed to add nearby opportunity", error);
      notify(error.response?.data?.error || "Failed to add work to the plan");
    }
  };

  const handleApplyVariation = async (variation) => {
    try {
      await updatePlanMutation.mutateAsync({
        planId: id,
        patch: {
          forceIncludeWorkIds: variation.addWorkIds,
          forceExcludeWorkIds: variation.removeWorkIds,
        },
      });
      setVariations([]);
    } catch (error) {
      console.error("Failed to apply plan variation", error);
      notify(error.response?.data?.error || "Failed to apply plan variation");
    }
  };

  const handleOpenEditWindow = () => {
    setEditStart({
      dateTime: toDateTimeLocalValue(plan.startAt),
      label: plan.startLabel || "",
      latitude: plan.startLatitude,
      longitude: plan.startLongitude,
    });
    setEditEnd({
      dateTime: toDateTimeLocalValue(plan.endAt),
      label: plan.endLabel || "",
      latitude: plan.endLatitude,
      longitude: plan.endLongitude,
    });
    setIsEditingWindow(true);
  };

  const handleSaveWindow = async (event) => {
    event.preventDefault();
    if (editStart.latitude == null || editStart.longitude == null) {
      notify("Pick a start location before saving.");
      return;
    }
    if (editEnd.latitude == null || editEnd.longitude == null) {
      notify("Pick an end location before saving.");
      return;
    }

    try {
      await updatePlanMutation.mutateAsync({
        planId: id,
        patch: {
          startAt: new Date(editStart.dateTime).toISOString(),
          startLabel: editStart.label || undefined,
          startLatitude: editStart.latitude,
          startLongitude: editStart.longitude,
          endAt: new Date(editEnd.dateTime).toISOString(),
          endLabel: editEnd.label || undefined,
          endLatitude: editEnd.latitude,
          endLongitude: editEnd.longitude,
        },
      });
      setIsEditingWindow(false);
    } catch (error) {
      console.error("Failed to update plan window", error);
      notify(error.response?.data?.error || "Failed to update plan window");
    }
  };

  function legStartPoint(stopIndex) {
    if (stopIndex === 0) {
      return (
        liveOrigin || {
          latitude: plan.startLatitude,
          longitude: plan.startLongitude,
        }
      );
    }
    return stops[stopIndex - 1].location;
  }

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
            {getPlanDisplayTitle(plan)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDateTime(plan.startAt)} → {formatDateTime(plan.endAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[plan.status] || "neutral"}>
            {plan.status}
          </Badge>
          {plan.status === "draft" && (
            <>
              <Button variant="secondary" onClick={handleOpenEditWindow}>
                Edit window
              </Button>
              <Button
                variant="primary"
                onClick={() => handleStatusChange("active")}
              >
                Start
              </Button>
            </>
          )}
          {isActive && (
            <>
              <Button
                variant="secondary"
                onClick={handleRecheck}
                disabled={recheckPlanMutation.isPending}
              >
                {recheckPlanMutation.isPending ? "Checking…" : "Re-check plan"}
              </Button>
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

      {isEditingWindow && (
        <Card padding="lg" className="mb-6">
          <form onSubmit={handleSaveWindow} className="space-y-4">
            <PlanLocationPicker
              legend="Start"
              value={editStart}
              onChange={setEditStart}
            />
            <PlanLocationPicker
              legend="End"
              value={editEnd}
              onChange={setEditEnd}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsEditingWindow(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={updatePlanMutation.isPending}
              >
                {updatePlanMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {behindSchedule && (
        <Card padding="md" className="mb-6 border-danger/30 bg-danger/5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-foreground">
              Running behind — about {behindSchedule.minutesLate} min behind at{" "}
              <strong>{behindSchedule.stop.location.name}</strong>. Your route
              may no longer be accurate.
            </p>
            <Button
              size="sm"
              variant="danger-outline"
              onClick={handleRecheck}
              disabled={recheckPlanMutation.isPending}
            >
              {recheckPlanMutation.isPending ? "Checking…" : "Re-check plan"}
            </Button>
          </div>
        </Card>
      )}

      <Card padding="lg" className="mb-6">
        {fullRouteUrl && (
          <div className="mb-3 flex justify-end">
            <a
              href={fullRouteUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold text-primary hover:underline"
            >
              Open full route in Maps
            </a>
          </div>
        )}
        {!googleKey ? (
          <div className="rounded-3xl border border-dashed border-border bg-surface-alt p-8 text-center text-muted-foreground">
            Configure VITE_GOOGLE_MAPS_API_KEY to see a map preview.
          </div>
        ) : mapError ? (
          <div className="rounded-3xl border border-dashed border-border bg-surface-alt p-8 text-center text-muted-foreground">
            {mapError}
          </div>
        ) : !hasMapPoint ? (
          <div className="rounded-3xl bg-surface-alt p-6 text-muted-foreground">
            No locations to preview yet.
          </div>
        ) : (
          <div
            ref={mapRef}
            className="h-80 w-full rounded-3xl border border-border"
          />
        )}
      </Card>

      {stops.length === 0 && (
        <div className="mb-6 rounded-3xl bg-surface-alt p-6 text-muted-foreground">
          {eligibleWorkItems.length === 0
            ? "Nothing fits in this window yet."
            : `${unselectedWork.length} work item${unselectedWork.length === 1 ? "" : "s"} didn't fit in this window.`}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {unselectedWork.length > 0 &&
            `${unselectedWork.length} work item${unselectedWork.length === 1 ? "" : "s"} not included in this plan.`}
        </div>
        {unselectedWork.length > 0 && plan.status !== "completed" && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSuggestVariations}
            disabled={suggestVariationsMutation.isPending}
          >
            {suggestVariationsMutation.isPending
              ? "Asking AI…"
              : "Suggest variations"}
          </Button>
        )}
      </div>

      {unselectedWork.length > 0 && (
        <Card padding="md" className="mb-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Not included in this plan
          </div>
          <ul className="mt-2 space-y-1">
            {unselectedWork.map((work) => {
              const blocker = findUnresolvedDependency(work);
              return (
                <li key={work.id} className="text-sm text-foreground">
                  {work.title}
                  <span className="ml-2 text-muted-foreground">
                    {work.priority} priority
                  </span>
                  {blocker && (
                    <span className="ml-2 text-warning">
                      blocked by "{blocker.title}"
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {variations.length > 0 && (
        <div className="mb-6 grid gap-3">
          {variations.map((variation, index) => (
            <Card
              key={index}
              padding="md"
              className="border-accent/30 bg-accent/5"
            >
              <p className="text-sm text-foreground">{variation.reasoning}</p>
              <div className="mt-2 flex justify-end">
                <Button
                  variant="accent"
                  size="sm"
                  onClick={() => handleApplyVariation(variation)}
                >
                  Apply
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-4">
        {stops.map((stop, index) => {
          const arrivalDelta = describeTimingDelta(
            stop.actualArrivalAt,
            stop.plannedArrivalAt
          );
          const departureDelta = describeTimingDelta(
            stop.actualDepartureAt,
            stop.plannedDepartureAt
          );
          // Opportunities only make sense while you're actually there —
          // computed fresh on every render, never stored, so one disappears
          // the moment you leave the stop or it gets added to the plan
          // (moving it out of unselectedWork).
          const opportunities =
            stop.status === "in_progress"
              ? findNearbyOpportunities(stop.location, unselectedWork)
              : [];

          return (
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
                <div className="flex flex-col items-end gap-1">
                  <Badge tone={ITEM_STATUS_TONE[stop.status] || "neutral"}>
                    {stop.status}
                  </Badge>
                  {arrivalDelta && stop.status !== "done" && (
                    <Badge tone={arrivalDelta.tone}>
                      Arrived {arrivalDelta.label}
                    </Badge>
                  )}
                  {departureDelta && stop.status === "done" && (
                    <Badge tone={departureDelta.tone}>
                      Left {departureDelta.label}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <a
                  href={buildGoogleMapsDirectionsUrl(legStartPoint(index), [
                    stop,
                  ])}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  Open in Maps
                </a>

                {isActive && stop.status === "planned" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleArrive(stop.id)}
                    disabled={updatePlanStopMutation.isPending}
                  >
                    Arrived
                  </Button>
                )}
                {isActive && stop.status === "in_progress" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleLeaveStop(stop.id)}
                    disabled={updatePlanStopMutation.isPending}
                  >
                    Leave stop
                  </Button>
                )}
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
                    {assignment.status === "planned" ? (
                      isActive ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              handleWorkStatusChange(
                                stop.id,
                                assignment.work.id,
                                "skipped"
                              )
                            }
                          >
                            Skip
                          </Button>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() =>
                              handleWorkStatusChange(
                                stop.id,
                                assignment.work.id,
                                "done"
                              )
                            }
                          >
                            Done
                          </Button>
                        </div>
                      ) : (
                        <Badge tone="neutral">planned</Badge>
                      )
                    ) : (
                      <Badge
                        tone={ITEM_STATUS_TONE[assignment.status] || "neutral"}
                      >
                        {assignment.status}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>

              {opportunities.length > 0 && (
                <div className="mt-4 rounded-2xl border border-accent/30 bg-accent/5 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-accent">
                    While you're here
                  </div>
                  <ul className="mt-2 space-y-2">
                    {opportunities.map(({ work, distanceKm }) => (
                      <li
                        key={work.id}
                        className="flex items-center justify-between gap-3"
                      >
                        <div className="text-sm text-foreground">
                          {work.title}
                          <span className="ml-2 text-muted-foreground">
                            {distanceKm < 0.1
                              ? "right here"
                              : `${distanceKm.toFixed(1)} km away`}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="accent"
                          onClick={() => handleAddOpportunity(work.id)}
                          disabled={updatePlanMutation.isPending}
                        >
                          Add to plan
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
