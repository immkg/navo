const loadedGoogleMapsPromises = new Map();

export function loadGoogleMaps(apiKey) {
  if (!apiKey) {
    return Promise.reject(new Error("Google Maps API key is required"));
  }

  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("Google Maps can only be loaded in a browser")
    );
  }

  const ensureMapsReady = async () => {
    const waitForReady = async () => {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const maps = window.google?.maps;
        if (!maps) {
          await new Promise((resolve) => setTimeout(resolve, 75));
          continue;
        }

        if (typeof maps.Map === "function") {
          return maps;
        }

        if (maps.importLibrary) {
          const mapsLib = await maps.importLibrary("maps");
          await maps.importLibrary("places");
          if (
            typeof mapsLib?.Map === "function" ||
            typeof maps.Map === "function"
          ) {
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
      service.findPlaceFromQuery(
        {
          query,
          fields: ["name", "formatted_address", "geometry", "place_id"],
          ...(locationBias ? { locationBias } : {}),
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
          });
        } else {
          reject(new Error(status || "Place details failed"));
        }
      };

      if (maps.places.Place) {
        const service = new maps.places.PlacesService(
          document.createElement("div")
        );
        service.getDetails(
          {
            placeId,
            fields: ["name", "formatted_address", "geometry", "place_id"],
          },
          finish
        );
      } else {
        const service = new maps.places.PlacesService(
          document.createElement("div")
        );
        service.getDetails(
          {
            placeId,
            fields: ["name", "formatted_address", "geometry", "place_id"],
          },
          finish
        );
      }
    });
  });
}

export function buildGoogleMapsDirectionsUrl(startPoint, stops) {
  if (!stops || stops.length === 0) {
    return "https://www.google.com/maps";
  }

  const origin =
    startPoint?.latitude != null && startPoint?.longitude != null
      ? `${startPoint.latitude},${startPoint.longitude}`
      : encodeURIComponent(stops[0].location.name || "");

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

  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ""}`;
}
