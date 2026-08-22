const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const {
  isGoogleRoutingConfigured,
  fetchTravelTimeMatrixMinutes,
} = require("../src/services/googleRouting");

let originalKey;
let originalFetch;

beforeEach(() => {
  originalKey = process.env.GOOGLE_MAPS_API_KEY;
  originalFetch = global.fetch;
});

afterEach(() => {
  if (originalKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
  else process.env.GOOGLE_MAPS_API_KEY = originalKey;
  global.fetch = originalFetch;
});

function mockFetchOnce(implementation) {
  global.fetch = implementation;
}

test("isGoogleRoutingConfigured is false when GOOGLE_MAPS_API_KEY is unset", () => {
  delete process.env.GOOGLE_MAPS_API_KEY;
  assert.equal(isGoogleRoutingConfigured(), false);
});

test("isGoogleRoutingConfigured is true when GOOGLE_MAPS_API_KEY is set", () => {
  process.env.GOOGLE_MAPS_API_KEY = "test-key";
  assert.equal(isGoogleRoutingConfigured(), true);
});

test("fetchTravelTimeMatrixMinutes returns an empty map without calling fetch when unconfigured", async () => {
  delete process.env.GOOGLE_MAPS_API_KEY;
  mockFetchOnce(() => {
    throw new Error("should not be called");
  });

  const matrix = await fetchTravelTimeMatrixMinutes([
    { latitude: 0, longitude: 0 },
    { latitude: 1, longitude: 1 },
  ]);

  assert.equal(matrix.size, 0);
});

test("fetchTravelTimeMatrixMinutes returns an empty map for fewer than 2 points", async () => {
  process.env.GOOGLE_MAPS_API_KEY = "test-key";
  mockFetchOnce(() => {
    throw new Error("should not be called");
  });

  const matrix = await fetchTravelTimeMatrixMinutes([
    { latitude: 0, longitude: 0 },
  ]);

  assert.equal(matrix.size, 0);
});

test("fetchTravelTimeMatrixMinutes parses a successful response into a minutes map keyed by point pair", async () => {
  process.env.GOOGLE_MAPS_API_KEY = "test-key";
  const a = { latitude: 0, longitude: 0 };
  const b = { latitude: 1, longitude: 1 };

  mockFetchOnce(async () => ({
    ok: true,
    json: async () => ({
      status: "OK",
      rows: [
        {
          elements: [
            { status: "OK", duration: { value: 0 } },
            { status: "OK", duration: { value: 725 } },
          ],
        },
        {
          elements: [
            { status: "OK", duration: { value: 725 } },
            { status: "OK", duration: { value: 0 } },
          ],
        },
      ],
    }),
  }));

  const matrix = await fetchTravelTimeMatrixMinutes([a, b]);

  assert.equal(matrix.get("0,0:1,1"), 12); // 725s -> 12.08min rounds to 12
  assert.equal(matrix.get("1,1:0,0"), 12);
});

test("fetchTravelTimeMatrixMinutes omits pairs whose element status is not OK", async () => {
  process.env.GOOGLE_MAPS_API_KEY = "test-key";
  const a = { latitude: 0, longitude: 0 };
  const b = { latitude: 1, longitude: 1 };

  mockFetchOnce(async () => ({
    ok: true,
    json: async () => ({
      status: "OK",
      rows: [
        {
          elements: [
            { status: "OK", duration: { value: 0 } },
            { status: "NOT_FOUND" },
          ],
        },
        {
          elements: [
            { status: "NOT_FOUND" },
            { status: "OK", duration: { value: 0 } },
          ],
        },
      ],
    }),
  }));

  const matrix = await fetchTravelTimeMatrixMinutes([a, b]);

  assert.equal(matrix.has("0,0:1,1"), false);
  assert.equal(matrix.has("1,1:0,0"), false);
});

test("fetchTravelTimeMatrixMinutes returns an empty map on a non-ok HTTP response", async () => {
  process.env.GOOGLE_MAPS_API_KEY = "test-key";
  mockFetchOnce(async () => ({
    ok: false,
    status: 500,
    text: async () => "boom",
  }));

  const matrix = await fetchTravelTimeMatrixMinutes([
    { latitude: 0, longitude: 0 },
    { latitude: 1, longitude: 1 },
  ]);

  assert.equal(matrix.size, 0);
});

test("fetchTravelTimeMatrixMinutes returns an empty map when the API status is not OK", async () => {
  process.env.GOOGLE_MAPS_API_KEY = "test-key";
  mockFetchOnce(async () => ({
    ok: true,
    json: async () => ({ status: "REQUEST_DENIED" }),
  }));

  const matrix = await fetchTravelTimeMatrixMinutes([
    { latitude: 0, longitude: 0 },
    { latitude: 1, longitude: 1 },
  ]);

  assert.equal(matrix.size, 0);
});
