import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  searchPlaces,
  autocompletePlaces,
  getPlaceDetails,
  loadGoogleMaps,
  reverseGeocodeLocation,
} from "../../utils/googleMaps";
import LocationCard from "./LocationCard";

const DURATION_OPTIONS = [
  5, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240,
];

export default function IntentWorkForm({ intentId, onWorkCreated }) {
  const [newWorkTitle, setNewWorkTitle] = useState("");
  const [newWorkDuration, setNewWorkDuration] = useState(15);
  const [newWorkNotes, setNewWorkNotes] = useState("");
  const [newWorkMode, setNewWorkMode] = useState("remote");
  const [newWorkLocationOptionGroups, setNewWorkLocationOptionGroups] =
    useState([]);
  const [newWorkSelectedOptionGroupIndex, setNewWorkSelectedOptionGroupIndex] =
    useState(0);
  const [newWorkPlaceQuery, setNewWorkPlaceQuery] = useState("");
  const [newWorkAutocompleteResults, setNewWorkAutocompleteResults] = useState(
    []
  );
  const [newWorkPlaceResults, setNewWorkPlaceResults] = useState([]);
  const [selectedPreviewPlace, setSelectedPreviewPlace] = useState(null);
  const [droppedPinPlace, setDroppedPinPlace] = useState(null);
  const [newWorkPlaceSearchError, setNewWorkPlaceSearchError] = useState(null);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRefs = useRef([]);
  const mapClickListenerRef = useRef(null);
  const googleKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const showPlaceSearchPanel =
    newWorkMode === "place" && newWorkLocationOptionGroups.length > 0;

  const resetForm = () => {
    setNewWorkTitle("");
    setNewWorkDuration(15);
    setNewWorkNotes("");
    setNewWorkMode("remote");
    setNewWorkLocationOptionGroups([]);
    setNewWorkSelectedOptionGroupIndex(0);
    setNewWorkPlaceQuery("");
    setNewWorkAutocompleteResults([]);
    setNewWorkAutocompleteResults([]);
    setNewWorkPlaceResults([]);
    setSelectedPreviewPlace(null);
    setDroppedPinPlace(null);
    setNewWorkPlaceSearchError(null);
  };

  const handleAutocomplete = async (query) => {
    setNewWorkPlaceSearchError(null);
    setSelectedPreviewPlace(null);
    setDroppedPinPlace(null);

    if (!googleKey || !query.trim()) {
      setNewWorkAutocompleteResults([]);
      return;
    }

    try {
      const autocomplete = await autocompletePlaces(query.trim(), googleKey);
      setNewWorkAutocompleteResults(autocomplete);
    } catch (error) {
      console.error("Autocomplete failed", error);
      setNewWorkPlaceSearchError(error.message || "Autocomplete failed.");
      setNewWorkAutocompleteResults([]);
    }
  };

  const handleCreateWork = async (event) => {
    event.preventDefault();
    if (!newWorkTitle.trim()) return;

    setIsSubmitting(true);

    try {
      const payload = {
        title: newWorkTitle.trim(),
        durationMinutes: Number(newWorkDuration) || 15,
        notes: newWorkNotes.trim() || undefined,
        intentId,
      };

      if (newWorkMode === "place") {
        if (newWorkLocationOptionGroups.length === 0) {
          alert(
            "Please add at least one location option group for place-based work."
          );
          return;
        }

        payload.locationOptions = newWorkLocationOptionGroups
          .map((group) => ({
            title: group.title?.trim() || undefined,
            locations: group.locations
              .filter((location) => location.name)
              .map((location) => ({
                name: location.name,
                address: location.address,
                latitude: location.latitude,
                longitude: location.longitude,
                placeId: location.placeId,
                provider: location.provider,
              })),
          }))
          .filter((option) => option.locations.length > 0);

        if (payload.locationOptions.length === 0) {
          alert(
            "Please add at least one place to your location option groups."
          );
          return;
        }
      }

      const res = await axios.post("http://localhost:3001/api/work", payload);
      const newWork = res.data;

      onWorkCreated({
        ...newWork,
        selectedLocationOptionId:
          newWork.selectedLocationOptionId || newWork.locationOptions?.[0]?.id,
      });
      resetForm();
    } catch (error) {
      console.error("Failed to create work", error);
      alert("Failed to create work");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddLocationOptionGroup = () => {
    const nextIndex = newWorkLocationOptionGroups.length;
    setNewWorkLocationOptionGroups((prev) => [
      ...prev,
      { title: `Option ${nextIndex + 1}`, locations: [] },
    ]);
    setNewWorkSelectedOptionGroupIndex(nextIndex);
  };

  const handleRemoveLocationOptionGroup = (groupIndex) => {
    setNewWorkLocationOptionGroups((prev) =>
      prev.filter((_, index) => index !== groupIndex)
    );
    setNewWorkSelectedOptionGroupIndex((prevSelectedIndex) => {
      if (groupIndex < prevSelectedIndex) {
        return prevSelectedIndex - 1;
      }
      if (groupIndex === prevSelectedIndex) {
        return Math.max(0, prevSelectedIndex - 1);
      }
      return prevSelectedIndex;
    });
  };

  const handleRemoveLocationFromGroup = (groupIndex, locationIndex) => {
    setNewWorkLocationOptionGroups((prev) => {
      const next = [...prev];
      const group = next[groupIndex];
      if (!group) return prev;
      group.locations = group.locations.filter(
        (_, index) => index !== locationIndex
      );
      return next;
    });
  };

  const handleSearchPlaces = async () => {
    if (!googleKey) {
      setNewWorkPlaceSearchError("Google Maps API key is not configured.");
      return;
    }

    if (!newWorkPlaceQuery.trim()) {
      setNewWorkPlaceSearchError("Enter a place name or address to search.");
      return;
    }

    setIsSearchingPlaces(true);
    setNewWorkPlaceSearchError(null);
    setSelectedPreviewPlace(null);
    setDroppedPinPlace(null);

    try {
      const results = await searchPlaces(newWorkPlaceQuery.trim(), googleKey);
      setNewWorkPlaceResults(results);
      if (results.length > 0) {
        setSelectedPreviewPlace(results[0]);
      }
    } catch (error) {
      console.error("Place search failed", error);
      setNewWorkPlaceSearchError(error.message || "Place search failed.");
      setNewWorkPlaceResults([]);
      setSelectedPreviewPlace(null);
    } finally {
      setIsSearchingPlaces(false);
    }
  };

  const handleAddLocationResultToGroup = (groupIndex, place) => {
    setNewWorkLocationOptionGroups((prev) => {
      const next = [...prev];
      const group = next[groupIndex];
      if (!group) return prev;

      const isDuplicate = group.locations.some(
        (location) => location.placeId === place.placeId
      );
      if (isDuplicate) {
        return prev;
      }

      group.locations = [
        ...group.locations,
        {
          name: place.name,
          address: place.formattedAddress,
          latitude: place.latitude,
          longitude: place.longitude,
          placeId: place.placeId,
          provider: "google",
        },
      ];
      return next;
    });
    setNewWorkPlaceResults([]);
    setNewWorkPlaceQuery("");
    setNewWorkAutocompleteResults([]);
  };

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
    handleAddLocationResultToGroup(
      newWorkSelectedOptionGroupIndex,
      droppedPinPlace
    );
  };

  useEffect(() => {
    async function initializeMap() {
      if (
        !googleKey ||
        !showPlaceSearchPanel ||
        newWorkPlaceResults.length === 0 ||
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
    newWorkPlaceResults.length,
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

      const candidatePlaces = [...newWorkPlaceResults];
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
  }, [newWorkPlaceResults, selectedPreviewPlace, droppedPinPlace, mapReady]);

  return (
    <div
      id="new-work-form"
      className="mt-10 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6"
    >
      <h2 className="mb-4 text-lg font-semibold text-gray-900 sm:text-xl">
        Add Work
      </h2>
      <form onSubmit={handleCreateWork} className="space-y-4 sm:space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            What needs to happen?
          </label>
          <input
            value={newWorkTitle}
            onChange={(e) => setNewWorkTitle(e.target.value)}
            className="block w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
            placeholder="Buy ingredients, call electrician, review document"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Notes (optional)
          </label>
          <input
            value={newWorkNotes}
            onChange={(e) => setNewWorkNotes(e.target.value)}
            className="block w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
            placeholder="Add context or details"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Duration (optional)
            </label>
            <select
              value={newWorkDuration}
              onChange={(e) => setNewWorkDuration(Number(e.target.value))}
              className="block w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
            >
              {DURATION_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes < 60
                    ? `${minutes} min`
                    : `${minutes / 60} hr${minutes === 60 ? "" : "s"}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-4 rounded-3xl border border-gray-200 bg-gray-50 p-4">
          <div className="text-sm font-medium text-gray-700">Work location</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-3 rounded-3xl border border-gray-200 bg-white p-4">
              <input
                type="radio"
                name="newWorkMode"
                value="remote"
                checked={newWorkMode === "remote"}
                onChange={() => setNewWorkMode("remote")}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="font-semibold text-gray-900">
                  Remote (mobile / laptop)
                </div>
                <div className="text-sm text-gray-500">
                  No physical location required.
                </div>
              </div>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-3xl border border-gray-200 bg-white p-4">
              <input
                type="radio"
                name="newWorkMode"
                value="place"
                checked={newWorkMode === "place"}
                onChange={() => setNewWorkMode("place")}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="font-semibold text-gray-900">
                  Requires one or more places
                </div>
                <div className="text-sm text-gray-500">
                  Add location option groups for route-aware work.
                </div>
              </div>
            </label>
          </div>
        </div>

        {newWorkMode === "place" && (
          <div className="space-y-4 rounded-3xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={handleAddLocationOptionGroup}
                className="rounded-full border border-blue-200 bg-white min-h-9 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                {newWorkLocationOptionGroups.length === 0
                  ? "Edit Locations"
                  : "+ Add Group"}
              </button>
            </div>

            {newWorkLocationOptionGroups.length > 0 && (
              <div className="rounded-3xl border border-gray-200 bg-white p-4">
                <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <input
                    value={newWorkPlaceQuery}
                    onChange={(e) => {
                      const nextQuery = e.target.value;
                      setNewWorkPlaceQuery(nextQuery);
                      handleAutocomplete(nextQuery);
                    }}
                    placeholder="Search for a place"
                    className="block w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleSearchPlaces}
                    disabled={isSearchingPlaces}
                    className="rounded-full bg-blue-600 px-4 py-3 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSearchingPlaces ? "Searching…" : "Search"}
                  </button>
                </div>
                {newWorkPlaceSearchError && (
                  <div className="mt-3 text-sm text-red-600">
                    {newWorkPlaceSearchError}
                  </div>
                )}

                {newWorkAutocompleteResults.length > 0 && (
                  <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-3">
                    <div className="mb-2 text-sm font-semibold text-gray-900">
                      Suggestions
                    </div>
                    <div className="space-y-2">
                      {newWorkAutocompleteResults.map((suggestion) => (
                        <button
                          key={suggestion.placeId}
                          type="button"
                          onClick={async () => {
                            setNewWorkPlaceQuery(suggestion.description);
                            setNewWorkAutocompleteResults([]);
                            setIsSearchingPlaces(true);
                            try {
                              const placeDetails = await getPlaceDetails(
                                suggestion.placeId,
                                googleKey
                              );
                              setNewWorkPlaceResults([placeDetails]);
                              setNewWorkPlaceSearchError(null);
                            } catch (error) {
                              console.error(
                                "Autocomplete selection failed",
                                error
                              );
                              setNewWorkPlaceSearchError(
                                error.message || "Place details failed."
                              );
                              setNewWorkPlaceResults([]);
                            } finally {
                              setIsSearchingPlaces(false);
                            }
                          }}
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100"
                        >
                          {suggestion.description}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {newWorkPlaceResults.length > 0 && (
                  <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.95fr)]">
                    <div className="space-y-2">
                      <div className="rounded-3xl border border-gray-200 bg-white p-2.5 sm:p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="text-sm font-semibold text-gray-900">
                            Places
                          </div>
                          <div className="text-xs text-gray-500">
                            {newWorkPlaceResults.length} results
                          </div>
                        </div>
                        <div className="space-y-2">
                          {newWorkPlaceResults.map((place, resultIndex) => (
                            <div
                              key={resultIndex}
                              className={`rounded-2xl border p-3 ${selectedPreviewPlace?.placeId === place.placeId ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-gray-50"}`}
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                                <div className="min-w-0">
                                  <div className="truncate font-medium text-gray-900">
                                    {place.name}
                                  </div>
                                  {place.formattedAddress && (
                                    <div className="truncate text-sm text-gray-500">
                                      {place.formattedAddress}
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-col gap-2 sm:flex-row">
                                  <button
                                    type="button"
                                    onClick={() => previewPlaceInMap(place)}
                                    className="rounded-full border border-blue-200 bg-white min-h-9 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                                  >
                                    Preview
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleAddLocationResultToGroup(
                                        newWorkSelectedOptionGroupIndex,
                                        place
                                      )
                                    }
                                    className="rounded-full bg-blue-600 min-h-9 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                                  >
                                    Add
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-3xl border border-gray-200 bg-white p-2.5 sm:p-3">
                      <div className="mb-2 text-sm font-semibold text-gray-900">
                        Map preview
                      </div>
                      <div className="mb-2 text-xs text-gray-500">
                        Click on map to drop a pin, then add it to the active
                        group.
                      </div>
                      <div
                        ref={mapContainerRef}
                        className="h-56 rounded-3xl border border-gray-200 bg-gray-100 sm:h-64"
                      />
                      {droppedPinPlace && (
                        <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 p-3">
                          <div className="text-sm font-semibold text-blue-900">
                            Dropped pin
                          </div>
                          <div className="text-sm text-blue-700">
                            {droppedPinPlace.formattedAddress}
                          </div>
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={handleAddDroppedPinToGroup}
                              className="rounded-full bg-blue-600 min-h-9 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                            >
                              Add dropped pin
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {newWorkLocationOptionGroups.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
                    Add a location option group first, then add one or more
                    places inside it.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {newWorkLocationOptionGroups.map((group, index) => (
                      <div
                        key={index}
                        className={`rounded-3xl border p-4 ${newWorkSelectedOptionGroupIndex === index ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"}`}
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-3">
                              <input
                                value={group.title}
                                onChange={(e) => {
                                  const title = e.target.value;
                                  setNewWorkLocationOptionGroups((prev) => {
                                    const next = [...prev];
                                    next[index] = { ...next[index], title };
                                    return next;
                                  });
                                }}
                                placeholder="Option title (optional)"
                                className="w-full max-w-[260px] rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                              />
                              <span className="rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                                {group.locations.length} place
                                {group.locations.length === 1 ? "" : "s"}
                              </span>
                            </div>
                            {group.locations.length > 0 && (
                              <div className="mt-2 text-sm text-gray-500">
                                {group.locations.length === 1
                                  ? "1 place added"
                                  : `${group.locations.length} places added`}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setNewWorkSelectedOptionGroupIndex(index)
                            }
                            className={`rounded-full min-h-9 px-3 py-1.5 text-xs font-semibold transition ${newWorkSelectedOptionGroupIndex === index ? "border border-blue-500 bg-blue-500 text-white" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"}`}
                          >
                            {newWorkSelectedOptionGroupIndex === index
                              ? "Selected"
                              : "Select"}
                          </button>
                        </div>
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveLocationOptionGroup(index)
                            }
                            className="rounded-full border border-red-200 bg-red-50 min-h-9 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                          >
                            Remove group
                          </button>
                        </div>
                        {group.locations.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {group.locations.map((location, locationIndex) => (
                              <LocationCard
                                key={`${location.placeId || location.name}-${locationIndex}`}
                                location={location}
                                actions={
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRemoveLocationFromGroup(
                                        index,
                                        locationIndex
                                      )
                                    }
                                    className="rounded-full border border-red-200 bg-red-50 min-h-9 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                                  >
                                    Remove place
                                  </button>
                                }
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={resetForm}
            className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-400"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !newWorkTitle.trim()}
            className="rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? "Adding..." : "Add Work"}
          </button>
        </div>
      </form>
    </div>
  );
}
