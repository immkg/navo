import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addLocationToOption,
  createLocationOption,
  deleteLocationOption,
  removeLocationFromOption,
} from "../../api/work";
import { WORK_QUERY_KEY } from "../work/hooks";

const INTENT_QUERIES_FILTER = { queryKey: ["intent"] };
const SESSION_LOCATION_STORAGE_KEY = "navo:searchNearLocation";

function readStoredLocation() {
  try {
    const raw = sessionStorage.getItem(SESSION_LOCATION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredLocation(location) {
  try {
    if (location) {
      sessionStorage.setItem(
        SESSION_LOCATION_STORAGE_KEY,
        JSON.stringify(location)
      );
    } else {
      sessionStorage.removeItem(SESSION_LOCATION_STORAGE_KEY);
    }
  } catch {
    // sessionStorage unavailable (e.g. private browsing) — not persisting
    // the choice across reloads is an acceptable degradation.
  }
}

function initialLocationState() {
  const stored = readStoredLocation();
  if (stored) {
    return {
      status: "manual",
      latitude: stored.latitude,
      longitude: stored.longitude,
      label: stored.label || null,
    };
  }
  return {
    status:
      typeof navigator !== "undefined" && navigator.geolocation
        ? "pending"
        : "unsupported",
    latitude: null,
    longitude: null,
    label: null,
  };
}

// Where to bias place search results, so searches are relevant to the user
// instead of the whole world. Tries the browser's geolocation automatically
// first; the caller can also set (or clear) a manual location explicitly —
// e.g. when geolocation is denied, or the user is planning for a different
// area — which is remembered in sessionStorage for the rest of the browser
// session. Status is "unsupported", "pending", "success" (geolocation),
// "denied", or "manual" (explicitly set).
export function useCurrentLocation() {
  const [state, setState] = useState(initialLocationState);

  useEffect(() => {
    if (state.status !== "pending") return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          status: "success",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          label: null,
        });
      },
      () => {
        setState((previous) => ({ ...previous, status: "denied" }));
      }
    );
  }, [state.status]);

  const requestLocation = () => {
    writeStoredLocation(null);
    setState({
      status:
        typeof navigator !== "undefined" && navigator.geolocation
          ? "pending"
          : "unsupported",
      latitude: null,
      longitude: null,
      label: null,
    });
  };

  const setManualLocation = (location) => {
    const next = {
      latitude: location.latitude,
      longitude: location.longitude,
      label: location.label || null,
    };
    writeStoredLocation(next);
    setState({ status: "manual", ...next });
  };

  return { ...state, requestLocation, setManualLocation };
}

// A location option (and the locations inside it) always belongs to a work
// item, so these mutations still call through the /api/work/:id/location-
// option... endpoints — but from the frontend's perspective this is
// Location's own CRUD, not Work's, so it lives in its own module. Every
// mutation writes through both the flat ["work"] list and any cached
// ["intent", id] query, same as modules/work/hooks.js, so editing a work
// item's locations from either page keeps the other in sync.
export function useCreateLocationOption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workId, data }) => createLocationOption(workId, data),
    onSuccess: (createdOption, { workId }) => {
      queryClient.setQueryData(WORK_QUERY_KEY, (previous) =>
        previous?.map((item) =>
          item.id === workId
            ? {
                ...item,
                locationOptions: [
                  ...(item.locationOptions || []),
                  createdOption,
                ],
              }
            : item
        )
      );
      queryClient
        .getQueryCache()
        .findAll(INTENT_QUERIES_FILTER)
        .forEach(({ queryKey }) => {
          queryClient.setQueryData(
            queryKey,
            (previous) =>
              previous && {
                ...previous,
                workItems: previous.workItems?.map((item) =>
                  item.id === workId
                    ? {
                        ...item,
                        locationOptions: [
                          ...(item.locationOptions || []),
                          createdOption,
                        ],
                      }
                    : item
                ),
              }
          );
        });
    },
  });
}

export function useDeleteLocationOption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workId, optionId }) =>
      deleteLocationOption(workId, optionId),
    onSuccess: ({ selectedLocationOptionId }, { workId, optionId }) => {
      const removeOption = (item) => ({
        ...item,
        locationOptions: (item.locationOptions || []).filter(
          (option) => option.id !== optionId
        ),
        selectedLocationOptionId,
      });
      queryClient.setQueryData(WORK_QUERY_KEY, (previous) =>
        previous?.map((item) =>
          item.id === workId ? removeOption(item) : item
        )
      );
      queryClient
        .getQueryCache()
        .findAll(INTENT_QUERIES_FILTER)
        .forEach(({ queryKey }) => {
          queryClient.setQueryData(
            queryKey,
            (previous) =>
              previous && {
                ...previous,
                workItems: previous.workItems?.map((item) =>
                  item.id === workId ? removeOption(item) : item
                ),
              }
          );
        });
    },
  });
}

export function useAddLocationToOption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workId, optionId, data }) =>
      addLocationToOption(workId, optionId, data),
    onSuccess: (updatedOption, { workId, optionId }) => {
      const replaceOption = (item) => ({
        ...item,
        locationOptions: (item.locationOptions || []).map((option) =>
          option.id === optionId ? updatedOption : option
        ),
      });
      queryClient.setQueryData(WORK_QUERY_KEY, (previous) =>
        previous?.map((item) =>
          item.id === workId ? replaceOption(item) : item
        )
      );
      queryClient
        .getQueryCache()
        .findAll(INTENT_QUERIES_FILTER)
        .forEach(({ queryKey }) => {
          queryClient.setQueryData(
            queryKey,
            (previous) =>
              previous && {
                ...previous,
                workItems: previous.workItems?.map((item) =>
                  item.id === workId ? replaceOption(item) : item
                ),
              }
          );
        });
    },
  });
}

export function useRemoveLocationFromOption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workId, optionId, locationId }) =>
      removeLocationFromOption(workId, optionId, locationId),
    onSuccess: (updatedOption, { workId, optionId }) => {
      const replaceOption = (item) => ({
        ...item,
        locationOptions: (item.locationOptions || []).map((option) =>
          option.id === optionId ? updatedOption : option
        ),
      });
      queryClient.setQueryData(WORK_QUERY_KEY, (previous) =>
        previous?.map((item) =>
          item.id === workId ? replaceOption(item) : item
        )
      );
      queryClient
        .getQueryCache()
        .findAll(INTENT_QUERIES_FILTER)
        .forEach(({ queryKey }) => {
          queryClient.setQueryData(
            queryKey,
            (previous) =>
              previous && {
                ...previous,
                workItems: previous.workItems?.map((item) =>
                  item.id === workId ? replaceOption(item) : item
                ),
              }
          );
        });
    },
  });
}
