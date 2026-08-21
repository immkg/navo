import { useCallback, useEffect, useMemo, useState } from "react";
import { ThemeContext } from "../hooks/useTheme";

const STORAGE_KEY = "navo-theme";
const VALID_THEMES = new Set(["light", "dark", "system"]);

function getStoredTheme() {
  if (typeof localStorage === "undefined") return "system";
  const stored = localStorage.getItem(STORAGE_KEY);
  return VALID_THEMES.has(stored) ? stored : "system";
}

function prefersDark() {
  if (typeof window === "undefined") return false;
  return Boolean(window.matchMedia?.("(prefers-color-scheme: dark)")?.matches);
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getStoredTheme);
  const resolvedTheme =
    theme === "system" ? (prefersDark() ? "dark" : "light") : theme;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);

  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      document.documentElement.classList.toggle("dark", media.matches);
    };
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [theme]);

  const setTheme = useCallback((nextTheme) => {
    if (!VALID_THEMES.has(nextTheme)) return;
    setThemeState(nextTheme);
    localStorage.setItem(STORAGE_KEY, nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [theme, resolvedTheme, setTheme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
