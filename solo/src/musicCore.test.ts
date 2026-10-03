import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack, degreeToMidi, rngFrom, type TrackSpec } from './musicCore';
import { TRACKS_DUEL, TRACKS_MEMO } from './tracks';
const TRACKS_50M = [...TRACKS_DUEL, ...TRACKS_MEMO];

const SPEC: TrackSpec = { id: 't', name: 'T', emoji: '🎵', bpm: 120, root: 60, mode: 'major', prog: [0, 4, 5, 3], lead: 'triangle', bass: 'sine', drums: 'march', density: 0.6, seed: 7 };

test('musique : même graine, même morceau ; graine différente, morceau différent', () => {
  const a = buildTrack(SPEC), b = buildTrack({ ...SPEC });
  assert.deepEqual(a.events, b.events);
  assert.notDeepEqual(buildTrack({ ...SPEC, seed: 8 }).events.filter((e) => e.v === 'lead'), a.events.filter((e) => e.v === 'lead'));
  assert.equal(rngFrom(5)(), rngFrom(5)());
});

test('musique : gammes — le degré 0 est la tonique, 7 degrés = une octave', () => {
  for (const mode of ['major', 'minor', 'dorian', 'mixolydian', 'phrygian', 'lydian', 'harmonicMinor'] as const) {
    assert.equal(degreeToMidi({ root: 60, mode }, 0), 60);
    assert.equal(degreeToMidi({ root: 60, mode }, 7), 72);
    assert.equal(degreeToMidi({ root: 60, mode }, -7), 48);
  }
  assert.equal(degreeToMidi({ root: 60, mode: 'pentatonic' }, 5), 72);
});

test('musique : un morceau est complet, dans la tessiture, et boucle', () => {
  for (const spec of TRACKS_50M) {
    const t = buildTrack(spec);
    assert.ok(t.steps > 0 && t.stepSec > 0.1 && t.stepSec < 0.5, spec.id);
    assert.ok(t.events.some((e) => e.v === 'lead'), `${spec.id} : mélodie`);
    assert.ok(t.events.some((e) => e.v === 'bass'), `${spec.id} : basse`);
    for (const e of t.events) {
      assert.ok(e.s >= 0 && e.s < t.steps, `${spec.id} : événement dans la boucle`);
      if (e.v === 'lead' || e.v === 'bass' || e.v === 'pad') assert.ok(e.m >= 24 && e.m <= 100, `${spec.id} : note ${e.m} jouable`);
    }
  }
  const meters = [8, 6] as const;
  for (const meter of meters) assert.equal(buildTrack({ ...SPEC, meter }).steps, 8 * meter);
});

test('musique : la liste des morceaux a des identifiants uniques et des noms', () => {
  const ids = TRACKS_50M.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(TRACKS_50M.every((t) => t.name && t.emoji));
});
