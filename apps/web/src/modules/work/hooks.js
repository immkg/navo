import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createWorkItem,
  deleteWorkItem,
  getRecommendedWork,
  getWorkItems,
  updateWorkItem,
} from "../../api/work";
import { intentQueryKey } from "../intents/hooks";

export const WORK_QUERY_KEY = ["work"];
const INTENT_QUERIES_FILTER = { queryKey: ["intent"] };

// Work items are cached in two places: the flat ["work"] list (used by the
// Planner) and the nested workItems array inside each ["intent", id] query
// (used by IntentPage). Every mutation below writes through both caches so
// editing a work item from either page keeps the other in sync.
function patchWorkItemInCaches(queryClient, workId, patch) {
  queryClient.setQueryData(WORK_QUERY_KEY, (previous) =>
    previous?.map((item) => (item.id === workId ? { ...item, ...patch } : item))
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
              item.id === workId ? { ...item, ...patch } : item
            ),
          }
      );
    });
}

function removeWorkItemFromCaches(queryClient, workId) {
  queryClient.setQueryData(WORK_QUERY_KEY, (previous) =>
    previous?.filter((item) => item.id !== workId)
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
            workItems: previous.workItems?.filter((item) => item.id !== workId),
          }
      );
    });
}

function addWorkItemToCaches(queryClient, newWorkItem) {
  queryClient.setQueryData(WORK_QUERY_KEY, (previous) =>
    previous ? [newWorkItem, ...previous] : previous
  );
  if (newWorkItem.intentId) {
    queryClient.setQueryData(
      intentQueryKey(newWorkItem.intentId),
      (previous) =>
        previous && {
          ...previous,
          workItems: [newWorkItem, ...(previous.workItems || [])],
        }
    );
  }
}

export function useWorkItems() {
  return useQuery({ queryKey: WORK_QUERY_KEY, queryFn: getWorkItems });
}

export function useRecommendedWork(limit) {
  return useQuery({
    queryKey: ["work", "recommended", limit],
    queryFn: () => getRecommendedWork(limit),
  });
}

export function useCreateWorkItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createWorkItem,
    onSuccess: (newWorkItem) => addWorkItemToCaches(queryClient, newWorkItem),
  });
}

export function useUpdateWorkItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workId, patch }) => updateWorkItem(workId, patch),
    onSuccess: (updatedWork, { workId }) =>
      patchWorkItemInCaches(queryClient, workId, updatedWork),
  });
}

export function useDeleteWorkItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workId) => deleteWorkItem(workId),
    onSuccess: (_data, workId) => removeWorkItemFromCaches(queryClient, workId),
  });
}
