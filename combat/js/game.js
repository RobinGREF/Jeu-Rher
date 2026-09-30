/* RUMBLE FIGHTER — moteur de jeu (canvas 2D, aucune dépendance).
 * Le contenu (personnages, décors) est dans data.js. */
(() => {
'use strict';

const CFG = window.GAME_CONFIG;
const W = 960, H = 540, GROUND = 470, STAGE_L = 50, STAGE_R = 910, GRAV = 0.8;
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
ctx.imageSmoothingQuality = 'high';

/* ---------------------------------------------------------------- utils */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const overlap = (a, b) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;

/* ---------------------------------------------------------------- audio */
let AC = null;
function ensureAudio() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } }
  if (AC && AC.state === 'suspended') AC.resume();
}
function tone(freq, freq2, dur, type, vol) {
  if (!AC) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, AC.currentTime);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, freq2), AC.currentTime + dur);
  g.gain.setValueAtTime(vol, AC.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);
  o.connect(g); g.connect(AC.destination); o.start(); o.stop(AC.currentTime + dur);
}
function noise(dur, vol) {
  if (!AC) return;
  const n = Math.floor(AC.sampleRate * dur), buf = AC.createBuffer(1, n, AC.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = AC.createBufferSource(), g = AC.createGain();
  s.buffer = buf; g.gain.value = vol; s.connect(g); g.connect(AC.destination); s.start();
}
function sfx(t) {
  switch (t) {
    case 'whoosh': noise(0.08, 0.10); break;
    case 'hit': tone(220, 70, 0.12, 'square', 0.14); noise(0.06, 0.16); break;
    case 'heavy': tone(150, 40, 0.22, 'sawtooth', 0.2); noise(0.14, 0.25); break;
    case 'block': tone(500, 300, 0.06, 'triangle', 0.12); break;
    case 'jump': tone(300, 520, 0.09, 'sine', 0.07); break;
    case 'special': tone(200, 900, 0.35, 'sawtooth', 0.14); break;
    case 'thud': tone(90, 40, 0.15, 'sine', 0.2); break;
    case 'ko': tone(300, 40, 0.8, 'sawtooth', 0.22); noise(0.4, 0.2); break;
    case 'menu': tone(600, 800, 0.05, 'square', 0.07); break;
    case 'ok': tone(500, 1000, 0.12, 'square', 0.09); break;
    case 'start': tone(400, 800, 0.25, 'square', 0.12); break;
    case 'ready': tone(1200, 1500, 0.15, 'sine', 0.08); break;
  }
}

/* ---------------------------------------------------------------- attaques */
/* start/active/rec en frames (60/s). Hitbox : rx = décalage devant le
 * personnage, rw = portée, y0..y1 = hauteur au-dessus des pieds.
 * h : 'mid' | 'low' (le coup bas ne se pare que accroupi). */
const ATTACKS = {
  punch:  { start: 4, active: 3, rec: 9,  dmg: 6,  rx: 18, rw: 58, y0: 85, y1: 118, hs: 14, bs: 8,  kb: 3, h: 'mid', sfx: 'whoosh', hitSfx: 'hit' },
  kick:   { start: 8, active: 4, rec: 14, dmg: 10, rx: 15, rw: 84, y0: 40, y1: 88,  hs: 18, bs: 10, kb: 6, h: 'mid', sfx: 'whoosh', hitSfx: 'heavy' },
  cpunch: { start: 5, active: 3, rec: 10, dmg: 5,  rx: 18, rw: 58, y0: 30, y1: 72,  hs: 13, bs: 8,  kb: 3, h: 'mid', sfx: 'whoosh', hitSfx: 'hit' },
  ckick:  { start: 9, active: 4, rec: 20, dmg: 8,  rx: 15, rw: 96, y0: 0,  y1: 26,  hs: 22, bs: 10, kb: 5, h: 'low', launch: 8, sfx: 'whoosh', hitSfx: 'heavy' },
  apunch: { start: 3, active: 9, rec: 4,  dmg: 7,  rx: 8,  rw: 52, y0: 20, y1: 100, hs: 16, bs: 9,  kb: 4, h: 'mid', sfx: 'whoosh', hitSfx: 'hit' },
  akick:  { start: 4, active: 9, rec: 4,  dmg: 9,  rx: 8,  rw: 68, y0: -4, y1: 62,  hs: 18, bs: 10, kb: 5, h: 'mid', sfx: 'whoosh', hitSfx: 'heavy' }
};
const SPECIALS = {
  fireball: { special: true, start: 14, active: 1, rec: 26, fire: true, dmg: 18, hs: 24, bs: 14, kb: 9, h: 'mid', launch: 9, chip: 0.2, sfx: 'special', hitSfx: 'heavy' },
  dash:     { special: true, start: 10, active: 22, rec: 22, dash: 12, dmg: 22, rx: 0, rw: 74, y0: 0, y1: 125, hs: 26, bs: 16, kb: 10, h: 'mid', launch: 10, chip: 0.2, sfx: 'special', hitSfx: 'heavy' },
  uppercut: { special: true, start: 5, active: 14, rec: 28, rise: 15, dmg: 26, rx: 0, rw: 54, y0: 10, y1: 200, hs: 28, bs: 16, kb: 4, h: 'mid', launch: 15, chip: 0.2, sfx: 'special', hitSfx: 'heavy' }
};
const SPECIAL_NAMES = { fireball: 'projectile', dash: 'charge', uppercut: 'coup montant' };

/* ---------------------------------------------------------------- état global */
const keys = {};
let savedDiff = 1;
try { savedDiff = parseInt(localStorage.getItem('rf_diff'), 10); } catch (e) {}
const G = {
  scene: 'title', menuIdx: 0, showControls: false, mode: 1, difficulty: (savedDiff >= 0 && savedDiff < CFG.difficulties.length) ? savedDiff : 1,
  sel: { cursor: 0, step: 0 }, picks: [0, 1], stageCursor: 0, stageIdx: 0,
  match: null, clickables: [], hover: null, t: 0, mouse: { x: -1, y: -1 }
};

/* ---------------------------------------------------------------- combattants */
function makeFighter(side, ch, cpu) {
  return {
    side, ch, cpu, x: side === 0 ? 330 : 630, y: 0, vx: 0, vy: 0, face: side === 0 ? 1 : -1,
    hp: ch.hp, hpTrail: ch.hp, gauge: 0, state: 'idle', stateT: 0, stun: 0, atk: null,
    launched: false, blockCrouch: false, holdBack: false, combo: 0, wins: 0,
    inp: { left: false, right: false, up: false, down: false },
    buf: { punch: 0, kick: 0, special: 0 }, anim: 0, walkPh: 0, flash: 0,
    ai: { t: 0, plan: 'wait', d: 0 }
  };
}
function S(f, s) { if (f.state !== s) { f.state = s; f.stateT = 0; } }
function isCrouching(f) {
  return f.state === 'crouch' || (f.state === 'attack' && f.atk.name[0] === 'c' && !f.atk.def.special) ||
    (f.state === 'block' && f.blockCrouch);
}
function hurtbox(f) {
  return { x1: f.x - 22, x2: f.x + 22, y1: f.y, y2: f.y + (isCrouching(f) ? 80 : 135) };
}

function resetRound() {
  const m = G.match;
  const [a, b] = m.f;
  for (const f of m.f) {
    const ch = f.ch;
    f.hp = ch.hp; f.hpTrail = ch.hp; f.y = 0; f.vx = f.vy = 0; f.state = 'idle'; f.stateT = 0;
    f.atk = null; f.launched = false; f.combo = 0; f.flash = 0; f.stun = 0;
    f.buf = { punch: 0, kick: 0, special: 0 };
    f.inp = { left: false, right: false, up: false, down: false };
  }
  a.x = 330; b.x = 630; a.face = 1; b.face = -1;
  m.proj = []; m.sparks = []; m.timer = CFG.roundTime; m.tick = 0;
  m.phase = 'intro'; m.phaseT = 0; m.hitstop = 0; m.shake = 0; m.slow = 0; m.banner = '';
}
function startMatch() {
  const chars = CFG.characters;
  const f = [makeFighter(0, chars[G.picks[0]], false), makeFighter(1, chars[G.picks[1]], G.mode === 1)];
  G.match = { f, round: 1, proj: [], sparks: [], texts: [], paused: false, winner: -1, stage: CFG.stages[G.stageIdx], roundMsg: '' };
  resetRound();
  G.scene = 'fight';
  sfx('start');
}

/* ---------------------------------------------------------------- entrées */
const P1_KEYS = { punch: ['KeyJ'], kick: ['KeyK'], special: ['KeyL'] };
const P2_KEYS = { punch: ['KeyF'], kick: ['KeyG'], special: ['KeyH'] };
function keyMapFor(i) {
  if (G.mode === 1) return i === 0
    ? { punch: ['KeyJ', 'KeyF'], kick: ['KeyK', 'KeyG'], special: ['KeyL', 'KeyH'] } : null;
  return i === 0 ? P1_KEYS : P2_KEYS;
}
function humanInput(i) {
  const K = keys, one = G.mode === 1;
  if (i === 0) return {
    left: !!(K.ArrowLeft || (one && K.KeyA)), right: !!(K.ArrowRight || (one && K.KeyD)),
    up: !!(K.ArrowUp || (one && K.KeyW)), down: !!(K.ArrowDown || (one && K.KeyS))
  };
  return { left: !!K.KeyA, right: !!K.KeyD, up: !!K.KeyW, down: !!K.KeyS };
}

/* ---------------------------------------------------------------- combat */
function startAttack(f, name) {
  const def = name === 'special' ? SPECIALS[f.ch.special.type] : ATTACKS[name];
  f.atk = { name, def, t: 0, hit: false };
  S(f, 'attack');
  if (f.y <= 0 && !(def.dash)) f.vx = 0;
  if (def.sfx && !def.special) sfx(def.sfx);
  if (def.special) sfx('special');
}

function freeAct(f, o) {
  const inp = f.inp, c = f.ch, air = f.y > 0;
  const spd = c.speed * (f.cpu ? curDiff().speed : 1);
  if (!air) f.face = o.x >= f.x ? 1 : -1;
  if (f.buf.special > 0 && f.gauge >= 100 && !air) {
    f.gauge = 0; f.buf.special = 0; f.buf.punch = f.buf.kick = 0;
    startAttack(f, 'special'); return;
  }
  if (f.buf.punch > 0 || f.buf.kick > 0) {
    const kind = (f.buf.kick > 0 && f.buf.kick >= f.buf.punch) ? 'kick' : 'punch';
    f.buf.punch = f.buf.kick = 0;
    startAttack(f, air ? 'a' + kind : inp.down ? 'c' + kind : kind); return;
  }
  if (air) { S(f, 'jump'); return; }
  if (inp.up) {
    f.vy = c.jump; f.vx = (inp.right ? 1 : inp.left ? -1 : 0) * spd * 1.15;
    S(f, 'jump'); sfx('jump'); return;
  }
  if (inp.down) { S(f, 'crouch'); f.vx = 0; return; }
  const dir = inp.right ? 1 : inp.left ? -1 : 0;
  f.vx = dir * spd; S(f, dir ? 'walk' : 'idle');
}

function hitboxOf(f, d) {
  const x1 = f.face > 0 ? f.x + d.rx : f.x - d.rx - d.rw;
  return { x1, x2: x1 + d.rw, y1: f.y + d.y0, y2: f.y + d.y1 };
}

function updateAttack(f, o) {
  const a = f.atk, d = a.def, air = f.y > 0;
  a.t++;
  const active = a.t >= d.start && a.t < d.start + d.active;
  if (a.t === d.start) {
    if (d.fire) spawnProj(f, d);
    if (d.rise) f.vy = d.rise;
  }
  if (d.dash && active) f.vx = f.face * d.dash;
  else if (!air && f.y <= 0) f.vx = 0;
  if (active && !a.hit && d.rw && o.hp > 0 && o.state !== 'ko' && o.state !== 'down') {
    if (overlap(hitboxOf(f, d), hurtbox(o))) { a.hit = true; resolveHit(f, o, d, f.x); }
  }
  if (a.t >= d.start + d.active + d.rec) {
    f.atk = null; S(f, f.y > 0 ? 'jump' : 'idle');
  }
}

function spawnProj(f, d) {
  G.match.proj.push({ x: f.x + f.face * 50, y: f.y + 72, vx: f.face * 9, owner: f, d, life: 200, t: 0 });
}

function resolveHit(owner, def, d, srcX) {
  const m = G.match;
  if (def.hp <= 0) return;
  const dirAway = srcX <= def.x ? 1 : -1;
  const inBlockState = def.state === 'idle' || def.state === 'walk' || def.state === 'crouch' || def.state === 'block';
  const lowOk = d.h !== 'low' || def.inp.down;
  const canBlock = def.y <= 0 && inBlockState && def.holdBack && lowOk;
  const cy = clamp(def.y + (d.y0 !== undefined ? (d.y0 + d.y1) / 2 : 70), def.y + 20, def.y + 120);
  const sx = (srcX + def.x) / 2;
  const atWall = def.x <= STAGE_L + 2 || def.x >= STAGE_R - 2;

  if (canBlock) {
    S(def, 'block'); def.stun = d.bs; def.blockCrouch = !!def.inp.down; def.atk = null;
    def.vx = dirAway * d.kb * 0.9;
    if (d.chip) def.hp = Math.max(1, def.hp - Math.round(d.dmg * d.chip * owner.ch.power));
    def.gauge = Math.min(100, def.gauge + 3);
    if (!d.special) owner.gauge = Math.min(100, owner.gauge + 2);
    m.sparks.push({ x: sx, y: def.y + cy - def.y, t: 0, kind: 'block' });
    m.hitstop = 3; sfx('block');
    if (atWall) owner.x -= dirAway * d.kb * 1.2;
    return;
  }

  owner.combo = def.state === 'hit' ? owner.combo + 1 : 1;
  const scale = Math.max(0.4, 1 - 0.12 * (owner.combo - 1));
  const dmg = Math.max(1, Math.round(d.dmg * owner.ch.power * scale));
  def.hp = Math.max(0, def.hp - dmg);
  S(def, 'hit'); def.atk = null; def.stun = d.hs; def.vx = dirAway * d.kb; def.flash = 6;
  if (d.launch || def.y > 0) { def.vy = d.launch || 6; def.launched = true; }
  if (def.hp <= 0) { def.launched = true; def.vy = Math.max(def.vy, 11); def.vx = dirAway * 7; }
  if (!d.special) owner.gauge = Math.min(100, owner.gauge + dmg * 1.2 + 2);
  def.gauge = Math.min(100, def.gauge + dmg * 0.7);
  m.sparks.push({ x: sx, y: cy, t: 0, kind: d.special ? 'big' : 'hit' });
  m.hitstop = d.special ? 9 : (def.hp <= 0 ? 24 : 4);
  m.shake = d.special ? 12 : def.hp <= 0 ? 14 : 4;
  sfx(d.hitSfx || 'hit');
  if (atWall) owner.x -= dirAway * d.kb * 1.2;
  if (owner.combo >= 2) m.texts.push({ side: owner.side, kind: 'combo', n: owner.combo, t: 0 });
}

function land(f) {
  if (f.state === 'jump') { S(f, 'idle'); f.vx = 0; }
  else if (f.state === 'hit' && f.launched) {
    f.launched = false; f.vx = 0; sfx('thud'); G.match.shake = Math.max(G.match.shake, 5);
    if (f.hp <= 0) S(f, 'ko'); else { S(f, 'down'); f.stun = 42; }
  }
  else if (f.state === 'attack' && !(f.atk && f.atk.def.dash)) f.vx = 0;
}

function updateFighter(f, o) {
  f.anim++; f.stateT++;
  if (f.flash > 0) f.flash--;
  for (const k of ['punch', 'kick', 'special']) if (f.buf[k] > 0) f.buf[k]--;
  f.holdBack = (f.face === 1 && f.inp.left) || (f.face === -1 && f.inp.right);
  switch (f.state) {
    case 'idle': case 'walk': case 'crouch': case 'jump': freeAct(f, o); break;
    case 'attack': updateAttack(f, o); break;
    case 'hit':
      if (!f.launched && --f.stun <= 0) S(f, 'idle');
      break;
    case 'block':
      if (--f.stun <= 0) S(f, 'idle');
      break;
    case 'down':
      if (--f.stun <= 0) S(f, 'idle');
      break;
  }
  // physique
  if (f.y > 0 || f.vy !== 0) {
    f.vy -= GRAV; f.y += f.vy;
    if (f.y <= 0) { f.y = 0; f.vy = 0; land(f); }
  }
  if (f.state === 'hit' || f.state === 'block') f.vx *= f.y > 0 ? 0.98 : 0.84;
  if (f.state === 'down' || f.state === 'ko') f.vx *= 0.8;
  f.x += f.vx;
  f.x = clamp(f.x, STAGE_L, STAGE_R);
  if (f.state === 'walk') f.walkPh += f.vx * f.face * 0.09;
}

function separate(a, b) {
  const solid = f => f.state !== 'ko' && f.state !== 'down';
  if (!solid(a) || !solid(b) || Math.abs(a.y - b.y) > 90) return;
  const dx = b.x - a.x, min = 42;
  if (Math.abs(dx) >= min) return;
  const dir = dx === 0 ? (a.face || 1) : Math.sign(dx);
  const push = (min - Math.abs(dx)) / 2;
  a.x -= dir * push; b.x += dir * push;
  for (const f of [a, b]) {
    if (f.x < STAGE_L) { const e = STAGE_L - f.x; f.x = STAGE_L; (f === a ? b : a).x += e; }
    if (f.x > STAGE_R) { const e = f.x - STAGE_R; f.x = STAGE_R; (f === a ? b : a).x -= e; }
  }
}

function updateProjectiles() {
  const m = G.match;
  for (const p of m.proj) {
    p.x += p.vx; p.t++; p.life--;
    if (p.x < -40 || p.x > W + 40 || p.life <= 0) { p.dead = true; continue; }
    const o = m.f[1 - p.owner.side];
    const box = { x1: p.x - 20, x2: p.x + 20, y1: p.y - 16, y2: p.y + 16 };
    if (o.state !== 'ko' && o.state !== 'down' && o.hp > 0 && overlap(box, hurtbox(o))) {
      p.dead = true; resolveHit(p.owner, o, p.d, p.x - p.vx * 3);
    }
  }
  for (let i = 0; i < m.proj.length; i++) for (let j = i + 1; j < m.proj.length; j++) {
    const a = m.proj[i], b = m.proj[j];
    if (a.owner !== b.owner && !a.dead && !b.dead && Math.abs(a.x - b.x) < 34 && Math.abs(a.y - b.y) < 30) {
      a.dead = b.dead = true; m.sparks.push({ x: (a.x + b.x) / 2, y: a.y, t: 0, kind: 'big' }); sfx('block');
    }
  }
  m.proj = m.proj.filter(p => !p.dead);
}

/* ---------------------------------------------------------------- IA */
function curDiff() { return CFG.difficulties[G.difficulty] || CFG.difficulties[0]; }
function aiThink(f, o) {
  const D = curDiff();
  const ai = f.ai, inp = f.inp;
  inp.left = inp.right = inp.up = inp.down = false;
  const dx = o.x - f.x, dist = Math.abs(dx);
  const toward = dx > 0 ? 'right' : 'left', away = dx > 0 ? 'left' : 'right';
  if (--ai.t <= 0) {
    const r = Math.random();
    const threat = (o.state === 'attack' && dist < 170) || G.match.proj.some(p => p.owner !== f && Math.abs(p.x - f.x) < 220);
    ai.d = 0;
    if (threat && r < D.block) { ai.plan = 'block'; ai.t = 18; ai.low = Math.random() < 0.3; }
    else if (f.gauge >= 100 && f.y <= 0 && ((f.ch.special.type === 'fireball' && dist > 200 && Math.random() < D.special) || (f.ch.special.type !== 'fireball' && dist < 260 && dist > 90 && Math.random() < D.special))) { ai.plan = 'special'; ai.t = 20; }
    else if (dist > 260) { ai.plan = r < 0.7 ? 'approach' : r < 0.85 ? 'jumpin' : 'wait'; ai.t = 14 + rand(0, 14); }
    else if (dist > 120) { ai.plan = r < 0.5 ? 'approach' : r < 0.7 ? 'kick' : r < 0.82 ? 'jumpin' : r < 0.9 ? 'ckick' : 'wait'; ai.t = 8 + rand(0, 10); }
    else { ai.plan = r < 0.28 ? 'punch' : r < 0.5 ? 'kick' : r < 0.6 ? 'cpunch' : r < 0.68 ? 'ckick' : r < 0.8 ? 'retreat' : r < 0.9 ? 'block' : 'jumpin'; ai.t = 8 + rand(0, 12); ai.low = false; }
    if (['punch', 'kick', 'cpunch', 'ckick'].includes(ai.plan) && Math.random() > D.aggr) ai.plan = 'wait';
    ai.t = Math.ceil(ai.t * D.react);
    ai.fired = false;
  }
  const press = k => { if (!ai.fired) { f.buf[k] = 6; ai.fired = true; } };
  switch (ai.plan) {
    case 'approach': inp[toward] = true; break;
    case 'retreat': inp[away] = true; break;
    case 'block': inp[away] = true; inp.down = !!ai.low; break;
    case 'jumpin': if (f.y <= 0 && !ai.fired) { inp.up = true; inp[toward] = true; ai.fired = true; } else if (f.y > 0) { inp[toward] = true; if (dist < 110 && f.state === 'jump') { press('kick'); ai.fired = false; } } break;
    case 'punch': if (dist > 90) inp[toward] = true; press('punch'); break;
    case 'kick': if (dist > 110) inp[toward] = true; press('kick'); break;
    case 'cpunch': inp.down = true; press('punch'); break;
    case 'ckick': inp.down = true; if (dist > 100) inp.down = false, inp[toward] = true; press('kick'); break;
    case 'special': press('special'); break;
  }
}

/* ---------------------------------------------------------------- boucle de match */
function endRound() {
  const m = G.match, [a, b] = m.f;
  m.phase = 'end'; m.phaseT = 0;
  let win = -1;
  if (a.hp <= 0 && b.hp > 0) win = 1; else if (b.hp <= 0 && a.hp > 0) win = 0;
  else if (a.hp / a.ch.hp !== b.hp / b.ch.hp && m.timer <= 0) win = a.hp / a.ch.hp > b.hp / b.ch.hp ? 0 : 1;
  m.roundWin = win;
  if (win === -1) { a.wins++; b.wins++; m.banner = 'MATCH NUL'; }
  else { m.f[win].wins++; m.banner = (a.hp <= 0 || b.hp <= 0) ? 'K.O.' : 'TEMPS ÉCOULÉ'; }
  if (a.hp <= 0 || b.hp <= 0) { m.slow = 70; sfx('ko'); }
}

function updateFight() {
  const m = G.match;
  if (m.paused) return;
  const [a, b] = m.f;
  for (const f of m.f) f.hpTrail = f.hpTrail > f.hp ? Math.max(f.hp, f.hpTrail - 0.35) : f.hp;
  updateFx();
  if (m.hitstop > 0) { m.hitstop--; return; }
  if (m.slow > 0) { m.slow--; if (m.slow % 2) return; }
  m.phaseT++;

  if (m.phase === 'intro') {
    a.anim++; b.anim++;
    if (m.phaseT === 60) sfx('ready');
    if (m.phaseT >= 110) { m.phase = 'play'; m.phaseT = 0; sfx('start'); }
    return;
  }
  for (let i = 0; i < 2; i++) {
    const f = m.f[i], o = m.f[1 - i];
    if (m.phase !== 'play') { f.inp = { left: false, right: false, up: false, down: false }; f.buf = { punch: 0, kick: 0, special: 0 }; }
    else if (f.cpu) aiThink(f, o);
    else f.inp = humanInput(i);
  }
  updateFighter(a, b); updateFighter(b, a);
  separate(a, b);
  updateProjectiles();
  for (const f of m.f) if (m.f[1 - f.side].state !== 'hit') f.combo = 0;

  if (m.phase === 'play') {
    if (++m.tick % 60 === 0) m.timer--;
    if (a.hp <= 0 || b.hp <= 0 || m.timer <= 0) endRound();
  } else if (m.phase === 'end') {
    if (m.phaseT > 45 && m.roundWin >= 0) {
      const w = m.f[m.roundWin];
      if (w.hp > 0 && w.y <= 0 && (w.state === 'idle' || w.state === 'walk' || w.state === 'crouch')) { S(w, 'win'); w.vx = 0; }
    }
    if (m.phaseT > 170) {
      const need = CFG.roundsToWin;
      if (a.wins >= need || b.wins >= need) {
        m.phase = 'match'; m.phaseT = 0;
        m.winner = a.wins === b.wins ? -1 : a.wins > b.wins ? 0 : 1;
        if (m.winner >= 0) S(m.f[m.winner], 'win');
      } else { m.round++; resetRound(); }
    }
  } else if (m.phase === 'match') {
    /* attente d'un choix du joueur */
  }
}

function updateFx() {
  const m = G.match;
  for (const s of m.sparks) s.t++;
  m.sparks = m.sparks.filter(s => s.t < 14);
  for (const t of m.texts) t.t++;
  m.texts = m.texts.filter(t => t.t < 70);
  if (m.shake > 0) m.shake *= 0.85;
}

/* ---------------------------------------------------------------- décors */
const stageCache = new Map();
function drawLayer(g, L, rnd) {
  const base = L.y || GROUND;
  g.fillStyle = L.color;
  if (L.type === 'mountains') {
    const p1 = rnd() * 6, p2 = rnd() * 6;
    g.beginPath(); g.moveTo(0, base);
    for (let x = 0; x <= W; x += 8) g.lineTo(x, base - L.h * (0.55 + 0.3 * Math.sin(x * 0.006 + p1) + 0.15 * Math.sin(x * 0.017 + p2)));
    g.lineTo(W, base); g.closePath(); g.fill();
  } else if (L.type === 'buildings') {
    let x = -10;
    while (x < W) {
      const w = 50 + rnd() * 70, h = L.h * (0.4 + rnd() * 0.6);
      g.fillStyle = L.color; g.fillRect(x, base - h, w, h);
      if (L.windows) for (let wy = base - h + 12; wy < base - 20; wy += 18) for (let wx = x + 8; wx < x + w - 10; wx += 16) {
        if (rnd() < 0.38) { g.fillStyle = L.windows[Math.floor(rnd() * L.windows.length)]; g.globalAlpha = 0.85; g.fillRect(wx, wy, 8, 10); g.globalAlpha = 1; }
      }
      x += w + rnd() * 6;
    }
  } else if (L.type === 'trees') {
    for (let i = 0; i < (L.count || 12); i++) {
      const x = rnd() * W, h = L.h * (0.6 + rnd() * 0.4);
      g.fillStyle = L.color; g.fillRect(x - 4, base - h * 0.25, 8, h * 0.25);
      for (let k = 0; k < 3; k++) {
        const w = 44 - k * 10, top = base - h * 0.25 - h * 0.28 * (k + 1) - 8;
        g.beginPath(); g.moveTo(x - w, top + h * 0.34); g.lineTo(x, top); g.lineTo(x + w, top + h * 0.34); g.closePath(); g.fill();
      }
    }
  } else if (L.type === 'pillars') {
    for (let x = 30; x < W; x += 190) {
      g.fillStyle = L.color; g.fillRect(x, base - L.h, 56, L.h);
      g.fillRect(x - 10, base - L.h - 14, 76, 16); g.fillRect(x - 8, base - 12, 72, 12);
      g.fillStyle = 'rgba(0,0,0,0.12)';
      for (let k = 1; k < 5; k++) g.fillRect(x + k * 11, base - L.h + 4, 3, L.h - 16);
    }
  }
}
function buildStage(s) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), rnd = mulberry(s.seed || 1);
  if (s.image) {
    if (!s._img) { s._img = new Image(); s._img.onload = () => stageCache.delete(s); s._img.src = s.image; }
    if (s._img.complete && s._img.naturalWidth) { g.drawImage(s._img, 0, 0, W, H); return drawGround(g, s, c, true); }
  }
  const sky = s.sky || ['#222', '#444'];
  const gr = g.createLinearGradient(0, 0, 0, GROUND);
  sky.forEach((col, i) => gr.addColorStop(sky.length === 1 ? 0 : i / (sky.length - 1), col));
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  if (s.stars) for (let i = 0; i < 130; i++) {
    g.fillStyle = 'rgba(255,255,255,' + (0.25 + rnd() * 0.75) + ')';
    g.fillRect(rnd() * W, rnd() * GROUND * 0.7, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
  }
  if (s.sun) {
    const sg = g.createRadialGradient(s.sun.x, s.sun.y, s.sun.r * 0.5, s.sun.x, s.sun.y, s.sun.r * 3);
    sg.addColorStop(0, s.sun.glow || 'rgba(255,255,255,0.4)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sg; g.fillRect(0, 0, W, H);
    g.fillStyle = s.sun.color; g.beginPath(); g.arc(s.sun.x, s.sun.y, s.sun.r, 0, Math.PI * 2); g.fill();
  }
  (s.layers || []).forEach(L => drawLayer(g, L, rnd));
  return drawGround(g, s, c, false);
}
function drawGround(g, s, c) {
  const gd = s.ground || { colors: ['#555', '#222'], line: 'rgba(255,255,255,0.2)' };
  const gg = g.createLinearGradient(0, GROUND, 0, H);
  gg.addColorStop(0, gd.colors[0]); gg.addColorStop(1, gd.colors[1]);
  g.fillStyle = gg; g.fillRect(0, GROUND, W, H - GROUND);
  g.strokeStyle = gd.line; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, GROUND); g.lineTo(W, GROUND); g.stroke();
  g.lineWidth = 1;
  for (let i = -6; i <= 18; i++) { g.beginPath(); g.moveTo(i * W / 12, GROUND); g.lineTo(W / 2 + (i - 6) * W / 5, H); g.stroke(); }
  for (let k = 1; k < 5; k++) { const y = GROUND + (H - GROUND) * (k * k) / 16; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  return c;
}
function stageCanvas(s) {
  let c = stageCache.get(s);
  if (!c) { c = buildStage(s); stageCache.set(s, c); }
  return c;
}
function drawStage(s, t, tx, ty, sc) {
  ctx.save();
  if (tx !== undefined) { ctx.translate(tx, ty); ctx.scale(sc, sc); }
  ctx.drawImage(stageCanvas(s), 0, 0);
  if (s.clouds) {
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    for (let i = 0; i < 6; i++) {
      const x = ((i * 220 + t * (0.15 + i * 0.03)) % (W + 300)) - 150, y = 60 + (i * 47) % 160;
      ctx.beginPath(); ctx.ellipse(x, y, 90, 18, 0, 0, 7); ctx.ellipse(x + 40, y - 12, 60, 16, 0, 0, 7); ctx.fill();
    }
  }
  if (s.embers) for (let i = 0; i < 30; i++) {
    const x = (i * 97 + Math.sin(t * 0.02 + i) * 30) % W, y = GROUND - ((t * (0.6 + (i % 5) * 0.25) + i * 53) % 420);
    ctx.fillStyle = `rgba(255,${120 + (i % 4) * 30},40,${0.7 - (GROUND - y) / 700})`;
    ctx.fillRect(x, y, 3, 3);
  }
  ctx.restore();
}

/* ---------------------------------------------------------------- dessin des combattants */
function limb(a, k, e, w, col) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(k.x, k.y); ctx.lineTo(e.x, e.y);
  ctx.strokeStyle = '#141414'; ctx.lineWidth = w + 4; ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
}
function ik(a, b, l1, l2, dir) {
  let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
  const maxd = l1 + l2 - 0.5;
  let end = b;
  if (d > maxd) { dx *= maxd / d; dy *= maxd / d; d = maxd; end = { x: a.x + dx, y: a.y + dy }; }
  if (d < 1) d = 1;
  const ang = Math.atan2(dy, dx);
  const A = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  return { k: { x: a.x + Math.cos(ang + dir * A) * l1, y: a.y + Math.sin(ang + dir * A) * l1 }, e: end };
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp((n >> 16) + amt, 0, 255), g = clamp(((n >> 8) & 255) + amt, 0, 255), b = clamp((n & 255) + amt, 0, 255);
  return `rgb(${r},${g},${b})`;
}

