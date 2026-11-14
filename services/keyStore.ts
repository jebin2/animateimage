// Where the user's Gemini API key is kept: this browser only, never sent
// anywhere but Google. "Remember" keeps it in localStorage; otherwise it lives
// in sessionStorage and is gone when the tab closes.

const KEY = 'gemini_api_key';

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

export function loadKey(): { key: string; remembered: boolean } {
  const saved = safe(() => localStorage.getItem(KEY), null);
  if (saved) return { key: saved, remembered: true };
  return { key: safe(() => sessionStorage.getItem(KEY), null) || '', remembered: false };
}

export function saveKey(key: string, remember: boolean): void {
  forgetKey();
  safe(() => (remember ? localStorage : sessionStorage).setItem(KEY, key), undefined);
}

export function forgetKey(): void {
  safe(() => localStorage.removeItem(KEY), undefined);
  safe(() => sessionStorage.removeItem(KEY), undefined);
  // Leftover from the old credits version of the app.
  safe(() => localStorage.removeItem('use_credits_preference'), undefined);
}
