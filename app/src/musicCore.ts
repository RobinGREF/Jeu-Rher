/**
 * Moteur de musique de fond, 100 % synthétisé par le navigateur (aucun fichier audio, aucune œuvre existante) :
 * chaque morceau est généré de façon déterministe (même graine = même musique) à partir d'une gamme, d'une grille
 * d'accords, d'un tempo et d'un style de batterie. Même fichier dans app/src, solo/src et (compilé) combat/js.
 */
export type Mode = 'major' | 'minor' | 'dorian' | 'mixolydian' | 'phrygian' | 'lydian' | 'pentatonic' | 'harmonicMinor';
export type Drums = 'none' | 'soft' | 'march' | 'rock' | 'waltz' | 'pulse' | 'dance';
export type Voice = 'triangle' | 'square' | 'sawtooth' | 'sine' | 'box';

export type TrackSpec = {
  id: string;
  name: string;
  emoji: string;
  bpm: number;
  /** Note MIDI de la tonique (60 = do central). */
  root: number;
  mode: Mode;
  /** Temps par mesure, en croches : 8 (4/4), 6 (3/4 ou 6/8). */
  meter?: 8 | 6;
  /** Degré d'accord (0 = I, 3 = IV, 4 = V…) pour chacune des 4 premières mesures ; 4 autres mesures reprennent en variant. */
  prog: number[];
  lead: Voice;
  bass: Voice;
  pad?: boolean;
  drums: Drums;
  /** Part des croches qui portent une note de mélodie (0 à 1). */
  density: number;
  seed: number;
  /** Morceau écrit à la main (prioritaire sur la génération). */
  fixed?: Track;
};

export type Ev = { s: number; d: number; m: number; v: 'lead' | 'bass' | 'pad' | 'kick' | 'snare' | 'hat' };
export type Track = { stepSec: number; steps: number; events: Ev[] };

const SCALES: Record<Mode, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  pentatonic: [0, 2, 4, 7, 9],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
};

