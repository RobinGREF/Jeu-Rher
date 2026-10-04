import { loadJson, saveJson } from '../storage';

export type CatStats = { asked: number; right: number };
export type DuelStats = {
  /** Parties terminées vues sur cet appareil. */ games: number;
  wins: Record<string, number>;
  asked: number; right: number;
  blindTried: number; blindRight: number;
  hints: number;
  cats: Record<string, CatStats>;
  hard: CatStats;
  first: number | null; last: number | null;
};
const KEY = 'duel-stats';

export const emptyDuelStats = (): DuelStats => ({ games: 0, wins: {}, asked: 0, right: 0, blindTried: 0, blindRight: 0, hints: 0, cats: {}, hard: { asked: 0, right: 0 }, first: null, last: null });

export type Answered = { cat: string; correct: boolean; blind: boolean; hint: boolean; hard: boolean };

export function addAnswer(st: DuelStats, a: Answered, now = Date.now()): DuelStats {
  const c = st.cats[a.cat] ?? { asked: 0, right: 0 };
  return {
    ...st,
    asked: st.asked + 1, right: st.right + (a.correct ? 1 : 0),
    blindTried: st.blindTried + (a.blind ? 1 : 0), blindRight: st.blindRight + (a.blind && a.correct ? 1 : 0),
    hints: st.hints + (a.hint ? 1 : 0),
    cats: { ...st.cats, [a.cat]: { asked: c.asked + 1, right: c.right + (a.correct ? 1 : 0) } },
    hard: a.hard ? { asked: st.hard.asked + 1, right: st.hard.right + (a.correct ? 1 : 0) } : st.hard,
    first: st.first ?? now, last: now,
  };
}

export const addWin = (st: DuelStats, winner: string, now = Date.now()): DuelStats => ({
  ...st, games: st.games + 1, wins: { ...st.wins, [winner]: (st.wins[winner] ?? 0) + 1 }, first: st.first ?? now, last: now,
});

export const loadDuelStats = (): DuelStats => {
  const j = loadJson<DuelStats | null>(KEY, null);
  return j && typeof j === 'object' && j.cats && j.wins ? { ...emptyDuelStats(), ...j } : emptyDuelStats();
};
export const saveDuelStats = (st: DuelStats) => saveJson(KEY, st);
export const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)} %` : '—');
