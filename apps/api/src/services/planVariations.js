const { callGroqJson, isGroqConfigured } = require("./groqClient");

const PLAN_VARIATIONS_SYSTEM_PROMPT = `You suggest trade-offs for a day plan that is short on time.

Rules:
- You are given the work items currently scheduled ("selected") and the ones that didn't fit ("unselected"), each with its priority, its intent's priority, and due date.
- Suggest at most 2 variations. Each variation names some currently-unselected work item ids to add and some currently-selected work item ids to remove, trading lower-value items for higher-value ones that don't currently fit.
- Only suggest a variation that plausibly improves the plan (e.g. swapping in something overdue or due today for something low-priority with no due date).
- reasoning is one short sentence per variation explaining the trade-off.
- Never invent work item ids that weren't given to you.

Respond with ONLY a JSON object of this exact shape, no other text:
{"variations": [{"addWorkIds": [string], "removeWorkIds": [string], "reasoning": string}]}`;

function summarizeWork(work) {
  return `- id: ${work.id}, title: ${work.title}, priority: ${work.priority}, intentPriority: ${work.intent?.priority || "medium"}, dueDate: ${work.intent?.dueDate || "none"}`;
}

function buildPlanVariationsUserPrompt(
  selectedWork,
  unselectedWork,
  budgetMinutes
) {
  return [
    `Time budget: ${budgetMinutes} minutes`,
    "Currently selected:",
    ...(selectedWork.length ? selectedWork.map(summarizeWork) : ["- none"]),
    "Currently unselected (didn't fit):",
    ...(unselectedWork.length ? unselectedWork.map(summarizeWork) : ["- none"]),
  ].join("\n");
}

function sanitizePlanVariations(parsed, selectedIds, unselectedIds) {
  if (!Array.isArray(parsed?.variations)) return [];

  return parsed.variations
    .slice(0, 2)
    .map((variation) => ({
      addWorkIds: Array.isArray(variation?.addWorkIds)
        ? variation.addWorkIds.filter((id) => unselectedIds.has(id))
        : [],
      removeWorkIds: Array.isArray(variation?.removeWorkIds)
        ? variation.removeWorkIds.filter((id) => selectedIds.has(id))
        : [],
      reasoning:
        typeof variation?.reasoning === "string" && variation.reasoning.trim()
          ? variation.reasoning.trim().slice(0, 300)
          : null,
    }))
    .filter((variation) => variation.addWorkIds.length > 0);
}

// Asks an LLM for 1-2 alternative work-item swaps for a plan that's short
// on time. The model only ever chooses *which* work item ids to swap,
// never times or ordering — the caller re-runs the deterministic builder
// (via PATCH /api/plans/:id's forceIncludeWorkIds/forceExcludeWorkIds) to
// get a concrete, trustworthy schedule for whichever variation is applied.
async function buildPlanVariations({
  selectedWork,
  unselectedWork,
  budgetMinutes,
}) {
  if (!isGroqConfigured() || unselectedWork.length === 0) return [];

  const selectedIds = new Set(selectedWork.map((work) => work.id));
  const unselectedIds = new Set(unselectedWork.map((work) => work.id));

  const parsed = await callGroqJson({
    systemPrompt: PLAN_VARIATIONS_SYSTEM_PROMPT,
    userPrompt: buildPlanVariationsUserPrompt(
      selectedWork,
      unselectedWork,
      budgetMinutes
    ),
  });

  return sanitizePlanVariations(parsed, selectedIds, unselectedIds);
}

module.exports = { buildPlanVariations, sanitizePlanVariations };
