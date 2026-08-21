import { useEffect, useMemo, useRef, useState } from "react";
import {
  loadGoogleMaps,
  buildGoogleMapsDirectionsUrl,
} from "../../utils/googleMaps";
import { useNotifications } from "../../hooks/useNotifications";
import {
  useWorkItems,
  useCreateLocationOption,
  useUpdateWorkItem,
} from "../../modules/work/hooks";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";

const DEFAULT_TRAVEL_MIN_PER_KM = 8;

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function distanceKm(a, b) {
  if (
    !a ||
    !b ||
    a.latitude == null ||
    a.longitude == null ||
    b.latitude == null ||
    b.longitude == null
  ) {
    return null;
  }
  const latDiff = toRadians(b.latitude - a.latitude);
  const lonDiff = toRadians(b.longitude - a.longitude);
  const radLat1 = toRadians(a.latitude);
  const radLat2 = toRadians(b.latitude);
  const sinLat = Math.sin(latDiff / 2);
  const sinLon = Math.sin(lonDiff / 2);
  const earthRadiusKm = 6371;

  const aValue =
    sinLat * sinLat + Math.cos(radLat1) * Math.cos(radLat2) * sinLon * sinLon;
  const c = 2 * Math.atan2(Math.sqrt(aValue), Math.sqrt(1 - aValue));

  return earthRadiusKm * c;
}

function estimateTravelMinutes(from, to) {
  const km = distanceKm(from, to);
  if (km === null) {
    return 8;
  }
  return Math.max(3, Math.round(km * DEFAULT_TRAVEL_MIN_PER_KM));
}

function orderStopsByDistance(stops, startPoint) {
  if (!startPoint || !startPoint.latitude || !startPoint.longitude) {
    return [...stops].sort((a, b) =>
      a.location.name.localeCompare(b.location.name)
    );
  }

  const remaining = [...stops];
  const ordered = [];
  let current = {
    latitude: startPoint.latitude,
    longitude: startPoint.longitude,
  };

  while (remaining.length > 0) {
    remaining.sort((a, b) => {
      const distA = distanceKm(current, a.location) ?? Number.MAX_SAFE_INTEGER;
      const distB = distanceKm(current, b.location) ?? Number.MAX_SAFE_INTEGER;
      return distA - distB;
    });
    const next = remaining.shift();
    if (!next) break;
    ordered.push(next);
    current = next.location;
  }

  return ordered;
}

function buildStaticMapUrl(stops, startPoint, apiKey) {
  if (!apiKey || stops.length === 0) return null;

  const markers = [];
  if (startPoint?.latitude != null && startPoint?.longitude != null) {
    markers.push(
      `markers=color:green%7Clabel:S%7C${startPoint.latitude},${startPoint.longitude}`
    );
  }

  stops.forEach((stop, index) => {
    if (stop.location.latitude == null || stop.location.longitude == null)
      return;
    const label = String.fromCharCode(65 + (index % 26));
    markers.push(
      `markers=color:red%7Clabel:${label}%7C${stop.location.latitude},${stop.location.longitude}`
    );
  });

  const path = stops
    .filter(
      (stop) =>
        stop.location.latitude != null && stop.location.longitude != null
    )
    .map((stop) => `${stop.location.latitude},${stop.location.longitude}`)
    .join("%7C");

  return `https://maps.googleapis.com/maps/api/staticmap?size=900x320&maptype=roadmap&key=${apiKey}&${markers.join("&")}${path ? `&path=color:0x2f6ce5|weight:4|${path}` : ""}`;
}

function getChosenOption(work) {
  if (!work.locationOptions || work.locationOptions.length === 0) {
    return null;
  }

  if (work.selectedLocationOptionId) {
    const selected = work.locationOptions.find(
      (option) => option.id === work.selectedLocationOptionId
    );
    if (selected) return selected;
  }

  return work.locationOptions[0];
}

