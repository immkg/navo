import { useMutation } from "@tanstack/react-query";
import { suggestWork } from "../../api/ai";

export function useSuggestWork() {
  return useMutation({
    mutationFn: (intentId) => suggestWork(intentId),
  });
}
