const HOME_LOCATION_STORAGE_KEY = "navo:homeLocation";

// Persisted in localStorage (not sessionStorage) — the whole point is to
// survive across sessions, removing the "pick my start location" tap every
// single day for the common case of always starting from the same place.
export function getHomeLocation() {
  try {
    const raw = localStorage.getItem(HOME_LOCATION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setHomeLocation(location) {
  try {
    if (location) {
      localStorage.setItem(
        HOME_LOCATION_STORAGE_KEY,
        JSON.stringify({
          label: location.label || null,
          latitude: location.latitude,
          longitude: location.longitude,
        })
      );
    } else {
      localStorage.removeItem(HOME_LOCATION_STORAGE_KEY);
    }
  } catch {
    // localStorage unavailable (e.g. private browsing) — not persisting
    // "home" is an acceptable degradation.
  }
}
