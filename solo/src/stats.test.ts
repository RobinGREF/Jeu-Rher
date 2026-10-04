import test from 'node:test';
import assert from 'node:assert/strict';
import { addAnswer, addWin, emptyDuelStats, pct } from './duel/stats';
import { addMemoGame, emptyMemoStats } from './memo/stats';

test('stats Duel : réponses, aveugle, indices, victoires', () => {
  let st = emptyDuelStats();
  st = addAnswer(st, { cat: 'histoire', correct: true, blind: true, hint: false, hard: true }, 10);
  st = addAnswer(st, { cat: 'histoire', correct: false, blind: false, hint: true, hard: false }, 20);
  st = addWin(st, 'Marie', 30);
  assert.equal(st.asked, 2); assert.equal(st.right, 1);
  assert.deepEqual(st.cats.histoire, { asked: 2, right: 1 });
  assert.equal(st.blindTried, 1); assert.equal(st.blindRight, 1); assert.equal(st.hints, 1);
  assert.deepEqual(st.hard, { asked: 1, right: 1 });
  assert.equal(st.games, 1); assert.equal(st.wins.Marie, 1);
  assert.equal(st.first, 10); assert.equal(st.last, 30);
  assert.equal(pct(1, 2), '50 %'); assert.equal(pct(0, 0), '—');
});

test('stats Mémo : record, moyenne, étoiles', () => {
  let st = emptyMemoStats();
  st = addMemoGame(st, 'facile', 12, 3, 1);
  st = addMemoGame(st, 'facile', 9, 2, 2);
  assert.equal(st.levels.facile.played, 2); assert.equal(st.levels.facile.best, 9);
  assert.equal(st.levels.facile.moves, 21); assert.equal(st.levels.facile.stars, 5);
});
