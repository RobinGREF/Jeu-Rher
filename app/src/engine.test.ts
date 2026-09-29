import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSymbolDeck, canPlayOn, newGame, play, playablePiles, tops } from './engine';

const seeded = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

test('deck : 56 cartes, chaque (symbole, valeur) en double', () => {
  const deck = buildSymbolDeck();
  assert.equal(deck.length, 56);
  assert.equal(deck.filter((c) => c.symbol === 0 && c.value === 3).length, 2);
});

test('canPlayOn : même symbole ou même valeur', () => {
  assert.ok(canPlayOn({ id: 0, symbol: 1, value: 2 }, { id: 1, symbol: 1, value: 5 }));
  assert.ok(canPlayOn({ id: 0, symbol: 1, value: 2 }, { id: 1, symbol: 3, value: 2 }));
  assert.ok(!canPlayOn({ id: 0, symbol: 1, value: 2 }, { id: 1, symbol: 3, value: 5 }));
});

test('mise en place : 4 tas, 4 missions, mains de 4', () => {
  const s = newGame(3, seeded(1));
  assert.equal(s.piles.length, 4);
  assert.equal(s.missions.length, 4);
  s.hands.forEach((h) => assert.equal(h.length, 4));
  assert.equal(s.symbolDeck.length, 56 - 4 - 12);
});

test('coup illégal refusé, coup légal accepté', () => {
  const s = newGame(2, seeded(7));
  const hand = s.hands[s.current];
  const legal = hand.map((c) => ({ c, p: playablePiles(s, c) })).find((x) => x.p.length);
  if (!legal) return;
  const bad = [0, 1, 2, 3].find((p) => !legal.p.includes(p));
  if (bad !== undefined) assert.equal(play(s, legal.c.id, bad).ok, false);
  const r = play(s, legal.c.id, legal.p[0]);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(tops(r.state)[legal.p[0]].id, legal.c.id);
    assert.equal(r.state.hands[s.current].length, 4);
  }
});

test('partie jouée au hasard : se termine, jamais d\'état incohérent', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const rng = seeded(seed);
    let s = newGame(1 + (seed % 4), rng);
    let guard = 0;
    while (!s.over && guard++ < 5000) {
      const moves = s.hands[s.current].flatMap((c) => playablePiles(s, c).map((p) => [c.id, p] as const));
      const [id, p] = moves[Math.floor(rng() * moves.length)];
      const r = play(s, id, p, rng);
      assert.ok(r.ok);
      if (r.ok) s = r.state;
    }
    assert.ok(s.over, `seed ${seed} ne termine pas`);
    const total = s.symbolDeck.length + s.hands.flat().length + s.piles.flat().length;
    assert.equal(total, 56);
  }
});

import { buildMissionDefs } from './missions';
const C = (symbol: 0 | 1 | 2 | 3, value: number) => ({ id: 0, symbol, value });
const JUM = 0, BOU = 1, BRI = 2, COU = 3;
const mission = (start: string) => buildMissionDefs().find((d) => d.label.startsWith(start))!;

test('missions : 50, ids et textes uniques', () => {
  const defs = buildMissionDefs();
  assert.equal(defs.length, 50);
  assert.equal(new Set(defs.map((d) => d.id)).size, 50);
  assert.equal(new Set(defs.map((d) => d.label)).size, 50);
});

test('missions : sommes', () => {
  assert.ok(mission('La somme des Boussoles est égale à 11').check([C(BOU, 5), C(BOU, 6), C(JUM, 1), C(COU, 2)]));
  assert.ok(!mission('La somme des Boussoles est égale à 11').check([C(BOU, 5), C(BOU, 5), C(JUM, 1), C(COU, 2)]));
  assert.ok(mission('La somme des 4 cartes est égale à 15').check([C(0, 4), C(1, 4), C(2, 4), C(3, 3)]));
});

