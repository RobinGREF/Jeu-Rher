import test from 'node:test';
import assert from 'node:assert/strict';
import { joinedNames } from './alerts';

const p = (uid: string, name: string) => ({ uid, name });

test('arrivées dans le salon : seulement les nouveaux, jamais toi, rien à la première liste', () => {
  assert.deepEqual(joinedNames(null, [p('a', 'Robin'), p('b', 'Marie')], 'a'), []);
  assert.deepEqual(joinedNames(['a'], [p('a', 'Robin'), p('b', 'Marie')], 'a'), ['Marie']);
  assert.deepEqual(joinedNames(['a', 'b'], [p('a', 'Robin'), p('b', 'Marie')], 'a'), []);
  assert.deepEqual(joinedNames(['b'], [p('a', 'Robin'), p('b', 'Marie'), p('c', 'Léo')], 'a'), ['Léo']);
});
