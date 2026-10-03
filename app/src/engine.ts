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
  /** Missions réussies par le dernier coup, dans l'ordre (y compris celle piochée puis réussie aussitôt). */
  justDone?: { def: MissionDef; idx: number }[];
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
    (s.justDone ??= []).push({ def: s.missions[idx], idx });
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
    justDone: [],
    canDo: prev.canDo, // revu plus bas : une annonce que ce coup n'a pas touchée reste en place
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

  // Une mission annoncée « réalisable » reste positionnée si ce coup ne l'a pas touchée : elle est toujours sur le tapis
  // et son annonceur peut toujours la réussir d'un seul coup. Sinon, l'annonce tombe et il devra se reprononcer.
  s.canDo = prev.canDo.flatMap((a) => {
    const reach = reachableMissions(s, a.player);
    const missions = a.missions.filter((id) => s.missions.some((m) => m.id === id) && reach.includes(id));
    return missions.length ? [{ player: a.player, missions }] : [];
  });

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
 * Refusée si le joueur ne peut en réussir aucune (sauf `free`, quand le joueur a coupé l'indice). Les missions inconnues sont ignorées.
 */
export function setCanDo(prev: GameState, player: number, missions: string[], free = false): GameState {
  if (prev.over || player < 0 || player >= prev.players) return prev;
  const ids = [...new Set(missions)].filter((id) => prev.missions.some((m) => m.id === id));
  const rest = prev.canDo.filter((a) => a.player !== player);
  if (!ids.length) return { ...prev, canDo: rest };
  if (!free && !canAnnounce(prev, player)) return prev; // `free` : sans l'indice, le jeu ne bloque pas une annonce qui ne serait pas réalisable
  return { ...prev, canDo: [...rest, { player, missions: ids }].sort((x, y) => x.player - y.player), passed: prev.passed.filter((p) => p !== player) };
}

/** « Je ne peux pas réussir de mission » : réponse du joueur pour ce tour (retire son éventuelle annonce). */
export function setPass(prev: GameState, player: number): GameState {
  if (prev.over || player < 0 || player >= prev.players) return prev;
  return { ...prev, canDo: prev.canDo.filter((a) => a.player !== player), passed: prev.passed.includes(player) ? prev.passed : [...prev.passed, player].sort((x, y) => x - y) };
}

/** Joueurs qui n'ont pas encore dit s'ils peuvent ou non réussir une mission. Celui dont c'est le tour n'a pas à répondre : il joue. */
export const unanswered = (s: GameState): number[] =>
  s.over ? [] : Array.from({ length: s.players }, (_, i) => i).filter((i) => i !== s.current && !s.passed.includes(i) && !s.canDo.some((a) => a.player === i));

/**
 * Alerte de blocage : parmi les coups du joueur dont c'est le tour, combien laisseraient le joueur suivant sans aucune carte
 * jouable (= fin de partie) ? Ne dit ni quelles cartes, ni lesquelles du suivant : seulement « n coups sur m ».
 * `null` si aucun coup ne bloque (ou partie finie).
 */
export type BlockRisk = { next: number; fatal: number; total: number };
export function blockRisk(s: GameState): BlockRisk | null {
  if (s.over || s.players < 2) return null;
  const next = (s.current + 1) % s.players;
  let fatal = 0, total = 0;
  for (const card of s.hands[s.current] ?? []) {
    for (const pile of playablePiles(s, card)) {
      const r = play(s, card.id, pile, () => 0.5);
      if (!r.ok) continue;
      total++;
      if (r.state.over && r.state.completed < 50) fatal++;
    }
  }
  return fatal > 0 ? { next, fatal, total } : null;
}

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

export const KEEP_ANNOUNCED_PENALTY = 150;
/** Réglages internes de la machine (servent aux comparaisons de force). */
export const botTuning = { slope: 1.2 };

/** Ancienne machine, gourmande : réussit le plus de missions tout de suite (gardée pour comparer). */
export function botMoveGreedy(s: GameState, player: number, rng: Rng = Math.random): Move | null {
  if (s.over || s.current !== player) return null;
  let best: Move | null = null;
  let bestScore = -Infinity;
  for (const card of s.hands[player]) {
    for (const pile of playablePiles(s, card)) {
      const r = play(s, card.id, pile, rng);
      if (!r.ok) continue;
      const score = (r.state.completed - s.completed) * 100 - (r.state.over && r.state.completed < 50 ? 1000 : 0) + rng();
      if (score > bestScore) { bestScore = score; best = { cardId: card.id, pile }; }
    }
  }
  return best;
}

/** Cartes que la machine ne voit pas : ni sur les tas (jouées), ni dans sa main. Pioche et mains des autres, sans l'ordre. */
export function unseenCards(s: GameState, player: number): Card[] {
  const seen = new Set<number>([...s.piles.flat(), ...(s.hands[player] ?? [])].map((c) => c.id));
  return buildSymbolDeck().filter((c) => !seen.has(c.id));
}

/**
 * Difficulté d'une mission dans le contexte de la partie, de 0 (facile) à 1 (très rare) : chance qu'une combinaison
 * de 4 cartes tirées parmi les cartes encore inconnues la réussisse. Elle bouge au fil de la partie : une famille
 * presque épuisée rend difficiles les missions qui en demandent.
 */
export function missionDifficulty(def: MissionDef, pool: Card[], rng: Rng = Math.random, samples = 300): number {
  if (pool.length < 4) return 1;
  let hits = 0;
  for (let i = 0; i < samples; i++) {
    const pick = new Set<number>();
    while (pick.size < 4) pick.add(Math.floor(rng() * pool.length));
    if (def.check([...pick].map((k) => pool[k]))) hits++;
  }
  return Math.min(1, Math.log((hits + 0.5) / (samples + 0.5)) / Math.log(0.5 / (samples + 0.5)));
}

/**
 * Coup d'un joueur machine, pour réussir ensemble :
 *  - il réussit tout de suite le plus de missions possible ;
 *  - il évite de bloquer le joueur suivant (ce qui terminerait la partie) ;
 *  - il ne défait pas une mission qu'un autre joueur a annoncée pouvoir réussir ;
 *  - il préfère laisser un tapis où les prochains joueurs ont une bonne chance de réussir une mission, en comptant
 *    davantage les missions difficiles (rares dans le contexte de la partie) que les faciles.
 */
export function botMove(s: GameState, player: number, rng: Rng = Math.random): Move | null {
  if (s.over || s.current !== player) return null;
  const promised = s.canDo.filter((a) => a.player !== player);
  const pool = unseenCards(s, player);
  const diff = new Map<string, number>();
  const hard = (m: MissionDef) => { let d = diff.get(m.id); if (d === undefined) { d = missionDifficulty(m, pool, rng); diff.set(m.id, d); } return d; };
  const weight = (m: MissionDef) => Math.max(0.1, 1 + botTuning.slope * (hard(m) - 0.5));
  const others = Math.max(1, s.players - 1);

  /** Chance que ce tapis offre une mission : à la machine (sa main, exacte) et aux autres (cartes inconnues, probabilité). */
  const chance = (after: GameState, m: MissionDef) => {
    const t = tops(after);
    const reach = (card: Card) => playablePiles(after, card).some((i) => { const u = [...t]; u[i] = card; return m.check(u); });
    const own = after.hands[player].some(reach) ? 1 : 0;
    const frac = pool.length ? pool.filter(reach).length / pool.length : 0;
    const theirs = 1 - Math.pow(1 - frac, Math.min(12, 4 * others));
    return 0.6 * theirs + 0.4 * own;
  };

  let best: Move | null = null;
  let bestScore = -Infinity;
  for (const card of s.hands[player]) {
    for (const pile of playablePiles(s, card)) {
      const r = play(s, card.id, pile, rng);
      if (!r.ok) continue;
      let score = (r.state.completed - s.completed) * 100 - (r.state.over && r.state.completed < 50 ? 1000 : 0) + rng();
      score += 4 * r.state.missions.reduce((acc, m) => acc + weight(m) * chance(r.state, m), 0);
      for (const a of promised) {
        const before = reachableMissions(s, a.player);
        const still = reachableMissions(r.state, a.player);
        for (const id of a.missions) {
          const m = s.missions.find((x) => x.id === id);
          if (m && before.includes(id) && r.state.missions.some((x) => x.id === id) && !still.includes(id)) score -= KEEP_ANNOUNCED_PENALTY * (0.7 + 0.6 * hard(m));
        }
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
  // Les machines répondent aussi « je ne peux pas » quand elles n'ont rien à annoncer.
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
  // Le coup sait lui-même ce qu'il a réussi (deux missions d'affilée : la 2e vient d'être piochée, elle n'était pas dans `before`).
  if (after.justDone?.length && after.justDone.length === after.completed - before.completed) {
    return { gained: after.justDone.length, done: after.justDone };
  }
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
