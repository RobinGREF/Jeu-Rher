/* FICHIER GÉNÉRÉ depuis app/src/musicCore.ts (moteur de musique commun) — ne pas modifier à la main :
 * cd app && npx esbuild src/musicCore.ts --format=iife --global-name=MusicCore --target=es2019 --outfile=../combat/js/musiccore.js */
"use strict";
var MusicCore = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  var musicCore_exports = {};
  __export(musicCore_exports, {
    MusicPlayer: () => MusicPlayer,
    buildTrack: () => buildTrack,
    degreeToMidi: () => degreeToMidi,
    midiHz: () => midiHz,
    playEvent: () => playEvent,
    rngFrom: () => rngFrom
  });
  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    pentatonic: [0, 2, 4, 7, 9],
    harmonicMinor: [0, 2, 3, 5, 7, 8, 11]
  };
  function rngFrom(seed) {
    let a = seed >>> 0;
    return () => {
      a = a + 1831565813 >>> 0;
      let t = a;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function degreeToMidi(spec, deg) {
    const sc = SCALES[spec.mode];
    const oct = Math.floor(deg / sc.length);
    const i = (deg % sc.length + sc.length) % sc.length;
    return spec.root + oct * 12 + sc[i];
  }
  const chordDegrees = (d) => [d, d + 2, d + 4];
  function buildTrack(spec) {
    var _a, _b;
    if (spec.fixed) return spec.fixed;
    const per = (_a = spec.meter) != null ? _a : 8;
    const rnd = rngFrom(spec.seed);
    const stepSec = 60 / spec.bpm / 2;
    const bars = 8;
    const ev = [];
    const prog = [...spec.prog];
    while (prog.length < 4) prog.push((_b = prog[prog.length - 1]) != null ? _b : 0);
    const chordAt = (bar) => bar < 4 ? prog[bar] : bar === 7 ? 4 : prog[bar - 4];
    const strong = per === 8 ? [0, 4] : [0, 3];
    const bar0 = [];
    let last = chordDegrees(chordAt(0))[2] + 7;
    for (let b = 0; b < 4; b++) {
      const notes = [];
      const chord = chordDegrees(chordAt(b));
      for (let s = 0; s < per; s++) {
        const isStrong = strong.includes(s);
        const play = isStrong ? rnd() < 0.55 + spec.density * 0.45 : rnd() < spec.density * 0.8;
        if (!play) continue;
        let deg;
        if (isStrong) {
          const cands = [...chord, ...chord.map((x) => x + 7), ...chord.map((x) => x + 14)];
          deg = cands.reduce((best, c) => Math.abs(c - last) < Math.abs(best - last) ? c : best, cands[0]);
        } else {
          deg = last + (rnd() < 0.5 ? -1 : 1) * (rnd() < 0.7 ? 1 : 2);
        }
        deg = Math.max(2, Math.min(15, deg));
        notes.push({ s, deg, d: rnd() < 0.4 ? 2 : 1 });
        last = deg;
      }
      if (b === 3 && notes.length) notes[notes.length - 1].deg = chord[1] + 7;
      bar0.push(notes);
    }
    for (let b = 0; b < bars; b++) {
      const src = bar0[b % 4];
      const varied = b >= 4 && b === 7;
      for (const n of src) {
        let deg = n.deg;
        if (varied) deg = n.deg + (n.s % 2 === 0 ? 1 : -1);
        ev.push({ s: b * per + n.s, d: n.d, m: degreeToMidi(spec, deg), v: "lead" });
      }
    }
    for (let b = 0; b < bars; b++) {
      const c = chordAt(b);
      const root = degreeToMidi(spec, c - 14);
      const fifth = degreeToMidi(spec, c - 14 + 4);
      const base = b * per;
      if (spec.drums === "dance" || spec.drums === "rock") {
        for (let s = 0; s < per; s++) ev.push({ s: base + s, d: 1, m: s % 4 === 3 ? fifth : root, v: "bass" });
      } else if (per === 6) {
        ev.push({ s: base, d: 3, m: root, v: "bass" }, { s: base + 3, d: 3, m: fifth, v: "bass" });
      } else {
        ev.push({ s: base, d: 4, m: root, v: "bass" }, { s: base + 4, d: 4, m: spec.drums === "none" ? root : fifth, v: "bass" });
      }
      if (spec.pad) {
        for (const dg of chordDegrees(c)) ev.push({ s: base, d: per, m: degreeToMidi(spec, dg - 7), v: "pad" });
      }
    }
    for (let b = 0; b < bars; b++) {
      const base = b * per;
      const add = (s, v) => ev.push({ s: base + s, d: 1, m: 0, v });
      switch (spec.drums) {
        case "none":
          break;
        case "soft":
          add(0, "hat");
          if (per === 8) add(4, "hat");
          else add(3, "hat");
          break;
        case "march":
          add(0, "kick");
          add(per === 8 ? 4 : 3, "snare");
          for (let s = 1; s < per; s += 2) add(s, "hat");
          break;
        case "waltz":
          add(0, "kick");
          add(2, "hat");
          add(4, "hat");
          break;
        case "pulse":
          for (let s = 0; s < per; s += 2) add(s, "kick");
          break;
        case "rock":
          add(0, "kick");
          add(4 % per, "snare");
          add(5 % per, "kick");
          for (let s = 0; s < per; s++) add(s, "hat");
          break;
        case "dance":
          for (let s = 0; s < per; s += 2) add(s, "kick");
          add(per === 8 ? 4 : 3, "snare");
          for (let s = 1; s < per; s += 2) add(s, "hat");
          break;
      }
    }
    return { stepSec, steps: bars * per, events: ev };
  }
  function noiseBuffer(ctx, secs) {
    const len = Math.floor(ctx.sampleRate * secs);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    return buf;
  }
  function envNote(ctx, dest, t, freq, dur, type, vol, lowpass) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(1e-4, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
    if (lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = lowpass;
      o.connect(f);
      f.connect(g);
    } else o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  function playEvent(ctx, dest, spec, e, t, stepSec) {
    const dur = Math.max(0.12, e.d * stepSec * 0.95);
    switch (e.v) {
      case "lead":
        if (spec.lead === "box") {
          envNote(ctx, dest, t, midiHz(e.m), dur * 1.6, "sine", 0.5);
          envNote(ctx, dest, t, midiHz(e.m) * 2, dur * 0.7, "sine", 0.18);
        } else envNote(ctx, dest, t, midiHz(e.m), dur * 1.5, spec.lead, spec.lead === "sine" || spec.lead === "triangle" ? 0.5 : 0.28, spec.lead === "triangle" || spec.lead === "sine" ? void 0 : 2400);
        break;
      case "bass":
        envNote(ctx, dest, t, midiHz(e.m), dur * 1.8, spec.bass === "box" ? "sine" : spec.bass, 0.75, 600);
        break;
      case "pad":
        envNote(ctx, dest, t, midiHz(e.m), dur, "sine", 0.16);
        break;
      case "kick": {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(150, t);
        o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
        g.gain.setValueAtTime(0.9, t);
        g.gain.exponentialRampToValueAtTime(1e-4, t + 0.16);
        o.connect(g);
        g.connect(dest);
        o.start(t);
        o.stop(t + 0.2);
        break;
      }
      case "snare":
      case "hat": {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer(ctx, e.v === "snare" ? 0.14 : 0.05);
        const f = ctx.createBiquadFilter();
        f.type = e.v === "snare" ? "bandpass" : "highpass";
        f.frequency.value = e.v === "snare" ? 1800 : 6e3;
        const g = ctx.createGain();
        g.gain.value = e.v === "snare" ? 0.55 : 0.14;
        src.connect(f);
        f.connect(g);
        g.connect(dest);
        src.start(t);
        break;
      }
    }
  }
  class MusicPlayer {
    constructor(getCtx, volume = 0.045) {
      __publicField(this, "getCtx", getCtx);
      __publicField(this, "volume", volume);
      __publicField(this, "ctx", null);
      __publicField(this, "master", null);
      __publicField(this, "timer", null);
      __publicField(this, "track", null);
      __publicField(this, "spec", null);
      __publicField(this, "idx", 0);
      __publicField(this, "loopT", 0);
      __publicField(this, "startT", 0);
    }
    get current() {
      return this.spec;
    }
    get running() {
      return this.timer !== null;
    }
    /** Lance (ou change de) morceau ; `null` arrête. Renvoie false si le son n'est pas encore autorisé. */
    play(spec) {
      this.stop();
      if (!spec) return true;
      const ctx = this.getCtx();
      if (!ctx) return false;
      this.ctx = ctx;
      if (!this.master) {
        this.master = ctx.createGain();
        this.master.connect(ctx.destination);
      }
      this.master.gain.cancelScheduledValues(ctx.currentTime);
      this.master.gain.setValueAtTime(1e-4, ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(this.volume, ctx.currentTime + 0.4);
      this.spec = spec;
      this.track = buildTrack(spec);
      this.track.events.sort((a, b) => a.s - b.s);
      this.idx = 0;
      this.loopT = 0;
      this.startT = ctx.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(), 120);
      this.schedule();
      return true;
    }
    stop() {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      if (this.ctx && this.master) {
        try {
          this.master.gain.cancelScheduledValues(this.ctx.currentTime);
          this.master.gain.setValueAtTime(this.master.gain.value, this.ctx.currentTime);
          this.master.gain.linearRampToValueAtTime(1e-4, this.ctx.currentTime + 0.15);
        } catch {
        }
      }
      this.spec = null;
    }
    schedule() {
      const ctx = this.ctx;
      const tr = this.track;
      const spec = this.spec;
      if (!ctx || !tr || !spec || !this.master) return;
      const horizon = ctx.currentTime + 0.6;
      for (let guard = 0; guard < 400; guard++) {
        const e = tr.events[this.idx];
        const t = this.startT + this.loopT + e.s * tr.stepSec;
        if (t > horizon) break;
        if (t >= ctx.currentTime - 0.05) playEvent(ctx, this.master, spec, e, t, tr.stepSec);
        this.idx++;
        if (this.idx >= tr.events.length) {
          this.idx = 0;
          this.loopT += tr.steps * tr.stepSec;
        }
      }
    }
  }
  return __toCommonJS(musicCore_exports);
})();
