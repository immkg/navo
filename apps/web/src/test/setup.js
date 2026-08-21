import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(cleanup);

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
