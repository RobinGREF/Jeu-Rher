import type { Medal } from './types';

export type ScoreMode = 'solo' | 'together' | 'online';
export type ScorePlayer = { name: string; bot: boolean };

/** Une partie terminée : ce qu'elle a rapporté, et qui y a joué. */
export type ScoreEntry = {
  id: string;
  at: number;
  /** Missions réussies (sur 50). */
  completed: number;
  medal: Medal | null;
  /** Nombre de cartes posées : à score égal, moins de coups = meilleure partie. */
  plays: number;
  mode: ScoreMode;
  players: ScorePlayer[];
};

const KEY = '50m-scores';
export const MAX_SCORES = 50;

/** Meilleur d'abord : plus de missions, puis moins de coups, puis la plus ancienne (le record reste à son détenteur). */
export const compareScores = (a: ScoreEntry, b: ScoreEntry) =>
  b.completed - a.completed || a.plays - b.plays || a.at - b.at || a.id.localeCompare(b.id);

/** Ajoute une partie et renvoie la liste classée (limitée) et le rang de la partie (1 = record), ou null si elle n'a pas été gardée. */
export function addScore(list: ScoreEntry[], entry: ScoreEntry, max = MAX_SCORES): { list: ScoreEntry[]; rank: number | null } {
  const next = [...list.filter((e) => e.id !== entry.id), entry].sort(compareScores).slice(0, max);
  const i = next.findIndex((e) => e.id === entry.id);
  return { list: next, rank: i < 0 ? null : i + 1 };
}

const isMedal = (m: unknown): m is Medal | null => m === null || m === 'bronze' || m === 'argent' || m === 'or';

/** Ne garde que les entrées bien formées : un stockage abîmé ne doit jamais faire planter l'appli. */
export function parseScores(raw: string | null): ScoreEntry[] {
  try {
    const data = JSON.parse(raw ?? '[]');
    if (!Array.isArray(data)) return [];
    return data
      .filter((e): e is ScoreEntry =>
        !!e && typeof e.id === 'string' && typeof e.at === 'number' && Number.isFinite(e.completed) && e.completed >= 0 && e.completed <= 50
        && Number.isFinite(e.plays) && isMedal(e.medal) && ['solo', 'together', 'online'].includes(e.mode)
        && Array.isArray(e.players) && e.players.every((p: ScorePlayer) => p && typeof p.name === 'string' && typeof p.bot === 'boolean'))
      .sort(compareScores)
      .slice(0, MAX_SCORES);
  } catch { return []; }
}

export function loadScores(storage: Pick<Storage, 'getItem'> | undefined = safeStorage()): ScoreEntry[] {
  try { return parseScores(storage?.getItem(KEY) ?? null); } catch { return []; }
}

export function saveScores(list: ScoreEntry[], storage: Pick<Storage, 'setItem'> | undefined = safeStorage()) {
  try { storage?.setItem(KEY, JSON.stringify(list)); } catch { /* sans stockage : les scores ne sont pas gardés */ }
}

export function clearScores(storage: Pick<Storage, 'removeItem'> | undefined = safeStorage()) {
  try { storage?.removeItem(KEY); } catch { /* sans stockage */ }
}

function safeStorage(): Storage | undefined {
  try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; }
}

/** Noms nettoyés pour l'affichage. */
export const cleanName = (n: string, fallback: string) => n.trim().slice(0, 14) || fallback;