/** Petit générateur pseudo-aléatoire à graine (mulberry32). */
export function rngFrom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Note MIDI du degré `deg` de la gamme (peut dépasser l'octave, en montant ou en descendant). */
export function degreeToMidi(spec: Pick<TrackSpec, 'root' | 'mode'>, deg: number): number {
  const sc = SCALES[spec.mode];
  const oct = Math.floor(deg / sc.length);
  const i = ((deg % sc.length) + sc.length) % sc.length;
  return spec.root + oct * 12 + sc[i];
}

/** Notes (en degrés) de l'accord posé sur le degré `d` : tierce et quinte de la gamme. */
const chordDegrees = (d: number) => [d, d + 2, d + 4];

/** Construit le morceau : 8 mesures (4 + reprise variée), mélodie, basse, nappe et batterie. */
export function buildTrack(spec: TrackSpec): Track {
  if (spec.fixed) return spec.fixed;
  const per = spec.meter ?? 8;
  const rnd = rngFrom(spec.seed);
  const stepSec = 60 / spec.bpm / 2; // une croche
  const bars = 8;
  const ev: Ev[] = [];
  const prog = [...spec.prog];
  while (prog.length < 4) prog.push(prog[prog.length - 1] ?? 0);
  // 2e moitié : mêmes accords, sauf la dernière mesure qui prépare le retour (dominante) pour que la boucle « tourne ».
  const chordAt = (bar: number) => (bar < 4 ? prog[bar] : bar === 7 ? 4 : prog[bar - 4]);

  // Mélodie : 4 mesures écrites, puis reprise avec une fin différente.
  const strong = per === 8 ? [0, 4] : [0, 3];
  const bar0: Array<{ s: number; deg: number; d: number }[]> = [];
  let last = chordDegrees(chordAt(0))[2] + 7; // on démarre autour de la quinte, une octave au-dessus de la tonique
  for (let b = 0; b < 4; b++) {
    const notes: { s: number; deg: number; d: number }[] = [];
    const chord = chordDegrees(chordAt(b));
    for (let s = 0; s < per; s++) {
      const isStrong = strong.includes(s);
      const play = isStrong ? rnd() < 0.55 + spec.density * 0.45 : rnd() < spec.density * 0.8;
      if (!play) continue;
      let deg: number;
      if (isStrong) {
        // sur les temps forts : une note de l'accord, la plus proche de la précédente
        const cands = [...chord, ...chord.map((x) => x + 7), ...chord.map((x) => x + 14)];
        deg = cands.reduce((best, c) => (Math.abs(c - last) < Math.abs(best - last) ? c : best), cands[0]);
      } else {
        deg = last + (rnd() < 0.5 ? -1 : 1) * (rnd() < 0.7 ? 1 : 2);
      }
      deg = Math.max(2, Math.min(15, deg));
      notes.push({ s, deg, d: rnd() < 0.4 ? 2 : 1 });
      last = deg;
    }
    // dernière mesure de la phrase : tombe sur une note de l'accord
    if (b === 3 && notes.length) notes[notes.length - 1].deg = chord[1] + 7;
    bar0.push(notes);
  }
  for (let b = 0; b < bars; b++) {
    const src = bar0[b % 4];
    const varied = b >= 4 && b === 7;
    for (const n of src) {
      let deg = n.deg;
      if (varied) deg = n.deg + (n.s % 2 === 0 ? 1 : -1); // cadence légèrement différente
      ev.push({ s: b * per + n.s, d: n.d, m: degreeToMidi(spec, deg), v: 'lead' });
    }
  }

  // Basse et nappe
  for (let b = 0; b < bars; b++) {
    const c = chordAt(b);
    const root = degreeToMidi(spec, c - 14);
    const fifth = degreeToMidi(spec, c - 14 + 4);
    const base = b * per;
    if (spec.drums === 'dance' || spec.drums === 'rock') {
      for (let s = 0; s < per; s++) ev.push({ s: base + s, d: 1, m: s % 4 === 3 ? fifth : root, v: 'bass' });
    } else if (per === 6) {
      ev.push({ s: base, d: 3, m: root, v: 'bass' }, { s: base + 3, d: 3, m: fifth, v: 'bass' });
    } else {
      ev.push({ s: base, d: 4, m: root, v: 'bass' }, { s: base + 4, d: 4, m: spec.drums === 'none' ? root : fifth, v: 'bass' });
    }
    if (spec.pad) {
      for (const dg of chordDegrees(c)) ev.push({ s: base, d: per, m: degreeToMidi(spec, dg - 7), v: 'pad' });
    }
  }

  // Batterie
  for (let b = 0; b < bars; b++) {
    const base = b * per;
    const add = (s: number, v: Ev['v']) => ev.push({ s: base + s, d: 1, m: 0, v });
    switch (spec.drums) {
      case 'none': break;
      case 'soft': add(0, 'hat'); if (per === 8) add(4, 'hat'); else add(3, 'hat'); break;
      case 'march': add(0, 'kick'); add(per === 8 ? 4 : 3, 'snare'); for (let s = 1; s < per; s += 2) add(s, 'hat'); break;
      case 'waltz': add(0, 'kick'); add(2, 'hat'); add(4, 'hat'); break;
      case 'pulse': for (let s = 0; s < per; s += 2) add(s, 'kick'); break;
      case 'rock': add(0, 'kick'); add(4 % per, 'snare'); add(5 % per, 'kick'); for (let s = 0; s < per; s++) add(s, 'hat'); break;
      case 'dance': for (let s = 0; s < per; s += 2) add(s, 'kick'); add(per === 8 ? 4 : 3, 'snare'); for (let s = 1; s < per; s += 2) add(s, 'hat'); break;
    }
  }
  return { stepSec, steps: bars * per, events: ev };
}

// ───────────────────────────── lecture (Web Audio) ─────────────────────────────

type Ctx = AudioContext;

function noiseBuffer(ctx: Ctx, secs: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * secs);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  return buf;
}