function poseOf(f) {
  const st = f.state, t = f.anim;
  const P = { hipY: -62, lean: 0, bf: { x: -16, y: 0 }, ff: { x: 16, y: 0 }, fF: { x: 24, y: 8 }, fB: { x: 16, y: 14 }, rot: 0, headDx: 0 };
  const crouch = isCrouching(f);
  if (crouch) { P.hipY = -34; P.bf = { x: -22, y: 0 }; P.ff = { x: 24, y: 0 }; }
  else if (st === 'idle') P.hipY += Math.sin(t * 0.12) * 2;
  if (st === 'walk') {
    const p = f.walkPh;
    P.ff = { x: 16 + Math.sin(p) * 20, y: -Math.max(0, Math.cos(p)) * 10 };
    P.bf = { x: -16 - Math.sin(p) * 20, y: -Math.max(0, -Math.cos(p)) * 10 };
    P.hipY += Math.abs(Math.sin(p)) * -2;
  }
  if (f.y > 0.5 && st !== 'attack' && st !== 'hit') {
    P.hipY = -64; P.bf = { x: -14, y: -18 }; P.ff = { x: 16, y: -30 };
    P.fF = { x: 22, y: 0 }; P.fB = { x: 14, y: 8 };
  }
  if (st === 'attack') {
    const a = f.atk, d = a.def;
    const ext = a.t < d.start ? a.t / d.start : a.t < d.start + d.active ? 1 : Math.max(0, 1 - (a.t - d.start - d.active) / d.rec);
    switch (d.special ? f.ch.special.type : a.name) {
      case 'punch': P.fF = { x: 8 + ext * 54, y: 8 }; P.lean = ext * 8; break;
      case 'cpunch': P.fF = { x: 6 + ext * 52, y: 10 }; P.lean = ext * 6; break;
      case 'kick': P.ff = { x: 20 + ext * 58, y: -24 - ext * 38 }; P.lean = -ext * 10; break;
      case 'ckick': P.ff = { x: 20 + ext * 70, y: -8 }; P.lean = -ext * 4; P.bf = { x: -26, y: 0 }; break;
      case 'apunch': P.fF = { x: 8 + ext * 48, y: 18 + ext * 10 }; P.bf = { x: -14, y: -16 }; P.ff = { x: 16, y: -26 }; P.hipY = -64; break;
      case 'akick': P.ff = { x: 22 + ext * 46, y: -8 - (1 - ext) * 30 }; P.bf = { x: -14, y: -22 }; P.hipY = -64; P.lean = -ext * 6; break;
      case 'fireball': P.hipY = -52; P.bf = { x: -26, y: 0 }; P.ff = { x: 26, y: 0 }; P.fF = { x: 6 + ext * 48, y: 10 }; P.fB = { x: 2 + ext * 40, y: 12 }; P.lean = ext * 6; break;
      case 'dash': P.hipY = -54; P.lean = 26; P.bf = { x: -36, y: -8 }; P.ff = { x: 34, y: -4 }; P.fF = { x: 40, y: 10 }; P.fB = { x: 20, y: 16 }; break;
      case 'uppercut':
        P.fF = { x: 10, y: -8 - 52 * ext }; P.lean = 4;
        if (f.y > 2) { P.bf = { x: -10, y: -22 }; P.ff = { x: 14, y: -30 }; P.hipY = -60; } else { P.hipY = -46; P.bf = { x: -22, y: 0 }; P.ff = { x: 22, y: 0 }; }
        break;
    }
  } else if (st === 'hit') {
    P.lean = -14; P.fF = { x: -12, y: 18 }; P.fB = { x: -22, y: 8 }; P.headDx = -5;
    if (f.launched) { P.rot = Math.min(1, f.stateT / 6) * 1.2; P.bf = { x: -16, y: -14 }; P.ff = { x: 14, y: -22 }; P.hipY = -60; }
  } else if (st === 'block') {
    P.fF = { x: 28, y: -8 }; P.fB = { x: 22, y: 0 }; P.lean = -3;
  } else if (st === 'down' || st === 'ko') {
    let r = 1.2 + (Math.PI / 2 - 1.2) * Math.min(1, f.stateT / 6);
    if (st === 'down' && f.stun < 12) r *= Math.max(0, f.stun) / 12;
    P.rot = r; P.bf = { x: -16, y: 0 }; P.ff = { x: 14, y: -10 }; P.fF = { x: 8, y: 12 }; P.fB = { x: -6, y: 14 };
  } else if (st === 'win') {
    P.fF = { x: 12, y: -44 - Math.sin(t * 0.2) * 6 }; P.hipY += Math.sin(t * 0.2) * 2;
  }
  return P;
}

