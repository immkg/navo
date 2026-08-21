const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

class GroqProviderError extends Error {}
class GroqParseError extends Error {}

// Every route calls this first and returns its own 503 before ever calling
// callGroqJson, so callGroqJson itself trusts the key is present rather than
// re-checking it — there is no caller path that reaches it otherwise.
function isGroqConfigured() {
  return Boolean(process.env.GROQ_API_KEY);
}

async function callGroqJson({ systemPrompt, userPrompt, temperature = 0.4 }) {
  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
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
  if (error instanceof GroqProviderError || error instanceof GroqParseError) {
    return res.status(502).json({ error: error.message });
  }
  return null;
}

module.exports = {
  isGroqConfigured,
  callGroqJson,
  sendGroqError,
  GroqProviderError,
  GroqParseError,
};
