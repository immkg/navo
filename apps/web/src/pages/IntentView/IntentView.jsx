import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import IntentWorkForm from "./IntentWorkForm";
import LocationCard from "./LocationCard";
import {
  autocompletePlaces,
  getPlaceDetails,
  loadGoogleMaps,
  reverseGeocodeLocation,
  searchPlaces,
} from "../../utils/googleMaps";
import { useNotifications } from "../../hooks/useNotifications";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";

const DURATION_OPTIONS = [
  5, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240,
];

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

  const formatDate = (dateValue) => {
    if (!dateValue) return "-";

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "-";

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
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

  const priorityStyle =
    intentPriority === "high"
      ? "bg-danger/15 text-danger"
      : intentPriority === "low"
        ? "bg-surface-alt text-muted-foreground"
        : "bg-warning/15 text-warning";

  return (
    <Card as="section" className="mb-4 sm:mb-6" padding="lg">
      <input
        value={intentTitle}
        onChange={(e) => setIntentTitle(e.target.value)}
        onBlur={handleTitleBlur}
        disabled={updatingIntent}
        placeholder="Untitled intent"
        className="-mx-2 w-full min-w-0 rounded-xl border border-transparent px-2 py-1 text-xl font-bold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 sm:text-2xl lg:text-3xl"
      />
      <textarea
        value={intentDescription}
        onChange={(e) => setIntentDescription(e.target.value)}
        onBlur={handleDescriptionBlur}
        disabled={updatingIntent}
        rows={2}
        placeholder="Add a short description"
        className="-mx-2 mt-1 w-full resize-none rounded-xl border border-transparent px-2 py-1 text-sm text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
      />

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <label className="inline-flex items-center gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Priority
          </span>
          <select
            value={intentPriority}
            onChange={(e) => handleUpdatePriority(e.target.value)}
            disabled={updatingIntent}
            className={`h-9 rounded-full border-0 px-3 text-sm font-semibold outline-none transition disabled:opacity-60 ${priorityStyle}`}
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>

        <label className="inline-flex items-center gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Status
          </span>
          <select
            value={intentStatus}
            onChange={(e) => handleUpdateStatus(e.target.value)}
            disabled={updatingIntent}
            className="h-9 rounded-full border border-border bg-surface px-3 text-sm font-medium text-foreground outline-none transition focus:border-primary disabled:opacity-60"
          >
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="not_required">Not Required</option>
            <option value="archived">Archived</option>
          </select>
        </label>

        <button
          type="button"
          onClick={() => openDateInput(`intent-start-date-${intent.id}`)}
          disabled={updatingIntent}
          className="relative inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-sm font-medium text-foreground transition hover:bg-surface-alt disabled:opacity-60"
        >
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Start
          </span>
          {intentStartDate ? formatDate(intentStartDate) : "Not set"}
          <input
            id={`intent-start-date-${intent.id}`}
            type="date"
            value={intentStartDate}
            onChange={(e) => handleUpdateStartDate(e.target.value)}
            disabled={updatingIntent}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            aria-label="Set start date"
          />
        </button>

        <button
          type="button"
          onClick={() => openDateInput(`intent-due-date-${intent.id}`)}
          disabled={updatingIntent}
          className="relative inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-sm font-medium text-foreground transition hover:bg-surface-alt disabled:opacity-60"
        >
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Due
          </span>
          {intentDueDate ? formatDate(intentDueDate) : "Not set"}
          <input
            id={`intent-due-date-${intent.id}`}
            type="date"
            value={intentDueDate}
            onChange={(e) => handleUpdateDueDate(e.target.value)}
            disabled={updatingIntent}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            aria-label="Set due date"
          />
        </button>
      </div>
    </Card>
  );
}

function buildLocationOptionGroupsFromWork(work) {
  return (work?.locationOptions || []).map((option) => ({
    id: option.id,
    title: option.title || "",
    locations: (option.locations || []).map((location) => ({
      id: location.id,
      name: location.name,
      address: location.address,
      latitude: location.latitude,
      longitude: location.longitude,
      placeId: location.placeId,
      provider: location.provider,
    })),
  }));
}

