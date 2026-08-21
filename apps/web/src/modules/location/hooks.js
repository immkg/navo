import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addLocationToOption,
  createLocationOption,
  deleteLocationOption,
  removeLocationFromOption,
} from "../../api/work";
import { WORK_QUERY_KEY } from "../work/hooks";

const INTENT_QUERIES_FILTER = { queryKey: ["intent"] };

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
