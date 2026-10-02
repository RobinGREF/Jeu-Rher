import test from 'node:test';
import assert from 'node:assert/strict';
import { addScore, clearScores, cleanName, compareScores, loadScores, MAX_SCORES, parseScores, saveScores, type ScoreEntry } from './scores';

const e = (id: string, completed: number, plays = 40, at = 1000, extra: Partial<ScoreEntry> = {}): ScoreEntry => ({
  id, at, completed, plays, medal: null, mode: 'solo', players: [{ name: 'Robin', bot: false }, { name: 'Machine 1', bot: true }], ...extra,
});

test('classement : plus de missions d\'abord, puis moins de coups, puis la plus ancienne', () => {
  const list = [e('a', 10), e('b', 30, 50), e('c', 30, 40), e('d', 30, 40, 500), e('f', 5)].sort(compareScores);
  assert.deepEqual(list.map((x) => x.id), ['d', 'c', 'b', 'a', 'f']);
});

test('addScore : donne le rang (1 = record), garde les noms des participants, remplace un doublon', () => {
  let r = addScore([], e('a', 12, 30, 1, { players: [{ name: 'Robin', bot: false }, { name: 'Alice', bot: false }, { name: 'Machine 1', bot: true }] }));
  assert.equal(r.rank, 1);
  r = addScore(r.list, e('b', 20));
  assert.equal(r.rank, 1);
  r = addScore(r.list, e('c', 8));
  assert.equal(r.rank, 3);
  assert.deepEqual(r.list.map((x) => x.id), ['b', 'a', 'c']);
  assert.deepEqual(r.list[1].players.map((p) => p.name), ['Robin', 'Alice', 'Machine 1']);
  // la même partie enregistrée deux fois ne compte qu'une fois
  r = addScore(r.list, e('c', 8));
  assert.equal(r.list.length, 3);
});

test('addScore : la liste est plafonnée et une mauvaise partie n\'entre pas dans une liste pleine', () => {
  let list: ScoreEntry[] = [];
  for (let i = 0; i < MAX_SCORES; i++) list = addScore(list, e(`x${i}`, 20 + (i % 20))).list;
  assert.equal(list.length, MAX_SCORES);
  const worst = list[list.length - 1];
  const r = addScore(list, e('nul', 0));
  assert.equal(r.rank, null);
  assert.equal(r.list.length, MAX_SCORES);
  assert.equal(r.list[r.list.length - 1].id, worst.id);
  assert.equal(addScore(list, e('top', 50)).rank, 1);
});

test('stockage : aller-retour, données abîmées ou étrangères ignorées, sans stockage on ne plante pas', () => {
  const data = new Map<string, string>();
  const st = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); } };
  assert.deepEqual(loadScores(st), []);
  const list = addScore(addScore([], e('a', 12)).list, e('b', 30, 40, 1, { medal: 'argent', mode: 'online' })).list;
  saveScores(list, st);
  assert.deepEqual(loadScores(st), list);
  clearScores(st);
  assert.deepEqual(loadScores(st), []);
  // contenu abîmé
  assert.deepEqual(parseScores('pas du json'), []);
  assert.deepEqual(parseScores('{"a":1}'), []);
  assert.deepEqual(parseScores(JSON.stringify([e('ok', 5), { id: 'x' }, null, e('trop', 99), { ...e('mode', 5), mode: 'autre' }, { ...e('nom', 5), players: [{ name: 3 }] }])).map((x) => x.id), ['ok']);
  // stockage indisponible
  assert.deepEqual(loadScores({ getItem: () => { throw new Error('bloqué'); } }), []);
  saveScores(list, { setItem: () => { throw new Error('bloqué'); } });
  saveScores(list, undefined);
});

test('noms : nettoyés et limités à 14 caractères', () => {
  assert.equal(cleanName('  Robin  ', 'Moi'), 'Robin');
  assert.equal(cleanName('   ', 'Moi'), 'Moi');
  assert.equal(cleanName('Jean-Christophe-Alexandre', 'Moi'), 'Jean-Christoph');
});
