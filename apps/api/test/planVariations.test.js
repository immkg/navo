const { test } = require("node:test");
const assert = require("node:assert/strict");

const { buildPlanVariations } = require("../src/services/planVariations");

function mockFetchOnce(implementation) {
  const originalFetch = global.fetch;
  global.fetch = implementation;
  return () => {
    global.fetch = originalFetch;
  };
}

async function withGroqConfigured(fn) {
  const originalGroqKey = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = "test-groq-key";
  try {
    await fn();
  } finally {
    if (originalGroqKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = originalGroqKey;
  }
}

function makeWork(id, overrides = {}) {
  return {
    id,
    title: `Work ${id}`,
    priority: "medium",
    intent: { priority: "medium", dueDate: null },
    ...overrides,
  };
}

test("buildPlanVariations caps how many work items are sent to the model, even with a large backlog", async () => {
  await withGroqConfigured(async () => {
    let capturedBody;
    const restoreFetch = mockFetchOnce(async (url, options) => {
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({ variations: [] }),
              },
            },
          ],
        }),
      };
    });

    try {
      // Mirrors the real-world case that surfaced this bug: a backlog large
      // enough that the unselected pool alone is well past any reasonable
      // per-request cap.
      const unselectedWork = Array.from({ length: 40 }, (_, i) =>
        makeWork(`unselected-${i}`)
      );
      const selectedWork = Array.from({ length: 20 }, (_, i) =>
        makeWork(`selected-${i}`)
      );

      await buildPlanVariations({
        selectedWork,
        unselectedWork,
        budgetMinutes: 120,
      });

      const userPrompt = capturedBody.messages[1].content;
      const unselectedLines = userPrompt
        .split("\n")
        .filter((line) => line.includes("unselected-"));
      const selectedLines = userPrompt
        .split("\n")
        .filter((line) => line.includes("selected-") && !line.includes("un"));

      assert.ok(
        unselectedLines.length < unselectedWork.length,
        "expected the unselected work list to be capped below the full backlog size"
      );
      assert.ok(
        selectedLines.length < selectedWork.length,
        "expected the selected work list to be capped below the full backlog size"
      );
    } finally {
      restoreFetch();
    }
  });
});

test("buildPlanVariations gives the model an explicit, generous completion token budget", async () => {
  await withGroqConfigured(async () => {
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
      await buildPlanVariations({
        selectedWork: [makeWork("w1")],
        unselectedWork: [makeWork("w2")],
        budgetMinutes: 60,
      });

      assert.ok(
        typeof capturedBody.max_tokens === "number" &&
          capturedBody.max_tokens >= 1024,
        `expected a generous explicit max_tokens, got ${capturedBody.max_tokens}`
      );
    } finally {
      restoreFetch();
    }
  });
});

test("buildPlanVariations still returns sanitized variations for a small, uncapped backlog", async () => {
  await withGroqConfigured(async () => {
    const restoreFetch = mockFetchOnce(async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                variations: [
                  {
                    addWorkIds: ["w2"],
                    removeWorkIds: ["w1"],
                    reasoning: "Swap in the overdue one.",
                  },
                ],
              }),
            },
          },
        ],
      }),
    }));

    try {
      const variations = await buildPlanVariations({
        selectedWork: [makeWork("w1")],
        unselectedWork: [makeWork("w2")],
        budgetMinutes: 60,
      });

      assert.equal(variations.length, 1);
      assert.deepEqual(variations[0].addWorkIds, ["w2"]);
      assert.deepEqual(variations[0].removeWorkIds, ["w1"]);
    } finally {
      restoreFetch();
    }
  });
});
