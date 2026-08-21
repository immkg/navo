import { useMutation } from "@tanstack/react-query";
import {
  draftIntent,
  optimizeRoute,
  splitIntent,
  suggestPlaceTypes,
  suggestWork,
} from "../../api/ai";

export function useSuggestWork() {
  return useMutation({
    mutationFn: (intentId) => suggestWork(intentId),
  });
}

export function useDraftIntent() {
  return useMutation({
    mutationFn: ({ title, description }) => draftIntent(title, description),
  });
}

export function useSuggestPlaceTypes() {
  return useMutation({
    mutationFn: ({ title, notes, location }) =>
      suggestPlaceTypes(title, notes, location),
  });
}

export function useOptimizeRoute() {
  return useMutation({
    mutationFn: ({ startPoint, stops }) => optimizeRoute(startPoint, stops),
  });
}

export function useSplitIntent() {
  return useMutation({
    mutationFn: (text) => splitIntent(text),
  });
}
