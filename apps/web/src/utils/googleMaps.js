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

  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (loadedGoogleMapsPromises.has(apiKey)) {
    return loadedGoogleMapsPromises.get(apiKey);
  }

  const promise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(
      'script[src*="maps.googleapis.com/maps/api/js"]'
    );
    if (existingScript) {
      if (window.google?.maps) {
        resolve(window.google.maps);
        return;
      }
      existingScript.addEventListener("load", () =>
        resolve(window.google.maps)
      );
      existingScript.addEventListener("error", () =>
        reject(new Error("Failed to load Google Maps JavaScript API"))
      );
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.maps) {
        resolve(window.google.maps);
      } else {
        reject(
          new Error("Google Maps loaded but window.google.maps is unavailable")
        );
      }
    };
    script.onerror = () =>
      reject(new Error("Failed to load Google Maps JavaScript API"));
    document.head.appendChild(script);
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
          });
        } else {
          reject(new Error(status || "Geocode failed"));
        }
      });
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
