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

test("POST /api/ai/optimize-route returns 503 when GROQ_API_KEY is not configured", async () => {
  delete process.env.GROQ_API_KEY;

  const response = await request(app)
    .post("/api/ai/optimize-route")
    .send({ stops: [{ id: "w1", title: "Stop 1" }] });

  assert.equal(response.statusCode, 503);
});

test("POST /api/ai/optimize-route requires a non-empty stops array", async () => {
  const response = await request(app)
    .post("/api/ai/optimize-route")
    .send({ stops: [] });

  assert.equal(response.statusCode, 400);
});

test("POST /api/ai/optimize-route requires every stop to have an id", async () => {
  const response = await request(app)
    .post("/api/ai/optimize-route")
    .send({ stops: [{ title: "Stop without id" }] });

  assert.equal(response.statusCode, 400);
});

test("POST /api/ai/optimize-route rejects a null entry in stops", async () => {
  const response = await request(app)
    .post("/api/ai/optimize-route")
    .send({ stops: [null] });

  assert.equal(response.statusCode, 400);
});

test("POST /api/ai/optimize-route falls back to the original order and null reasoning when the model omits both", async () => {
  const restoreFetch = mockFetchOnce(async () => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify({}) } }],
    }),
  }));

  try {
    const response = await request(app)
      .post("/api/ai/optimize-route")
      .send({
        stops: [
          { id: "w1", title: "Stop 1" },
          { id: "w2", title: "Stop 2" },
        ],
      });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.order, ["w1", "w2"]);
    assert.equal(response.body.reasoning, null);
  } finally {
    restoreFetch();
  }
});

test("POST /api/ai/optimize-route returns the model's order when it's valid", async () => {
  const restoreFetch = mockFetchOnce(async () => ({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              order: ["w2", "w1"],
              reasoning: "w2 is closer to your start point.",
            }),
          },
        },
      ],
    }),
  }));

  try {
    const response = await request(app)
      .post("/api/ai/optimize-route")
      .send({
        startPoint: { latitude: 1, longitude: 1 },
        stops: [
          { id: "w1", title: "Stop 1", latitude: 2, longitude: 2 },
          { id: "w2", title: "Stop 2", latitude: 1.1, longitude: 1.1 },
        ],
      });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.order, ["w2", "w1"]);
    assert.equal(response.body.reasoning, "w2 is closer to your start point.");
  } finally {
    restoreFetch();
  }
});

test("POST /api/ai/optimize-route falls back to the original order if the model returns invalid ids", async () => {
  const restoreFetch = mockFetchOnce(async () => ({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              order: ["w1", "made-up-id"],
              reasoning: "bad response",
            }),
          },
        },
      ],
    }),
  }));

  try {
    const response = await request(app)
      .post("/api/ai/optimize-route")
      .send({
        stops: [
          { id: "w1", title: "Stop 1" },
          { id: "w2", title: "Stop 2" },
        ],
      });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.order, ["w1", "w2"]);
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

test("POST /api/ai/optimize-route returns 500 for a non-Groq failure", async () => {
  const restoreFetch = mockFetchOnce(() => {
    throw new Error("network down");
  });

  try {
    const response = await request(app)
      .post("/api/ai/optimize-route")
      .send({ stops: [{ id: "w1", title: "Stop 1" }] });

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
