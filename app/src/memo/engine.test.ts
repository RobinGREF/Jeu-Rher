import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { flip, hide, isDone, LEVELS, mismatch, newMemo, stars, SYMBOLS } from './engine';

const seeded = (seed = 1) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

test('le jeu contient chaque symbole exactement deux fois', () => {
  for (const l of LEVELS) {
    assert.ok(l.pairs <= SYMBOLS.length);
    assert.equal((l.pairs * 2) % l.cols, 0, `${l.key}: grille complète`);
    const m = newMemo(l.pairs, seeded(l.pairs));
    assert.equal(m.cards.length, l.pairs * 2);
    const count = new Map<string, number>();
    for (const c of m.cards) count.set(c.symbol, (count.get(c.symbol) ?? 0) + 1);
    assert.equal(count.size, l.pairs);
    assert.ok([...count.values()].every((n) => n === 2));
  }
});

const pairOf = (m: ReturnType<typeof newMemo>, id: number) => m.cards.findIndex((c) => c.id !== id && c.symbol === m.cards[id].symbol);

test('une paire trouvée reste visible et compte un coup', () => {
  let m = newMemo(6, seeded(2));
  m = flip(m, 0);
  assert.equal(m.moves, 0);
  m = flip(m, pairOf(m, 0));
  assert.equal(m.moves, 1);
  assert.equal(m.cards.filter((c) => c.matched).length, 2);
  assert.deepEqual(m.flipped, []);
});

test('une paire ratée bloque les clics jusqu\'à ce qu\'on la cache', () => {
  let m = newMemo(6, seeded(2));
  const other = m.cards.findIndex((c) => c.symbol !== m.cards[0].symbol);
  m = flip(flip(m, 0), other);
  assert.ok(mismatch(m));
  assert.equal(m.moves, 1);
  const blocked = flip(m, pairOf(m, 0));
  assert.equal(blocked, m);
  m = hide(m);
  assert.deepEqual(m.flipped, []);
  assert.ok(!mismatch(m));
});

test('re-toucher la même carte ou une carte appariée ne fait rien', () => {
  let m = newMemo(6, seeded(5));
  m = flip(m, 3);
  assert.equal(flip(m, 3), m);
  m = flip(m, pairOf(m, 3));
  assert.equal(flip(m, 3), m);
});

test('la partie se termine quand toutes les paires sont trouvées, en `pairs` coups au mieux', () => {
  const pairs = 8;
  let m = newMemo(pairs, seeded(9));
  for (let i = 0; i < m.cards.length; i++) {
    if (m.cards[i].matched) continue;
    m = flip(flip(m, i), pairOf(m, i));
  }
  assert.ok(isDone(m));
  assert.equal(m.moves, pairs);
  assert.equal(stars(pairs, m.moves), 3);
});

test('étoiles selon le nombre de coups', () => {
  assert.equal(stars(8, 12), 3);
  assert.equal(stars(8, 13), 2);
  assert.equal(stars(8, 20), 2);
  assert.equal(stars(8, 21), 1);
});
