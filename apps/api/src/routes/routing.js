const express = require("express");
const {
  isGoogleRoutingConfigured,
  fetchTravelTimeMatrixMinutes,
  locationKey,
} = require("../services/googleRouting");

const router = express.Router();

function isValidPoint(point) {
  return (
    point &&
    typeof point.latitude === "number" &&
    typeof point.longitude === "number"
  );
}

// Real driving time for search results (#78) — the frontend's own
// distanceLabel is straight-line only, since the Distance Matrix key is
// server-side and never sent to the browser. Mirrors buildPlan's own
// fall-back-to-null-per-pair behavior rather than failing the whole
// request when the API is unconfigured or one pair comes back short.
router.post("/travel-time", async (req, res) => {
  const { origin, destinations } = req.body || {};

  if (!isValidPoint(origin)) {
    return res
      .status(400)
      .json({ error: "origin with latitude/longitude is required" });
  }
  if (!Array.isArray(destinations) || destinations.length === 0) {
    return res
      .status(400)
      .json({ error: "a non-empty destinations array is required" });
  }
  if (!destinations.every(isValidPoint)) {
    return res
      .status(400)
      .json({ error: "every destination needs latitude and longitude" });
  }

  if (!isGoogleRoutingConfigured()) {
    return res.json({
      configured: false,
      minutes: destinations.map(() => null),
    });
  }

  let matrix;
  try {
    matrix = await fetchTravelTimeMatrixMinutes([origin, ...destinations]);
  } catch (error) {
    console.error("Failed to fetch travel time for search results", error);
    return res.json({
      configured: true,
      minutes: destinations.map(() => null),
    });
  }

  const originKey = locationKey(origin);
  const minutes = destinations.map(
    (destination) =>
      matrix.get(`${originKey}:${locationKey(destination)}`) ?? null
  );

  res.json({ configured: true, minutes });
});

module.exports = router;
