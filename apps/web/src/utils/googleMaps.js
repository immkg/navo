const loadedGoogleMapsPromises = new Map();

// Straight-line (haversine) distance from the search bias point to a
// result, formatted for display. Good enough for "is this nearby" at a
// glance — not routing distance.
export function distanceLabel(originLat, originLng, lat, lng) {
  if (originLat == null || originLng == null || lat == null || lng == null) {
    return null;
  }

  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat - originLat);
  const dLng = toRad(lng - originLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(originLat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
  const km = earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const useMiles =
    typeof navigator !== "undefined" && /^en-US/.test(navigator.language || "");
  if (useMiles) {
    const miles = km * 0.621371;
    return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi away`;
  }
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km away`;
}

export function loadGoogleMaps(apiKey) {
  if (!apiKey) {
    return Promise.reject(new Error("Google Maps API key is required"));
  }

  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("Google Maps can only be loaded in a browser")
    );
  }

  // "Ready" means both the core maps library (Map) and the places library
  // are hydrated — checking Map alone is not enough: importLibrary("maps")
  // and importLibrary("places") are awaited sequentially below, so a
  // concurrent caller (e.g. autocomplete firing on every keystroke) could
  // otherwise see Map already available and return before places finishes,
  // leaving maps.places undefined for that caller.
  const isMapsReady = (maps) =>
    typeof maps?.Map === "function" && Boolean(maps?.places);

  const ensureMapsReady = async () => {
    const waitForReady = async () => {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const maps = window.google?.maps;
        if (!maps) {
          await new Promise((resolve) => setTimeout(resolve, 75));
          continue;
        }

        if (isMapsReady(maps)) {
          return maps;
        }

        if (maps.importLibrary) {
          await maps.importLibrary("maps");
          await maps.importLibrary("places");
          if (isMapsReady(maps)) {
            return maps;
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 75));
      }

      throw new Error("Google Maps Map constructor unavailable");
    };

    return waitForReady();
  };

  if (window.google?.maps) {
    return ensureMapsReady();
  }

  if (loadedGoogleMapsPromises.has(apiKey)) {
    return loadedGoogleMapsPromises.get(apiKey);
  }

  const promise = new Promise((resolve, reject) => {
    const createAndLoadScript = () => {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly&loading=async`;
      script.async = true;
      script.defer = true;
      script.setAttribute("async", "");
      script.setAttribute("defer", "");
      script.setAttribute("loading", "async");
      script.onload = () => {
        ensureMapsReady().then(resolve).catch(reject);
      };
      script.onerror = () =>
        reject(new Error("Failed to load Google Maps JavaScript API"));
      document.head.appendChild(script);
    };

    const existingScript = document.querySelector(
      'script[src*="maps.googleapis.com/maps/api/js"]'
    );
    if (existingScript) {
      if (window.google?.maps) {
        ensureMapsReady().then(resolve).catch(reject);
        return;
      }

      const hadAsyncLoading =
        existingScript.getAttribute("loading") === "async";

      if (!hadAsyncLoading) {
        existingScript.remove();
        createAndLoadScript();
        return;
      }

      existingScript.addEventListener("load", () => {
        ensureMapsReady().then(resolve).catch(reject);
      });
      existingScript.addEventListener("error", () =>
        reject(new Error("Failed to load Google Maps JavaScript API"))
      );
      return;
    }

    createAndLoadScript();
  });

  loadedGoogleMapsPromises.set(apiKey, promise);
  return promise;
}

export function geocodeLocation(query, apiKey) {
  if (!query) {
    return Promise.reject(new Error("Location query is required"));
  }

  return loadGoogleMaps(apiKey).then((maps) => {
    const geocoder = new maps.Geocoder();
    return new Promise((resolve, reject) => {
      geocoder.geocode({ address: query }, (results, status) => {
        if (status === "OK" && results && results.length > 0) {
          const result = results[0];
          resolve({
            latitude: result.geometry.location.lat(),
            longitude: result.geometry.location.lng(),
            formattedAddress: result.formatted_address,
            placeId: result.place_id,
          });
        } else {
          reject(new Error(status || "Geocode failed"));
        }
      });
    });
  });
}

export function reverseGeocodeLocation(latitude, longitude, apiKey) {
  if (latitude == null || longitude == null) {
    return Promise.reject(new Error("Latitude and longitude are required"));
  }

  return loadGoogleMaps(apiKey).then((maps) => {
    const geocoder = new maps.Geocoder();
    return new Promise((resolve, reject) => {
      geocoder.geocode(
        { location: { lat: latitude, lng: longitude } },
        (results, status) => {
          if (status === "OK" && results && results.length > 0) {
            resolve({
              label: results[0].formatted_address,
              placeId: results[0].place_id,
            });
          } else {
            reject(new Error(status || "Reverse geocode failed"));
          }
        }
      );
    });
  });
}

// Default bias radius (meters) used to prefer results near the user's
// current location instead of searching the whole world. This is a bias,
// not a hard restriction — a great match further away can still surface.
const DEFAULT_NEARBY_RADIUS_METERS = 20000;

function buildLocationBias(nearLocation) {
  if (nearLocation?.latitude == null || nearLocation?.longitude == null) {
    return undefined;
  }

  return {
    center: { lat: nearLocation.latitude, lng: nearLocation.longitude },
    radius: nearLocation.radiusMeters || DEFAULT_NEARBY_RADIUS_METERS,
  };
}

export function searchPlaces(query, apiKey, nearLocation) {
  if (!query) {
    return Promise.reject(new Error("Place query is required"));
  }

  return loadGoogleMaps(apiKey).then((maps) => {
    return new Promise((resolve, reject) => {
      const finish = (results, status) => {
        if (status === "OK" && results && results.length > 0) {
          resolve(
            results.map((result) => ({
              name: result.name,
              formattedAddress: result.formatted_address,
              latitude: result.geometry?.location?.lat(),
              longitude: result.geometry?.location?.lng(),
              placeId: result.place_id,
              rating: result.rating ?? null,
              ratingsCount: result.user_ratings_total ?? null,
            }))
          );
        } else {
          reject(new Error(status || "Place search failed"));
        }
      };

      const locationBias = buildLocationBias(nearLocation);
      const service = new maps.places.PlacesService(
        document.createElement("div")
      );
      // Only Basic Data + rating (Atmosphere Data) here — phone number and
      // opening hours (also billed separately by Google) are fetched by
      // getPlaceEnrichedDetails only once a result is actually added, not
      // for every search result shown.
      service.findPlaceFromQuery(
        {
          query,
          fields: [
            "name",
            "formatted_address",
            "geometry",
            "place_id",
            "rating",
            "user_ratings_total",
          ],
          ...(locationBias ? { locationBias } : {}),
        },
        finish
      );
    });
  });
}

// Called only when a search result is actually being added to a group —
// fetches the fields billed as Contact Data (phone) and the structured
// opening hours needed to compute a live open/closed status, neither of
// which are fetched for every search result.
export function getPlaceEnrichedDetails(placeId, apiKey) {
  if (!placeId) {
    return Promise.reject(new Error("Place ID is required"));
  }

  return loadGoogleMaps(apiKey).then((maps) => {
    return new Promise((resolve, reject) => {
      const finish = (result, status) => {
        if (status === "OK" && result) {
          resolve({
            phoneNumber: result.formatted_phone_number || null,
            openingHoursText: result.opening_hours?.weekday_text || null,
            openingPeriods: result.opening_hours?.periods
              ? result.opening_hours.periods.map((period) => ({
                  open: period.open
                    ? { day: period.open.day, time: period.open.time }
                    : null,
                  close: period.close
                    ? { day: period.close.day, time: period.close.time }
                    : null,
                }))
              : null,
          });
        } else {
          reject(new Error(status || "Place details failed"));
        }
      };

      const service = new maps.places.PlacesService(
        document.createElement("div")
      );
      service.getDetails(
        {
          placeId,
          fields: ["formatted_phone_number", "opening_hours"],
        },
        finish
      );
    });
  });
}

export function autocompletePlaces(query, apiKey, nearLocation) {
  if (!query) {
    return Promise.reject(new Error("Autocomplete query is required"));
  }

  return loadGoogleMaps(apiKey).then((maps) => {
    return new Promise((resolve, reject) => {
      const finalize = (predictions, status) => {
        if (status === "OK" && predictions && predictions.length > 0) {
          resolve(
            predictions.map((prediction) => ({
              description: prediction.description,
              placeId: prediction.place_id,
            }))
          );
          return;
        }
        resolve([]);
      };

      const locationBias = buildLocationBias(nearLocation);

      try {
        const suggestionProto = maps.places.AutocompleteSuggestion?.prototype;
        if (suggestionProto?.getPlacePredictions) {
          const service = new maps.places.AutocompleteSuggestion();
          service.getPlacePredictions(
            {
              input: query,
              ...(locationBias ? { locationBias } : {}),
            },
            finalize
          );
          return;
        }

        const service = new maps.places.AutocompleteService();
        service.getPlacePredictions(
          {
            input: query,
            types: ["establishment", "geocode"],
            ...(locationBias
              ? {
                  location: new maps.LatLng(
                    locationBias.center.lat,
                    locationBias.center.lng
                  ),
                  radius: locationBias.radius,
                }
              : {}),
          },
          finalize
        );
      } catch (error) {
        reject(error);
      }
    });
  });
}

export function getPlaceDetails(placeId, apiKey) {
  if (!placeId) {
    return Promise.reject(new Error("Place ID is required"));
  }

  return loadGoogleMaps(apiKey).then((maps) => {
    return new Promise((resolve, reject) => {
      const finish = (result, status) => {
        if (status === "OK" && result) {
          resolve({
            name: result.name,
            formattedAddress: result.formatted_address,
            latitude: result.geometry?.location?.lat(),
            longitude: result.geometry?.location?.lng(),
            placeId: result.place_id,
            rating: result.rating ?? null,
            ratingsCount: result.user_ratings_total ?? null,
          });
        } else {
          reject(new Error(status || "Place details failed"));
        }
      };

      const service = new maps.places.PlacesService(
        document.createElement("div")
      );
      service.getDetails(
        {
          placeId,
          fields: [
            "name",
            "formatted_address",
            "geometry",
            "place_id",
            "rating",
            "user_ratings_total",
          ],
        },
        finish
      );
    });
  });
}

export function buildGoogleMapsDirectionsUrl(startPoint, stops) {
  if (!stops || stops.length === 0) {
    return "https://www.google.com/maps";
  }

  // Without real coordinates, falling back to the first stop's own name as
  // the origin made a single-stop leg's link point from that place to
  // itself. Omitting origin instead lets Google Maps default to the
  // viewer's current location.
  const hasStartCoords =
    startPoint?.latitude != null && startPoint?.longitude != null;
  const origin = hasStartCoords
    ? `${startPoint.latitude},${startPoint.longitude}`
    : null;

  const destination =
    stops[stops.length - 1].location.latitude != null &&
    stops[stops.length - 1].location.longitude != null
      ? `${stops[stops.length - 1].location.latitude},${stops[stops.length - 1].location.longitude}`
      : encodeURIComponent(stops[stops.length - 1].location.name || "");

  const waypoints = stops
    .slice(0, stops.length - 1)
    .map((stop) =>
      stop.location.latitude != null && stop.location.longitude != null
        ? `${stop.location.latitude},${stop.location.longitude}`
        : encodeURIComponent(stop.location.name || "")
    )
    .join("%7C");

  const originParam = origin ? `&origin=${origin}` : "";
  return `https://www.google.com/maps/dir/?api=1${originParam}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ""}`;
}