function drawFighter(f, gx, gy, sc) {
  const c = f.ch, P = poseOf(f), flash = f.flash > 0 && f.flash % 4 < 2;
  const C = col => flash ? '#ffffff' : col;
  ctx.save();
  ctx.translate(gx, gy); ctx.scale(sc || 1, sc || 1); ctx.scale(f.face, 1);
  if (P.rot) { ctx.translate(0, -14 * Math.sin(P.rot)); ctx.rotate(-P.rot); }

  // aura
  const aura = f.state === 'attack' && f.atk.def.special ? c.special.color : (f.gauge >= 100 && f.state !== 'ko' ? '#ffd23f' : null);
  if (aura) {
    const pulse = 0.5 + 0.5 * Math.sin(f.anim * 0.3);
    const ag = ctx.createRadialGradient(0, -70, 10, 0, -70, 90);
    ag.addColorStop(0, aura); ag.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = (f.state === 'attack' ? 0.55 : 0.18 + pulse * 0.2); ctx.fillStyle = ag;
    ctx.beginPath(); ctx.arc(0, -70, 90, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  }

  const H0 = { x: 0, y: P.hipY }, Sh = { x: P.lean, y: P.hipY - 44 + (P.hipY > -40 ? 4 : 0) };
  const skin = C(c.skin), skinD = C(shade(c.skin, -35)), pants = C(c.outfit2), pantsD = C(shade(c.outfit2, -30));
  const legBend = -1, armBend = 1;
  // jambe arrière, bras arrière
  let r = ik({ x: -4, y: H0.y }, P.bf, 32, 32, legBend);
  limb({ x: -4, y: H0.y }, r.k, r.e, 13, pantsD);
  ctx.fillStyle = C(shade(c.accent, -40)); ctx.beginPath(); ctx.ellipse(r.e.x + 3, r.e.y - 1, 9, 5, 0, 0, 7); ctx.fill();
  const bs = { x: Sh.x - 3, y: Sh.y + 5 };
  r = ik(bs, { x: Sh.x + P.fB.x, y: Sh.y + P.fB.y }, 24, 22, armBend);
  limb(bs, r.k, r.e, 10, skinD);
  ctx.fillStyle = C(shade(c.accent, -40)); ctx.beginPath(); ctx.arc(r.e.x, r.e.y, 6, 0, 7); ctx.fill();
  // torse
  ctx.beginPath();
  ctx.moveTo(Sh.x - 13, Sh.y); ctx.lineTo(Sh.x + 13, Sh.y); ctx.lineTo(H0.x + 12, H0.y); ctx.lineTo(H0.x - 12, H0.y); ctx.closePath();
  ctx.fillStyle = C(c.outfit); ctx.fill(); ctx.strokeStyle = '#141414'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.fillStyle = C(c.accent);
  const bx = lerp(H0.x, Sh.x, 0.08);
  ctx.fillRect(bx - 12, H0.y - 7, 24, 8);
  ctx.fillRect(Sh.x - 4, Sh.y, 8, 5);
  // jambe avant
  r = ik({ x: 4, y: H0.y }, P.ff, 32, 32, legBend);
  limb({ x: 4, y: H0.y }, r.k, r.e, 13, pants);
  ctx.fillStyle = C(c.accent); ctx.beginPath(); ctx.ellipse(r.e.x + 3, r.e.y - 1, 9, 5, 0, 0, 7); ctx.fill();
  // tête
  const hx = Sh.x + 2 + P.headDx, hy = Sh.y - 17;
  drawHead(c, hx, hy, f, flash, C);
  // bras avant
  const fs = { x: Sh.x + 2, y: Sh.y + 5 };
  r = ik(fs, { x: Sh.x + P.fF.x, y: Sh.y + P.fF.y }, 24, 22, armBend);
  limb(fs, r.k, r.e, 10, skin);
  ctx.fillStyle = C(c.accent); ctx.beginPath(); ctx.arc(r.e.x, r.e.y, 7, 0, 7); ctx.fill();
  ctx.strokeStyle = '#141414'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
}

function faceImage(c) {
  if (!c.face) return null;
  if (!c._img) { c._img = new Image(); c._img.src = c.face; }
  return c._img.complete && c._img.naturalWidth ? c._img : null;
}
function drawHead(c, hx, hy, f, flash, C) {
  const skin = C(c.skin), hair = C(c.hair), acc = C(c.accent), t = f.anim;
  ctx.lineJoin = 'round';
  if (c.hairStyle === 'long' && !c.face) { // queue derrière
    ctx.strokeStyle = hair; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx - 10, hy - 8);
    ctx.quadraticCurveTo(hx - 30, hy + 6 + Math.sin(t * 0.15) * 4, hx - 34, hy + 30 + Math.sin(t * 0.15 + 1) * 5); ctx.stroke();
  }
  if (c.hairStyle === 'band' && !c.face) { // ruban qui flotte
    ctx.strokeStyle = acc; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx - 12, hy - 6);
    ctx.quadraticCurveTo(hx - 24, hy - 2 + Math.sin(t * 0.2) * 4, hx - 36, hy + 6 + Math.sin(t * 0.2 + 1) * 6); ctx.stroke();
  }
  const img = faceImage(c);
  if (img) { // visage photo : toujours de face, jamais inversé
    const R = 22, cy2 = hy - 4;
    ctx.save(); ctx.translate(hx, cy2); ctx.scale(f.face, 1);
    ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fillStyle = skin; ctx.fill();
    ctx.save(); ctx.clip(); ctx.drawImage(img, -R, -R, R * 2, R * 2); ctx.restore();
    if (flash) { ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill(); }
    else if (f.state === 'hit' || f.state === 'ko' || f.state === 'down') { ctx.fillStyle = 'rgba(200,0,0,0.22)'; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill(); }
    ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.strokeStyle = '#141414'; ctx.lineWidth = 3.5; ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.beginPath(); ctx.arc(hx, hy, 14, 0, 7); ctx.fillStyle = skin; ctx.fill();
  ctx.strokeStyle = '#141414'; ctx.lineWidth = 3; ctx.stroke();
  // cheveux
  ctx.fillStyle = hair;
  if (c.hairStyle === 'spiky') {
    ctx.beginPath(); ctx.moveTo(hx - 14, hy);
    ctx.lineTo(hx - 20, hy - 14); ctx.lineTo(hx - 9, hy - 10); ctx.lineTo(hx - 8, hy - 26); ctx.lineTo(hx, hy - 12);
    ctx.lineTo(hx + 6, hy - 25); ctx.lineTo(hx + 9, hy - 10); ctx.lineTo(hx + 16, hy - 16); ctx.lineTo(hx + 14, hy - 2);
    ctx.arc(hx, hy, 14, -0.15, Math.PI + 0.15, true); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#141414'; ctx.lineWidth = 2; ctx.stroke();
  } else if (c.hairStyle === 'long') {
    ctx.beginPath(); ctx.arc(hx, hy, 15, Math.PI, Math.PI * 2); ctx.lineTo(hx + 8, hy - 3); ctx.lineTo(hx - 15, hy - 2); ctx.closePath(); ctx.fill();
  } else if (c.hairStyle === 'band') {
    ctx.beginPath(); ctx.arc(hx, hy, 15, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = acc; ctx.fillRect(hx - 15, hy - 9, 30, 5);
  } else if (c.hairStyle === 'mask') {
    ctx.beginPath(); ctx.arc(hx, hy, 15, 0, 7); ctx.fill();
    ctx.fillStyle = skin; ctx.fillRect(hx - 1, hy - 8, 16, 8);
    ctx.fillStyle = acc; ctx.fillRect(hx - 15, hy - 11, 30, 3);
  } else if (c.hairStyle === 'bald') {
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(hx - 4, hy - 9, 5, 3, -0.5, 0, 7); ctx.fill();
  }
  // œil et bouche
  const hit = f.state === 'hit' || f.state === 'ko' || f.state === 'down';
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#141414'; ctx.lineWidth = 1.5;
  if (hit) {
    ctx.beginPath(); ctx.moveTo(hx + 3, hy - 5); ctx.lineTo(hx + 10, hy + 1); ctx.moveTo(hx + 10, hy - 5); ctx.lineTo(hx + 3, hy + 1); ctx.stroke();
    ctx.fillStyle = '#500'; ctx.beginPath(); ctx.ellipse(hx + 8, hy + 8, 3, 4, 0, 0, 7); ctx.fill();
  } else {
    ctx.beginPath(); ctx.ellipse(hx + 7, hy - 2, 4, 3.4, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#141414'; ctx.beginPath(); ctx.arc(hx + 8.5, hy - 2, 1.8, 0, 7); ctx.fill();
    ctx.strokeStyle = '#141414'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hx + 3, hy - 7); ctx.lineTo(hx + 12, hy - 5); ctx.stroke();
    if (c.hairStyle !== 'mask') { ctx.beginPath(); ctx.moveTo(hx + 5, hy + 8); ctx.lineTo(hx + 11, hy + 8); ctx.stroke(); }
  }
}

function drawShadow(f) {
  const s = clamp(1 - f.y / 260, 0.3, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(f.x, GROUND + 6, 36 * s, 8 * s, 0, 0, 7); ctx.fill();
}

function drawProjectile(p) {
  const col = p.owner.ch.special.color;
  ctx.save(); ctx.translate(p.x, GROUND - p.y);
  for (let i = 4; i >= 1; i--) {
    ctx.globalAlpha = 0.12 * (5 - i); ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(-p.vx * i * 1.6, 0, 16 - i * 2, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
  g.addColorStop(0, '#fff'); g.addColorStop(0.35, col); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 26 + Math.sin(p.t * 0.6) * 3, 0, 7); ctx.fill();
  ctx.restore();
}

function drawSpark(s) {
  const t = s.t / 14;
  ctx.save(); ctx.translate(s.x, GROUND - s.y);
  ctx.globalAlpha = 1 - t;
  if (s.kind === 'block') {
    ctx.strokeStyle = '#8fd3ff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 8 + t * 22, 0, 7); ctx.stroke();
  } else {
    const n = s.kind === 'big' ? 12 : 8, R = (s.kind === 'big' ? 46 : 28) * (0.4 + t);
    ctx.strokeStyle = s.kind === 'big' ? '#ffdd55' : '#fff6c0'; ctx.lineWidth = s.kind === 'big' ? 5 : 3; ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + s.x;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 0.4, Math.sin(a) * R * 0.4); ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R); ctx.stroke();
    }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, R * 0.3 * (1 - t), 0, 7); ctx.fill();
  }
  ctx.restore();
}

