const { test, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../src/app");
const prisma = require("../src/db/client");
const { cleanDatabase } = require("../test-support/helpers");

beforeEach(cleanDatabase);
// GROQ_API_KEY isn't guaranteed to be set in every environment these tests
// run in (e.g. CI has no such secret configured), so give every test a
// consistent fake key up front rather than depending on ambient env state.
beforeEach(() => {
  process.env.GROQ_API_KEY = "test-groq-key";
});
after(cleanDatabase);

function mockFetchOnce(implementation) {
  const originalFetch = global.fetch;
  global.fetch = implementation;
  return () => {
    global.fetch = originalFetch;
  };
}

test("POST /api/ai/suggest-work returns 503 when GROQ_API_KEY is not configured", async () => {
  delete process.env.GROQ_API_KEY;

  const response = await request(app)
    .post("/api/ai/suggest-work")
    .send({ intentId: "any-id" });

  assert.equal(response.statusCode, 503);
});

test("POST /api/ai/suggest-work requires an intentId", async () => {
  const response = await request(app).post("/api/ai/suggest-work").send({});

  assert.equal(response.statusCode, 400);
});

test("POST /api/ai/suggest-work returns 404 for a missing intent", async () => {
  const response = await request(app)
    .post("/api/ai/suggest-work")
    .send({ intentId: "missing-id" });

  assert.equal(response.statusCode, 404);
});

test("POST /api/ai/suggest-work returns sanitized suggestions on success", async () => {
  const intent = await prisma.intent.create({
    data: { title: "Plan a trip", description: "A week in Japan" },
  });
  await prisma.work.create({
    data: { title: "Book hotel", intentId: intent.id },
  });

  const restoreFetch = mockFetchOnce(async () => ({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              suggestions: [
                {
                  title: "Book flights",
                  notes: "Compare prices",
                  durationMinutes: 45,
                  needsLocation: false,
                },
                {
                  title: "Pack bags",
                  notes: "   ",
                  durationMinutes: -5,
                },
                { title: "  " }, // blank title, should be filtered out
              ],
            }),
          },
        },
      ],
    }),
  }));

  try {
    const response = await request(app)
      .post("/api/ai/suggest-work")
      .send({ intentId: intent.id });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.suggestions.length, 2);
    assert.equal(response.body.suggestions[0].title, "Book flights");
    assert.equal(response.body.suggestions[0].durationMinutes, 45);
    assert.equal(response.body.suggestions[0].needsLocation, false);
    assert.equal(response.body.suggestions[1].title, "Pack bags");
    assert.equal(response.body.suggestions[1].notes, null);
    assert.equal(response.body.suggestions[1].durationMinutes, 30);
    assert.equal(response.body.suggestions[1].needsLocation, false);
  } finally {
    restoreFetch();
  }
});

test("POST /api/ai/suggest-work returns 502 when the AI provider request fails", async () => {
  const intent = await prisma.intent.create({ data: { title: "Plan a trip" } });

  const restoreFetch = mockFetchOnce(async () => ({
    ok: false,
    status: 500,
    text: async () => "provider error",
  }));

  try {
    const response = await request(app)
      .post("/api/ai/suggest-work")
      .send({ intentId: intent.id });

    assert.equal(response.statusCode, 502);
  } finally {
    restoreFetch();
  }
});

test("POST /api/ai/suggest-work returns 502 when the AI response isn't valid JSON", async () => {
  const intent = await prisma.intent.create({ data: { title: "Plan a trip" } });

  const restoreFetch = mockFetchOnce(async () => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: "not json" } }],
    }),
  }));

  try {
    const response = await request(app)
      .post("/api/ai/suggest-work")
      .send({ intentId: intent.id });

    assert.equal(response.statusCode, 502);
  } finally {
    restoreFetch();
  }
});

test("POST /api/ai/draft-intent returns 503 when GROQ_API_KEY is not configured", async () => {
  delete process.env.GROQ_API_KEY;

  const response = await request(app)
    .post("/api/ai/draft-intent")
    .send({ title: "Renew passport" });

  assert.equal(response.statusCode, 503);
});

test("POST /api/ai/draft-intent requires a title", async () => {
  const response = await request(app).post("/api/ai/draft-intent").send({});

  assert.equal(response.statusCode, 400);
});

test("POST /api/ai/draft-intent rejects a whitespace-only title", async () => {
  const response = await request(app)
    .post("/api/ai/draft-intent")
    .send({ title: "   " });

  assert.equal(response.statusCode, 400);
});

