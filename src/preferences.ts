export const LANGUAGE_STORAGE_KEY = "spa-lang";
export const LEGACY_LANGUAGE_STORAGE_KEY = "lenabeauty_lang";
export const THEME_STORAGE_KEY = "spa-theme";
export const LEGACY_THEME_STORAGE_KEY = "lenabeauty_theme";

export type AppLanguage = "ar" | "en";
export type AppTheme = "light" | "dark";

const isBrowserStorageAvailable = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export function isValidLanguage(value: string | null): value is AppLanguage {
  return value === "ar" || value === "en";
}

export function isValidTheme(value: string | null): value is AppTheme {
  return value === "light" || value === "dark";
}

export function getStoredLanguage(defaultLanguage: AppLanguage = "ar"): AppLanguage {
  if (!isBrowserStorageAvailable()) return defaultLanguage;

  const current = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (isValidLanguage(current)) return current;

  const legacy = window.localStorage.getItem(LEGACY_LANGUAGE_STORAGE_KEY);
  if (isValidLanguage(legacy)) {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, legacy);
    return legacy;
  }

  return defaultLanguage;
}

export function persistLanguage(language: AppLanguage) {
  if (!isBrowserStorageAvailable()) return;
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
}

export function getStoredTheme(defaultTheme?: AppTheme): AppTheme | null {
  if (!isBrowserStorageAvailable()) return defaultTheme ?? null;

  const current = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (isValidTheme(current)) return current;

  const legacy = window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
  if (isValidTheme(legacy)) {
    window.localStorage.setItem(THEME_STORAGE_KEY, legacy);
    return legacy;
  }

  return defaultTheme ?? null;
}

export function persistTheme(theme: AppTheme) {
  if (!isBrowserStorageAvailable()) return;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}
