import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(cleanup);

// Vite loads apps/web/.env by default, including the real
// VITE_GOOGLE_MAPS_API_KEY — without this, that real key leaks into every
// test's import.meta.env, silently taking "key is configured" code paths
// (reverse geocoding, place search, map loading) that hang or fail in
// jsdom since there's no real network/Maps SDK available. Tests that
// specifically want the "key present" behavior opt in with their own
// vi.stubEnv(...); unstubbing after every test (not just once) also
// guards against one test's stub leaking into the next.
beforeEach(() => {
  vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

// jsdom has no matchMedia implementation. Tests that care about a specific
// OS color-scheme preference stub this themselves via vi.stubGlobal; this is
// just a safe default so ThemeProvider (system theme) doesn't throw in tests
// that don't care about it.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}