test("POST /api/ai/draft-intent returns a sanitized draft on success", async () => {
  const restoreFetch = mockFetchOnce(async () => ({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              description: "Renew your passport before it expires.",
              priority: "high",
              dueDate: "2026-09-01",
            }),
          },
        },
      ],
    }),
  }));

  try {
    const response = await request(app)
      .post("/api/ai/draft-intent")
      .send({ title: "Renew passport" });

    assert.equal(response.statusCode, 200);
    assert.equal(
      response.body.description,
      "Renew your passport before it expires."
    );
    assert.equal(response.body.priority, "high");
    assert.equal(response.body.dueDate, "2026-09-01");
  } finally {
    restoreFetch();
  }
});

test("POST /api/ai/draft-intent falls back to medium priority, null description, and null due date for bad values", async () => {
  const restoreFetch = mockFetchOnce(async () => ({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              description: "   ",
              priority: "urgent",
              dueDate: "not-a-date",
            }),
          },
        },
      ],
    }),
  }));

  try {
    const response = await request(app)
      .post("/api/ai/draft-intent")
      .send({ title: "Do something", description: "existing description" });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.description, null);
    assert.equal(response.body.priority, "medium");
    assert.equal(response.body.dueDate, null);
  } finally {
    restoreFetch();
  }
});

test("POST /api/ai/suggest-place-types returns 503 when GROQ_API_KEY is not configured", async () => {
  delete process.env.GROQ_API_KEY;

  const response = await request(app)
    .post("/api/ai/suggest-place-types")
    .send({ title: "Pick up prescription" });

  assert.equal(response.statusCode, 503);
});

test("POST /api/ai/suggest-place-types requires a title", async () => {
  const response = await request(app)
    .post("/api/ai/suggest-place-types")
    .send({});

  assert.equal(response.statusCode, 400);
});

test("POST /api/ai/suggest-place-types rejects a whitespace-only title", async () => {
  const response = await request(app)
    .post("/api/ai/suggest-place-types")
    .send({ title: "   " });

  assert.equal(response.statusCode, 400);
});

test("POST /api/ai/suggest-place-types includes notes in the prompt when given", async () => {
  const restoreFetch = mockFetchOnce(async () => ({
    ok: true,
    json: async () => ({
      choices: [
        { message: { content: JSON.stringify({ types: [], names: [] }) } },
      ],
    }),
  }));

  try {
    const response = await request(app)
      .post("/api/ai/suggest-place-types")
      .send({ title: "Pick up prescription", notes: "Ask for generic" });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, { types: [], names: [] });
  } finally {
    restoreFetch();
  }
});

test("POST /api/ai/suggest-place-types includes the user's current location in the prompt when given", async () => {
  let capturedBody;
  const restoreFetch = mockFetchOnce(async (url, options) => {
    capturedBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        choices: [
          { message: { content: JSON.stringify({ types: [], names: [] }) } },
        ],
      }),
    };
  });

  try {
    const response = await request(app)
      .post("/api/ai/suggest-place-types")
      .send({
        title: "Pick up prescription",
        location: { latitude: 19.076, longitude: 72.8777 },
      });

    assert.equal(response.statusCode, 200);
    const userMessage = capturedBody.messages.find(
      (message) => message.role === "user"
    );
    assert.match(userMessage.content, /19\.076, 72\.8777/);
  } finally {
    restoreFetch();
  }
});

test("POST /api/ai/suggest-place-types returns sanitized types and names on success", async () => {
  const restoreFetch = mockFetchOnce(async () => ({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              types: ["pharmacy", "drugstore", 42, "  "],
              names: ["CVS", "Walgreens", "Rite Aid", "Duane Reade"],
            }),
          },
        },
      ],
    }),
  }));

  try {
    const response = await request(app)
      .post("/api/ai/suggest-place-types")
      .send({ title: "Pick up prescription" });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.types, ["pharmacy", "drugstore"]);
    assert.deepEqual(response.body.names, ["CVS", "Walgreens", "Rite Aid"]);
  } finally {
    restoreFetch();
  }
});

test("POST /api/ai/plan-variations returns 503 when GROQ_API_KEY is not configured", async () => {
  delete process.env.GROQ_API_KEY;

  const response = await request(app)
    .post("/api/ai/plan-variations")
    .send({ selectedWork: [], unselectedWork: [], budgetMinutes: 60 });

  assert.equal(response.statusCode, 503);
});

