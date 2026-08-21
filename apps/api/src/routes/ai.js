const express = require("express");
const prisma = require("../db/client");
const {
  isGroqConfigured,
  callGroqJson,
  sendGroqError,
} = require("../services/groqClient");

const router = express.Router();

const SYSTEM_PROMPT = `You help break a personal outcome (an "intent") into a small number of concrete next actions ("work").

Rules:
- Work should be specific and actionable, not a vague restatement of the intent.
- Suggest at most 5 items.
- Never repeat anything already in the existing work list.
- durationMinutes should be a realistic estimate in whole minutes.
- needsLocation should be true only if the work realistically requires visiting a specific physical place (not for calls, research, or anything doable remotely).

Respond with ONLY a JSON object of this exact shape, no other text:
{"suggestions": [{"title": string, "notes": string or null, "durationMinutes": number, "needsLocation": boolean}]}`;

function buildUserPrompt(intent, existingTitles) {
  return [
    `Intent: ${intent.title}`,
    intent.description ? `Description: ${intent.description}` : null,
    `Existing work items: ${
      existingTitles.length ? existingTitles.join(", ") : "none yet"
    }`,
  ]
    .filter(Boolean)
    .join("\n");
}

function sanitizeSuggestions(parsed) {
  if (!Array.isArray(parsed?.suggestions)) return [];

  return parsed.suggestions
    .filter(
      (item) => item && typeof item.title === "string" && item.title.trim()
    )
    .slice(0, 5)
    .map((item) => ({
      title: item.title.trim().slice(0, 200),
      notes:
        typeof item.notes === "string" && item.notes.trim()
          ? item.notes.trim().slice(0, 500)
          : null,
      durationMinutes:
        Number.isFinite(item.durationMinutes) && item.durationMinutes > 0
          ? Math.round(item.durationMinutes)
          : 30,
      needsLocation: Boolean(item.needsLocation),
    }));
}

// Ask an LLM for candidate work items for an intent. Suggestions are
// returned for review only - the client decides which, if any, to add
// as real work items via the existing POST /api/work endpoint.
router.post("/suggest-work", async (req, res) => {
  if (!isGroqConfigured()) {
    return res
      .status(503)
      .json({ error: "AI features are not configured on this server." });
  }

  const { intentId } = req.body;
  if (!intentId) {
    return res.status(400).json({ error: "intentId is required" });
  }

  try {
    const intent = await prisma.intent.findUnique({
      where: { id: intentId },
      include: { workItems: { select: { title: true } } },
    });

    if (!intent) {
      return res.status(404).json({ error: "Intent not found" });
    }

    const existingTitles = intent.workItems.map((work) => work.title);

    const parsed = await callGroqJson({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(intent, existingTitles),
    });

    res.json({ suggestions: sanitizeSuggestions(parsed) });
  } catch (error) {
    const handled = sendGroqError(res, error);
    if (handled) return handled;

    console.error("Failed to get AI suggestions", error);
    res.status(500).json({ error: "Failed to get AI suggestions" });
  }
});

const DRAFT_INTENT_SYSTEM_PROMPT = `You help someone flesh out a personal goal ("intent") from just a title.

Rules:
- description should be 1-2 concise, helpful sentences expanding on the title. If the user already gave a description, lightly improve/extend it rather than replacing its meaning.
- priority must be exactly one of: "low", "medium", "high".
- dueDate should be an ISO date (YYYY-MM-DD) ONLY if the title/description implies a natural deadline (e.g. "renew passport before trip", "file taxes"); otherwise null. Never invent an arbitrary deadline.

Respond with ONLY a JSON object of this exact shape, no other text:
{"description": string, "priority": "low"|"medium"|"high", "dueDate": string or null}`;

const VALID_DRAFT_PRIORITIES = new Set(["low", "medium", "high"]);

