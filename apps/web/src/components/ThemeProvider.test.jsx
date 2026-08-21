import { act, render, renderHook, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ThemeProvider } from "./ThemeProvider";
import ThemeToggle from "./ThemeToggle";
import { useTheme } from "../hooks/useTheme";

function createMatchMediaStub(initialMatches) {
  let matches = initialMatches;
  let changeListener = null;
  const mql = {
    get matches() {
      return matches;
    },
    addEventListener: vi.fn((event, listener) => {
      if (event === "change") changeListener = listener;
    }),
    removeEventListener: vi.fn(),
  };
  return {
    stub: vi.fn(() => mql),
    setMatches(next) {
      matches = next;
      changeListener?.();
    },
  };
}

function Harness() {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
  return (
    <div>
      <p data-testid="theme">{theme}</p>
      <p data-testid="resolved">{resolvedTheme}</p>
      <button onClick={() => setTheme("dark")}>set-dark</button>
      <button onClick={() => setTheme("light")}>set-light</button>
      <button onClick={() => setTheme("system")}>set-system</button>
      <button onClick={() => setTheme("neon")}>set-invalid</button>
      <button onClick={toggleTheme}>toggle</button>
      <ThemeToggle />
    </div>
  );
}

function renderHarness() {
  return render(
    <ThemeProvider>
      <Harness />
    </ThemeProvider>
  );
}

describe("ThemeProvider / useTheme / ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it('defaults to "system" when localStorage has no stored theme, resolving via matchMedia', () => {
    const { stub } = createMatchMediaStub(false);
    vi.stubGlobal("matchMedia", stub);

    renderHarness();

    expect(screen.getByTestId("theme")).toHaveTextContent("system");
    expect(screen.getByTestId("resolved")).toHaveTextContent("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("resolves to dark immediately when the OS prefers dark and theme is system", () => {
    const { stub } = createMatchMediaStub(true);
    vi.stubGlobal("matchMedia", stub);

    renderHarness();

    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("reads a valid stored theme from localStorage on mount", () => {
    localStorage.setItem("navo-theme", "dark");
    vi.stubGlobal("matchMedia", createMatchMediaStub(false).stub);

    renderHarness();

    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
  });

  it("falls back to system for an invalid stored value", () => {
    localStorage.setItem("navo-theme", "purple");
    vi.stubGlobal("matchMedia", createMatchMediaStub(false).stub);

    renderHarness();

    expect(screen.getByTestId("theme")).toHaveTextContent("system");
  });

  it("setTheme(dark) adds the dark class and persists to localStorage", () => {
    vi.stubGlobal("matchMedia", createMatchMediaStub(false).stub);
    renderHarness();

    fireEvent.click(screen.getByText("set-dark"));

    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("navo-theme")).toBe("dark");
  });

  it("setTheme(light) removes the dark class and persists to localStorage", () => {
    localStorage.setItem("navo-theme", "dark");
    vi.stubGlobal("matchMedia", createMatchMediaStub(false).stub);
    renderHarness();
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    fireEvent.click(screen.getByText("set-light"));

    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("navo-theme")).toBe("light");
  });

  it("setTheme with an invalid value is a no-op", () => {
    vi.stubGlobal("matchMedia", createMatchMediaStub(false).stub);
    renderHarness();

    fireEvent.click(screen.getByText("set-invalid"));

    expect(screen.getByTestId("theme")).toHaveTextContent("system");
    expect(localStorage.getItem("navo-theme")).toBeNull();
  });

  it("toggleTheme flips based on the current resolved theme, not a stored raw value", () => {
    // system + OS-prefers-dark resolves to "dark"; toggling should go to "light"
    vi.stubGlobal("matchMedia", createMatchMediaStub(true).stub);
    renderHarness();
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");

    fireEvent.click(screen.getByText("toggle"));
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    expect(screen.getByTestId("resolved")).toHaveTextContent("light");

    fireEvent.click(screen.getByText("toggle"));
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
  });

  it("updates when the OS preference changes while theme is system", () => {
    const { stub, setMatches } = createMatchMediaStub(false);
    vi.stubGlobal("matchMedia", stub);
    renderHarness();
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    act(() => {
      setMatches(true);
    });

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  describe("ThemeToggle", () => {
    it('shows the moon and "Switch to dark theme" label when resolved theme is light', () => {
      vi.stubGlobal("matchMedia", createMatchMediaStub(false).stub);
      renderHarness();

      const toggle = screen.getByRole("button", {
        name: "Switch to dark theme",
      });
      expect(toggle).toHaveTextContent("🌙");
    });

    it('shows the sun and "Switch to light theme" label when resolved theme is dark, and clicking it toggles', () => {
      vi.stubGlobal("matchMedia", createMatchMediaStub(true).stub);
      renderHarness();

      const toggle = screen.getByRole("button", {
        name: "Switch to light theme",
      });
      expect(toggle).toHaveTextContent("☀️");

      fireEvent.click(toggle);

      expect(document.documentElement.classList.contains("dark")).toBe(false);
      expect(
        screen.getByRole("button", { name: "Switch to dark theme" })
      ).toBeInTheDocument();
    });
  });
});

describe("useTheme", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("throws when used outside a ThemeProvider", () => {
    expect(() => renderHook(() => useTheme())).toThrow(
      "useTheme must be used within a ThemeProvider"
    );
  });
});
