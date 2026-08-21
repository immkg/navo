import { useCallback, useEffect, useRef, useState } from "react";
import {
  autocompletePlaces,
  getPlaceDetails,
  loadGoogleMaps,
  reverseGeocodeLocation,
  searchPlaces,
} from "../../utils/googleMaps";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import LocationCard from "../../pages/IntentView/LocationCard";

// Presentational + Google Places search UI shared by IntentView's
// WorkLocationOptionsEditor (persists each change immediately via the API)
// and IntentWorkForm's location step (accumulates groups locally until the
// whole work item is created). This component owns none of that persistence
// decision — it only renders the group list + search/map UI and calls back
// into the parent for every mutation, so the parent decides how (or whether)
// to persist it.
export default function LocationOptionGroupsEditor({
  groups,
  selectedGroupIndex,
  onSelectGroup,
  onAddGroup,
  onRenameGroup,
  onRemoveGroup,
  onAddLocationToGroup,
  onRemoveLocationFromGroup,
  disabled = false,
  addGroupLabel = "+ Add group",
}) {
  const [placeQuery, setPlaceQuery] = useState("");
  const [autocompleteResults, setAutocompleteResults] = useState([]);
  const [placeResults, setPlaceResults] = useState([]);
  const [selectedPreviewPlace, setSelectedPreviewPlace] = useState(null);
  const [droppedPinPlace, setDroppedPinPlace] = useState(null);
  const [searchError, setSearchError] = useState(null);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [showManualPlaceForm, setShowManualPlaceForm] = useState(false);
  const [manualPlaceName, setManualPlaceName] = useState("");
  const [manualPlaceAddress, setManualPlaceAddress] = useState("");
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRefs = useRef([]);
  const mapClickListenerRef = useRef(null);
  const googleKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const showPlaceSearchPanel = groups.length > 0;

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
    const group = groups[groupIndex];
    if (!group) return;

    const isDuplicate = group.locations.some(
      (location) => location.placeId === place.placeId
    );
    if (isDuplicate) {
      return;
    }

    onAddLocationToGroup(groupIndex, {
      name: place.name,
      address: place.formattedAddress,
      latitude: place.latitude,
      longitude: place.longitude,
      placeId: place.placeId,
      provider: place.provider || "google",
    });

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

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={onAddGroup}
          className="rounded-full border border-primary/30 bg-surface min-h-9 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/10"
        >
          {groups.length === 0 ? "Edit Locations" : addGroupLabel}
        </button>
      </div>

      {groups.length === 0 ? (
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
            {groups.map((group, index) => (
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
                          onRenameGroup(index, e.target.value);
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
                    onClick={() => onSelectGroup(index)}
                    className={`rounded-full min-h-9 px-3 py-1.5 text-xs font-semibold transition ${selectedGroupIndex === index ? "border border-primary bg-primary text-primary-foreground" : "border border-border bg-surface text-foreground hover:bg-surface-alt"}`}
                  >
                    {selectedGroupIndex === index ? "Selected" : "Select"}
                  </button>
                </div>
                <div className="mt-3">
                  <Button
                    variant="danger-outline"
                    size="sm"
                    onClick={() => onRemoveGroup(index)}
                    disabled={disabled}
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
                              onRemoveLocationFromGroup(index, locationIndex)
                            }
                            disabled={disabled}
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
        </div>
      )}
    </>
  );
}