export default function PlannerView() {
  const { notify } = useNotifications();
  const { data: workItems = [], isLoading: loading } = useWorkItems();
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState(
    typeof navigator !== "undefined" && navigator.geolocation
      ? "pending"
      : "unsupported"
  );
  const [mapError, setMapError] = useState(null);
  const mapRef = useRef(null);
  const [manualStartOpen, setManualStartOpen] = useState(false);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [addLocationFormWorkId, setAddLocationFormWorkId] = useState(null);
  const [addLocationTitle, setAddLocationTitle] = useState("");
  const [addLocationName, setAddLocationName] = useState("");
  const [addLocationAddress, setAddLocationAddress] = useState("");

  const addLocationOptionMutation = useCreateLocationOption();
  const isSavingLocation = addLocationOptionMutation.isPending;

  const selectLocationOptionMutation = useUpdateWorkItem();

  const openAddLocationForm = (work) => {
    setAddLocationFormWorkId(work.id);
    setAddLocationTitle(
      work.locationOptions?.length
        ? `Option ${work.locationOptions.length + 1}`
        : "Option 1"
    );
    setAddLocationName("");
    setAddLocationAddress("");
  };

  const closeAddLocationForm = () => {
    setAddLocationFormWorkId(null);
    setAddLocationTitle("");
    setAddLocationName("");
    setAddLocationAddress("");
  };

  const submitAddLocationForm = (event, work) => {
    event.preventDefault();
    if (!addLocationName.trim()) {
      notify("Location name is required.");
      return;
    }

    addLocationOptionMutation.mutate(
      {
        workId: work.id,
        data: {
          title: addLocationTitle.trim() || undefined,
          locations: [
            {
              name: addLocationName.trim(),
              address: addLocationAddress.trim() || undefined,
            },
          ],
        },
      },
      {
        onSuccess: () => {
          closeAddLocationForm();
        },
        onError: (error) => {
          console.error("Failed to add location option", error);
          notify("Failed to add location option");
        },
      }
    );
  };

  const handleSelectLocationOption = (workId, optionId) => {
    selectLocationOptionMutation.mutate(
      { workId, patch: { selectedLocationOptionId: optionId } },
      {
        onError: (error) => {
          console.error("Failed to select location option", error);
          notify("Failed to choose location option");
        },
      }
    );
  };

  useEffect(() => {
    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          label: "Current location",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationStatus("ready");
      },
      () => {
        setLocationStatus("denied");
      }
    );
  }, []);

  const googleKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const actionableWork = useMemo(
    () => workItems.filter((item) => item.status !== "done"),
    [workItems]
  );

  const locatedWork = useMemo(
    () =>
      actionableWork.filter((item) => {
        const chosenOption = getChosenOption(item);
        return chosenOption?.locations?.length > 0;
      }),
    [actionableWork]
  );

  const unplacedWork = useMemo(
    () =>
      actionableWork.filter((item) => {
        const chosenOption = getChosenOption(item);
        return !chosenOption?.locations?.length;
      }),
    [actionableWork]
  );

  const routeStops = useMemo(() => {
    const map = new Map();
    locatedWork.forEach((work) => {
      const chosenOption = getChosenOption(work);
      chosenOption?.locations?.forEach((location) => {
        if (!location) return;
        const existing = map.get(location.id);
        if (existing) {
          existing.works.push(work);
        } else {
          map.set(location.id, { location, works: [work] });
        }
      });
    });
    return Array.from(map.values());
  }, [locatedWork]);

  const orderedStops = useMemo(
    () => orderStopsByDistance(routeStops, currentLocation),
    [routeStops, currentLocation]
  );

  const routeMinutes = useMemo(() => {
    if (orderedStops.length === 0) return 0;
    let minutes = 0;
    let previous = currentLocation;
    orderedStops.forEach((stop) => {
      if (previous) {
        minutes += estimateTravelMinutes(previous, stop.location);
      }
      previous = stop.location;
    });
    return minutes;
  }, [orderedStops, currentLocation]);

  useEffect(() => {
    if (!googleKey || !mapRef.current) {
      return;
    }

    setMapError(null);
    let mapInstance;
    let routePath;

    loadGoogleMaps(googleKey)
      .then((maps) => {
        const center = currentLocation ||
          orderedStops[0]?.location || {
            latitude: 37.7749,
            longitude: -122.4194,
          };
        mapInstance = new maps.Map(mapRef.current, {
          center: { lat: center.latitude, lng: center.longitude },
          zoom: 12,
          disableDefaultUI: true,
        });

        const markers = [];
        if (currentLocation) {
          markers.push(
            new maps.Marker({
              position: {
                lat: currentLocation.latitude,
                lng: currentLocation.longitude,
              },
              map: mapInstance,
              label: "S",
              title: "Start",
            })
          );
        }

        orderedStops.forEach((stop, index) => {
          if (stop.location.latitude == null || stop.location.longitude == null)
            return;
          markers.push(
            new maps.Marker({
              position: {
                lat: stop.location.latitude,
                lng: stop.location.longitude,
              },
              map: mapInstance,
              label: String.fromCharCode(65 + (index % 26)),
              title: stop.location.name,
            })
          );
        });

        const points = orderedStops
          .filter(
            (stop) =>
              stop.location.latitude != null && stop.location.longitude != null
          )
          .map((stop) => ({
            lat: stop.location.latitude,
            lng: stop.location.longitude,
          }));

        if (points.length > 1) {
          routePath = new maps.Polyline({
            path: points,
            geodesic: true,
            strokeColor: "#2f6ce5",
            strokeOpacity: 0.75,
            strokeWeight: 5,
            map: mapInstance,
          });
        }

        if (markers.length > 0) {
          const bounds = new maps.LatLngBounds();
          markers.forEach((marker) => bounds.extend(marker.getPosition()));
          mapInstance.fitBounds(bounds, 80);
        }
      })
      .catch((error) => {
        console.warn("Google Maps JS failed to load", error);
        setMapError(error.message || "Failed to load Google Maps");
      });

    return () => {
      if (routePath) {
        routePath.setMap(null);
      }
      if (mapInstance) {
        mapInstance = null;
      }
    };
  }, [googleKey, orderedStops, currentLocation]);

  const workMinutes = useMemo(
    () =>
      locatedWork.reduce((sum, work) => sum + (work.durationMinutes || 30), 0),
    [locatedWork]
  );

  const totalMinutes = routeMinutes + workMinutes;
  const staticMapUrl = useMemo(
    () =>
      googleKey
        ? buildStaticMapUrl(orderedStops, currentLocation, googleKey)
        : null,
    [orderedStops, currentLocation, googleKey]
  );

  const mapLink = useMemo(
    () => buildGoogleMapsDirectionsUrl(currentLocation, orderedStops),
    [currentLocation, orderedStops]
  );

  const openManualStart = () => {
    setManualLat(
      currentLocation?.latitude != null ? String(currentLocation.latitude) : ""
    );
    setManualLng(
      currentLocation?.longitude != null
        ? String(currentLocation.longitude)
        : ""
    );
    setManualStartOpen(true);
  };

  const submitManualStart = (event) => {
    event.preventDefault();
    const latitude = Number(manualLat);
    const longitude = Number(manualLng);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      notify("Please enter valid numbers for latitude and longitude.");
      return;
    }
    setCurrentLocation({ label: "Manual start", latitude, longitude });
    setLocationStatus("manual");
    setManualStartOpen(false);
  };

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 sm:p-6">
      <div className="mb-4 sm:mb-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
              Daily Planner
            </h1>
            <p className="mt-1 text-sm text-muted-foreground sm:mt-2 sm:text-base">
              See nearby work, chosen locations, and a practical route for
              today.
            </p>
          </div>
          <div className="space-y-1 sm:space-y-2 sm:text-right">
            <div className="text-sm text-muted-foreground">
              {orderedStops.length} stop{orderedStops.length === 1 ? "" : "s"} •{" "}
              {totalMinutes} min estimated
            </div>
            <div className="text-sm text-muted-foreground">
              Current location: {currentLocation?.label || "Unknown"}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1.65fr_1fr] lg:gap-8">
        <section className="space-y-4 sm:space-y-6">
          <Card padding="lg">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground sm:text-xl">
                  Starting point
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Use your device location or enter a manual start coordinate.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <Button
                  variant="primary"
                  onClick={() => {
                    navigator.geolocation?.getCurrentPosition(
                      (position) => {
                        setCurrentLocation({
                          label: "Current location",
                          latitude: position.coords.latitude,
                          longitude: position.coords.longitude,
                        });
                        setLocationStatus("ready");
                      },
                      () => setLocationStatus("denied")
                    );
                  }}
                >
                  Use current location
                </Button>
                <Button variant="secondary" onClick={openManualStart}>
                  Set start point
                </Button>
              </div>
            </div>

            {manualStartOpen && (
              <form
                onSubmit={submitManualStart}
                className="mt-4 space-y-3 rounded-3xl border border-border bg-surface-alt p-4"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Latitude
                    </span>
                    <input
                      type="number"
                      step="any"
                      required
                      autoFocus
                      value={manualLat}
                      onChange={(e) => setManualLat(e.target.value)}
                      placeholder="e.g., 37.7749"
                      className="block w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground focus:border-primary focus:ring-primary"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Longitude
                    </span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={manualLng}
                      onChange={(e) => setManualLng(e.target.value)}
                      placeholder="e.g., -122.4194"
                      className="block w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground focus:border-primary focus:ring-primary"
                    />
                  </label>
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="secondary"
                    onClick={() => setManualStartOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit">
                    Save start point
                  </Button>
                </div>
              </form>
            )}

            <div className="mt-4 flex flex-col gap-3 rounded-3xl bg-surface-alt p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Location status</p>
                <p className="text-base font-medium text-foreground capitalize">
                  {locationStatus}
                </p>
              </div>
              {currentLocation?.latitude != null &&
                currentLocation?.longitude != null && (
                  <div className="text-sm text-muted-foreground">
                    {currentLocation.latitude.toFixed(4)},{" "}
                    {currentLocation.longitude.toFixed(4)}
                  </div>
                )}
            </div>
          </Card>

          <Card padding="lg">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground sm:text-xl">
                  Route preview
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Nearby locations are grouped and ordered based on distance
                  from your start point.
                </p>
              </div>
              <a
                href={mapLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
              >
                Open in Maps
              </a>
            </div>

            {loading ? (
              <div className="text-center text-muted-foreground py-8">
                Loading route...
              </div>
            ) : googleKey ? (
              mapError ? (
                staticMapUrl ? (
                  <img
                    src={staticMapUrl}
                    alt="Route preview"
                    className="mt-6 w-full rounded-3xl border border-border object-cover"
                  />
                ) : (
                  <div className="mt-6 rounded-3xl border border-dashed border-border bg-surface-alt p-8 text-center text-muted-foreground">
                    <p className="font-medium text-foreground">
                      Map preview failed
                    </p>
                    <p className="mt-2 text-sm">{mapError}</p>
                  </div>
                )
              ) : (
                <div
                  ref={mapRef}
                  className="mt-6 h-80 w-full rounded-3xl border border-border"
                />
              )
            ) : staticMapUrl ? (
              <img
                src={staticMapUrl}
                alt="Route preview"
                className="mt-6 w-full rounded-3xl border border-border object-cover"
              />
            ) : (
              <div className="mt-6 rounded-3xl border border-dashed border-border bg-surface-alt p-8 text-center text-muted-foreground">
                <p className="font-medium text-foreground">
                  Map preview unavailable
                </p>
                <p className="mt-2 text-sm">
                  Configure a Google Maps API key in `VITE_GOOGLE_MAPS_API_KEY`
                  to see a map preview.
                </p>
              </div>
            )}
          </Card>

          <Card padding="lg">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground sm:text-xl">
                  Planned route
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Estimated travel + stop time for this route.
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Travel time</div>
                <div className="text-lg font-semibold text-foreground">
                  {routeMinutes} min
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-4">
              {orderedStops.length === 0 ? (
                <div className="rounded-3xl bg-surface-alt p-6 text-muted-foreground">
                  No location-based work was found. Open an intent and attach a
                  location to your work.
                </div>
              ) : (
                orderedStops.map((stop, index) => (
                  <div
                    key={stop.location.id}
                    className="rounded-3xl border border-border p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">
                          Stop {index + 1}
                        </div>
                        <div className="text-lg font-semibold text-foreground">
                          {stop.location.name}
                        </div>
                        {stop.location.address && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {stop.location.address}
                          </div>
                        )}
                      </div>
                      <div className="text-sm text-foreground">
                        {stop.works.reduce(
                          (sum, work) => sum + (work.durationMinutes || 30),
                          0
                        )}{" "}
                        min
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3">
                      {stop.works.map((work) => {
                        const chosenOption = getChosenOption(work);
                        return (
                          <div
                            key={work.id}
                            className="rounded-2xl bg-surface-alt p-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-medium text-foreground">
                                {work.title}
                              </div>
                              {chosenOption?.title && (
                                <Badge tone="primary">
                                  {chosenOption.title}
                                </Badge>
                              )}
                            </div>
                            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div className="text-sm text-muted-foreground">
                                {work.type} · {work.durationMinutes || 30} min
                              </div>
                              {work.locationOptions?.length > 1 && (
                                <label className="inline-flex items-center gap-2">
                                  <span className="sr-only">
                                    Switch selected option for {work.title}
                                  </span>
                                  <select
                                    value={work.selectedLocationOptionId || ""}
                                    onChange={(e) =>
                                      handleSelectLocationOption(
                                        work.id,
                                        e.target.value
                                      )
                                    }
                                    className="min-h-9 rounded-full border border-primary/30 bg-surface px-3 text-xs font-semibold text-primary transition hover:bg-primary/10"
                                  >
                                    {work.locationOptions.map(
                                      (option, optionIndex) => (
                                        <option
                                          key={option.id}
                                          value={option.id}
                                        >
                                          {option.title ||
                                            `Option ${optionIndex + 1}`}
                                        </option>
                                      )
                                    )}
                                  </select>
                                </label>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </section>

        <aside className="space-y-4 sm:space-y-6">
          {unplacedWork.length > 0 && (
            <Card padding="lg">
              <h2 className="text-lg font-semibold text-foreground sm:text-xl">
                Unplaced work
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                These items still need a location to be part of the route.
              </p>
              <div className="mt-4 space-y-3">
                {unplacedWork.map((work) => {
                  const chosenOption = getChosenOption(work);
                  const hasOptions = work.locationOptions?.length > 0;
                  return (
                    <div
                      key={work.id}
                      className="rounded-3xl border border-warning/30 bg-warning/10 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div>
                          <div className="font-medium text-foreground">
                            {work.title}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {work.type} · {work.durationMinutes || 30} min
                          </div>
                          {chosenOption && (
                            <div className="mt-2 text-xs text-warning">
                              Selected:{" "}
                              {chosenOption.title ||
                                `Option ${work.locationOptions.indexOf(chosenOption) + 1}`}
                            </div>
                          )}
                          {hasOptions && (
                            <div className="mt-2 text-xs text-warning">
                              {work.locationOptions.length} saved option
                              {work.locationOptions.length === 1 ? "" : "s"}
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-col">
                          <button
                            type="button"
                            onClick={() => openAddLocationForm(work)}
                            className="inline-flex min-h-9 items-center justify-center rounded-full bg-warning px-3 text-xs font-semibold text-warning-foreground transition hover:bg-warning-hover"
                          >
                            + Add location
                          </button>
                          {hasOptions && (
                            <select
                              value={work.selectedLocationOptionId || ""}
                              onChange={(e) =>
                                handleSelectLocationOption(
                                  work.id,
                                  e.target.value
                                )
                              }
                              aria-label={`Choose location option for ${work.title}`}
                              className="min-h-9 rounded-full border border-warning bg-surface px-3 text-xs font-semibold text-warning transition hover:bg-warning/20"
                            >
                              {work.locationOptions.map(
                                (option, optionIndex) => (
                                  <option key={option.id} value={option.id}>
                                    {option.title ||
                                      `Option ${optionIndex + 1}`}
                                  </option>
                                )
                              )}
                            </select>
                          )}
                        </div>
                      </div>

                      {addLocationFormWorkId === work.id && (
                        <form
                          onSubmit={(e) => submitAddLocationForm(e, work)}
                          className="mt-3 space-y-3 rounded-2xl border border-warning/30 bg-surface p-3"
                        >
                          <label className="block space-y-1">
                            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Option title (optional)
                            </span>
                            <input
                              value={addLocationTitle}
                              onChange={(e) =>
                                setAddLocationTitle(e.target.value)
                              }
                              className="block w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-primary"
                            />
                          </label>
                          <label className="block space-y-1">
                            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Location name
                            </span>
                            <input
                              value={addLocationName}
                              onChange={(e) =>
                                setAddLocationName(e.target.value)
                              }
                              required
                              autoFocus
                              placeholder="e.g., Downtown Farmers Market"
                              className="block w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-primary"
                            />
                          </label>
                          <label className="block space-y-1">
                            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Address (optional)
                            </span>
                            <input
                              value={addLocationAddress}
                              onChange={(e) =>
                                setAddLocationAddress(e.target.value)
                              }
                              className="block w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-primary"
                            />
                          </label>
                          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <Button
                              variant="secondary"
                              onClick={closeAddLocationForm}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="primary"
                              type="submit"
                              disabled={isSavingLocation}
                            >
                              {isSavingLocation ? "Saving..." : "Save location"}
                            </Button>
                          </div>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <Card padding="lg">
            <h2 className="text-lg font-semibold text-foreground sm:text-xl">
              Nearby work
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Work grouped by the most relevant location.
            </p>
            <div className="mt-4 space-y-3 sm:mt-6 sm:space-y-4">
              {orderedStops.length === 0 ? (
                <div className="rounded-3xl bg-surface-alt p-4 text-muted-foreground">
                  No nearby work with location data yet.
                </div>
              ) : (
                orderedStops.map((stop) => (
                  <div
                    key={stop.location.id}
                    className="rounded-3xl bg-surface-alt p-4"
                  >
                    <div className="font-medium text-foreground">
                      {stop.location.name}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {stop.works.length} work item
                      {stop.works.length === 1 ? "" : "s"}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