function WorkLocationOptionsEditor({
  work,
  onOptionsCreated,
  onLocationAttached,
  onGroupRemoved,
  onCancel,
}) {
  const { notify } = useNotifications();
  const initialLocationOptionGroups = buildLocationOptionGroupsFromWork(work);
  const [locationOptionGroups, setLocationOptionGroups] = useState(
    initialLocationOptionGroups
  );
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(() => {
    const selectedIndex = initialLocationOptionGroups.findIndex(
      (group) => group.id === work?.selectedLocationOptionId
    );
    return selectedIndex >= 0 ? selectedIndex : 0;
  });
  const [placeQuery, setPlaceQuery] = useState("");
  const [autocompleteResults, setAutocompleteResults] = useState([]);
  const [placeResults, setPlaceResults] = useState([]);
  const [selectedPreviewPlace, setSelectedPreviewPlace] = useState(null);
  const [droppedPinPlace, setDroppedPinPlace] = useState(null);
  const [searchError, setSearchError] = useState(null);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [showManualPlaceForm, setShowManualPlaceForm] = useState(false);
  const [manualPlaceName, setManualPlaceName] = useState("");
  const [manualPlaceAddress, setManualPlaceAddress] = useState("");
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRefs = useRef([]);
  const mapClickListenerRef = useRef(null);
  const googleKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const showPlaceSearchPanel = locationOptionGroups.length > 0;
  const workId = work?.id;

  const resetEditor = () => {
    const nextGroups = buildLocationOptionGroupsFromWork(work);
    setLocationOptionGroups(nextGroups);
    const selectedIndex = nextGroups.findIndex(
      (group) => group.id === work?.selectedLocationOptionId
    );
    setSelectedGroupIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setPlaceQuery("");
    setAutocompleteResults([]);
    setPlaceResults([]);
    setSelectedPreviewPlace(null);
    setDroppedPinPlace(null);
    setSearchError(null);
    setShowManualPlaceForm(false);
    setManualPlaceName("");
    setManualPlaceAddress("");
  };

  const handleAddLocationOptionGroup = () => {
    const nextIndex = locationOptionGroups.length;
    setLocationOptionGroups((prev) => [
      ...prev,
      { id: null, title: `Option ${nextIndex + 1}`, locations: [] },
    ]);
    setSelectedGroupIndex(nextIndex);
  };

  const removeGroupAtIndex = (groupIndex) => {
    setLocationOptionGroups((prev) =>
      prev.filter((_, index) => index !== groupIndex)
    );
    setSelectedGroupIndex((prevSelectedIndex) => {
      if (groupIndex < prevSelectedIndex) {
        return prevSelectedIndex - 1;
      }
      if (groupIndex === prevSelectedIndex) {
        return Math.max(0, prevSelectedIndex - 1);
      }
      return prevSelectedIndex;
    });
  };

  const handleRemoveGroup = async (groupIndex) => {
    const group = locationOptionGroups[groupIndex];
    if (!group) return;

    if (!group.id) {
      removeGroupAtIndex(groupIndex);
      return;
    }

    if (!workId) return;

    setIsSaving(true);
    try {
      const response = await axios.delete(
        `http://localhost:3001/api/work/${workId}/location-option/${group.id}`
      );
      onGroupRemoved?.(
        group.id,
        response.data?.selectedLocationOptionId || null
      );
      removeGroupAtIndex(groupIndex);
    } catch (error) {
      console.error("Failed to remove location option group", error);
      notify("Failed to remove location option group");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveLocationFromGroup = async (groupIndex, locationIndex) => {
    const group = locationOptionGroups[groupIndex];
    const location = group?.locations?.[locationIndex];
    if (!group || !location) return;

    if (!group.id || !location.id) {
      setLocationOptionGroups((prev) => {
        const next = [...prev];
        const nextGroup = next[groupIndex];
        if (!nextGroup) return prev;
        nextGroup.locations = nextGroup.locations.filter(
          (_, index) => index !== locationIndex
        );
        return next;
      });
      return;
    }

    if (!workId) return;

    setIsSaving(true);
    try {
      const response = await axios.delete(
        `http://localhost:3001/api/work/${workId}/location-option/${group.id}/location/${location.id}`
      );
      const updatedOption = response.data;
      setLocationOptionGroups((prev) =>
        prev.map((item, index) =>
          index === groupIndex
            ? {
                ...item,
                locations: (updatedOption.locations || []).map(
                  (updatedLocation) => ({
                    id: updatedLocation.id,
                    name: updatedLocation.name,
                    address: updatedLocation.address,
                    latitude: updatedLocation.latitude,
                    longitude: updatedLocation.longitude,
                    placeId: updatedLocation.placeId,
                    provider: updatedLocation.provider,
                  })
                ),
              }
            : item
        )
      );
      onLocationAttached?.(group.id, updatedOption);
    } catch (error) {
      console.error("Failed to remove location from group", error);
      notify("Failed to remove location from group");
    } finally {
      setIsSaving(false);
    }
  };

  const attachLocationToExistingGroup = async (groupIndex, place) => {
    const group = locationOptionGroups[groupIndex];
    if (!group?.id || !workId) {
      return false;
    }

    const response = await axios.post(
      `http://localhost:3001/api/work/${workId}/location-option/${group.id}/location`,
      {
        name: place.name,
        address: place.address,
        latitude: place.latitude,
        longitude: place.longitude,
        placeId: place.placeId,
        provider: place.provider,
      }
    );

    const updatedOption = response.data;
    setLocationOptionGroups((prev) =>
      prev.map((item, index) =>
        index === groupIndex
          ? {
              ...item,
              locations: updatedOption.locations.map((location) => ({
                id: location.id,
                name: location.name,
                address: location.address,
                latitude: location.latitude,
                longitude: location.longitude,
                placeId: location.placeId,
                provider: location.provider,
              })),
            }
          : item
      )
    );

    onLocationAttached?.(group.id, updatedOption);
    return true;
  };

  const handleAutocomplete = async (query) => {
    setSearchError(null);
    setSelectedPreviewPlace(null);
    setDroppedPinPlace(null);

    if (!googleKey || !query.trim()) {
      setAutocompleteResults([]);
      return;
    }

    try {
      const results = await autocompletePlaces(query.trim(), googleKey);
      setAutocompleteResults(results);
    } catch (error) {
      console.error("Autocomplete failed", error);
      setSearchError(error.message || "Autocomplete failed.");
      setAutocompleteResults([]);
    }
  };

  const handleSearchPlaces = async () => {
    if (!googleKey) {
      setSearchError("Google Maps API key is not configured.");
      return;
    }

    if (!placeQuery.trim()) {
      setSearchError("Enter a place name or address to search.");
      return;
    }

    setIsSearchingPlaces(true);
    setSearchError(null);
    setSelectedPreviewPlace(null);
    setDroppedPinPlace(null);

    try {
      const results = await searchPlaces(placeQuery.trim(), googleKey);
      setPlaceResults(results);
      if (results.length > 0) {
        setSelectedPreviewPlace(results[0]);
      }
    } catch (error) {
      console.error("Place search failed", error);
      setSearchError(error.message || "Place search failed.");
      setPlaceResults([]);
      setSelectedPreviewPlace(null);
    } finally {
      setIsSearchingPlaces(false);
    }
  };

  const handleAddLocationToGroup = (groupIndex, place) => {
    const group = locationOptionGroups[groupIndex];
    if (!group) return;

    const isDuplicate = group.locations.some(
      (location) => location.placeId === place.placeId
    );
    if (isDuplicate) {
      return;
    }

    const nextLocation = {
      name: place.name,
      address: place.formattedAddress,
      latitude: place.latitude,
      longitude: place.longitude,
      placeId: place.placeId,
      provider: place.provider || "google",
    };

    if (group.id) {
      setIsSaving(true);
      attachLocationToExistingGroup(groupIndex, nextLocation)
        .catch((error) => {
          console.error("Failed to add location to existing group", error);
          notify("Failed to add location to group");
        })
        .finally(() => {
          setIsSaving(false);
        });
    } else {
      setLocationOptionGroups((prev) => {
        const next = [...prev];
        const targetGroup = next[groupIndex];
        if (!targetGroup) return prev;

        targetGroup.locations = [...targetGroup.locations, nextLocation];
        return next;
      });
    }

    setPlaceResults([]);
    setPlaceQuery("");
    setAutocompleteResults([]);
  };

  const handleAddManualPlace = (event) => {
    event.preventDefault();
    if (!manualPlaceName.trim()) return;

    handleAddLocationToGroup(selectedGroupIndex, {
      name: manualPlaceName.trim(),
      formattedAddress: manualPlaceAddress.trim() || undefined,
      latitude: null,
      longitude: null,
      placeId: `manual:${crypto.randomUUID?.() ?? Date.now()}`,
      provider: "manual",
    });
    setManualPlaceName("");
    setManualPlaceAddress("");
    setShowManualPlaceForm(false);
  };

  const hasPendingNewGroups = locationOptionGroups.some((group) => !group.id);

  const previewPlaceInMap = (place) => {
    setSelectedPreviewPlace(place);

    if (
      mapInstanceRef.current &&
      place?.latitude != null &&
      place?.longitude != null
    ) {
      mapInstanceRef.current.setCenter({
        lat: place.latitude,
        lng: place.longitude,
      });
      mapInstanceRef.current.setZoom(15);
    }
  };

  const handleMapClickDropPin = useCallback(
    async (lat, lng) => {
      const coordinateLabel = `Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)}`;
      let label = coordinateLabel;
      let placeId = `pin:${lat.toFixed(6)},${lng.toFixed(6)}`;

      if (googleKey) {
        try {
          const reverse = await reverseGeocodeLocation(lat, lng, googleKey);
          if (reverse?.label) {
            label = reverse.label;
          }
          if (reverse?.placeId) {
            placeId = reverse.placeId;
          }
        } catch {
          // Fallback to coordinate label when reverse geocode is unavailable.
        }
      }

      const dropped = {
        name: label,
        formattedAddress: label,
        latitude: lat,
        longitude: lng,
        placeId,
        provider: "google",
      };
      setDroppedPinPlace(dropped);
      setSelectedPreviewPlace(dropped);
    },
    [googleKey]
  );

  const handleAddDroppedPinToGroup = () => {
    if (!droppedPinPlace) return;
    handleAddLocationToGroup(selectedGroupIndex, droppedPinPlace);
  };

  useEffect(() => {
    async function initializeMap() {
      if (
        !googleKey ||
        !showPlaceSearchPanel ||
        placeResults.length === 0 ||
        !mapContainerRef.current
      )
        return;

      try {
        const maps = await loadGoogleMaps(googleKey);

        let MapCtor = null;
        for (let attempt = 0; attempt < 40; attempt += 1) {
          const runtimeMaps = window.google?.maps || maps;
          if (typeof runtimeMaps?.Map === "function") {
            MapCtor = runtimeMaps.Map;
            break;
          }

          if (runtimeMaps?.importLibrary) {
            const mapsLib = await runtimeMaps.importLibrary("maps");
            if (typeof mapsLib?.Map === "function") {
              MapCtor = mapsLib.Map;
              break;
            }
          }

          await new Promise((resolve) => setTimeout(resolve, 75));
        }

        if (!MapCtor) {
          throw new Error("Google Maps Map constructor unavailable");
        }

        if (!mapInstanceRef.current) {
          mapInstanceRef.current = new MapCtor(mapContainerRef.current, {
            center: { lat: 39.5, lng: -98.35 },
            zoom: 4,
            disableDefaultUI: true,
          });
          setMapReady(true);

          if (mapClickListenerRef.current) {
            mapClickListenerRef.current.remove();
          }
          mapClickListenerRef.current = mapInstanceRef.current.addListener(
            "click",
            (event) => {
              const lat = event?.latLng?.lat?.();
              const lng = event?.latLng?.lng?.();
              if (lat == null || lng == null) return;
              handleMapClickDropPin(lat, lng);
            }
          );
        } else {
          mapInstanceRef.current.setCenter({ lat: 39.5, lng: -98.35 });
          mapInstanceRef.current.setZoom(4);
          setMapReady(true);
          maps.event.trigger(mapInstanceRef.current, "resize");
        }
      } catch (error) {
        setMapReady(false);
        console.error("Failed to initialize map preview", error);
      }
    }

    initializeMap();

    return () => {
      if (mapClickListenerRef.current) {
        mapClickListenerRef.current.remove();
        mapClickListenerRef.current = null;
      }
    };
  }, [
    googleKey,
    showPlaceSearchPanel,
    placeResults.length,
    handleMapClickDropPin,
  ]);

  useEffect(() => {
    async function updateMarkers() {
      const maps = window.google?.maps;
      if (!maps || !mapInstanceRef.current) return;

      const MarkerCtor = maps.Marker;
      const LatLngBoundsCtor = maps.LatLngBounds;

      if (!MarkerCtor || !LatLngBoundsCtor) {
        return;
      }

      markerRefs.current.forEach((marker) => marker.setMap(null));
      markerRefs.current = [];

      const candidatePlaces = [...placeResults];
      if (
        selectedPreviewPlace &&
        !candidatePlaces.some(
          (place) => place.placeId === selectedPreviewPlace.placeId
        )
      ) {
        candidatePlaces.push(selectedPreviewPlace);
      }
      if (
        droppedPinPlace &&
        !candidatePlaces.some(
          (place) => place.placeId === droppedPinPlace.placeId
        )
      ) {
        candidatePlaces.push(droppedPinPlace);
      }

      const validPlaces = candidatePlaces.filter(
        (place) => place?.latitude != null && place?.longitude != null
      );
      if (validPlaces.length === 0) {
        return;
      }

      const bounds = new LatLngBoundsCtor();
      const newMarkers = validPlaces.map((place) => {
        const marker = new MarkerCtor({
          map: mapInstanceRef.current,
          position: { lat: place.latitude, lng: place.longitude },
          title: place.name,
        });

        marker.addListener("click", () => {
          setSelectedPreviewPlace(place);
        });

        bounds.extend(marker.getPosition());
        return marker;
      });

      markerRefs.current = newMarkers;

      if (
        selectedPreviewPlace?.latitude != null &&
        selectedPreviewPlace?.longitude != null
      ) {
        mapInstanceRef.current.setCenter({
          lat: selectedPreviewPlace.latitude,
          lng: selectedPreviewPlace.longitude,
        });
        mapInstanceRef.current.setZoom(15);
      } else if (validPlaces.length === 1) {
        mapInstanceRef.current.setCenter({
          lat: validPlaces[0].latitude,
          lng: validPlaces[0].longitude,
        });
        mapInstanceRef.current.setZoom(14);
      } else {
        mapInstanceRef.current.fitBounds(bounds, 48);
      }
    }

    updateMarkers();
  }, [placeResults, selectedPreviewPlace, droppedPinPlace, mapReady]);

  const handleSubmit = async () => {
    const validGroups = locationOptionGroups
      .filter((group) => !group.id)
      .map((group) => ({
        title: group.title?.trim() || undefined,
        locations: group.locations.filter((location) => location.name),
      }))
      .filter((group) => group.locations.length > 0);

    if (validGroups.length === 0) {
      if (!hasPendingNewGroups) {
        resetEditor();
        onCancel?.();
        return;
      }

      notify(
        "Please add at least one location option group with at least one place."
      );
      return;
    }

    setIsSaving(true);
    try {
      const createdOptions = [];
      for (const group of validGroups) {
        const response = await axios.post(
          `http://localhost:3001/api/work/${workId}/location-option`,
          {
            title: group.title,
            locations: group.locations.map((location) => ({
              name: location.name,
              address: location.address,
              latitude: location.latitude,
              longitude: location.longitude,
              placeId: location.placeId,
              provider: location.provider,
            })),
          }
        );
        createdOptions.push(response.data);
      }

      onOptionsCreated(createdOptions);
      resetEditor();
      onCancel?.();
    } catch (error) {
      console.error("Failed to add location option", error);
      notify("Failed to add location option");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="mt-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={handleAddLocationOptionGroup}
          className="rounded-full border border-primary/30 bg-surface min-h-9 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/10"
        >
          {locationOptionGroups.length === 0 ? "Edit Locations" : "+ Add group"}
        </button>
      </div>

      {locationOptionGroups.length === 0 ? (
        <div className="mt-4 rounded-3xl border border-dashed border-primary/30 bg-primary/10 p-4 text-sm text-primary">
          Add a location option group first, then add one or more places inside
          it.
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input
              value={placeQuery}
              onChange={(e) => {
                const nextQuery = e.target.value;
                setPlaceQuery(nextQuery);
                handleAutocomplete(nextQuery);
              }}
              placeholder="Search for a place"
              className="block w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground focus:border-primary focus:ring-primary"
            />
            <Button
              variant="primary"
              pill={false}
              onClick={handleSearchPlaces}
              disabled={isSearchingPlaces}
              className="px-4 py-3 text-xs"
            >
              {isSearchingPlaces ? "Searching…" : "Search"}
            </Button>
          </div>

          {searchError && (
            <div className="text-sm text-danger">{searchError}</div>
          )}

          <div>
            {!showManualPlaceForm ? (
              <button
                type="button"
                onClick={() => setShowManualPlaceForm(true)}
                className="min-h-9 text-xs font-semibold text-primary hover:underline"
              >
                Can&apos;t find it? Add a place manually
              </button>
            ) : (
              <form
                onSubmit={handleAddManualPlace}
                className="space-y-3 rounded-2xl border border-border bg-surface-alt p-3"
              >
                <label className="block space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Location name
                  </span>
                  <input
                    value={manualPlaceName}
                    onChange={(e) => setManualPlaceName(e.target.value)}
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
                    value={manualPlaceAddress}
                    onChange={(e) => setManualPlaceAddress(e.target.value)}
                    className="block w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-primary"
                  />
                </label>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    pill={false}
                    onClick={() => {
                      setShowManualPlaceForm(false);
                      setManualPlaceName("");
                      setManualPlaceAddress("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    pill={false}
                    disabled={!manualPlaceName.trim()}
                  >
                    Add place
                  </Button>
                </div>
              </form>
            )}
          </div>

          {autocompleteResults.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface-alt p-3">
              <div className="mb-2 text-sm font-semibold text-foreground">
                Suggestions
              </div>
              <div className="space-y-2">
                {autocompleteResults.map((suggestion) => (
                  <button
                    key={suggestion.placeId}
                    type="button"
                    onClick={async () => {
                      setPlaceQuery(suggestion.description);
                      setAutocompleteResults([]);
                      setIsSearchingPlaces(true);
                      try {
                        const placeDetails = await getPlaceDetails(
                          suggestion.placeId,
                          googleKey
                        );
                        setPlaceResults([placeDetails]);
                        setSearchError(null);
                      } catch (error) {
                        console.error("Autocomplete selection failed", error);
                        setSearchError(
                          error.message || "Place details failed."
                        );
                        setPlaceResults([]);
                      } finally {
                        setIsSearchingPlaces(false);
                      }
                    }}
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-left text-sm text-foreground transition hover:bg-surface-alt"
                  >
                    {suggestion.description}
                  </button>
                ))}
              </div>
            </div>
          )}

          {placeResults.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.95fr)]">
              <div className="space-y-2">
                <Card padding="sm">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-semibold text-foreground">
                      Places
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {placeResults.length} results
                    </div>
                  </div>
                  <div className="space-y-2">
                    {placeResults.map((place, resultIndex) => (
                      <div
                        key={resultIndex}
                        className={`rounded-2xl border p-3 ${selectedPreviewPlace?.placeId === place.placeId ? "border-primary bg-primary/10" : "border-border bg-surface-alt"}`}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-medium text-foreground">
                              {place.name}
                            </div>
                            {place.formattedAddress && (
                              <div className="truncate text-sm text-muted-foreground">
                                {place.formattedAddress}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <button
                              type="button"
                              onClick={() => previewPlaceInMap(place)}
                              className="rounded-full border border-primary/30 bg-surface min-h-9 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/10"
                            >
                              Preview
                            </button>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() =>
                                handleAddLocationToGroup(
                                  selectedGroupIndex,
                                  place
                                )
                              }
                            >
                              Add
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              <Card padding="sm">
                <div className="mb-2 text-sm font-semibold text-foreground">
                  Map preview
                </div>
                <div className="mb-2 text-xs text-muted-foreground">
                  Click on map to drop a pin, then add it to the active group.
                </div>
                <div
                  ref={mapContainerRef}
                  className="h-56 rounded-3xl border border-border bg-surface-alt sm:h-64"
                />
                {droppedPinPlace && (
                  <div className="mt-3 rounded-2xl border border-primary/30 bg-primary/10 p-3">
                    <div className="text-sm font-semibold text-primary">
                      Dropped pin
                    </div>
                    <div className="text-sm text-primary">
                      {droppedPinPlace.formattedAddress}
                    </div>
                    <div className="mt-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleAddDroppedPinToGroup}
                      >
                        Add dropped pin
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}

          <div className="space-y-4">
            {locationOptionGroups.map((group, index) => (
              <div
                key={index}
                className={`rounded-3xl border p-4 ${selectedGroupIndex === index ? "border-primary bg-primary/10" : "border-border bg-surface"}`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        value={group.title}
                        readOnly={Boolean(group.id)}
                        onChange={(e) => {
                          if (group.id) return;
                          const title = e.target.value;
                          setLocationOptionGroups((prev) => {
                            const next = [...prev];
                            next[index] = { ...next[index], title };
                            return next;
                          });
                        }}
                        placeholder={
                          group.id
                            ? "Existing group"
                            : "Option title (optional)"
                        }
                        className="w-full max-w-[260px] rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-primary disabled:bg-surface-alt"
                      />
                      <Badge
                        tone="neutral"
                        className="normal-case tracking-normal"
                      >
                        {group.locations.length} place
                        {group.locations.length === 1 ? "" : "s"}
                      </Badge>
                    </div>
                    {group.locations.length > 0 && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        {group.locations.length === 1
                          ? "1 place added"
                          : `${group.locations.length} places added`}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedGroupIndex(index)}
                    className={`rounded-full min-h-9 px-3 py-1.5 text-xs font-semibold transition ${selectedGroupIndex === index ? "border border-primary bg-primary text-primary-foreground" : "border border-border bg-surface text-foreground hover:bg-surface-alt"}`}
                  >
                    {selectedGroupIndex === index ? "Selected" : "Select"}
                  </button>
                </div>
                <div className="mt-3">
                  <Button
                    variant="danger-outline"
                    size="sm"
                    onClick={() => handleRemoveGroup(index)}
                    disabled={isSaving}
                  >
                    Remove group
                  </Button>
                </div>
                {group.locations.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {group.locations.map((location, locationIndex) => (
                      <LocationCard
                        key={
                          location.id ||
                          `${location.placeId || location.name}-${locationIndex}`
                        }
                        location={location}
                        actions={
                          <Button
                            variant="danger-outline"
                            size="sm"
                            onClick={() =>
                              handleRemoveLocationFromGroup(
                                index,
                                locationIndex
                              )
                            }
                            disabled={isSaving}
                          >
                            Remove place
                          </Button>
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <Button
              variant="secondary"
              pill={false}
              onClick={() => {
                resetEditor();
                onCancel?.();
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              pill={false}
              onClick={handleSubmit}
              disabled={isSaving || locationOptionGroups.length === 0}
            >
              {isSaving
                ? "Adding..."
                : hasPendingNewGroups
                  ? "Add location option"
                  : "Done"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function IntentView() {
  const { notify, confirm } = useNotifications();
  const { id } = useParams();
  const [intent, setIntent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingIntent, setUpdatingIntent] = useState(false);
  const [editingWorkId, setEditingWorkId] = useState(null);
  const [editingWorkTitle, setEditingWorkTitle] = useState("");
  const [editingWorkNotes, setEditingWorkNotes] = useState("");
  const [editingWorkDuration, setEditingWorkDuration] = useState(15);
  const [editingWorkStatus, setEditingWorkStatus] = useState("todo");
  const [updatingWorkId, setUpdatingWorkId] = useState(null);
  const [deletingWorkId, setDeletingWorkId] = useState(null);
  const [addingOptionForWorkId, setAddingOptionForWorkId] = useState(null);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [isSuggestingWork, setIsSuggestingWork] = useState(false);
  const [addingSuggestionIndex, setAddingSuggestionIndex] = useState(null);

  useEffect(() => {
    async function fetchIntent() {
      try {
        const response = await axios.get(
          `http://localhost:3001/api/intents/${id}`
        );
        setIntent(response.data);
      } catch (error) {
        console.error("Failed to fetch intent", error);
      } finally {
        setLoading(false);
      }
    }
    fetchIntent();
  }, [id]);

  const handlePatchIntent = async (patch) => {
    setUpdatingIntent(true);

    try {
      const response = await axios.patch(
        `http://localhost:3001/api/intents/${id}`,
        patch
      );
      setIntent(response.data);
      return response.data;
    } catch (error) {
      console.error("Failed to update intent", error);
      notify("Unable to update intent right now.");
      throw error;
    } finally {
      setUpdatingIntent(false);
    }
  };

  const handlePatchWork = async (workId, patch) => {
    setUpdatingWorkId(workId);

    try {
      const response = await axios.patch(
        `http://localhost:3001/api/work/${workId}`,
        patch
      );
      const updatedWork = response.data;

      setIntent((prev) => ({
        ...prev,
        workItems: prev.workItems.map((item) =>
          item.id === workId ? { ...item, ...updatedWork } : item
        ),
      }));

      return updatedWork;
    } catch (error) {
      console.error("Failed to update work", error);
      notify("Unable to update work right now.");
      throw error;
    } finally {
      setUpdatingWorkId(null);
    }
  };

  const handleLocationOptionsCreated = (workId, createdOptions) => {
    setIntent((prev) => ({
      ...prev,
      workItems: prev.workItems.map((item) =>
        item.id === workId
          ? {
              ...item,
              locationOptions: [
                ...(item.locationOptions || []),
                ...createdOptions,
              ],
              selectedLocationOptionId:
                createdOptions[createdOptions.length - 1]?.id ||
                item.selectedLocationOptionId,
            }
          : item
      ),
    }));
  };

  const handleLocationAttached = (workId, optionId, updatedOption) => {
    setIntent((prev) => ({
      ...prev,
      workItems: prev.workItems.map((item) =>
        item.id === workId
          ? {
              ...item,
              locationOptions: (item.locationOptions || []).map((option) =>
                option.id === optionId ? updatedOption : option
              ),
            }
          : item
      ),
    }));
  };

  const handleLocationOptionRemoved = (
    workId,
    optionId,
    selectedLocationOptionId
  ) => {
    setIntent((prev) => ({
      ...prev,
      workItems: prev.workItems.map((item) => {
        if (item.id !== workId) {
          return item;
        }

        const remainingOptions = (item.locationOptions || []).filter(
          (option) => option.id !== optionId
        );
        return {
          ...item,
          locationOptions: remainingOptions,
          selectedLocationOptionId:
            selectedLocationOptionId || remainingOptions[0]?.id || null,
        };
      }),
    }));
  };

  const startAddLocationOption = (work) => {
    setAddingOptionForWorkId(work.id);
  };

  const startEditWork = (work) => {
    setEditingWorkId(work.id);
    setEditingWorkTitle(work.title || "");
    setEditingWorkNotes(work.notes || "");
    setEditingWorkDuration(work.durationMinutes || 15);
    setEditingWorkStatus(work.status || "todo");
  };

  const cancelEditWork = () => {
    setEditingWorkId(null);
    setEditingWorkTitle("");
    setEditingWorkNotes("");
    setEditingWorkDuration(15);
    setEditingWorkStatus("todo");
  };

  const saveEditWork = async (workId) => {
    const nextTitle = editingWorkTitle.trim();
    if (!nextTitle) {
      notify("Work title is required.");
      return;
    }

    await handlePatchWork(workId, {
      title: nextTitle,
      notes: editingWorkNotes.trim() || null,
      durationMinutes: Number(editingWorkDuration) || 15,
      status: editingWorkStatus,
    });

    cancelEditWork();
  };

  const cancelAddLocationOption = () => {
    setAddingOptionForWorkId(null);
  };

  const handleSelectLocationOption = async (workId, optionId) => {
    try {
      const updated = await handlePatchWork(workId, {
        selectedLocationOptionId: optionId,
      });
      return updated;
    } catch (error) {
      console.error("Failed to select location option", error);
      notify("Failed to choose location option");
    }
  };

  const getChosenOption = (work) => {
    if (!work.locationOptions || work.locationOptions.length === 0) {
      return null;
    }
    return (
      work.locationOptions.find(
        (option) => option.id === work.selectedLocationOptionId
      ) || work.locationOptions[0]
    );
  };

  const handleWorkCreated = (newWork) => {
    setIntent((prev) => ({
      ...prev,
      workItems: [newWork, ...(prev.workItems || [])],
    }));
  };

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
      await axios.delete(`http://localhost:3001/api/work/${work.id}`);
      setIntent((prev) => ({
        ...prev,
        workItems: prev.workItems.filter((item) => item.id !== work.id),
      }));
    } catch (error) {
      console.error("Failed to delete work item", error);
      notify("Failed to delete work item.");
    } finally {
      setDeletingWorkId(null);
    }
  };

  const handleSuggestWork = async () => {
    setIsSuggestingWork(true);
    try {
      const response = await axios.post(
        "http://localhost:3001/api/ai/suggest-work",
        { intentId: id }
      );
      const suggestions = response.data?.suggestions || [];
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

  const addSuggestionAsWork = async (index) => {
    const suggestion = aiSuggestions[index];
    if (!suggestion) return;

    setAddingSuggestionIndex(index);
    try {
      const response = await axios.post("http://localhost:3001/api/work", {
        title: suggestion.title,
        notes: suggestion.notes || undefined,
        durationMinutes: suggestion.durationMinutes || 30,
        intentId: id,
      });
      handleWorkCreated(response.data);
      dismissSuggestion(index);
    } catch (error) {
      console.error("Failed to add suggested work", error);
      notify("Failed to add this suggestion.");
    } finally {
      setAddingSuggestionIndex(null);
    }
  };

  if (loading)
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading intent...
      </div>
    );

  if (!intent)
    return <div className="p-8 text-center text-danger">Intent not found</div>;

  const workCount = intent.workItems?.length || 0;
  const completedCount =
    intent.workItems?.filter((work) => work.status === "done").length || 0;
  const placeCount = new Set(
    intent.workItems?.flatMap(
      (work) =>
        work.locationOptions?.flatMap(
          (option) => option.locations?.map((location) => location.id) || []
        ) || []
    ) || []
  ).size;

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
        updatingIntent={updatingIntent}
      />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:mb-6 sm:flex sm:w-auto">
        <Button
          variant="primary"
          size="lg"
          onClick={() => {
            const form = document.getElementById("new-work-form");
            form?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          + Add Work
        </Button>
        <Button
          variant="accent-outline"
          size="lg"
          onClick={handleSuggestWork}
          disabled={isSuggestingWork}
        >
          {isSuggestingWork ? "Thinking…" : "✨ Suggest Work"}
        </Button>
      </div>

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
          </div>

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
            <div className="grid gap-3 sm:gap-4">
              {intent.workItems.map((work) => (
                <Card key={work.id} padding="md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-foreground sm:text-lg">
                        {work.title}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:text-sm">
                        <span>{work.durationMinutes || 30} min</span>
                        <Badge
                          tone={
                            work.status === "done"
                              ? "success"
                              : work.status === "in_progress"
                                ? "primary"
                                : "neutral"
                          }
                        >
                          {work.status.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteWork(work)}
                      disabled={deletingWorkId === work.id}
                      aria-label={`Delete ${work.title}`}
                      title="Delete work item"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-danger/30 bg-danger/10 text-danger transition hover:bg-danger/20 disabled:opacity-50"
                    >
                      {deletingWorkId === work.id ? "…" : "✕"}
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => startEditWork(work)}
                      disabled={updatingWorkId === work.id}
                    >
                      Edit
                    </Button>
                    <Badge tone="neutral">
                      {work.locationOptions?.length > 0
                        ? `${work.locationOptions.length} option${work.locationOptions.length === 1 ? "" : "s"}`
                        : "No location"}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => startAddLocationOption(work)}
                      className="rounded-full border border-primary/30 bg-primary/10 min-h-9 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20"
                    >
                      Edit locations
                    </button>
                  </div>

                  {editingWorkId === work.id && (
                    <div className="mt-4 rounded-3xl border border-border bg-surface-alt p-4">
                      <div className="mb-3 text-sm font-semibold text-foreground">
                        Edit Work
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="space-y-2 sm:col-span-2">
                          <span className="text-sm font-medium text-foreground">
                            What needs to happen?
                          </span>
                          <input
                            value={editingWorkTitle}
                            onChange={(e) =>
                              setEditingWorkTitle(e.target.value)
                            }
                            className="block w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground focus:border-primary focus:ring-primary"
                          />
                        </label>

                        <label className="space-y-2">
                          <span className="text-sm font-medium text-foreground">
                            Duration
                          </span>
                          <select
                            value={editingWorkDuration}
                            onChange={(e) =>
                              setEditingWorkDuration(Number(e.target.value))
                            }
                            className="block w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground focus:border-primary focus:ring-primary"
                          >
                            {DURATION_OPTIONS.map((minutes) => (
                              <option key={minutes} value={minutes}>
                                {minutes < 60
                                  ? `${minutes} min`
                                  : `${minutes / 60} hr${minutes === 60 ? "" : "s"}`}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="space-y-2">
                          <span className="text-sm font-medium text-foreground">
                            Status
                          </span>
                          <select
                            value={editingWorkStatus}
                            onChange={(e) =>
                              setEditingWorkStatus(e.target.value)
                            }
                            className="block w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground focus:border-primary focus:ring-primary"
                          >
                            <option value="todo">Todo</option>
                            <option value="in_progress">In progress</option>
                            <option value="done">Done</option>
                          </select>
                        </label>

                        <label className="space-y-2 sm:col-span-2">
                          <span className="text-sm font-medium text-foreground">
                            Notes
                          </span>
                          <input
                            value={editingWorkNotes}
                            onChange={(e) =>
                              setEditingWorkNotes(e.target.value)
                            }
                            className="block w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground focus:border-primary focus:ring-primary"
                            placeholder="Add context or details"
                          />
                        </label>
                      </div>
                      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button
                          variant="secondary"
                          pill={false}
                          onClick={cancelEditWork}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="primary"
                          pill={false}
                          onClick={() => saveEditWork(work.id)}
                          disabled={
                            updatingWorkId === work.id ||
                            !editingWorkTitle.trim()
                          }
                        >
                          {updatingWorkId === work.id
                            ? "Saving..."
                            : "Save changes"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {addingOptionForWorkId === work.id && (
                    <WorkLocationOptionsEditor
                      work={work}
                      onOptionsCreated={(createdOptions) =>
                        handleLocationOptionsCreated(work.id, createdOptions)
                      }
                      onLocationAttached={(optionId, updatedOption) =>
                        handleLocationAttached(work.id, optionId, updatedOption)
                      }
                      onGroupRemoved={(optionId, nextSelectedOptionId) =>
                        handleLocationOptionRemoved(
                          work.id,
                          optionId,
                          nextSelectedOptionId
                        )
                      }
                      onCancel={cancelAddLocationOption}
                    />
                  )}

                  {work.notes && (
                    <div className="mt-4 text-sm text-muted-foreground">
                      {work.notes}
                    </div>
                  )}
                  {work.locationOptions && work.locationOptions.length > 0 && (
                    <div className="mt-4 space-y-3">
                      <div className="rounded-3xl border border-border bg-primary/10 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                          <div>
                            <div className="text-sm font-semibold text-primary">
                              Chosen location option
                            </div>
                            <div className="text-sm text-primary">
                              {getChosenOption(work)?.title || `Option 1`}
                            </div>
                            {getChosenOption(work)?.locations?.length > 0 && (
                              <div className="mt-1 text-xs text-primary">
                                {getChosenOption(work).locations.length} place
                                {getChosenOption(work).locations.length === 1
                                  ? ""
                                  : "s"}
                              </div>
                            )}
                          </div>
                          <div className="self-start rounded-full border border-primary/30 bg-surface px-3 py-1 text-xs text-primary">
                            {work.locationOptions.length} option
                            {work.locationOptions.length === 1 ? "" : "s"}
                          </div>
                        </div>
                      </div>
                      {work.locationOptions.map((option, index) => {
                        const isSelected =
                          option.id === work.selectedLocationOptionId;

                        return (
                          <div
                            key={option.id}
                            className={`rounded-3xl border p-4 ${isSelected ? "border-primary bg-primary/10" : "border-border bg-surface-alt"}`}
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                              <div>
                                <div className="text-sm font-semibold text-foreground">
                                  {option.title || `Option ${index + 1}`}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {option.locations.length} place
                                  {option.locations.length === 1 ? "" : "s"}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  handleSelectLocationOption(work.id, option.id)
                                }
                                className={`rounded-full min-h-9 px-3 py-1.5 text-xs font-semibold transition ${isSelected ? "border border-primary bg-primary text-primary-foreground" : "border border-border bg-surface text-foreground hover:bg-surface-alt"}`}
                              >
                                {isSelected ? "Selected" : "Select option"}
                              </button>
                            </div>
                            <div className="mt-3 space-y-2">
                              {option.locations.map((location) => (
                                <LocationCard
                                  key={location.id}
                                  location={location}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              ))}
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

          <IntentWorkForm intentId={id} onWorkCreated={handleWorkCreated} />
        </section>

        <Card
          as="aside"
          padding="lg"
          className="order-first sm:p-6 lg:order-none"
        >
          <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Places</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Derived from your work options.
              </p>
            </div>
            <Button
              variant="primary"
              pill={false}
              onClick={() => (window.location.href = "/planner")}
              className="sm:w-auto"
            >
              Plan this Intent
            </Button>
          </div>

          <div className="grid gap-3 sm:gap-4">
            <div className="rounded-3xl border border-border p-4">
              <div className="text-sm text-muted-foreground">Work</div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {workCount}
              </div>
              <div className="text-sm text-muted-foreground">
                {completedCount} complete
              </div>
            </div>
            <div className="rounded-3xl border border-border p-4">
              <div className="text-sm text-muted-foreground">Places</div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {placeCount}
              </div>
              <div className="text-sm text-muted-foreground">
                Derived automatically from work options.
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
