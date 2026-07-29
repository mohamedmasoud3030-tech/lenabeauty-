const PREFIX = 'lenabeauty_desktop_draft_';

export function saveDesktopDraft<T>(key: string, value: T): void {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

export function loadDesktopDraft<T>(key: string): T | null {
  const raw = localStorage.getItem(PREFIX + key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearDesktopDraft(key: string): void {
  localStorage.removeItem(PREFIX + key);
}
