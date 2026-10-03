import { buildMissionDefs, type MissionDef } from '../missions';
import type { Announce, GameState, Signal, MissionDeckItem } from '../engine';
import type { Card, Medal } from '../types';

let defsById: Map<string, MissionDef> | null = null;
/** Les 50 missions, retrouvées par leur identifiant (les fonctions de contrôle ne voyagent pas sur le réseau). */
export const missionById = (id: string): MissionDef => {
  defsById ??= new Map(buildMissionDefs().map((d) => [d.id, d]));
  const d = defsById.get(id);
  if (!d) throw new Error(`mission inconnue : ${id}`);
  return d;
};

type DeckWire = { m: string } | { medal: Medal };

/** État complet du jeu, sérialisable (gardé chez l'hôte pour pouvoir reprendre après un rechargement). */
export function toWire(g: GameState): string {
  return JSON.stringify({
    players: g.players, current: g.current, hands: g.hands, piles: g.piles, symbolDeck: g.symbolDeck,
    missions: g.missions.map((m) => m.id),
    missionDeck: g.missionDeck.map((it): DeckWire => (it.kind === 'mission' ? { m: it.def.id } : { medal: it.medal })),
    canDo: g.canDo, passed: g.passed, signals: g.signals, completed: g.completed, medal: g.medal, goldReached: g.goldReached, over: g.over,
  });
}

export function fromWire(json: string): GameState {
  const w = JSON.parse(json);
  return {
    players: w.players, current: w.current, hands: w.hands, piles: w.piles, symbolDeck: w.symbolDeck,
    missions: (w.missions as string[]).map(missionById),
    missionDeck: (w.missionDeck as DeckWire[]).map((it): MissionDeckItem => ('m' in it ? { kind: 'mission', def: missionById(it.m) } : { kind: 'medal', medal: it.medal })),
    canDo: w.canDo, passed: w.passed ?? [], signals: w.signals as Signal[], completed: w.completed, medal: w.medal, goldReached: w.goldReached, over: w.over,
  };
}

export type SeatInfo = { name: string; bot: boolean; uid?: string };
/** `manual` : chaque machine attend qu'un joueur touche « Laisser jouer » (sinon, elle joue toute seule après la pause). */
export type Options = { pauseMs: number; phrases: boolean; manual: boolean; /** Tour de table : chacun dit s'il peut ou non avant que le joueur ne joue. */ ask?: boolean };

/** Dernier coup joué, pour l'animation de la carte et la fête. */
export type LastWire = {
  n: number; seat: number; card: Card; covered: Card; pile: number; gained: number;
  done: { id: string; idx: number }[]; medal: string | null;
};

/** Ce que tout le monde peut voir : jamais les mains des autres, seulement leur nombre de cartes. */
export type PublicState = {
  v: number;
  seats: SeatInfo[];
  current: number; completed: number; medal: Medal | null; goldReached: boolean; over: boolean;
  missions: string[];
  piles: { top: Card; depth: number }[];
  deckCount: number;
  handCounts: number[];
  /** Fin de partie seulement : les mains de tous, pour voir pourquoi on a perdu. */
  finalHands?: Card[][];
  canDo: Announce[]; signals: Signal[]; passed?: number[];
  /** Joueurs sans carte jouable sur le tapis actuel (calculé par l'hôte, qui connaît toutes les mains). */
  blocked?: number[];
  nextMedal: { medal: Medal; needed: number } | null;
  /** Siège de la machine qui attend le feu vert d'un joueur, sinon null. */
  awaitingGo: number | null;
  /** Demandes de place refusées par l'hôte (identifiants des spectateurs). */
  refused?: string[];
  last: LastWire | null;
  history: string[];
  options: Options;
};

const dummy = (i: number): Card => ({ id: -1000 - i, symbol: 0, value: 0 });

/**
 * Reconstruit un GameState affichable côté joueur : ta vraie main, mais seulement des dos
 * (cartes factices) pour les autres, la pioche et le dessous des tas.
 */
export function buildView(pub: PublicState, hand: Card[], mySeat: number): GameState {
  const missions = pub.missions.map(missionById);
  let k = 0;
  const filler = (n: number) => Array.from({ length: n }, () => dummy(k++));
  const missionDeck: MissionDeckItem[] = pub.nextMedal
    ? [...Array.from({ length: pub.nextMedal.needed - 1 }, (): MissionDeckItem => ({ kind: 'mission', def: missions[0] ?? missionById('m1') })), { kind: 'medal', medal: pub.nextMedal.medal }]
    : [];
  return {
    players: pub.seats.length, current: pub.current,
    hands: pub.handCounts.map((n, i) => (i === mySeat ? hand : pub.over && pub.finalHands?.[i] ? pub.finalHands[i] : filler(n))),
    piles: pub.piles.map((p) => [...filler(p.depth), p.top]),
    symbolDeck: filler(pub.deckCount),
    missions, missionDeck, canDo: pub.canDo, passed: pub.passed ?? [], signals: pub.signals,
    completed: pub.completed, medal: pub.medal, goldReached: pub.goldReached, over: pub.over,
  };
}