/* ---------------------------------------------------------------- HUD */
function text(str, x, y, size, color, align, stroke) {
  ctx.font = `900 ${size}px Impact, 'Arial Black', 'Helvetica Neue', sans-serif`;
  ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
  if (stroke !== false) { ctx.lineWidth = Math.max(3, size / 6); ctx.strokeStyle = '#000'; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y); }
  ctx.fillStyle = color || '#fff'; ctx.fillText(str, x, y);
}
function plainText(str, x, y, size, color, align, weight) {
  ctx.font = `${weight || 'normal'} ${size}px 'Helvetica Neue', Arial, sans-serif`;
  ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(str, x, y);
}
function rrect(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function drawHUD() {
  const m = G.match, need = CFG.roundsToWin;
  for (const f of m.f) {
    const left = f.side === 0, bw = 390, bx = left ? 30 : W - 30 - bw, by = 26;
    ctx.fillStyle = '#000'; rrect(bx - 3, by - 3, bw + 6, 28, 6); ctx.fill();
    ctx.fillStyle = '#3a1010'; ctx.fillRect(bx, by, bw, 22);
    const w1 = bw * f.hpTrail / f.ch.hp, w2 = bw * f.hp / f.ch.hp;
    const px = v => left ? bx + bw - v : bx;
    ctx.fillStyle = '#ffdd44'; ctx.fillRect(px(w1), by, w1, 22);
    const hg = ctx.createLinearGradient(0, by, 0, by + 22);
    const low = f.hp / f.ch.hp < 0.25;
    hg.addColorStop(0, low ? '#ff8a8a' : '#8dff7a'); hg.addColorStop(1, low ? '#c81818' : '#1fa83a');
    ctx.fillStyle = hg; ctx.fillRect(px(w2), by, w2, 22);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(px(w2), by, w2, 6);
    text(f.ch.name + (f.cpu ? ' (CPU ' + curDiff().name + ')' : ''), left ? bx : bx + bw, by + 42, 20, '#fff', left ? 'left' : 'right');
    // manches gagnées
    for (let i = 0; i < need; i++) {
      const cx = left ? bx + bw - 10 - i * 22 : bx + 10 + i * 22, cy = by + 42;
      ctx.beginPath(); ctx.arc(cx, cy, 7, 0, 7); ctx.fillStyle = i < f.wins ? '#ffd23f' : 'rgba(0,0,0,0.5)'; ctx.fill();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();
    }
    // jauge spéciale
    const gw = 300, gx = left ? 30 : W - 30 - gw, gy = H - 34;
    ctx.fillStyle = '#000'; rrect(gx - 3, gy - 3, gw + 6, 22, 6); ctx.fill();
    ctx.fillStyle = '#1a1a2e'; ctx.fillRect(gx, gy, gw, 16);
    const full = f.gauge >= 100, gv = gw * f.gauge / 100;
    const sg = ctx.createLinearGradient(0, gy, 0, gy + 16);
    if (full) { const p = 0.5 + 0.5 * Math.sin(G.t * 0.25); sg.addColorStop(0, '#fff6a0'); sg.addColorStop(1, `rgb(255,${160 + p * 60},30)`); }
    else { sg.addColorStop(0, '#7ad0ff'); sg.addColorStop(1, '#2a63d6'); }
    ctx.fillStyle = sg; ctx.fillRect(left ? gx : gx + gw - gv, gy, gv, 16);
    if (full) text('SPÉCIAL PRÊT !', left ? gx + gw + 12 : gx - 12, gy + 8, 16, '#ffd23f', left ? 'left' : 'right');
    else plainText('SPÉCIAL', left ? gx + gw + 10 : gx - 10, gy + 8, 12, 'rgba(255,255,255,0.7)', left ? 'left' : 'right', 'bold');
  }
  // chrono
  ctx.fillStyle = '#000'; rrect(W / 2 - 34, 22, 68, 46, 8); ctx.fill();
  text(String(Math.max(0, m.timer)), W / 2, 46, 34, m.timer <= 10 ? '#ff5050' : '#fff');
  // combos
  for (const t of m.texts) if (t.kind === 'combo') {
    const left = t.side === 0, a = 1 - t.t / 70, sc = 1 + Math.max(0, 1 - t.t / 8) * 0.5;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(left ? 130 : W - 130, 190);
    ctx.scale(sc, sc); text(t.n + ' COUPS', 0, 0, 34, '#ffd23f'); ctx.restore();
  }
}

function banner(str, size, color, y) { text(str, W / 2, y || H / 2 - 30, size, color || '#fff'); }

function drawFight() {
  const m = G.match, sh = m.shake;
  ctx.save();
  if (sh > 0.5) ctx.translate(rand(-sh, sh), rand(-sh, sh) * 0.6);
  drawStage(m.stage, G.t);
  for (const f of m.f) drawShadow(f);
  const order = m.f.slice().sort((a, b) => (a.state === 'attack' ? 1 : 0) - (b.state === 'attack' ? 1 : 0));
  for (const f of order) drawFighter(f, f.x, GROUND - f.y);
  for (const p of m.proj) drawProjectile(p);
  for (const s of m.sparks) drawSpark(s);
  ctx.restore();
  drawHUD();

  if (m.phase === 'intro') {
    if (m.phaseT < 60) { banner('ROUND ' + m.round, 64, '#fff'); }
    else { const s = 1 + Math.max(0, 1 - (m.phaseT - 60) / 6) * 0.6; ctx.save(); ctx.translate(W / 2, H / 2 - 30); ctx.scale(s, s); text('COMBATTEZ !', 0, 0, 72, '#ffd23f'); ctx.restore(); }
  } else if (m.phase === 'end') {
    banner(m.banner, 84, m.banner === 'K.O.' ? '#ff4d4d' : '#fff');
    if (m.phaseT > 50 && m.roundWin >= 0) text((m.roundWin === 0 ? 'JOUEUR 1' : (m.f[1].cpu ? 'CPU' : 'JOUEUR 2')) + ' REMPORTE LE ROUND', W / 2, H / 2 + 40, 26, '#fff');
  } else if (m.phase === 'match') {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
    if (m.winner < 0) banner('MATCH NUL', 80, '#fff', 180);
    else {
      const w = m.f[m.winner];
      banner((m.winner === 0 ? 'JOUEUR 1' : (w.cpu ? 'CPU' : 'JOUEUR 2')) + ' GAGNE !', 62, '#ffd23f', 130);
      text(w.ch.name + ' — ' + w.ch.title, W / 2, 190, 26, '#fff');
      drawFighter(w, W / 2, 420, 1.6);
    }
    text(isTouch ? 'Touche en bas : rejouer  —  en haut : menu' : 'ENTRÉE : rejouer   —   ÉCHAP : menu', W / 2, H - 40, 22, '#fff');
  }
  if (m.paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
    banner('PAUSE', 80, '#fff', 200);
    text(isTouch ? 'Haut : reprendre  —  Bas : quitter' : 'P / ENTRÉE : reprendre   —   ÉCHAP : quitter', W / 2, 300, 24, '#ddd');
  }
}

/* ---------------------------------------------------------------- menus */
function clickable(x, y, w, h, fn) { G.clickables.push({ x, y, w, h, fn }); }

function drawBackdrop() {
  drawStage(CFG.stages[Math.floor(G.t / 600) % CFG.stages.length], G.t);
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H);
}

