import { MusicPlayer, type TrackSpec } from './musicCore';

/** Musique de fond du jeu en cours : un morceau de sa liste (ou le silence), synthétisé par le navigateur. */
let ctx: AudioContext | null = null;
const getCtx = () => {
  try {
    const A = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!A) return null;
    ctx ??= new A();
    void ctx.resume();
    return ctx;
  } catch { return null; }
};
const player = new MusicPlayer(getCtx);
let wanted: TrackSpec | null = null;
let listening = false;

function start() {
  if (!wanted) return;
  const c = getCtx();
  if (!c) return;
  if (c.state !== 'running') waitForGesture(); // le navigateur n'autorise le son qu'après un premier toucher
  player.play(wanted);
}

function waitForGesture() {
  if (listening || typeof document === 'undefined') return;
  listening = true;
  const go = () => { document.removeEventListener('pointerdown', go); listening = false; if (wanted) start(); };
  document.addEventListener('pointerdown', go);
}

export function setMusic(spec: TrackSpec | null) {
  wanted = spec;
  if (spec) { start(); waitForGesture(); } else player.stop();
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!wanted) return;
    if (document.hidden) player.stop(); else start();
  });
}
