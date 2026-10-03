import { MusicPlayer } from './musicCore';
import { DEFAULT_TRACK_50M, TRACKS_50M } from './tracks';

/** Musique de fond de 50 Missions : un morceau au choix (réglages), synthétisé par le navigateur. */
let ctx: AudioContext | null = null;
const getCtx = () => {
  try {
    const A = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!A) return null;
    ctx ??= new A();
    void ctx.resume();
    return ctx.state === 'running' || ctx.state === 'suspended' ? ctx : null;
  } catch { return null; }
};
const player = new MusicPlayer(getCtx);
let wanted: string | null = null; // morceau demandé (null : silence)
let listening = false;

export const trackById = (id: string | null | undefined) => TRACKS_50M.find((t) => t.id === id) ?? TRACKS_50M.find((t) => t.id === DEFAULT_TRACK_50M)!;

function start() {
  if (!wanted) return;
  const c = getCtx();
  if (!c) return;
  // Le navigateur n'autorise le son qu'après un premier toucher : en attendant, on le guette.
  if (c.state !== 'running') { waitForGesture(); }
  player.play(trackById(wanted));
}

function waitForGesture() {
  if (listening || typeof document === 'undefined') return;
  listening = true;
  const go = () => { document.removeEventListener('pointerdown', go); listening = false; if (wanted) start(); };
  document.addEventListener('pointerdown', go);
}

/** Lance le morceau `id` (ou coupe le son avec `null`). */
export function setMusic(id: string | null) {
  wanted = id;
  if (id) { start(); waitForGesture(); } else player.stop();
}

if (typeof document !== 'undefined') {
  // En arrière-plan, on coupe pour ne pas vider la batterie ni saccader au retour.
  document.addEventListener('visibilitychange', () => {
    if (!wanted) return;
    if (document.hidden) player.stop(); else start();
  });
}
