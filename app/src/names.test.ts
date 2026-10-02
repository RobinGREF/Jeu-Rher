import test from 'node:test';
import assert from 'node:assert/strict';
import { BOT_NAMES, botNames, shortName } from './names';
import { canAnnounce, newGame, reachableMissions, setCanDo } from './engine';

test('machines : des prénoms, sans doublon ni prénom déjà pris à la table', () => {
  assert.equal(new Set(BOT_NAMES).size, BOT_NAMES.length);
  assert.deepEqual(botNames(2), ['Jack', 'Anne']);
  assert.deepEqual(botNames(2, ['jack', 'Robin']), ['Anne', 'Morgan']);
});

test('pastilles sur les missions : le début du prénom', () => {
  assert.equal(shortName('Marie'), 'Marie');
  assert.equal(shortName('Alexandrine'), 'Alexa…');
  assert.equal(shortName('Jack (machine)'), 'Jack');
});

test('sans l\'indice, on peut se positionner sur une mission même si aucune n\'est faisable', () => {
  const seeded = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  let checked = 0;
  for (let seed = 1; seed < 300 && checked < 5; seed++) {
    const s = newGame(3, seeded(seed));
    const p = (s.current + 1) % 3;
    if (canAnnounce(s, p)) continue;
    checked++;
    assert.deepEqual(setCanDo(s, p, [s.missions[0].id]).canDo, [], 'avec l\'indice : refusé');
    const free = setCanDo(s, p, [s.missions[0].id, s.missions[1].id], true);
    assert.deepEqual(free.canDo, [{ player: p, missions: [s.missions[0].id, s.missions[1].id] }], 'sans l\'indice : accepté');
    assert.deepEqual(reachableMissions(s, p), []);
  }
  assert.ok(checked > 0);
});
