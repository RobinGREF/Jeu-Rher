/** Petit stockage local (navigateur) : sans stockage disponible, on repart des valeurs par défaut. */
export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch { return fallback; }
}

export function saveJson(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sans stockage */ }
}

export function removeKey(key: string): void {
  try { localStorage.removeItem(key); } catch { /* sans stockage */ }
}
