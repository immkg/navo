const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../src/app");

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

test("POST /api/routing/travel-time requires an origin and a non-empty destinations array", async () => {
  const missingOrigin = await request(app)
    .post("/api/routing/travel-time")
    .send({ destinations: [{ latitude: 1, longitude: 1 }] });
  assert.equal(missingOrigin.statusCode, 400);

  const emptyDestinations = await request(app)
    .post("/api/routing/travel-time")
    .send({ origin: { latitude: 0, longitude: 0 }, destinations: [] });
  assert.equal(emptyDestinations.statusCode, 400);
});

test("POST /api/routing/travel-time rejects a destination missing coordinates", async () => {
  const response = await request(app)
    .post("/api/routing/travel-time")
    .send({
      origin: { latitude: 0, longitude: 0 },
      destinations: [{ latitude: 1 }],
    });

  assert.equal(response.statusCode, 400);
});

test("POST /api/routing/travel-time reports configured: false and null minutes when no API key is set", async () => {
  delete process.env.GOOGLE_MAPS_API_KEY;

  const response = await request(app)
    .post("/api/routing/travel-time")
    .send({
      origin: { latitude: 0, longitude: 0 },
      destinations: [
        { latitude: 1, longitude: 1 },
        { latitude: 2, longitude: 2 },
      ],
    });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.configured, false);
  assert.deepEqual(response.body.minutes, [null, null]);
});

test("POST /api/routing/travel-time returns real minutes per destination, in request order", async () => {
  process.env.GOOGLE_MAPS_API_KEY = "test-key";
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      status: "OK",
      rows: [
        {
          elements: [
            { status: "OK", duration: { value: 0 } },
            { status: "OK", duration: { value: 300 } },
            { status: "OK", duration: { value: 600 } },
          ],
        },
        {
          elements: [
            { status: "OK", duration: { value: 300 } },
            { status: "OK", duration: { value: 0 } },
            { status: "OK", duration: { value: 300 } },
          ],
        },
        {
          elements: [
            { status: "OK", duration: { value: 600 } },
            { status: "OK", duration: { value: 300 } },
            { status: "OK", duration: { value: 0 } },
          ],
        },
      ],
    }),
  });

  const response = await request(app)
    .post("/api/routing/travel-time")
    .send({
      origin: { latitude: 0, longitude: 0 },
      destinations: [
        { latitude: 1, longitude: 1 },
        { latitude: 2, longitude: 2 },
      ],
    });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.configured, true);
  assert.deepEqual(response.body.minutes, [5, 10]);
});

test("POST /api/routing/travel-time falls back to null minutes when a destination pair is missing from the matrix", async () => {
  process.env.GOOGLE_MAPS_API_KEY = "test-key";
  global.fetch = async () => ({
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
            { status: "OK", duration: { value: 0 } },
            { status: "OK", duration: { value: 0 } },
          ],
        },
      ],
    }),
  });

  const response = await request(app)
    .post("/api/routing/travel-time")
    .send({
      origin: { latitude: 0, longitude: 0 },
      destinations: [{ latitude: 1, longitude: 1 }],
    });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.minutes, [null]);
});
