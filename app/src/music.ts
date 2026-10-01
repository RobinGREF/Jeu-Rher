/**
 * Musique de fond : une petite mélodie de marin en ré dorien, composée pour l'appli (pas un morceau existant),
 * jouée par la synthèse du navigateur (aucun fichier audio). Mesure à 6/8 : basse, mélodie, petit tambour.
 */
const STEP = 0.2; // durée d'une croche, en secondes
const MELODY = [
  [62, 0, 65, 69, 0, 65], [67, 0, 69, 74, 0, 69], [64, 0, 67, 72, 0, 67], [62, 65, 69, 74, 0, 0],
  [69, 0, 72, 74, 0, 72], [74, 0, 71, 67, 0, 71], [69, 0, 65, 64, 0, 65], [62, 0, 0, 57, 0, 62],
];
const BASS = [38, 38, 36, 38, 38, 43, 45, 38];
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

type AC = typeof AudioContext;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let next = 0;
let step = 0;
let wanted = false;
let listening = false;

function tone(freq: number, t: number, dur: number, type: OscillatorType, vol: number) {
  const o = ctx!.createOscillator(); const g = ctx!.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master!); o.start(t); o.stop(t + dur + 0.05);
}

function drum(t: number, vol: number, low: boolean) {
  const len = Math.floor(ctx!.sampleRate * 0.12);
  const buf = ctx!.createBuffer(1, len, ctx!.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx!.createBufferSource(); src.buffer = buf;
  const f = ctx!.createBiquadFilter(); f.type = low ? 'lowpass' : 'highpass'; f.frequency.value = low ? 220 : 4000;
  const g = ctx!.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(master!); src.start(t);
}

function schedule() {
  if (!ctx) return;
  while (next < ctx.currentTime + 0.6) {
    const bar = Math.floor(step / 6) % 8; const slot = step % 6;
    const m = MELODY[bar][slot];
    if (m) tone(hz(m), next, STEP * 1.6, 'triangle', 0.5);
    if (slot === 0 || slot === 3) { tone(hz(BASS[bar]), next, STEP * 2.6, 'sine', 0.8); drum(next, 0.9, true); }
    else if (slot % 3 === 1) drum(next, 0.12, false);
    next += STEP; step++;
  }
}

function resumeOnGesture() {
  if (listening || typeof document === 'undefined') return;
  listening = true;
  const go = () => {
    document.removeEventListener('pointerdown', go); listening = false;
    if (wanted) startNow();
  };
  document.addEventListener('pointerdown', go);
}

function startNow() {
  try {
    const A = (globalThis as { AudioContext?: AC; webkitAudioContext?: AC }).AudioContext ?? (globalThis as { webkitAudioContext?: AC }).webkitAudioContext;
    if (!A) return;
    ctx ??= new A();
    if (!master) { master = ctx.createGain(); master.gain.value = 0.045; master.connect(ctx.destination); }
    void ctx.resume();
    if (ctx.state !== 'running') { resumeOnGesture(); }
    if (timer) return;
    next = ctx.currentTime + 0.1;
    timer = setInterval(schedule, 150);
    schedule();
  } catch { /* pas de son */ }
}

/** Lance ou arrête la musique. Le navigateur n'autorise le son qu'après un premier toucher : on attend alors celui-ci. */
export function setMusic(on: boolean) {
  wanted = on;
  if (on) { startNow(); resumeOnGesture(); }
  else {
    if (timer) clearInterval(timer);
    timer = null;
    void ctx?.suspend();
  }
}

if (typeof document !== 'undefined') {
  // En arrière-plan, on coupe pour ne pas vider la batterie ni saccader au retour.
  document.addEventListener('visibilitychange', () => {
    if (!wanted) return;
    if (document.hidden) { if (timer) clearInterval(timer); timer = null; void ctx?.suspend(); } else startNow();
  });
}
