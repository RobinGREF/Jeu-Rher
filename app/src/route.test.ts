import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { gameFromSearch, hubUrl } from './route';

test("l'adresse choisit le jeu, 50 Missions par défaut", () => {
  assert.equal(gameFromSearch(''), 'missions');
  assert.equal(gameFromSearch('?jeu=duel'), 'duel');
  assert.equal(gameFromSearch('?x=1&jeu=memo'), 'memo');
  assert.equal(gameFromSearch('?jeu=inconnu'), 'missions');
});

test("retour à l'accueil du site depuis le dossier de l'appli", () => {
  assert.equal(hubUrl('https://robingref.github.io/Jeu-Rher/50-missions/?jeu=duel'), 'https://robingref.github.io/Jeu-Rher/');
  assert.equal(hubUrl('https://robingref.github.io/Jeu-Rher/50-missions/index.html'), 'https://robingref.github.io/Jeu-Rher/');
});
