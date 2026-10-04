import test from 'node:test';
import assert from 'node:assert/strict';
import { addLifetime, emptyLifetime } from './lifetime';

const st = (o: Partial<Record<string, number>>) => ({ plays: 0, done: 0, missed: 0, calls: 0, kept: 0, wrongCalls: 0, wrongNo: 0, ...o }) as never;

test('stats cumulées : parties, médailles, mes appels', () => {
  let l = emptyLifetime();
  l = addLifetime(l, { mode: 'solo', completed: 21, medal: 'argent', plays: 40 }, [st({ plays: 10, done: 5, calls: 3, kept: 2 })], 1);
  l = addLifetime(l, { mode: 'online', completed: 50, medal: 'or', plays: 90 }, [st({ plays: 20, done: 12, missed: 2, wrongNo: 1 })], 2);
  assert.equal(l.games, 2); assert.equal(l.byMode.solo, 1); assert.equal(l.byMode.online, 1);
  assert.equal(l.best, 50); assert.equal(l.missions, 71); assert.equal(l.fifty, 1);
  assert.deepEqual(l.medals, { bronze: 2, argent: 2, or: 1 });
  assert.equal(l.mine.done, 17); assert.equal(l.mine.calls, 3); assert.equal(l.mine.kept, 2); assert.equal(l.mine.missed, 2); assert.equal(l.mine.wrongNo, 1);
  assert.equal(l.first, 1); assert.equal(l.last, 2);
});
