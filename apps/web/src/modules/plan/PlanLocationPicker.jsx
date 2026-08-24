import { useEffect, useRef, useState } from "react";
import { reverseGeocodeLocation, searchPlaces } from "../../utils/googleMaps";
import Button from "../../components/ui/Button";
import { getHomeLocation, setHomeLocation } from "./homeLocation";

function isValidLatitude(value) {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

// Shared start/end picker for a plan's create form: a date/time input, a
// Places search with a current-location shortcut built into the field
// itself, and a manual lat/lng fallback for when neither of those has what
// you need.
export default function PlanLocationPicker({
  legend,
  value,
  onChange,
  autoDetectOnMount = false,
}) {
  const [searchQuery, setSearchQuery] = useState(value.label || "");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [searchError, setSearchError] = useState(null);
  // Holds the raw text only while it's *invalid* (out of range or NaN) —
  // valid keystrokes commit straight to onChange and this clears, so the
  // displayed value otherwise just follows value.latitude/longitude
  // directly. That keeps this component fully derived from props (no
  // effect needed to stay in sync with an external coordinate change, e.g.
  // a search pick or "use current location").
  const [invalidLatitudeDraft, setInvalidLatitudeDraft] = useState(null);
  const [invalidLongitudeDraft, setInvalidLongitudeDraft] = useState(null);
  const [homeLocation, setHomeLocationState] = useState(getHomeLocation);
  const googleKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const handleManualLatitudeChange = (rawValue) => {
    if (rawValue.trim() === "") {
      setInvalidLatitudeDraft(null);
      onChange({ ...value, latitude: null });
      return;
    }
    const numeric = Number(rawValue);
    if (isValidLatitude(numeric)) {
      setInvalidLatitudeDraft(null);
      onChange({ ...value, latitude: numeric });
    } else {
      setInvalidLatitudeDraft(rawValue);
    }
  };

  const handleManualLongitudeChange = (rawValue) => {
    if (rawValue.trim() === "") {
      setInvalidLongitudeDraft(null);
      onChange({ ...value, longitude: null });
      return;
    }
    const numeric = Number(rawValue);
    if (isValidLongitude(numeric)) {
      setInvalidLongitudeDraft(null);
      onChange({ ...value, longitude: numeric });
    } else {
      setInvalidLongitudeDraft(rawValue);
    }
  };

  const manualLatitudeInput = invalidLatitudeDraft ?? value.latitude ?? "";
  const manualLongitudeInput = invalidLongitudeDraft ?? value.longitude ?? "";
  const latitudeInputIsInvalid = invalidLatitudeDraft !== null;
  const longitudeInputIsInvalid = invalidLongitudeDraft !== null;

  // Detects the device's location and reverse-geocodes it into a real
  // address so the field shows *something* concrete, not a silent
  // "Current location" placeholder with an empty box — falls back to that
  // generic label when there's no API key configured or the geocode call
  // itself fails.
  const detectCurrentLocation = () => {
    if (!navigator.geolocation) {
      setSearchError("Your device doesn't support location detection.");
      return;
    }

    setIsDetecting(true);
    setSearchError(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        let label = "Current location";
        if (googleKey) {
          try {
            const reverse = await reverseGeocodeLocation(
              latitude,
              longitude,
              googleKey
            );
            if (reverse?.label) label = reverse.label;
          } catch {
            // Keep the generic label — coordinates are still real either way.
          }
        }
        setSearchQuery(label);
        onChange({ ...value, label, latitude, longitude });
        setIsDetecting(false);
      },
      () => {
        setSearchError("Couldn't get your current location.");
        setIsDetecting(false);
      }
    );
  };

  const hasAutoDetectedRef = useRef(false);
  useEffect(() => {
    if (!autoDetectOnMount) return;
    if (hasAutoDetectedRef.current) return;
    // Already has a real value (e.g. editing an existing plan) — the point
    // of auto-detecting is only to skip the tap for the common "starting
    // from wherever I am" case, never to override an existing choice.
    if (value.latitude != null && value.longitude != null) return;
    hasAutoDetectedRef.current = true;
    // Deferred a tick so detectCurrentLocation's own setState doesn't fire
    // synchronously within this effect's own commit.
    const timeoutId = setTimeout(() => {
      detectCurrentLocation();
    }, 0);
    return () => clearTimeout(timeoutId);
    // Deliberately runs once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async () => {
    if (!googleKey || !searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    try {
      const results = await searchPlaces(searchQuery.trim(), googleKey, null);
      setSearchResults(results);
    } catch (error) {
      setSearchError(error.message || "Search failed.");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleUseHome = () => {
    if (!homeLocation) return;
    const label = homeLocation.label || "Home";
    setSearchQuery(label);
    onChange({
      ...value,
      label,
      latitude: homeLocation.latitude,
      longitude: homeLocation.longitude,
    });
  };

  const handleSaveAsHome = () => {
    const next = {
      label: value.label || null,
      latitude: value.latitude,
      longitude: value.longitude,
    };
    setHomeLocation(next);
    setHomeLocationState(next);
  };

  const handlePickResult = (place) => {
    setSearchQuery(place.name);
    onChange({
      ...value,
      label: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
    });
    setSearchResults([]);
  };

  return (
    <fieldset className="space-y-3 rounded-2xl border border-border p-4">
      <legend className="px-1 text-sm font-semibold text-foreground">
        {legend}
      </legend>

      <label className="block space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Date &amp; time
        </span>
        <input
          type="datetime-local"
          required
          value={value.dateTime}
          onChange={(event) =>
            onChange({ ...value, dateTime: event.target.value })
          }
          className="block w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-primary"
        />
      </label>

      {/* A plain div, not a <form> — this picker is itself rendered inside
          the caller's own <form> (create-plan, edit-window), and a nested
          <form> is invalid HTML that React warns about at hydration. */}
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="relative min-w-0">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleSearch();
              }
            }}
            placeholder="Search a city or address"
            className={`block w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-primary ${
              homeLocation ? "pr-20" : "pr-11"
            }`}
          />
          {homeLocation && (
            <button
              type="button"
              onClick={handleUseHome}
              aria-label="Use home"
              title={`Use home (${homeLocation.label || "saved location"})`}
              className="absolute right-9 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-surface-alt hover:text-foreground"
            >
              🏠
            </button>
          )}
          <button
            type="button"
            onClick={detectCurrentLocation}
            disabled={isDetecting}
            aria-label="Use current location"
            title="Use current location"
            className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-surface-alt hover:text-foreground disabled:opacity-50"
          >
            📍
          </button>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleSearch}
          disabled={isSearching}
        >
          {isSearching ? "Searching…" : "Search"}
        </Button>
      </div>

      {isDetecting && (
        <p className="text-xs text-muted-foreground">
          Detecting your location…
        </p>
      )}

      {value.latitude != null && value.longitude != null && (
        <button
          type="button"
          onClick={handleSaveAsHome}
          className="text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline"
        >
          📌 Save as home
        </button>
      )}

      {searchError && <p className="text-sm text-danger">{searchError}</p>}

      {searchResults.length > 0 && (
        <ul className="space-y-1">
          {searchResults.map((place) => (
            <li key={place.placeId || place.name}>
              <button
                type="button"
                onClick={() => handlePickResult(place)}
                className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-surface-alt"
              >
                {place.name}
                {place.formattedAddress && (
                  <span className="block text-xs text-muted-foreground">
                    {place.formattedAddress}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <details className="text-sm text-muted-foreground">
        <summary className="cursor-pointer select-none">
          Enter coordinates manually
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide">
              Latitude
            </span>
            <input
              type="number"
              step="any"
              value={manualLatitudeInput}
              onChange={(event) =>
                handleManualLatitudeChange(event.target.value)
              }
              aria-invalid={latitudeInputIsInvalid}
              className={`block w-full rounded-xl border bg-surface px-3 py-2 text-sm text-foreground focus:ring-primary ${
                latitudeInputIsInvalid
                  ? "border-danger focus:border-danger"
                  : "border-border focus:border-primary"
              }`}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide">
              Longitude
            </span>
            <input
              type="number"
              step="any"
              value={manualLongitudeInput}
              onChange={(event) =>
                handleManualLongitudeChange(event.target.value)
              }
              aria-invalid={longitudeInputIsInvalid}
              className={`block w-full rounded-xl border bg-surface px-3 py-2 text-sm text-foreground focus:ring-primary ${
                longitudeInputIsInvalid
                  ? "border-danger focus:border-danger"
                  : "border-border focus:border-primary"
              }`}
            />
          </label>
        </div>
        {(latitudeInputIsInvalid || longitudeInputIsInvalid) && (
          <p className="mt-1 text-sm text-danger">
            Latitude must be between -90 and 90, longitude between -180 and 180.
          </p>
        )}
      </details>
    </fieldset>
  );
}
