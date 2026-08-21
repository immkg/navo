const express = require("express");
const prisma = require("../db/client");

const router = express.Router();

const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

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
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res
      .status(503)
      .json({ error: "AI suggestions are not configured on this server." });
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

    const groqResponse = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(intent, existingTitles) },
        ],
        temperature: 0.4,
        response_format: { type: "json_object" },
      }),
    });

    if (!groqResponse.ok) {
      const errorBody = await groqResponse.text();
      console.error("Groq API error", groqResponse.status, errorBody);
      return res.status(502).json({ error: "AI provider request failed" });
    }

    const data = await groqResponse.json();
    const content = data?.choices?.[0]?.message?.content;

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error("Failed to parse AI response", parseError, content);
      return res
        .status(502)
        .json({ error: "AI returned an unexpected response" });
    }

    res.json({ suggestions: sanitizeSuggestions(parsed) });
  } catch (error) {
    console.error("Failed to get AI suggestions", error);
    res.status(500).json({ error: "Failed to get AI suggestions" });
  }
});

module.exports = router;
