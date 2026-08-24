import { useState } from "react";
import { searchPlaces } from "../../utils/googleMaps";
import Button from "../../components/ui/Button";

function isValidLatitude(value) {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

// Shared start/end picker for a plan's create form: a date/time input, a
// device-geolocation shortcut, a Places search, and a manual lat/lng
// fallback for when neither of those has what you need.
export default function PlanLocationPicker({ legend, value, onChange }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  // Holds the raw text only while it's *invalid* (out of range or NaN) —
  // valid keystrokes commit straight to onChange and this clears, so the
  // displayed value otherwise just follows value.latitude/longitude
  // directly. That keeps this component fully derived from props (no
  // effect needed to stay in sync with an external coordinate change, e.g.
  // a search pick or "use current location").
  const [invalidLatitudeDraft, setInvalidLatitudeDraft] = useState(null);
  const [invalidLongitudeDraft, setInvalidLongitudeDraft] = useState(null);
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

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setSearchError("Your device doesn't support location detection.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({
          ...value,
          label: "Current location",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => setSearchError("Couldn't get your current location.")
    );
  };

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

  const handlePickResult = (place) => {
    onChange({
      ...value,
      label: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
    });
    setSearchResults([]);
    setSearchQuery("");
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

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleUseCurrentLocation}
        >
          📍 Use current location
        </Button>
        {value.label && (
          <span className="text-sm text-muted-foreground">{value.label}</span>
        )}
      </div>

      {/* A plain div, not a <form> — this picker is itself rendered inside
          the caller's own <form> (create-plan, edit-window), and a nested
          <form> is invalid HTML that React warns about at hydration. */}
      <div className="flex gap-2">
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
          className="block w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-primary"
        />
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