test("POST /api/ai/plan-variations requires selectedWork and unselectedWork arrays", async () => {
  const response = await request(app).post("/api/ai/plan-variations").send({});

  assert.equal(response.statusCode, 400);
});

test("POST /api/ai/plan-variations sanitizes ids the model invented or that aren't in the given pools", async () => {
  const restoreFetch = mockFetchOnce(async () => ({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              variations: [
                {
                  addWorkIds: ["unselected-1", "invented-id"],
                  removeWorkIds: ["selected-1", "invented-id-2"],
                  reasoning: "Swap in the overdue errand.",
                },
              ],
            }),
          },
        },
      ],
    }),
  }));

  try {
    const response = await request(app)
      .post("/api/ai/plan-variations")
      .send({
        selectedWork: [
          { id: "selected-1", title: "Buy groceries", priority: "low" },
        ],
        unselectedWork: [
          { id: "unselected-1", title: "Renew passport", priority: "high" },
        ],
        budgetMinutes: 60,
      });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.variations.length, 1);
    assert.deepEqual(response.body.variations[0].addWorkIds, ["unselected-1"]);
    assert.deepEqual(response.body.variations[0].removeWorkIds, ["selected-1"]);
    assert.equal(
      response.body.variations[0].reasoning,
      "Swap in the overdue errand."
    );
  } finally {
    restoreFetch();
  }
});

test("POST /api/ai/plan-variations drops a variation that ends up with nothing to add", async () => {
  const restoreFetch = mockFetchOnce(async () => ({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              variations: [
                {
                  addWorkIds: ["invented"],
                  removeWorkIds: [],
                  reasoning: "n/a",
                },
              ],
            }),
          },
        },
      ],
    }),
  }));

  try {
    const response = await request(app)
      .post("/api/ai/plan-variations")
      .send({
        selectedWork: [],
        unselectedWork: [
          { id: "real-1", title: "Renew passport", priority: "high" },
        ],
        budgetMinutes: 60,
      });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.variations, []);
  } finally {
    restoreFetch();
  }
});

test("POST /api/ai/plan-variations caps variations at 2", async () => {
  const restoreFetch = mockFetchOnce(async () => ({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              variations: [
                { addWorkIds: ["u1"], removeWorkIds: [], reasoning: "one" },
                { addWorkIds: ["u1"], removeWorkIds: [], reasoning: "two" },
                { addWorkIds: ["u1"], removeWorkIds: [], reasoning: "three" },
              ],
            }),
          },
        },
      ],
    }),
  }));

  try {
    const response = await request(app)
      .post("/api/ai/plan-variations")
      .send({
        selectedWork: [],
        unselectedWork: [
          { id: "u1", title: "Renew passport", priority: "high" },
        ],
        budgetMinutes: 60,
      });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.variations.length, 2);
  } finally {
    restoreFetch();
  }
});

test("POST /api/ai/plan-variations renders a due date as YYYY-MM-DD, not a verbose date string", async () => {
  let capturedBody;
  const restoreFetch = mockFetchOnce(async (url, options) => {
    capturedBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ variations: [] }) } }],
      }),
    };
  });

  try {
    const response = await request(app)
      .post("/api/ai/plan-variations")
      .send({
        selectedWork: [],
        unselectedWork: [
          {
            id: "u1",
            title: "Renew passport",
            priority: "high",
            intent: { priority: "high", dueDate: "2026-09-01T00:00:00.000Z" },
          },
        ],
        budgetMinutes: 60,
      });

    assert.equal(response.statusCode, 200);
    const userMessage = capturedBody.messages.find(
      (message) => message.role === "user"
    );
    assert.match(userMessage.content, /dueDate: 2026-09-01$/m);
    // No timezone-suffixed Date#toString() leaking into the prompt.
    assert.doesNotMatch(userMessage.content, /GMT|00:00:00/);
  } finally {
    restoreFetch();
  }
});

test("POST /api/ai/plan-variations renders a missing due date as none", async () => {
  let capturedBody;
  const restoreFetch = mockFetchOnce(async (url, options) => {
    capturedBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ variations: [] }) } }],
      }),
    };
  });

  try {
    await request(app)
      .post("/api/ai/plan-variations")
      .send({
        selectedWork: [],
        unselectedWork: [
          { id: "u1", title: "Renew passport", priority: "low" },
        ],
        budgetMinutes: 60,
      });

    const userMessage = capturedBody.messages.find(
      (message) => message.role === "user"
    );
    assert.match(userMessage.content, /dueDate: none$/m);
  } finally {
    restoreFetch();
  }
});

