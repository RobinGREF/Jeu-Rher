import type { ScoreEntry, ScorePlayer } from '../scores';
import { compareScores, MAX_SCORES } from '../scores';
import type { Backend } from './backend';

/** Un score tel qu'il est écrit dans la base (`scores/CODE`). */
export function toWireScore(e: ScoreEntry) {
  return {
    at: e.at, completed: e.completed, plays: e.plays, medal: e.medal ?? '',
    players: Object.fromEntries(e.players.map((p, i) => [String(i), { name: p.name, bot: p.bot }])),
  };
}

/** Les scores lus dans la base : les entrées mal formées sont ignorées ; le code du salon sert d'identifiant. */
export function fromWireScores(raw: unknown): ScoreEntry[] {
  if (!raw || typeof raw !== 'object') return [];
  const out: ScoreEntry[] = [];
  for (const [code, v] of Object.entries(raw as Record<string, unknown>)) {
    const s = v as { at?: unknown; completed?: unknown; plays?: unknown; medal?: unknown; players?: unknown } | null;
    if (!s || typeof s.at !== 'number' || typeof s.completed !== 'number' || typeof s.plays !== 'number') continue;
    if (s.completed < 0 || s.completed > 50) continue;
    // Firebase rend les listes à clés 0, 1, 2… sous forme de tableau
    const list = Array.isArray(s.players) ? s.players : s.players && typeof s.players === 'object' ? Object.values(s.players) : [];
    const players = list.flatMap((p): ScorePlayer[] => {
      const x = p as { name?: unknown; bot?: unknown } | null;
      return x && typeof x.name === 'string' && typeof x.bot === 'boolean' ? [{ name: x.name, bot: x.bot }] : [];
    });
    if (!players.length) continue;
    const medal = s.medal === 'bronze' || s.medal === 'argent' || s.medal === 'or' ? s.medal : null;
    out.push({ id: code, at: s.at, completed: s.completed, plays: s.plays, medal, mode: 'online', players });
  }
  return out.sort(compareScores).slice(0, MAX_SCORES);
}

/** L'hôte inscrit le résultat de la partie (une seule fois par salon : la base refuse d'écraser). */
export const publishScore = (be: Backend, code: string, e: ScoreEntry) => be.set(`scores/${code}`, toWireScore(e));

export async function fetchScores(be: Backend): Promise<ScoreEntry[]> {
  return fromWireScores(await be.get('scores'));
}
