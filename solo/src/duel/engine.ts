import { CATEGORIES, QUESTIONS } from './questions';
import type { Category, DiffKey, DuelGame, DuelPlayer, HintKind, Question } from './types';

export const MAX_PLAYERS = 6;
/** Score de progression nécessaire pour acquérir une catégorie. */
export const CATEGORY_TARGET = 2;
export const CLASSIC_CATEGORIES = 8;
export const MIN_CATEGORIES = 4;

export const DIFFICULTIES: { key: DiffKey; label: string; pts: number; step: number; color: string; desc: string }[] = [
  { key: 'facile', label: 'Facile', pts: 1, step: 1, color: '#5aab63', desc: '2 bonnes réponses requises' },
  { key: 'difficile', label: 'Difficile', pts: 2, step: 2, color: '#d9534f', desc: "Valide la catégorie d'un coup !" },
];

export const TURN_COLORS = ['#e6c35a', '#4a90d9', '#e85d9e', '#5aab63', '#e8792d', '#9b6bcf'];
export const DEFAULT_CATEGORIES = ['geo', 'divert', 'histoire', 'arts', 'sciences', 'sport', 'langues', 'insolite'];

export type Rng = () => number;

export const catInfo = (key: string): Category => CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[0];
export const diffInfo = (key: DiffKey) => DIFFICULTIES.find((d) => d.key === key) ?? DIFFICULTIES[0];

