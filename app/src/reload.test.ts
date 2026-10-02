import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { freshUrl } from './reload';

test("l'adresse change à chaque rechargement et garde le reste", () => {
  assert.equal(freshUrl('https://x.github.io/Jeu-Rher/duel-de-savoir/', 111), 'https://x.github.io/Jeu-Rher/duel-de-savoir/?v=111');
  assert.equal(freshUrl('https://x.github.io/Jeu-Rher/memo/?v=111', 222), 'https://x.github.io/Jeu-Rher/memo/?v=222');
  assert.equal(freshUrl('https://x.github.io/a/?b=1#h', 5), 'https://x.github.io/a/?b=1&v=5#h');
});
