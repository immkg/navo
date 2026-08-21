const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

class GroqNotConfiguredError extends Error {}
class GroqProviderError extends Error {}
class GroqParseError extends Error {}

function isGroqConfigured() {
  return Boolean(process.env.GROQ_API_KEY);
}

async function callGroqJson({ systemPrompt, userPrompt, temperature = 0.4 }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new GroqNotConfiguredError(
      "AI features are not configured on this server."
    );
  }

  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Groq API error", response.status, errorBody);
    throw new GroqProviderError("AI provider request failed");
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  try {
    return JSON.parse(content);
  } catch (parseError) {
    console.error("Failed to parse AI response", parseError, content);
    throw new GroqParseError("AI returned an unexpected response");
  }
}

// Maps a callGroqJson() failure to the right HTTP response. Route handlers
// should try/catch around callGroqJson and call this in the catch block for
// anything callGroqJson itself can throw; other errors (e.g. a DB lookup
// failure) are the route's own to handle.
function sendGroqError(res, error) {
  if (error instanceof GroqNotConfiguredError) {
    return res.status(503).json({ error: error.message });
  }
  if (error instanceof GroqProviderError || error instanceof GroqParseError) {
    return res.status(502).json({ error: error.message });
  }
  return null;
}

module.exports = {
  isGroqConfigured,
  callGroqJson,
  sendGroqError,
  GroqNotConfiguredError,
  GroqProviderError,
  GroqParseError,
};