export function shuffle<T>(arr: readonly T[], rng: Rng = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Tire `count` catégories au hasard (en gardant d'abord celles déjà choisies). */
export function randomCategories(count: number, keep: string[] = [], rng: Rng = Math.random): string[] {
  const rest = shuffle(CATEGORIES.map((c) => c.key).filter((k) => !keep.includes(k)), rng);
  return [...keep, ...rest].slice(0, count);
}

export function newDuel(names: string[], categories: string[], seen: Record<string, number[]> = {}): DuelGame {
  const players: DuelPlayer[] = names.slice(0, MAX_PLAYERS).map((n, i) => ({ name: n.trim() || `Joueur ${i + 1}`, score: 0, progress: {} }));
  return { players, current: 0, categories, seen };
}

export const progressOf = (p: DuelPlayer, cat: string) => p.progress[cat] ?? 0;
export const isCatDone = (p: DuelPlayer, cat: string) => progressOf(p, cat) >= CATEGORY_TARGET;
export const wonCount = (g: DuelGame, p: DuelPlayer) => g.categories.filter((c) => isCatDone(p, c)).length;
export const hasWon = (g: DuelGame, p: DuelPlayer) => wonCount(g, p) >= g.categories.length;

// ---------- Tirage des questions ----------

export type Drawn = { question: Question; seen: Record<string, number[]> };

/**
 * Tire une question et mélange ses propositions.
 * `seen` garde, par catégorie et difficulté, les questions déjà posées de la plus ancienne à la plus récente.
 * On tire d'abord parmi celles jamais vues ; une fois toute la banque épuisée, parmi le tiers le plus ancien :
 * une question ne revient donc jamais avant que les deux tiers de la banque soient passés (et jamais juste après l'avoir vue).
 */
export function drawQuestion(cat: string, diff: DiffKey, seen: Record<string, number[]>, rng: Rng = Math.random): Drawn {
  const key = `${cat}|${diff}`;
  const all = (QUESTIONS[cat] ?? []).map((q, i) => ({ q, i })).filter((x) => x.q.diff === diff);
  if (all.length === 0) throw new Error(`Aucune question pour ${key}`);
  const valid = new Set(all.map((x) => x.i));
  const used = (seen[key] ?? []).filter((i, k, a) => valid.has(i) && a.indexOf(i) === k);
  const fresh = all.filter((x) => !used.includes(x.i));
  let pick: { q: Question; i: number };
  if (fresh.length > 0) pick = fresh[Math.floor(rng() * fresh.length)];
  else {
    const oldest = used.slice(0, Math.max(1, Math.ceil(used.length / 3)));
    const target = oldest[Math.floor(rng() * oldest.length)];
    pick = all.find((x) => x.i === target)!;
  }
  const order = shuffle([0, 1, 2, 3], rng);
  const question: Question = { ...pick.q, choices: order.map((i) => pick.q.choices[i]), correct: order.indexOf(pick.q.correct) };
  return { question, seen: { ...seen, [key]: [...used.filter((i) => i !== pick.i), pick.i] } };
}

/** Réunit deux mémoires de questions vues : l'ordre de `base` est gardé, ce que `extra` ajoute vient en dernier (le plus récent). */
export function mergeSeen(base: Record<string, number[]>, extra: Record<string, number[]>): Record<string, number[]> {
  const out: Record<string, number[]> = { ...base };
  for (const [k, list] of Object.entries(extra)) {
    const have = out[k] ?? [];
    out[k] = [...have, ...list.filter((i) => !have.includes(i))];
  }
  return out;
}

// ---------- Indices ----------

/** Indices des propositions éliminées : 1 mauvaise réponse pour l'indice simple, 2 pour le 50/50. */
export function eliminate(q: Question, kind: HintKind, rng: Rng = Math.random): number[] {
  const wrong = shuffle(q.choices.map((_, i) => i).filter((i) => i !== q.correct), rng);
  return wrong.slice(0, kind === '5050' ? 2 : 1);
}

/** Progression rapportée par une bonne réponse (le 50/50 coûte 1 barre). */
export function stepGain(diff: DiffKey, hint: HintKind | null): number {
  return Math.max(0, diffInfo(diff).step - (hint === '5050' ? 1 : 0));
}

// ---------- Réponse à l'aveugle ----------

export function normalizeAnswer(s: string): string {
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(le|la|les|l|un|une|des|du|de|d)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array<number>(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

const typoBudget = (len: number) => (len <= 1 ? 0 : len <= 5 ? 1 : len <= 10 ? 2 : 3);

export function matchesOneAnswer(input: string, answer: string): boolean {
  // Réponse d'un seul signe ou d'une seule lettre (« @ », « C », « Q ») : la normalisation l'effacerait, on compare telle quelle.
  const raw = input.trim().toLowerCase();
  const bare = answer.trim().toLowerCase();
  if (raw && (raw === bare || raw === bare.replace(/^(le|la|les|l'|un|une) /, ''))) return true;
  const ni = normalizeAnswer(input);
  const nc = normalizeAnswer(answer);
  if (ni.length < 1) return false;
  if (ni.length < 2 && !/^\d+$/.test(ni)) return false;
  if (ni === nc || (ni.length >= 3 && nc.includes(ni)) || (nc.length >= 3 && ni.includes(nc))) return true;
  if (levenshtein(ni, nc) <= typoBudget(nc.length)) return true;
  // Un seul mot de la réponse suffit (« Marciano » pour « Rocky Marciano »).
  if (nc.split(' ').filter((w) => w.length >= 3).some((w) => levenshtein(ni, w) <= typoBudget(w.length))) return true;
  // Tolère un mot manquant (« être en forme » pour « être en pleine forme »).
  const niWords = ni.split(' ').filter((w) => w.length >= 3);
  const ncWords = nc.split(' ').filter((w) => w.length >= 3);
  if (niWords.length > 0 && ncWords.length > 0) {
    const matched = niWords.filter((w) => ncWords.includes(w)).length;
    if (matched === niWords.length && matched / ncWords.length >= 0.5) return true;
  }
  return false;
}

export function isBlindCorrect(input: string, q: Question): boolean {
  return [q.choices[q.correct], ...(q.alt ?? [])].some((a) => matchesOneAnswer(input, a));
}

// ---------- Fin de réponse ----------

export type Outcome = { game: DuelGame; won: boolean; gained: number };

/**
 * Applique le résultat d'une question au joueur dont c'est le tour.
 * Bonne réponse : points et progression. À l'aveugle, les points sont doublés et on rejoue.
 * Mauvaise réponse : perte des points de la difficulté (jamais sous 0) et le tour passe.
 */
export function applyAnswer(g: DuelGame, o: { correct: boolean; cat: string; diff: DiffKey; hint: HintKind | null; blind: boolean }): Outcome {
  const d = diffInfo(o.diff);
  const players = g.players.map((p) => ({ ...p, progress: { ...p.progress } }));
  const p = players[g.current];
  let gained: number;
  let next = g.current;
  if (o.correct) {
    gained = o.blind ? d.pts * 2 : d.pts;
    p.score += gained;
    const step = o.blind ? d.step : stepGain(o.diff, o.hint);
    p.progress[o.cat] = Math.min(CATEGORY_TARGET, progressOf(p, o.cat) + step);
  } else {
    gained = Math.min(p.score, d.pts) * -1 || 0;
    p.score = Math.max(0, p.score - d.pts);
  }
  const game: DuelGame = { ...g, players };
  const won = o.correct && hasWon(game, p);
  if (!(o.correct && o.blind)) next = (g.current + 1) % players.length;
  return { game: { ...game, current: next }, won, gained };
}