function drawTitle() {
  drawBackdrop();
  const bob = Math.sin(G.t * 0.05) * 4;
  text('RUMBLE', W / 2, 105 + bob, 104, '#ffd23f');
  text('FIGHTER', W / 2, 190 + bob, 84, '#ff4d4d');
  if (G.showControls) return drawControls();
  const items = ['1 JOUEUR  (contre l\'ordinateur)', '2 JOUEURS  (même clavier)', '◀ DIFFICULTÉ : ' + curDiff().name + ' ▶', 'COMMANDES'];
  items.forEach((it, i) => {
    const y = 272 + i * 56, sel = G.menuIdx === i;
    if (sel) { ctx.fillStyle = 'rgba(255,210,63,0.18)'; rrect(W / 2 - 300, y - 26, 600, 52, 10); ctx.fill(); }
    text((sel ? '▶ ' : '') + it, W / 2, y, sel ? 32 : 28, sel ? '#ffd23f' : '#fff');
    clickable(W / 2 - 300, y - 26, 600, 52, () => { G.menuIdx = i; menuConfirm(); });
    if (i === 2) { clickable(W / 2 - 300, y - 26, 150, 52, () => { G.menuIdx = 2; cycleDiff(-1); }); clickable(W / 2 + 150, y - 26, 150, 52, () => { G.menuIdx = 2; cycleDiff(1); }); }
  });
  plainText('↑ ↓ pour choisir · ENTRÉE pour valider', W / 2, H - 30, 16, 'rgba(255,255,255,0.7)', 'center');
}

