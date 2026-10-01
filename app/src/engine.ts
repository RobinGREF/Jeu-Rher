import { buildMissionDefs, type MissionDef } from './missions';
import type { Card, Medal, Symbol } from './types';

export type MissionDeckItem = { kind: 'mission'; def: MissionDef } | { kind: 'medal'; medal: Medal };

/** Phrases du livret (variante) : « Je peux aider pour cette Mission », « J'ai une bonne carte ici », « Ne jouez pas ici ». */
export type SignalKind = 'help' | 'good' | 'stop';
export type Signal = { player: number; kind: SignalKind; mission?: string; pile?: number };

/** Annonce « je peux réussir… » : qui, et sur quelles missions il se positionne. */
export type Announce = { player: number; missions: string[] };

export type GameState = {
  players: number;
  current: number;
  hands: Card[][];
  /** 4 tas ; la carte du dessus est la dernière. */
  piles: Card[][];
  symbolDeck: Card[];
  missions: MissionDef[];
  missionDeck: MissionDeckItem[];
  /** Joueurs ayant annoncé « je peux réussir une mission » (sans dire laquelle). */
  canDo: Announce[];
  /** Joueurs qui ont dit « je ne peux pas » pour ce tour (effacé à chaque carte posée). */
  passed: number[];
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
    canDo: [], passed: [], signals: [], completed: 0, medal: null, goldReached: false, over: false,
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
    canDo: [],
    passed: [],
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

  // Les annonces portaient sur l'ancienne situation : effacées dès qu'une carte est posée.
  // Une phrase du livret ne vaut que pour sa cible : tas recouvert, mission remplacée.
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

export const announcedBy = (s: GameState, player: number): Announce | null => s.canDo.find((a) => a.player === player) ?? null;

/** Le joueur peut-il réussir au moins une mission d'un seul coup ? (Le bouton d'annonce n'apparaît que dans ce cas.) */
export const canAnnounce = (s: GameState, player: number) => !s.over && reachableMissions(s, player).length > 0;

/**
 * Annonce « je peux réussir » ces missions (à tout moment, hors tour compris), ou retire l'annonce si la liste est vide.
 * Refusée si le joueur ne peut en réussir aucune. Les missions inconnues sont ignorées.
 */
export function setCanDo(prev: GameState, player: number, missions: string[]): GameState {
  if (prev.over || player < 0 || player >= prev.players) return prev;
  const ids = [...new Set(missions)].filter((id) => prev.missions.some((m) => m.id === id));
  const rest = prev.canDo.filter((a) => a.player !== player);
  if (!ids.length) return { ...prev, canDo: rest };
  if (!canAnnounce(prev, player)) return prev;
  return { ...prev, canDo: [...rest, { player, missions: ids }].sort((x, y) => x.player - y.player), passed: prev.passed.filter((p) => p !== player) };
}

/** « Je ne peux pas réussir de mission » : réponse du joueur pour ce tour (retire son éventuelle annonce). */
export function setPass(prev: GameState, player: number): GameState {
  if (prev.over || player < 0 || player >= prev.players) return prev;
  return { ...prev, canDo: prev.canDo.filter((a) => a.player !== player), passed: prev.passed.includes(player) ? prev.passed : [...prev.passed, player].sort((x, y) => x - y) };
}

/** Joueurs qui n'ont pas encore dit s'ils peuvent ou non réussir une mission (celui qui va jouer n'a pas à répondre). */
export const unanswered = (s: GameState): number[] =>
  s.over ? [] : Array.from({ length: s.players }, (_, i) => i).filter((i) => i !== s.current && !s.passed.includes(i) && !s.canDo.some((a) => a.player === i));

export type MissionMove = { cardId: number; pile: number; missions: string[] };

/**
 * Coup de pouce : les coups de la main d'un joueur qui réussiraient au moins une mission
 * immédiatement, des plus rentables aux moins. Valable à tout moment, même hors de son tour.
 */
export function findMissionMoves(s: GameState, player: number): MissionMove[] {
  const moves: MissionMove[] = [];
  for (const card of s.hands[player] ?? []) {
    for (const pile of playablePiles(s, card)) {
      const t = tops(s);
      t[pile] = card;
      const missions = s.missions.filter((m) => m.check(t)).map((m) => m.id);
      if (missions.length) moves.push({ cardId: card.id, pile, missions });
    }
  }
  return moves.sort((a, b) => b.missions.length - a.missions.length);
}

export type Move = { cardId: number; pile: number };

/**
 * Coup d'un joueur machine : celui qui réussit le plus de missions, en évitant de bloquer
 * le joueur suivant (ce qui terminerait la partie). Simule chaque coup avec `play`.
 * On joue ensemble : une machine ne défait pas la mission qu'un autre joueur (humain ou machine) a
 * annoncée pouvoir réussir, tant qu'un autre coup lui permet de l'éviter.
 */
export const KEEP_ANNOUNCED_PENALTY = 150;
export function botMove(s: GameState, player: number, rng: Rng = Math.random): Move | null {
  if (s.over || s.current !== player) return null;
  const promised = s.canDo.filter((a) => a.player !== player);
  let best: Move | null = null;
  let bestScore = -Infinity;
  for (const card of s.hands[player]) {
    for (const pile of playablePiles(s, card)) {
      const r = play(s, card.id, pile, rng);
      if (!r.ok) continue;
      let score = (r.state.completed - s.completed) * 100 - (r.state.over && r.state.completed < 50 ? 1000 : 0) + rng();
      for (const a of promised) {
        const still = reachableMissions(r.state, a.player);
        const lost = a.missions.filter((id) => r.state.missions.some((m) => m.id === id) && !still.includes(id));
        score -= lost.length * KEEP_ANNOUNCED_PENALTY;
      }
      if (score > bestScore) { bestScore = score; best = { cardId: card.id, pile }; }
    }
  }
  return best;
}

/** Les machines annoncent « je peux » sur toutes les missions à leur portée (les annonces des autres sont conservées). */
export function syncBotAnnouncements(s: GameState, bots: number[]): GameState {
  const others = s.canDo.filter((a) => !bots.includes(a.player));
  const mine = bots.flatMap((b) => { const missions = reachableMissions(s, b); return missions.length ? [{ player: b, missions }] : []; });
  // Les machines répondent aussi « je ne peux pas » quand elles n'ont rien à annoncer (sauf celle qui va jouer).
  const said = new Set(mine.map((a) => a.player));
  const no = bots.filter((b) => !said.has(b) && b !== s.current);
  const passed = [...s.passed.filter((p) => !bots.includes(p)), ...no].sort((x, y) => x - y);
  return { ...s, canDo: [...others, ...mine].sort((x, y) => x.player - y.player), passed };
}

/** Missions qu'un joueur pourrait réussir d'un seul coup avec sa main actuelle. */
export const reachableMissions = (s: GameState, player: number): string[] => [
  ...new Set(findMissionMoves(s, player).flatMap((m) => m.missions)),
];

const sameTarget = (a: Signal, b: Signal) => a.player === b.player && a.mission === b.mission && a.pile === b.pile;

/** Pose ou retire une phrase du livret. « Bonne carte » et « ne jouez pas » s'excluent pour un même joueur et un même tas. */
export function toggleSignal(prev: GameState, sig: Signal): GameState {
  if (prev.over || sig.player < 0 || sig.player >= prev.players) return prev;
  const valid = sig.kind === 'help'
    ? prev.missions.some((m) => m.id === sig.mission)
    : sig.pile !== undefined && sig.pile >= 0 && sig.pile < prev.piles.length;
  if (!valid) return prev;
  const same = (g: Signal) => g.kind === sig.kind && sameTarget(g, sig);
  const signals = prev.signals.some(same)
    ? prev.signals.filter((g) => !same(g))
    : [...prev.signals.filter((g) => !(g.kind !== 'help' && sig.kind !== 'help' && g.kind !== sig.kind && sameTarget(g, sig))), sig];
  return { ...prev, signals };
}

/** Phrases des machines : « je peux aider » sur les missions à leur portée, « bonne carte » sur les tas où elles réussissent une mission. */
export function syncBotSignals(s: GameState, bots: number[]): GameState {
  const signals: Signal[] = s.signals.filter((g) => !bots.includes(g.player));
  for (const b of bots) {
    for (const mission of reachableMissions(s, b)) signals.push({ player: b, kind: 'help', mission });
    for (const pile of new Set(findMissionMoves(s, b).map((m) => m.pile))) signals.push({ player: b, kind: 'good', pile });
  }
  return { ...s, signals };
}

/** Prochaine médaille à gagner et nombre de missions à réussir pour l'obtenir (null si toutes sont gagnées). */
export function nextMedal(s: GameState): { medal: Medal; missionsNeeded: number } | null {
  const i = s.missionDeck.findIndex((it) => it.kind === 'medal');
  const item = s.missionDeck[i];
  return item && item.kind === 'medal' ? { medal: item.medal, missionsNeeded: i + 1 } : null;
}

/** Missions réussies entre deux états (avec leur place dans la rangée) et nombre total gagné, chaînes comprises. */
export function completedBetween(before: GameState, after: GameState): { done: { def: MissionDef; idx: number }[]; gained: number } {
  return {
    gained: after.completed - before.completed,
    done: before.missions.flatMap((def, idx) => (after.missions.some((m) => m.id === def.id) ? [] : [{ def, idx }])),
  };
}

/**
 * Délai avant qu'une machine joue : la pause choisie, plus un supplément quand une machine vient
 * d'annoncer « je peux », pour laisser le temps de repérer sur quelles missions elle se positionne.
 */
export const botDelayMs = (pauseMs: number, botAnnounced: boolean) => pauseMs + (botAnnounced ? Math.round(pauseMs * 0.6) : 0);
