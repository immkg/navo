import { useState } from "react";
import { searchPlaces } from "../../utils/googleMaps";
import Button from "../../components/ui/Button";

// Shared start/end picker for a plan's create form: a date/time input, a
// device-geolocation shortcut, a Places search, and a manual lat/lng
// fallback for when neither of those has what you need.
export default function PlanLocationPicker({ legend, value, onChange }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const googleKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

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

  const handleSearch = async (event) => {
    event.preventDefault();
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

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search a city or address"
          className="block w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-primary"
        />
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          disabled={isSearching}
        >
          {isSearching ? "Searching…" : "Search"}
        </Button>
      </form>

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
              value={value.latitude ?? ""}
              onChange={(event) =>
                onChange({ ...value, latitude: Number(event.target.value) })
              }
              className="block w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-primary"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide">
              Longitude
            </span>
            <input
              type="number"
              step="any"
              value={value.longitude ?? ""}
              onChange={(event) =>
                onChange({ ...value, longitude: Number(event.target.value) })
              }
              className="block w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-primary"
            />
          </label>
        </div>
      </details>
    </fieldset>
  );
}