function drawControls() {
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; rrect(90, 240, 780, 250, 14); ctx.fill();
  text('COMMANDES', W / 2, 268, 30, '#ffd23f');
  const rows = [
    ['', 'JOUEUR 1', 'JOUEUR 2'],
    ['Déplacement', '← →', 'Q  D'],
    ['Saut / Accroupi', '↑  /  ↓', 'Z  /  S'],
    ['Poing', 'J', 'F'],
    ['Pied', 'K', 'G'],
    ['Attaque spéciale (jauge pleine)', 'L', 'H']
  ];
  rows.forEach((r, i) => {
    const y = 305 + i * 28;
    plainText(r[0], 120, y, 18, '#fff', 'left');
    plainText(r[1], 560, y, 18, i ? '#ffd23f' : '#fff', 'center', 'bold');
    plainText(r[2], 740, y, 18, i ? '#7ad0ff' : '#fff', 'center', 'bold');
  });
  plainText('Reculer = parer (accroupi pour les coups bas). En 1 joueur, les deux jeux de touches fonctionnent.', W / 2, 476, 14, 'rgba(255,255,255,0.7)', 'center');
  plainText('Échap : retour   ·   P : pause en combat', W / 2, H - 22, 15, 'rgba(255,255,255,0.7)', 'center');
}

