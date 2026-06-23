import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import {
  getStoredLanguage,
  getStoredTheme,
  LANGUAGE_STORAGE_KEY,
  LEGACY_LANGUAGE_STORAGE_KEY,
  THEME_STORAGE_KEY,
  LEGACY_THEME_STORAGE_KEY,
} from "../preferences";

function ThemeProbe() {
  const { theme, setTheme } = useTheme();
  return (
    <button data-testid="theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      {theme}
    </button>
  );
}

describe("persisted preference migrations", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    vi.restoreAllMocks();
  });

  it("migrates language from lenabeauty_lang to spa-lang", () => {
    localStorage.setItem(LEGACY_LANGUAGE_STORAGE_KEY, "en");

    expect(getStoredLanguage()).toBe("en");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en");
  });

  it("migrates theme from lenabeauty_theme to spa-theme", () => {
    localStorage.setItem(LEGACY_THEME_STORAGE_KEY, "light");

    expect(getStoredTheme()).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("keeps migrated language and theme after a simulated reload", async () => {
    localStorage.setItem(LEGACY_LANGUAGE_STORAGE_KEY, "en");
    localStorage.setItem(LEGACY_THEME_STORAGE_KEY, "dark");

    expect(getStoredLanguage()).toBe("en");
    const firstRender = render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    await waitFor(() => expect(firstRender.getByTestId("theme")).toHaveTextContent("dark"));
    firstRender.unmount();

    expect(getStoredLanguage()).toBe("en");
    const secondRender = render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    await waitFor(() => expect(secondRender.getByTestId("theme")).toHaveTextContent("dark"));
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });
});
