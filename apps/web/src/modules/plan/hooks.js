import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPlan,
  deletePlan,
  getPlan,
  getPlans,
  recheckPlan,
  reorderPlanStop,
  updatePlan,
  updatePlanStop,
  updatePlanStopWork,
  wrapUpPlan,
} from "../../api/plans";
import { planVariations } from "../../api/ai";
import { WORK_QUERY_KEY } from "../work/hooks";

export const PLANS_QUERY_KEY = ["plans"];
export const planQueryKey = (id) => ["plan", id];

export function usePlans() {
  return useQuery({ queryKey: PLANS_QUERY_KEY, queryFn: getPlans });
}

export function usePlan(id) {
  return useQuery({
    queryKey: planQueryKey(id),
    queryFn: () => getPlan(id),
    enabled: Boolean(id),
  });
}

export function useCreatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPlan,
    onSuccess: (newPlan) => {
      queryClient.setQueryData(PLANS_QUERY_KEY, (previous = []) => [
        newPlan,
        ...previous,
      ]);
      queryClient.setQueryData(planQueryKey(newPlan.id), newPlan);
    },
  });
}

export function useUpdatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, patch }) => updatePlan(planId, patch),
    onSuccess: (updatedPlan, { planId }) => {
      queryClient.setQueryData(planQueryKey(planId), updatedPlan);
      queryClient.setQueryData(PLANS_QUERY_KEY, (previous) =>
        previous?.map((plan) => (plan.id === planId ? updatedPlan : plan))
      );
    },
  });
}

export function useDeletePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (planId) => deletePlan(planId),
    onSuccess: (_data, planId) => {
      queryClient.setQueryData(PLANS_QUERY_KEY, (previous) =>
        previous?.filter((plan) => plan.id !== planId)
      );
      queryClient.removeQueries({ queryKey: planQueryKey(planId) });
    },
  });
}

export function useRecheckPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, data }) => recheckPlan(planId, data),
    onSuccess: (result, { planId }) => {
      queryClient.setQueryData(planQueryKey(planId), result.plan);
    },
  });
}

// Independent of recheck — no geolocation required. Used for a manual
// "Suggest variations" action on a plan the user hasn't started walking yet.
export function usePlanVariationsSuggestion() {
  return useMutation({
    mutationFn: ({ selectedWork, unselectedWork, budgetMinutes }) =>
      planVariations(selectedWork, unselectedWork, budgetMinutes),
  });
}

export function useUpdatePlanStop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, stopId, patch }) =>
      updatePlanStop(planId, stopId, patch),
    onSuccess: (updatedStop, { planId }) => {
      queryClient.setQueryData(
        planQueryKey(planId),
        (previous) =>
          previous && {
            ...previous,
            stops: previous.stops.map((stop) =>
              stop.id === updatedStop.id ? updatedStop : stop
            ),
          }
      );
    },
  });
}

// Unlike useUpdatePlanStop, the reorder endpoint returns the whole
// refreshed plan (every movable stop's order/timings shift, not just the
// one that moved), so the cache update replaces the plan wholesale rather
// than merging a single stop into it.
export function useReorderPlanStop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, stopId, direction }) =>
      reorderPlanStop(planId, stopId, direction),
    onSuccess: (updatedPlan, { planId }) => {
      queryClient.setQueryData(planQueryKey(planId), updatedPlan);
    },
  });
}

// One-tap "wrap up my day" (#83) — skips every remaining stop in one call
// instead of the person skipping each work item one at a time.
export function useWrapUpPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (planId) => wrapUpPlan(planId),
    onSuccess: (result, planId) => {
      queryClient.setQueryData(planQueryKey(planId), result.plan);
    },
  });
}

export function useUpdatePlanStopWork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, stopId, workId, patch }) =>
      updatePlanStopWork(planId, stopId, workId, patch),
    onSuccess: (updatedAssignment, { planId, stopId, workId }) => {
      queryClient.setQueryData(
        planQueryKey(planId),
        (previous) =>
          previous && {
            ...previous,
            stops: previous.stops.map((stop) =>
              stop.id === stopId
                ? {
                    ...stop,
                    works: stop.works.map((assignment) =>
                      assignment.id === updatedAssignment.id
                        ? updatedAssignment
                        : assignment
                    ),
                  }
                : stop
            ),
          }
      );

      if (updatedAssignment.status === "done") {
        queryClient.setQueryData(WORK_QUERY_KEY, (previous) =>
          previous?.map((item) =>
            item.id === workId ? { ...item, status: "done" } : item
          )
        );
      }
    },
  });
}
