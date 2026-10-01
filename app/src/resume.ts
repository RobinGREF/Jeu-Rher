import type { GameState } from './engine';
import { fromWire, toWire } from './online/wire';

/** Parties à reprendre : une partie locale (machines / un téléphone) et le dernier salon en ligne. */
export type LocalSave = { mode: 'solo' | 'together'; game: GameState; history: string[]; startedAt: number; at: number };
export type RoomSave = { code: string; at: number };

const LOCAL_KEY = '50m-resume';
const ROOM_KEY = '50m-room';
const MAX_AGE = 3 * 24 * 3600 * 1000; // au-delà de trois jours, on oublie

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const store = (): Store | null => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } };

export function saveLocal(save: Omit<LocalSave, 'at'>, st: Store | null = store(), now = Date.now()) {
  try { st?.setItem(LOCAL_KEY, JSON.stringify({ mode: save.mode, game: toWire(save.game), history: save.history.slice(0, 300), startedAt: save.startedAt, at: now })); } catch { /* sans stockage */ }
}

export function loadLocal(st: Store | null = store(), now = Date.now()): LocalSave | null {
  try {
    const raw = st?.getItem(LOCAL_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw);
    if ((j.mode !== 'solo' && j.mode !== 'together') || typeof j.game !== 'string' || typeof j.at !== 'number' || now - j.at > MAX_AGE) return null;
    const game = fromWire(j.game);
    if (game.over) return null;
    return { mode: j.mode, game, history: Array.isArray(j.history) ? j.history.filter((x: unknown) => typeof x === 'string') : [], startedAt: Number(j.startedAt) || j.at, at: j.at };
  } catch { return null; }
}

export function clearLocal(st: Store | null = store()) { try { st?.removeItem(LOCAL_KEY); } catch { /* sans stockage */ } }

export function saveRoom(code: string, st: Store | null = store(), now = Date.now()) {
  try { st?.setItem(ROOM_KEY, JSON.stringify({ code, at: now })); } catch { /* sans stockage */ }
}

export function loadRoom(st: Store | null = store(), now = Date.now()): RoomSave | null {
  try {
    const raw = st?.getItem(ROOM_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw);
    if (typeof j.code !== 'string' || !/^[A-Z]{4}$/.test(j.code) || typeof j.at !== 'number' || now - j.at > MAX_AGE) return null;
    return { code: j.code, at: j.at };
  } catch { return null; }
}

export function clearRoom(st: Store | null = store()) { try { st?.removeItem(ROOM_KEY); } catch { /* sans stockage */ } }
