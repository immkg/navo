const { test, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../src/app");
const prisma = require("../src/db/client");
const { cleanDatabase } = require("../test-support/helpers");

beforeEach(cleanDatabase);
after(cleanDatabase);

function mockFetchOnce(implementation) {
  const originalFetch = global.fetch;
  global.fetch = implementation;
  return () => {
    global.fetch = originalFetch;
  };
}

test("POST /api/ai/suggest-work returns 503 when GROQ_API_KEY is not configured", async () => {
  const originalKey = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;
  try {
    const response = await request(app)
      .post("/api/ai/suggest-work")
      .send({ intentId: "any-id" });

    assert.equal(response.statusCode, 503);
  } finally {
    if (originalKey === undefined) {
      delete process.env.GROQ_API_KEY;
    } else {
      process.env.GROQ_API_KEY = originalKey;
    }
  }
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
    assert.equal(response.body.suggestions.length, 1);
    assert.equal(response.body.suggestions[0].title, "Book flights");
    assert.equal(response.body.suggestions[0].durationMinutes, 45);
    assert.equal(response.body.suggestions[0].needsLocation, false);
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