test('missions : égalité et double exigent au moins une carte de chaque', () => {
  const eq = mission('La somme des Boussoles est égale à celle des Jumelles');
  assert.ok(eq.check([C(BOU, 3), C(JUM, 3), C(BRI, 1), C(COU, 1)]));
  assert.ok(!eq.check([C(BRI, 3), C(COU, 3), C(BRI, 1), C(COU, 1)])); // 0 = 0 ne compte pas
  const dbl = mission('La somme des Couteaux est le double de celle des Boussoles');
  assert.ok(dbl.check([C(COU, 6), C(COU, 4), C(BOU, 5), C(BRI, 1)]));
  assert.ok(!dbl.check([C(COU, 5), C(BOU, 5), C(BRI, 1), C(BRI, 2)]));
});

test('missions : positions', () => {
  const touch = mission('Exactement 2 cartes sont des Couteaux et elles se touchent');
  const apart = mission('Exactement 2 cartes sont des Couteaux et elles ne se touchent pas');
  const gap1 = mission("Exactement 2 cartes sont des Couteaux et elles sont espacées");
  const a = [C(COU, 1), C(COU, 2), C(JUM, 3), C(BRI, 4)];
  const b = [C(COU, 1), C(JUM, 2), C(COU, 3), C(BRI, 4)];
  const c = [C(COU, 1), C(JUM, 2), C(BRI, 3), C(COU, 4)];
  assert.deepEqual([touch.check(a), touch.check(b), touch.check(c)], [true, false, false]);
  assert.deepEqual([apart.check(a), apart.check(b), apart.check(c)], [false, true, true]);
  assert.deepEqual([gap1.check(a), gap1.check(b), gap1.check(c)], [false, true, false]);
  assert.ok(!touch.check([C(COU, 1), C(COU, 2), C(COU, 3), C(BRI, 4)])); // 3 couteaux : pas « exactement 2 »
});

test('missions : valeurs', () => {
  const three = mission('Les valeurs des 3 cartes qui se touchent');
  assert.ok(three.check([C(0, 1), C(1, 5), C(2, 4), C(3, 3)])); // 5 4 3
  assert.ok(three.check([C(0, 3), C(1, 4), C(2, 5), C(3, 1)]));
  assert.ok(!three.check([C(0, 3), C(1, 5), C(2, 4), C(3, 6)])); // consécutives mais pas dans l'ordre
  const four = mission('Les valeurs des 4 cartes se suivent');
  assert.ok(four.check([C(0, 6), C(1, 3), C(2, 5), C(3, 4)]));
  assert.ok(!four.check([C(0, 6), C(1, 3), C(2, 5), C(3, 5)]));
  assert.ok(mission('Chaque carte a une valeur inférieure à 4').check([C(0, 1), C(1, 2), C(2, 3), C(3, 3)]));
  assert.ok(!mission('Chaque carte a une valeur inférieure à 4').check([C(0, 1), C(1, 2), C(2, 3), C(3, 4)]));
  assert.ok(!mission('Chaque carte a une valeur supérieure à 4').check([C(0, 4), C(1, 5), C(2, 6), C(3, 7)]));
  const odd2 = mission('Exactement 2 cartes sont impaires');
  assert.ok(odd2.check([C(0, 1), C(1, 2), C(2, 3), C(3, 4)]));
  assert.ok(!odd2.check([C(0, 1), C(1, 3), C(2, 2), C(3, 4)]));
});

test('missions : que des X et/ou Y, symboles différents', () => {
  assert.ok(mission("Il n'y a que des cartes Couteaux et/ou Briquets").check([C(COU, 1), C(BRI, 2), C(COU, 3), C(COU, 4)]));
  assert.ok(!mission("Il n'y a que des cartes Couteaux et/ou Briquets").check([C(COU, 1), C(BRI, 2), C(JUM, 3), C(COU, 4)]));
  assert.ok(mission('Chaque carte a une valeur et un symbole différent').check([C(BOU, 3), C(JUM, 7), C(COU, 2), C(BRI, 6)]));
  assert.ok(!mission('Chaque carte a une valeur et un symbole différent').check([C(BOU, 3), C(JUM, 3), C(COU, 2), C(BRI, 6)]));
});
