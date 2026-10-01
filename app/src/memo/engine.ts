export type Level = { key: string; label: string; pairs: number; cols: number };

export const LEVELS: Level[] = [
  { key: 'facile', label: 'Facile', pairs: 6, cols: 3 },
  { key: 'moyen', label: 'Moyen', pairs: 8, cols: 4 },
  { key: 'difficile', label: 'Difficile', pairs: 12, cols: 4 },
];

export const SYMBOLS = ['🍎', '🚀', '🐙', '🎲', '🌵', '🎸', '🦊', '🍕', '⚓', '🔥', '🌙', '🧩', '🐢', '🍄'];

export type Card = { id: number; symbol: string; matched: boolean };
export type Memo = {
  cards: Card[];
  /** Cartes retournées face visible et pas encore appariées (0, 1 ou 2). */
  flipped: number[];
  moves: number;
};

export type Rng = () => number;

export function newMemo(pairs: number, rng: Rng = Math.random): Memo {
  const symbols = SYMBOLS.slice();
  for (let i = symbols.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [symbols[i], symbols[j]] = [symbols[j], symbols[i]]; }
  const deck = symbols.slice(0, pairs).flatMap((s) => [s, s]);
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return { cards: deck.map((symbol, id) => ({ id, symbol, matched: false })), flipped: [], moves: 0 };
}

/** Deux cartes sont face visible mais ne vont pas ensemble : il faut les retourner avant de continuer. */
export const mismatch = (m: Memo) => m.flipped.length === 2 && m.cards[m.flipped[0]].symbol !== m.cards[m.flipped[1]].symbol;

export const isDone = (m: Memo) => m.cards.every((c) => c.matched);

/** Retourne une carte. Sans effet si elle est déjà visible/appariée ou si une paire ratée attend d'être cachée. */
export function flip(m: Memo, id: number): Memo {
  if (m.flipped.length >= 2 || m.flipped.includes(id) || !m.cards[id] || m.cards[id].matched) return m;
  const flipped = [...m.flipped, id];
  if (flipped.length < 2) return { ...m, flipped };
  const [a, b] = flipped;
  const hit = m.cards[a].symbol === m.cards[b].symbol;
  const cards = hit ? m.cards.map((c) => (c.id === a || c.id === b ? { ...c, matched: true } : c)) : m.cards;
  return { cards, flipped: hit ? [] : flipped, moves: m.moves + 1 };
}

/** Cache de nouveau la paire ratée. */
export function hide(m: Memo): Memo {
  return mismatch(m) ? { ...m, flipped: [] } : m;
}

/** Note de 1 à 3 étoiles selon le nombre de coups (le minimum possible est `pairs`). */
export function stars(pairs: number, moves: number): 1 | 2 | 3 {
  if (moves <= Math.ceil(pairs * 1.5)) return 3;
  if (moves <= pairs * 2.5) return 2;
  return 1;
}
