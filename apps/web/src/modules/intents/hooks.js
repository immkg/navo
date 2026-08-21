import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createIntent,
  deleteIntent,
  getIntent,
  getIntents,
  updateIntent,
} from "../../api/intents";
import { normalizeIntent } from "./utils";

export const INTENTS_QUERY_KEY = ["intents"];
export const intentQueryKey = (id) => ["intent", id];

export function useIntents() {
  return useQuery({
    queryKey: INTENTS_QUERY_KEY,
    queryFn: async () => (await getIntents()).map(normalizeIntent),
    retry: false,
  });
}

export function useIntent(id) {
  return useQuery({
    queryKey: intentQueryKey(id),
    queryFn: () => getIntent(id),
    enabled: Boolean(id),
  });
}

export function useCreateIntent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createIntent,
    onSuccess: (newIntent) => {
      queryClient.setQueryData(INTENTS_QUERY_KEY, (previous = []) => [
        normalizeIntent(newIntent),
        ...previous,
      ]);
    },
  });
}

export function usePatchIntent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ intentId, patch }) => updateIntent(intentId, patch),
    onSuccess: (updatedIntent, { intentId, patch }) => {
      queryClient.setQueryData(INTENTS_QUERY_KEY, (previous = []) =>
        previous.map((intent) =>
          intent.id === intentId
            ? normalizeIntent({ ...intent, ...patch })
            : intent
        )
      );
      queryClient.setQueryData(
        intentQueryKey(intentId),
        (previous) => previous && { ...previous, ...updatedIntent }
      );
    },
  });
}

export function useBulkUpdateIntentStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, status }) => {
      const results = await Promise.allSettled(
        ids.map((id) => updateIntent(id, { status }))
      );
      return { results, ids, status };
    },
    onSuccess: ({ results, ids, status }) => {
      const succeededIds = ids.filter(
        (_, index) => results[index].status === "fulfilled"
      );
      queryClient.setQueryData(INTENTS_QUERY_KEY, (previous = []) =>
        previous.map((intent) =>
          succeededIds.includes(intent.id)
            ? normalizeIntent({ ...intent, status })
            : intent
        )
      );
    },
  });
}

export function useBulkDeleteIntents() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids) => {
      const results = await Promise.allSettled(ids.map((id) => deleteIntent(id)));
      return { results, ids };
    },
    onSuccess: ({ results, ids }) => {
      const succeededIds = ids.filter(
        (_, index) => results[index].status === "fulfilled"
      );
      queryClient.setQueryData(INTENTS_QUERY_KEY, (previous = []) =>
        previous.filter((intent) => !succeededIds.includes(intent.id))
      );
    },
  });
}
