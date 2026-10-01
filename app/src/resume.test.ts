import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, play, playablePiles } from './engine';
import { clearLocal, clearRoom, loadLocal, loadRoom, saveLocal, saveRoom } from './resume';

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};
const seeded = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

test('partie locale : sauvegarde puis reprise à l\'identique, la partie continue', () => {
  const st = mem();
  let g = newGame(3, seeded(3));
  const c = g.hands[g.current].find((x) => playablePiles(g, x).length)!;
  const r = play(g, c.id, playablePiles(g, c)[0], seeded(4));
  assert.ok(r.ok); g = r.state;
  saveLocal({ mode: 'solo', game: g, history: ['coup 1'], startedAt: 123 }, st, 1000);
  const back = loadLocal(st, 2000)!;
  assert.equal(back.mode, 'solo');
  assert.deepEqual(back.history, ['coup 1']);
  assert.equal(back.startedAt, 123);
  assert.equal(back.game.current, g.current);
  assert.deepEqual(back.game.hands, g.hands);
  assert.deepEqual(back.game.missions.map((m) => m.id), g.missions.map((m) => m.id));
  // les missions ont retrouvé leurs fonctions de contrôle : on peut continuer à jouer
  const c2 = back.game.hands[back.game.current].find((x) => playablePiles(back.game, x).length)!;
  assert.ok(play(back.game, c2.id, playablePiles(back.game, c2)[0]).ok);
  clearLocal(st);
  assert.equal(loadLocal(st), null);
});

test('reprise : sauvegardes périmées, abîmées ou terminées ignorées', () => {
  const st = mem();
  saveLocal({ mode: 'together', game: newGame(2, seeded(1)), history: [], startedAt: 1 }, st, 0);
  assert.equal(loadLocal(st, 4 * 24 * 3600 * 1000), null);
  st.setItem('50m-resume', '{pas du json');
  assert.equal(loadLocal(st), null);
  st.setItem('50m-resume', JSON.stringify({ mode: 'solo', game: '{"x":1}', at: Date.now() }));
  assert.equal(loadLocal(st), null);
  assert.equal(loadLocal(null), null);
  const over = { ...newGame(2, seeded(2)), over: true };
  saveLocal({ mode: 'solo', game: over, history: [], startedAt: 1 }, st);
  assert.equal(loadLocal(st), null);
});

test('salon à reprendre : code à 4 lettres, oublié après trois jours', () => {
  const st = mem();
  saveRoom('ABCD', st, 0);
  assert.equal(loadRoom(st, 1000)?.code, 'ABCD');
  assert.equal(loadRoom(st, 4 * 24 * 3600 * 1000), null);
  st.setItem('50m-room', JSON.stringify({ code: 'abc', at: Date.now() }));
  assert.equal(loadRoom(st), null);
  saveRoom('WXYZ', st); clearRoom(st);
  assert.equal(loadRoom(st), null);
});
