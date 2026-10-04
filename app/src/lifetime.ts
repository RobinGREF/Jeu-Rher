import type { PlayerStats } from './engine';
import type { Medal } from './types';

/** Activité cumulée sur cet appareil (parties terminées), pour la page « Mes stats ». */
export type Lifetime = {
  games: number;
  byMode: { solo: number; together: number; online: number };
  /** Total de missions réussies sur toutes les parties, et meilleur score. */
  missions: number; best: number;
  medals: { bronze: number; argent: number; or: number };
  fifty: number;
  plays: number;
  mine: { plays: number; done: number; missed: number; calls: number; kept: number; wrongCalls: number; wrongNo: number };
  first: number | null; last: number | null;
};
const KEY = '50m-lifetime';

export const emptyLifetime = (): Lifetime => ({
  games: 0, byMode: { solo: 0, together: 0, online: 0 }, missions: 0, best: 0, medals: { bronze: 0, argent: 0, or: 0 }, fifty: 0, plays: 0,
  mine: { plays: 0, done: 0, missed: 0, calls: 0, kept: 0, wrongCalls: 0, wrongNo: 0 }, first: null, last: null,
});

const MEDAL_ORDER: Medal[] = ['bronze', 'argent', 'or'];

/** Ajoute une partie terminée. `mine` : les stats du ou des joueurs de cet appareil (aucune pour un spectateur). */
export function addLifetime(l: Lifetime, g: { mode: 'solo' | 'together' | 'online'; completed: number; medal: Medal | null; plays: number }, mine: PlayerStats[], now = Date.now()): Lifetime {
  const medals = { ...l.medals };
  // Une médaille gagnée compte aussi pour les précédentes (l'or passe forcément par le bronze et l'argent).
  if (g.medal) for (const m of MEDAL_ORDER.slice(0, MEDAL_ORDER.indexOf(g.medal) + 1)) medals[m]++;
  const sum = (k: keyof PlayerStats) => mine.reduce((n, x) => n + x[k], 0);
  return {
    games: l.games + 1, byMode: { ...l.byMode, [g.mode]: l.byMode[g.mode] + 1 },
    missions: l.missions + g.completed, best: Math.max(l.best, g.completed), medals, fifty: l.fifty + (g.completed >= 50 ? 1 : 0), plays: l.plays + g.plays,
    mine: {
      plays: l.mine.plays + sum('plays'), done: l.mine.done + sum('done'), missed: l.mine.missed + sum('missed'), calls: l.mine.calls + sum('calls'),
      kept: l.mine.kept + sum('kept'), wrongCalls: l.mine.wrongCalls + sum('wrongCalls'), wrongNo: l.mine.wrongNo + sum('wrongNo'),
    },
    first: l.first ?? now, last: now,
  };
}

export function loadLifetime(): Lifetime {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return j && typeof j === 'object' && j.byMode && j.mine ? { ...emptyLifetime(), ...j } : emptyLifetime();
  } catch { return emptyLifetime(); }
}
export const saveLifetime = (l: Lifetime) => { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* sans stockage */ } };
export const clearLifetime = () => { try { localStorage.removeItem(KEY); } catch { /* sans stockage */ } };