function envNote(ctx: Ctx, dest: AudioNode, t: number, freq: number, dur: number, type: OscillatorType, vol: number, lowpass?: number) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  if (lowpass) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = lowpass;
    o.connect(f); f.connect(g);
  } else o.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** Joue un événement du morceau à l'instant `t`. */
export function playEvent(ctx: Ctx, dest: AudioNode, spec: Pick<TrackSpec, 'lead' | 'bass'>, e: Ev, t: number, stepSec: number) {
  const dur = Math.max(0.12, e.d * stepSec * 0.95);
  switch (e.v) {
    case 'lead':
      if (spec.lead === 'box') {
        envNote(ctx, dest, t, midiHz(e.m), dur * 1.6, 'sine', 0.5);
        envNote(ctx, dest, t, midiHz(e.m) * 2, dur * 0.7, 'sine', 0.18);
      } else envNote(ctx, dest, t, midiHz(e.m), dur * 1.5, spec.lead as OscillatorType, spec.lead === 'sine' || spec.lead === 'triangle' ? 0.5 : 0.28, spec.lead === 'triangle' || spec.lead === 'sine' ? undefined : 2400);
      break;
    case 'bass': envNote(ctx, dest, t, midiHz(e.m), dur * 1.8, spec.bass === 'box' ? 'sine' : (spec.bass as OscillatorType), 0.75, 600); break;
    case 'pad': envNote(ctx, dest, t, midiHz(e.m), dur, 'sine', 0.16); break;
    case 'kick': {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.2);
      break;
    }
    case 'snare':
    case 'hat': {
      const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx, e.v === 'snare' ? 0.14 : 0.05);
      const f = ctx.createBiquadFilter(); f.type = e.v === 'snare' ? 'bandpass' : 'highpass'; f.frequency.value = e.v === 'snare' ? 1800 : 6000;
      const g = ctx.createGain(); g.gain.value = e.v === 'snare' ? 0.55 : 0.14;
      src.connect(f); f.connect(g); g.connect(dest); src.start(t);
      break;
    }
  }
}

/** Lecteur : un morceau à la fois, en boucle, avec fondu au changement. */
export class MusicPlayer {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private track: Track | null = null;
  private spec: TrackSpec | null = null;
  private idx = 0;
  private loopT = 0;
  private startT = 0;
  constructor(private getCtx: () => Ctx | null, private volume = 0.045) {}

  get current(): TrackSpec | null { return this.spec; }
  get running() { return this.timer !== null; }

  /** Lance (ou change de) morceau ; `null` arrête. Renvoie false si le son n'est pas encore autorisé. */
  play(spec: TrackSpec | null): boolean {
    this.stop();
    if (!spec) return true;
    const ctx = this.getCtx();
    if (!ctx) return false;
    this.ctx = ctx;
    if (!this.master) { this.master = ctx.createGain(); this.master.connect(ctx.destination); }
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(this.volume, ctx.currentTime + 0.4);
    this.spec = spec;
    this.track = buildTrack(spec);
    this.track.events.sort((a, b) => a.s - b.s);
    this.idx = 0; this.loopT = 0;
    this.startT = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 120);
    this.schedule();
    return true;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.ctx && this.master) {
      try { this.master.gain.cancelScheduledValues(this.ctx.currentTime); this.master.gain.setValueAtTime(this.master.gain.value, this.ctx.currentTime); this.master.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.15); } catch { /* contexte fermé */ }
    }
    this.spec = null;
  }

  private schedule() {
    const ctx = this.ctx; const tr = this.track; const spec = this.spec;
    if (!ctx || !tr || !spec || !this.master) return;
    const horizon = ctx.currentTime + 0.6;
    for (let guard = 0; guard < 400; guard++) {
      const e = tr.events[this.idx];
      const t = this.startT + this.loopT + e.s * tr.stepSec;
      if (t > horizon) break;
      if (t >= ctx.currentTime - 0.05) playEvent(ctx, this.master, spec, e, t, tr.stepSec);
      this.idx++;
      if (this.idx >= tr.events.length) { this.idx = 0; this.loopT += tr.steps * tr.stepSec; }
    }
  }
}