function drawSelect() {
  drawBackdrop();
  const chars = CFG.characters, step = G.sel.step;
  text('CHOISIS TON COMBATTANT', W / 2, 44, 42, '#fff');
  const who = step === 0 ? 'JOUEUR 1' : (G.mode === 1 ? 'ADVERSAIRE (CPU)' : 'JOUEUR 2');
  text(who, W / 2, 86, 26, step === 0 ? '#ff6b6b' : '#7ad0ff');
  const n = chars.length, cols = Math.min(6, n), rows = Math.ceil(n / cols), cw = 138, gap = 12;
  const big = rows === 1, ch = big ? 220 : 108, fs = big ? 1 : 0.62, y00 = big ? 112 : 100;
  chars.forEach((c, i) => {
    const col = i % cols, row = Math.floor(i / cols), inRow = Math.min(cols, n - row * cols);
    const x = (W - (inRow * cw + (inRow - 1) * gap)) / 2 + col * (cw + gap), y0 = y00 + row * (ch + 34), sel = G.sel.cursor === i;
    ctx.save();
    rrect(x, y0, cw, ch, 12); ctx.clip();
    const g = ctx.createLinearGradient(0, y0, 0, y0 + ch);
    g.addColorStop(0, shade(c.outfit === '#e8e8ee' ? '#7a7a90' : c.outfit, -40)); g.addColorStop(1, '#101018');
    ctx.fillStyle = g; ctx.fillRect(x, y0, cw, ch);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x, y0 + ch - (big ? 40 : 20), cw, big ? 40 : 20);
    const dummy = { ch: c, state: 'idle', face: 1, anim: G.t + i * 20, y: 0, flash: 0, gauge: sel ? 100 : 0, stun: 0, atk: null, walkPh: 0, stateT: 0, launched: false, blockCrouch: false };
    drawFighter(dummy, x + cw / 2, y0 + ch - (big ? 24 : 12), fs);
    ctx.restore();
    ctx.lineWidth = sel ? 5 : 2; ctx.strokeStyle = sel ? '#ffd23f' : 'rgba(255,255,255,0.35)';
    rrect(x, y0, cw, ch, 12); ctx.stroke();
    text(c.name, x + cw / 2, y0 + ch + 18, c.name.length > 11 ? 15 : 18, sel ? '#ffd23f' : '#fff');
    if (step >= 1 && G.picks[0] === i) badge(x + 8, y0 + 8, 'J1', '#e0352b');
    if (step === 1 && sel) badge(x + cw - 44, y0 + 8, G.mode === 1 ? 'CPU' : 'J2', '#2a7de0');
    clickable(x, y0, cw, ch + 30, () => { if (G.sel.cursor === i) selectConfirm(); else { G.sel.cursor = i; sfx('menu'); } });
  });
  // fiche
  const c = chars[G.sel.cursor], py = big ? 384 : 392;
  ctx.fillStyle = 'rgba(0,0,0,0.65)'; rrect(60, py, W - 120, big ? 120 : 116, 12); ctx.fill();
  text(c.name, 90, py + 28, 30, '#ffd23f', 'left');
  plainText(c.title, 90, py + 58, 16, '#ddd', 'left', 'italic');
  plainText('SPÉCIAL : ' + c.special.name, 90, py + 88, 16, c.special.color, 'left', 'bold');
  plainText(c.special.desc + ' (' + SPECIAL_NAMES[c.special.type] + ')', 90, py + 107, 13, '#bbb', 'left');
  const stats = [['VIE', c.hp / 130], ['VITESSE', c.speed / 4.2], ['PUISSANCE', c.power / 1.3], ['SAUT', c.jump / 18]];
  stats.forEach((s, i) => {
    const sx = 470 + (i % 2) * 220, sy = py + 32 + Math.floor(i / 2) * 44;
    plainText(s[0], sx, sy, 13, '#ddd', 'left', 'bold');
    ctx.fillStyle = '#222'; ctx.fillRect(sx, sy + 10, 180, 10);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(sx, sy + 10, 180 * clamp(s[1], 0.05, 1), 10);
  });
  plainText('← → choisir · ENTRÉE valider · ÉCHAP retour', W / 2, H - 16, 14, 'rgba(255,255,255,0.7)', 'center');
}
function badge(x, y, str, col) {
  ctx.fillStyle = col; rrect(x, y, 36, 22, 5); ctx.fill();
  plainText(str, x + 18, y + 12, 13, '#fff', 'center', 'bold');
}