test("POST /api/ai/plan-variations makes no Groq call when there is nothing unselected", async () => {
  const restoreFetch = mockFetchOnce(async () => {
    throw new Error("fetch should not have been called");
  });

  try {
    const response = await request(app)
      .post("/api/ai/plan-variations")
      .send({
        selectedWork: [
          { id: "selected-1", title: "Buy groceries", priority: "low" },
        ],
        unselectedWork: [],
        budgetMinutes: 60,
      });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.variations, []);
  } finally {
    restoreFetch();
  }
});

test("POST /api/ai/suggest-work returns 500 for a non-Groq failure", async () => {
  const intent = await prisma.intent.create({ data: { title: "Plan a trip" } });
  const restoreFetch = mockFetchOnce(() => {
    throw new Error("network down");
  });

  try {
    const response = await request(app)
      .post("/api/ai/suggest-work")
      .send({ intentId: intent.id });

    assert.equal(response.statusCode, 500);
  } finally {
    restoreFetch();
  }
});

test("POST /api/ai/draft-intent returns 500 for a non-Groq failure", async () => {
  const restoreFetch = mockFetchOnce(() => {
    throw new Error("network down");
  });

  try {
    const response = await request(app)
      .post("/api/ai/draft-intent")
      .send({ title: "Renew passport" });

    assert.equal(response.statusCode, 500);
  } finally {
    restoreFetch();
  }
});

test("POST /api/ai/suggest-place-types returns 500 for a non-Groq failure", async () => {
  const restoreFetch = mockFetchOnce(() => {
    throw new Error("network down");
  });

  try {
    const response = await request(app)
      .post("/api/ai/suggest-place-types")
      .send({ title: "Pick up prescription" });

    assert.equal(response.statusCode, 500);
  } finally {
    restoreFetch();
  }
});

test("POST /api/ai/split-intent returns 503 when GROQ_API_KEY is not configured", async () => {
  delete process.env.GROQ_API_KEY;

  const response = await request(app)
    .post("/api/ai/split-intent")
    .send({ text: "renew passport, book flights" });

  assert.equal(response.statusCode, 503);
});

test("POST /api/ai/split-intent requires text", async () => {
  const response = await request(app).post("/api/ai/split-intent").send({});

  assert.equal(response.statusCode, 400);
});

test("POST /api/ai/split-intent rejects whitespace-only text", async () => {
  const response = await request(app)
    .post("/api/ai/split-intent")
    .send({ text: "   " });

  assert.equal(response.statusCode, 400);
});

test("POST /api/ai/split-intent returns sanitized intents on success", async () => {
  const restoreFetch = mockFetchOnce(async () => ({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              intents: [
                {
                  title: "Renew passport",
                  description: "Before the trip in September",
                  priority: "high",
                },
                { title: "Book flights", priority: "urgent" },
                { title: "  " }, // blank title, should be filtered out
              ],
            }),
          },
        },
      ],
    }),
  }));

  try {
    const response = await request(app)
      .post("/api/ai/split-intent")
      .send({ text: "renew passport before september trip, book flights" });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.intents.length, 2);
    assert.equal(response.body.intents[0].title, "Renew passport");
    assert.equal(response.body.intents[0].priority, "high");
    assert.equal(
      response.body.intents[0].description,
      "Before the trip in September"
    );
    assert.equal(response.body.intents[1].title, "Book flights");
    assert.equal(response.body.intents[1].priority, "medium");
    assert.equal(response.body.intents[1].description, null);
  } finally {
    restoreFetch();
  }
});

test("POST /api/ai/split-intent returns 502 when the AI provider request fails", async () => {
  const restoreFetch = mockFetchOnce(async () => ({
    ok: false,
    status: 500,
    text: async () => "provider error",
  }));

  try {
    const response = await request(app)
      .post("/api/ai/split-intent")
      .send({ text: "renew passport" });

    assert.equal(response.statusCode, 502);
  } finally {
    restoreFetch();
  }
});

test("POST /api/ai/split-intent returns 500 for a non-Groq failure", async () => {
  const restoreFetch = mockFetchOnce(() => {
    throw new Error("network down");
  });

  try {
    const response = await request(app)
      .post("/api/ai/split-intent")
      .send({ text: "renew passport" });

    assert.equal(response.statusCode, 500);
  } finally {
    restoreFetch();
  }
});
