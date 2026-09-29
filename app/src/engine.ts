import { buildMissionDefs, type MissionDef } from './missions';
import type { Card, Medal, Symbol } from './types';

type MissionDeckItem = { kind: 'mission'; def: MissionDef } | { kind: 'medal'; medal: Medal };

/** Ce qu'un joueur peut dire sans révéler sa main (voir les règles, « Communication »). */
export type SignalKind = 'help' | 'good' | 'stop';
/** `help` vise une mission (« Je peux aider pour cette Mission »), `good`/`stop` un tas. */
export type Signal = { player: number; kind: SignalKind; mission?: string; pile?: number };

export type GameState = {
  players: number;
  current: number;
  hands: Card[][];
  /** 4 tas ; la carte du dessus est la dernière. */
  piles: Card[][];
  symbolDeck: Card[];
  missions: MissionDef[];
  missionDeck: MissionDeckItem[];
  signals: Signal[];
  completed: number;
  medal: Medal | null;
  goldReached: boolean;
  over: boolean;
};

export type Rng = () => number;

export function shuffle<T>(xs: T[], rng: Rng = Math.random): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildSymbolDeck(): Card[] {
  const cards: Card[] = [];
  let id = 0;
  for (let copy = 0; copy < 2; copy++)
    for (let s = 0; s < 4; s++)
      for (let v = 1; v <= 7; v++) cards.push({ id: id++, symbol: s as Symbol, value: v });
  return cards;
}

export const canPlayOn = (card: Card, target: Card) =>
  card.symbol === target.symbol || card.value === target.value;

export const tops = (s: GameState) => s.piles.map((p) => p[p.length - 1]);

export const playablePiles = (s: GameState, card: Card) =>
  tops(s).flatMap((t, i) => (canPlayOn(card, t) ? [i] : []));

export const canPlayerMove = (s: GameState, player: number) =>
  s.hands[player].some((c) => playablePiles(s, c).length > 0);

function refill(s: GameState) {
  for (const hand of s.hands) while (hand.length < 4 && s.symbolDeck.length) hand.push(s.symbolDeck.pop()!);
}

/** Pioche une nouvelle mission ; les médailles rencontrées sont gagnées et passées. */
function drawMission(s: GameState, rng: Rng): MissionDef | null {
  while (s.missionDeck.length) {
    const item = s.missionDeck.shift()!;
    if (item.kind === 'mission') return item.def;
    s.medal = item.medal;
    if (item.medal === 'or') {
      s.goldReached = true;
      // Nouvelle pioche : cartes sous les tas + reste de la pioche.
      const buried = s.piles.flatMap((p) => p.splice(0, p.length - 1));
      s.symbolDeck = shuffle([...s.symbolDeck, ...buried], rng);
      refill(s);
    }
  }
  return null;
}

/** Valide en boucle les missions réussies (« à tout moment ») et les remplace. */
function resolveMissions(s: GameState, rng: Rng) {
  for (;;) {
    const t = tops(s);
    const idx = s.missions.findIndex((m) => m.check(t));
    if (idx === -1) return;
    s.completed++;
    const next = drawMission(s, rng);
    if (next) s.missions[idx] = next;
    else s.missions.splice(idx, 1);
    if (!s.missions.length) return;
  }
}

export function newGame(players: number, rng: Rng = Math.random): GameState {
  const defs = shuffle(buildMissionDefs(), rng);
  const missions = defs.splice(0, 4);
  const items: MissionDeckItem[] = defs.map((def) => ({ kind: 'mission', def }));
  // Bronze après 15 cartes, argent 4 plus loin, or 4 plus loin.
  items.splice(15, 0, { kind: 'medal', medal: 'bronze' });
  items.splice(15 + 1 + 4, 0, { kind: 'medal', medal: 'argent' });
  items.splice(15 + 1 + 4 + 1 + 4, 0, { kind: 'medal', medal: 'or' });

  const symbolDeck = shuffle(buildSymbolDeck(), rng);
  const piles = symbolDeck.splice(0, 4).map((c) => [c]);
  const hands: Card[][] = Array.from({ length: players }, () => []);
  const s: GameState = {
    players, current: 0, hands, piles, symbolDeck, missions, missionDeck: items,
    signals: [], completed: 0, medal: null, goldReached: false, over: false,
  };
  refill(s);
  resolveMissions(s, rng);
  if (!canPlayerMove(s, s.current)) s.over = true;
  return s;
}

export type PlayResult = { ok: true; state: GameState } | { ok: false; error: string };

/** Joue une carte de la main du joueur courant sur un tas. Renvoie un nouvel état. */
export function play(prev: GameState, cardId: number, pile: number, rng: Rng = Math.random): PlayResult {
  if (prev.over) return { ok: false, error: 'Partie terminée' };
  const s: GameState = {
    ...prev,
    hands: prev.hands.map((h) => [...h]),
    piles: prev.piles.map((p) => [...p]),
    symbolDeck: [...prev.symbolDeck],
    missions: [...prev.missions],
    missionDeck: [...prev.missionDeck],
    signals: [...prev.signals],
  };
  const hand = s.hands[s.current];
  const ci = hand.findIndex((c) => c.id === cardId);
  if (ci === -1) return { ok: false, error: 'Carte absente de la main' };
  const target = s.piles[pile]?.at(-1);
  if (!target) return { ok: false, error: 'Tas invalide' };
  if (!canPlayOn(hand[ci], target)) return { ok: false, error: 'Même symbole ou même valeur requis' };

  s.piles[pile].push(hand.splice(ci, 1)[0]);
  refill(s);
  resolveMissions(s, rng);

  // Un signal ne vaut que pour la situation qu'il commente : tas recouvert, mission remplacée.
  s.signals = s.signals.filter((g) => (g.kind === 'help' ? s.missions.some((m) => m.id === g.mission) : g.pile !== pile));

  if (s.completed >= 50) s.over = true;
  else {
    s.current = (s.current + 1) % s.players;
    if (!canPlayerMove(s, s.current)) s.over = true;
  }
  return { ok: true, state: s };
}

export const missionsLeft = (s: GameState) =>
  Math.max(0, 50 - s.completed);

const sameTarget = (a: Signal, b: Signal) => a.player === b.player && a.mission === b.mission && a.pile === b.pile;

/**
 * Pose ou retire un signal. Possible à tout moment, y compris hors de son tour.
 * Un même joueur ne peut pas dire « bonne carte » et « ne jouez pas » sur le même tas.
 */
export function toggleSignal(prev: GameState, sig: Signal): GameState {
  if (prev.over || sig.player < 0 || sig.player >= prev.players) return prev;
  const valid = sig.kind === 'help'
    ? prev.missions.some((m) => m.id === sig.mission)
    : sig.pile !== undefined && sig.pile >= 0 && sig.pile < prev.piles.length;
  if (!valid) return prev;
  const same = (g: Signal) => g.kind === sig.kind && sameTarget(g, sig);
  const signals = prev.signals.some(same)
    ? prev.signals.filter((g) => !same(g))
    : [...prev.signals.filter((g) => !(g.kind !== sig.kind && g.kind !== 'help' && sig.kind !== 'help' && sameTarget(g, sig))), sig];
  return { ...prev, signals };
}
