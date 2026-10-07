import { useSyncExternalStore } from 'react';

/** Encart des sommes (Σ) déplié ou replié : un seul réglage partagé (la mise en page du mode loupe en dépend), retenu sur l'appareil. */
const KEY = '50m-sum-open';
let open = (() => { try { return localStorage.getItem(KEY) !== '0'; } catch { return true; } })();
const listeners = new Set<() => void>();

export function setSumOpen(v: boolean) {
  open = v;
  try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* sans stockage */ }
  listeners.forEach((l) => l());
}
export const useSumOpen = (): boolean =>
  useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => open, () => open);
