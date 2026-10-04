import { loadJson, saveJson } from '../storage';

export type LevelStats = { played: number; moves: number; best: number | null; stars: number };
export type MemoStats = { levels: Record<string, LevelStats>; first: number | null; last: number | null };
const KEY = 'memo-stats';

export const emptyMemoStats = (): MemoStats => ({ levels: {}, first: null, last: null });

/** Ajoute une partie terminée (niveau, coups, étoiles). Pur : renvoie un nouvel objet. */
export function addMemoGame(st: MemoStats, level: string, moves: number, stars: number, now = Date.now()): MemoStats {
  const cur = st.levels[level] ?? { played: 0, moves: 0, best: null, stars: 0 };
  return {
    levels: { ...st.levels, [level]: { played: cur.played + 1, moves: cur.moves + moves, best: cur.best === null ? moves : Math.min(cur.best, moves), stars: cur.stars + stars } },
    first: st.first ?? now, last: now,
  };
}

export const loadMemoStats = (): MemoStats => {
  const j = loadJson<MemoStats | null>(KEY, null);
  return j && typeof j === 'object' && j.levels ? j : emptyMemoStats();
};
export const saveMemoStats = (st: MemoStats) => saveJson(KEY, st);