function drawStageSelect() {
  drawBackdrop();
  const stages = CFG.stages, n = stages.length + 1;
  text('CHOISIS LE DÉCOR', W / 2, 54, 42, '#fff');
  const cw = 190, chh = 107, gap = 20;
  const cols = Math.min(4, n), rows = Math.ceil(n / cols);
  for (let i = 0; i < n; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    const inRow = Math.min(cols, n - row * cols);
    const x = (W - (inRow * cw + (inRow - 1) * gap)) / 2 + col * (cw + gap), y = 130 + row * (chh + 70);
    const sel = G.stageCursor === i;
    ctx.save(); rrect(x, y, cw, chh, 10); ctx.clip();
    if (i < stages.length) drawStage(stages[i], G.t, x, y, cw / W);
    else { ctx.fillStyle = '#222'; ctx.fillRect(x, y, cw, chh); text('?', x + cw / 2, y + chh / 2, 60, '#ffd23f'); }
    ctx.restore();
    ctx.lineWidth = sel ? 5 : 2; ctx.strokeStyle = sel ? '#ffd23f' : 'rgba(255,255,255,0.35)'; rrect(x, y, cw, chh, 10); ctx.stroke();
    text(i < stages.length ? stages[i].name : 'ALÉATOIRE', x + cw / 2, y + chh + 20, 17, sel ? '#ffd23f' : '#fff');
    clickable(x, y, cw, chh + 30, () => { if (G.stageCursor === i) stageConfirm(); else { G.stageCursor = i; sfx('menu'); } });
  }
  plainText('← → choisir · ENTRÉE combattre · ÉCHAP retour', W / 2, H - 16, 14, 'rgba(255,255,255,0.7)', 'center');
}

/* ---------------------------------------------------------------- navigation */
function cycleDiff(d) {
  const n = CFG.difficulties.length;
  G.difficulty = (G.difficulty + d + n) % n; sfx('menu');
  try { localStorage.setItem('rf_diff', G.difficulty); } catch (e) {}
}
function menuConfirm() {
  sfx('ok');
  if (G.menuIdx === 2) { cycleDiff(1); return; }
  if (G.menuIdx === 3) { G.showControls = true; return; }
  G.mode = G.menuIdx === 0 ? 1 : 2;
  G.sel = { cursor: G.picks[0], step: 0 }; G.scene = 'select';
}
function selectConfirm() {
  sfx('ok');
  if (G.sel.step === 0) { G.picks[0] = G.sel.cursor; G.sel.step = 1; G.sel.cursor = G.picks[1]; }
  else { G.picks[1] = G.sel.cursor; G.scene = 'stage'; }
}
function stageConfirm() {
  sfx('ok');
  const n = CFG.stages.length;
  G.stageIdx = G.stageCursor < n ? G.stageCursor : Math.floor(Math.random() * n);
  startMatch();
}
function nav(c) {
  const L = c === 'ArrowLeft' || c === 'KeyA', R = c === 'ArrowRight' || c === 'KeyD';
  const U = c === 'ArrowUp' || c === 'KeyW', D = c === 'ArrowDown' || c === 'KeyS';
  const ok = c === 'Enter' || c === 'Space' || c === 'KeyJ' || c === 'KeyF';
  const back = c === 'Escape' || c === 'Backspace';
  return { L, R, U, D, ok, back };
}

function onPress(code) {
  const k = nav(code);
  if (G.scene === 'title') {
    if (G.showControls) { if (k.back || k.ok) G.showControls = false; return; }
    if (k.U) { G.menuIdx = (G.menuIdx + 3) % 4; sfx('menu'); }
    if (k.D) { G.menuIdx = (G.menuIdx + 1) % 4; sfx('menu'); }
    if (G.menuIdx === 2 && k.L) cycleDiff(-1);
    if (G.menuIdx === 2 && k.R) cycleDiff(1);
    if (k.ok) menuConfirm();
  } else if (G.scene === 'select') {
    const n = CFG.characters.length;
    if (k.L) { G.sel.cursor = (G.sel.cursor + n - 1) % n; sfx('menu'); }
    if (k.R) { G.sel.cursor = (G.sel.cursor + 1) % n; sfx('menu'); }
    if (k.D && G.sel.cursor + 6 < n) { G.sel.cursor += 6; sfx('menu'); }
    if (k.U && G.sel.cursor - 6 >= 0) { G.sel.cursor -= 6; sfx('menu'); }
    if (k.ok) selectConfirm();
    if (k.back) { if (G.sel.step === 1) { G.sel.step = 0; G.sel.cursor = G.picks[0]; } else G.scene = 'title'; sfx('menu'); }
  } else if (G.scene === 'stage') {
    const n = CFG.stages.length + 1;
    if (k.L) { G.stageCursor = (G.stageCursor + n - 1) % n; sfx('menu'); }
    if (k.R) { G.stageCursor = (G.stageCursor + 1) % n; sfx('menu'); }
    if (k.D && G.stageCursor + 4 < n) { G.stageCursor += 4; sfx('menu'); }
    if (k.U && G.stageCursor - 4 >= 0) { G.stageCursor -= 4; sfx('menu'); }
    if (k.ok) stageConfirm();
    if (k.back) { G.scene = 'select'; G.sel = { cursor: G.picks[1], step: 1 }; sfx('menu'); }
  } else if (G.scene === 'fight') {
    const m = G.match;
    if (m.paused) {
      if (code === 'KeyP' || code === 'Enter') m.paused = false;
      else if (code === 'Escape') { G.scene = 'title'; }
      return;
    }
    if (m.phase === 'match') {
      if (code === 'Enter') startMatch();
      else if (code === 'Escape') G.scene = 'title';
      return;
    }
    if (code === 'KeyP' || code === 'Escape') { m.paused = true; return; }
    for (let i = 0; i < 2; i++) {
      const map = keyMapFor(i);
      if (!map || m.f[i].cpu) continue;
      for (const act of ['punch', 'kick', 'special']) if (map[act].includes(code)) m.f[i].buf[act] = 6;
    }
  }
}

window.addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Backspace'].includes(e.code)) e.preventDefault();
  ensureAudio();
  if (e.repeat) return;
  keys[e.code] = true;
  onPress(e.code);
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

function canvasPos(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
}
cv.addEventListener('mousemove', e => {
  G.mouse = canvasPos(e);
  cv.style.cursor = G.clickables.some(c => G.mouse.x >= c.x && G.mouse.x <= c.x + c.w && G.mouse.y >= c.y && G.mouse.y <= c.y + c.h) ? 'pointer' : 'default';
});
cv.addEventListener('pointerdown', e => {
  ensureAudio();
  const p = canvasPos(e);
  if (G.scene === 'title' && G.showControls) { G.showControls = false; return; }
  if (G.scene === 'fight') {
    const m = G.match;
    if (m.phase === 'match') { if (p.y > H - 80) startMatch(); else if (p.y < 60) G.scene = 'title'; return; }
    if (m.paused) { if (p.y > H / 2) G.scene = 'title'; else m.paused = false; return; }
    return;
  }
  for (const c of G.clickables) if (p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h) { c.fn(); return; }
});

/* ---------------------------------------------------------------- commandes tactiles */
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');
document.querySelectorAll('#touch button').forEach(b => {
  const hold = b.dataset.k, tap = b.dataset.a;
  const down = e => {
    e.preventDefault(); ensureAudio(); b.classList.add('on');
    if (hold) keys[hold] = true;
    else if (G.scene === 'fight') onPress(tap);
  };
  const up = e => { e.preventDefault(); b.classList.remove('on'); if (hold) keys[hold] = false; };
  b.addEventListener('pointerdown', down);
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => b.addEventListener(t, up));
  b.addEventListener('contextmenu', e => e.preventDefault());
});

/* ---------------------------------------------------------------- boucle principale */
function render() {
  G.clickables = [];
  ctx.clearRect(0, 0, W, H);
  switch (G.scene) {
    case 'title': drawTitle(); break;
    case 'select': drawSelect(); break;
    case 'stage': drawStageSelect(); break;
    case 'fight': drawFight(); break;
  }
}
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(100, now - last); last = now;
  while (acc >= 1000 / 60) {
    acc -= 1000 / 60; G.t++;
    if (G.scene === 'fight') updateFight();
  }
  document.body.dataset.scene = G.scene;
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// accès pour le débogage / les tests
window.__game = { G, startMatch, onPress, keys };
})();
