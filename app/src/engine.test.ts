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