function buildDraftIntentUserPrompt(title, description) {
  return [
    `Today's date: ${new Date().toISOString().slice(0, 10)}`,
    `Title: ${title}`,
    description ? `Existing description: ${description}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function sanitizeDraftIntent(parsed) {
  const description =
    typeof parsed?.description === "string" && parsed.description.trim()
      ? parsed.description.trim().slice(0, 1000)
      : null;
  const priority = VALID_DRAFT_PRIORITIES.has(parsed?.priority)
    ? parsed.priority
    : "medium";
  const dueDate =
    typeof parsed?.dueDate === "string" &&
    !Number.isNaN(new Date(parsed.dueDate).getTime())
      ? parsed.dueDate
      : null;

  return { description, priority, dueDate };
}

// Ask an LLM to draft a description/priority/due-date for an intent from
// just its title. Purely advisory — the client decides whether to accept,
// edit, or discard the draft before creating/updating the real intent.
router.post("/draft-intent", async (req, res) => {
  if (!isGroqConfigured()) {
    return res
      .status(503)
      .json({ error: "AI features are not configured on this server." });
  }

  const { title, description } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: "title is required" });
  }

  try {
    const parsed = await callGroqJson({
      systemPrompt: DRAFT_INTENT_SYSTEM_PROMPT,
      userPrompt: buildDraftIntentUserPrompt(title.trim(), description),
    });

    res.json(sanitizeDraftIntent(parsed));
  } catch (error) {
    const handled = sendGroqError(res, error);
    if (handled) return handled;

    console.error("Failed to draft intent", error);
    res.status(500).json({ error: "Failed to draft intent" });
  }
});

const SUGGEST_PLACE_TYPES_SYSTEM_PROMPT = `You suggest places someone could search for on a map to get a piece of work done.

Rules:
- "types": 3-5 short, generic search terms (e.g. "pharmacy", "hardware store", "post office") — categories, not specific businesses.
- "names": up to 3 specific, well-known real place or business names that plausibly fit (e.g. "CVS", "Home Depot", "Trader Joe's") — real, commonly-recognized chains/brands, never an invented or made-up name. These are just starting points for a real map search, not a guarantee one is nearby.
- Base both lists only on the work's title/notes; if it clearly doesn't need a physical place, return both lists empty.
- Keep each suggestion under 40 characters.

Respond with ONLY a JSON object of this exact shape, no other text:
{"types": [string], "names": [string]}`;

function buildSuggestPlaceTypesUserPrompt(title, notes) {
  return [`Work: ${title}`, notes ? `Notes: ${notes}` : null]
    .filter(Boolean)
    .join("\n");
}

function sanitizeSuggestionList(list, maxItems) {
  if (!Array.isArray(list)) return [];

  return list
    .filter((item) => typeof item === "string" && item.trim())
    .slice(0, maxItems)
    .map((item) => item.trim().slice(0, 40));
}

function sanitizePlaceTypeSuggestions(parsed) {
  return {
    types: sanitizeSuggestionList(parsed?.types, 5),
    names: sanitizeSuggestionList(parsed?.names, 3),
  };
}

// Ask an LLM what kind of place to search for, given a work item's
// title/notes. Used to seed the Places search box, not to create anything.
router.post("/suggest-place-types", async (req, res) => {
  if (!isGroqConfigured()) {
    return res
      .status(503)
      .json({ error: "AI features are not configured on this server." });
  }

  const { title, notes } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: "title is required" });
  }

  try {
    const parsed = await callGroqJson({
      systemPrompt: SUGGEST_PLACE_TYPES_SYSTEM_PROMPT,
      userPrompt: buildSuggestPlaceTypesUserPrompt(title.trim(), notes),
    });

    res.json(sanitizePlaceTypeSuggestions(parsed));
  } catch (error) {
    const handled = sendGroqError(res, error);
    if (handled) return handled;

    console.error("Failed to suggest place types", error);
    res.status(500).json({ error: "Failed to suggest place types" });
  }
});

const OPTIMIZE_ROUTE_SYSTEM_PROMPT = `You suggest a sensible visiting order for a list of errands/stops, optionally starting from a given location.

Rules:
- Use the provided coordinates to reason about geographic proximity (nearby stops should generally be visited together).
- Return every stop id exactly once, in your suggested order.
- reasoning should be one short sentence explaining the overall logic (e.g. "grouped by proximity, working outward from your start point").
- This is a helpful suggestion, not a guarantee — you have no live traffic or opening-hours data.

Respond with ONLY a JSON object of this exact shape, no other text:
{"order": [string], "reasoning": string}`;

function buildOptimizeRouteUserPrompt(startPoint, stops) {
  const startLine =
    startPoint?.latitude != null && startPoint?.longitude != null
      ? `Start point: ${startPoint.latitude}, ${startPoint.longitude}`
      : "Start point: unknown";

  const stopLines = stops.map(
    (stop) =>
      `- id: ${stop.id}, title: ${stop.title}, lat: ${stop.latitude ?? "unknown"}, lng: ${stop.longitude ?? "unknown"}`
  );

  return [startLine, "Stops:", ...stopLines].join("\n");
}

function sanitizeOptimizedRoute(parsed, validIds) {
  const validIdSet = new Set(validIds);
  const order = Array.isArray(parsed?.order)
    ? parsed.order.filter(
        (id, index) =>
          typeof id === "string" &&
          validIdSet.has(id) &&
          parsed.order.indexOf(id) === index
      )
    : [];

  // If the model dropped or invented ids, fall back to the original order
  // rather than silently losing stops.
  const isCompleteAndValid =
    order.length === validIds.length &&
    validIds.every((id) => order.includes(id));

  return {
    order: isCompleteAndValid ? order : validIds,
    reasoning:
      typeof parsed?.reasoning === "string" && parsed.reasoning.trim()
        ? parsed.reasoning.trim().slice(0, 300)
        : null,
  };
}

// Ask an LLM to suggest a visiting order for a set of stops. Purely
// advisory — the client applies it as a display order, nothing is persisted.
router.post("/optimize-route", async (req, res) => {
  if (!isGroqConfigured()) {
    return res
      .status(503)
      .json({ error: "AI features are not configured on this server." });
  }

  const { startPoint, stops } = req.body;
  if (!Array.isArray(stops) || stops.length === 0) {
    return res.status(400).json({ error: "stops is required" });
  }
  if (stops.some((stop) => !stop || typeof stop.id !== "string")) {
    return res.status(400).json({ error: "every stop must have an id" });
  }

  try {
    const parsed = await callGroqJson({
      systemPrompt: OPTIMIZE_ROUTE_SYSTEM_PROMPT,
      userPrompt: buildOptimizeRouteUserPrompt(startPoint, stops),
    });

    res.json(
      sanitizeOptimizedRoute(
        parsed,
        stops.map((stop) => stop.id)
      )
    );
  } catch (error) {
    const handled = sendGroqError(res, error);
    if (handled) return handled;

    console.error("Failed to optimize route", error);
    res.status(500).json({ error: "Failed to optimize route" });
  }
});

const SPLIT_INTENT_SYSTEM_PROMPT = `You help someone turn a freeform note into one or more personal goals ("intents").

Rules:
- If the text describes ONE goal, return exactly one intent for it — do not invent extra ones.
- If the text describes SEVERAL distinct goals (e.g. separated by commas, "and", or line breaks), return one intent per distinct goal.
- Each intent's title should be short and action-oriented (e.g. "Renew passport", not "I need to renew my passport soon").
- description is optional — only include it if the text has extra detail worth keeping beyond the title; otherwise null.
- priority must be exactly one of: "low", "medium", "high" — guess "medium" if unclear.
- Never invent goals that aren't implied by the text. Suggest at most 8 intents.

Respond with ONLY a JSON object of this exact shape, no other text:
{"intents": [{"title": string, "description": string or null, "priority": "low"|"medium"|"high"}]}`;

const VALID_SPLIT_PRIORITIES = new Set(["low", "medium", "high"]);

function sanitizeSplitIntents(parsed) {
  if (!Array.isArray(parsed?.intents)) return [];

  return parsed.intents
    .filter(
      (item) => item && typeof item.title === "string" && item.title.trim()
    )
    .slice(0, 8)
    .map((item) => ({
      title: item.title.trim().slice(0, 200),
      description:
        typeof item.description === "string" && item.description.trim()
          ? item.description.trim().slice(0, 1000)
          : null,
      priority: VALID_SPLIT_PRIORITIES.has(item.priority)
        ? item.priority
        : "medium",
    }));
}

// Ask an LLM to split a freeform blob of text into one or more candidate
// intents. Purely advisory — the client reviews the list and decides which,
// if any, to actually create via the existing POST /api/intents endpoint.
router.post("/split-intent", async (req, res) => {
  if (!isGroqConfigured()) {
    return res
      .status(503)
      .json({ error: "AI features are not configured on this server." });
  }

  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "text is required" });
  }

  try {
    const parsed = await callGroqJson({
      systemPrompt: SPLIT_INTENT_SYSTEM_PROMPT,
      userPrompt: text.trim(),
    });

    res.json({ intents: sanitizeSplitIntents(parsed) });
  } catch (error) {
    const handled = sendGroqError(res, error);
    if (handled) return handled;

    console.error("Failed to split intent", error);
    res.status(500).json({ error: "Failed to split intent" });
  }
});

module.exports = router;
