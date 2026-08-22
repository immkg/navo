const DISTANCE_MATRIX_URL =
  "https://maps.googleapis.com/maps/api/distancematrix/json";

// Real API calls take a few hundred ms to a couple seconds; this bounds the
// worst case so a slow/hanging response can't stall plan building — callers
// fall back to the haversine estimate instead.
const REQUEST_TIMEOUT_MS = 5000;

function isGoogleRoutingConfigured() {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY);
}

function locationKey(point) {
  return `${point.latitude},${point.longitude}`;
}

// points: array of {latitude, longitude}, deduplicated by the caller.
// Returns Map<"lat,lng:lat,lng", minutes> for every pair Google could route
// between; a pair missing from the map (API failure, or that specific
// element came back non-OK) is the caller's signal to fall back per-pair.
async function fetchTravelTimeMatrixMinutes(points) {
  if (!isGoogleRoutingConfigured() || points.length < 2) return new Map();

  const coords = points.map(locationKey).join("|");
  const url =
    `${DISTANCE_MATRIX_URL}?origins=${encodeURIComponent(coords)}` +
    `&destinations=${encodeURIComponent(coords)}&mode=driving` +
    `&key=${process.env.GOOGLE_MAPS_API_KEY}`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    console.error(
      "Google Distance Matrix API error",
      response.status,
      await response.text()
    );
    return new Map();
  }

  const data = await response.json();
  if (data.status !== "OK") {
    console.error("Google Distance Matrix API status", data.status);
    return new Map();
  }

  const matrix = new Map();
  (data.rows || []).forEach((row, originIndex) => {
    (row.elements || []).forEach((element, destIndex) => {
      if (element.status !== "OK") return;
      const minutes = Math.max(1, Math.round(element.duration.value / 60));
      const key = `${locationKey(points[originIndex])}:${locationKey(points[destIndex])}`;
      matrix.set(key, minutes);
    });
  });

  return matrix;
}

module.exports = {
  isGoogleRoutingConfigured,
  fetchTravelTimeMatrixMinutes,
  locationKey,
};
