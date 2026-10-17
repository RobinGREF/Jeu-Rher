import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { core, drawLetter, fold, LETTERS, ranking, scoreRound, startsWithLetter, type Round } from './engine';

test('normalisation : accents, majuscules, articles', () => {
  assert.equal(fold("L'Éléphant"), 'l elephant');
  assert.equal(core("L'Éléphant"), 'elephant');
  assert.equal(core('le chat'), 'chat');
  assert.equal(core('Un Âne'), 'ane');
  assert.equal(core('les'), 'les', 'un article seul reste un mot');
  assert.ok(startsWithLetter('Éléphant', 'e'));
  assert.ok(startsWithLetter("l'oiseau", 'O'));
  assert.ok(!startsWithLetter('chat', 'A'));
  assert.ok(!startsWithLetter('a', 'A'), 'un mot d\'une lettre est refusé');
});

test('tirage : jamais deux fois la même lettre tant qu\'il en reste', () => {
  const used: string[] = [];
  for (let i = 0; i < LETTERS.length; i++) { const l = drawLetter(used); assert.ok(!used.includes(l)); used.push(l); }
  assert.ok(LETTERS.includes(drawLetter(used)), 'quand toutes ont servi, on recommence');
  assert.ok(!LETTERS.includes('K') && !LETTERS.includes('W'));
});

const round = (letter: string, answers: Round['answers'], contests: Round['contests'] = {}): Round => ({ letter, answers, contests });

test('points : seul 15, différent 10, doublon 5, invalide 0', () => {
  const r = round('A', {
    a: { animal: 'Âne', pays: 'Algérie', metier: 'Avocat', objet: '' },
    b: { animal: 'ane', pays: 'Argentine', metier: 'Boulanger', objet: '' },
    c: { animal: 'Aigle', pays: '', metier: '', objet: '' },
  });
  const { cells, totals } = scoreRound(r, ['a', 'b', 'c'], ['animal', 'pays', 'metier', 'objet']);
  assert.equal(cells.animal.a.status, 'doublon'); assert.equal(cells.animal.a.pts, 5);
  assert.equal(cells.animal.b.pts, 5);
  assert.equal(cells.animal.c.status, 'unique'); assert.equal(cells.animal.c.pts, 10);
  assert.equal(cells.pays.a.pts, 10); assert.equal(cells.pays.b.pts, 10); assert.equal(cells.pays.c.status, 'vide');
  assert.equal(cells.metier.a.status, 'seul'); assert.equal(cells.metier.a.pts, 15, 'seul à avoir un mot valide');
  assert.equal(cells.metier.b.status, 'faux'); assert.equal(cells.metier.b.pts, 0, 'Boulanger ne commence pas par A');
  assert.equal(cells.objet.a.status, 'vide');
  assert.deepEqual(totals, { a: 5 + 10 + 15, b: 5 + 10, c: 10 });
});

test('contestation : il faut plus de la moitié des autres joueurs', () => {
  const answers = { a: { animal: 'Ane' }, b: { animal: 'Aigle' }, c: { animal: 'Ara' } };
  const one = scoreRound(round('A', answers, { animal: { a: ['b'] } }), ['a', 'b', 'c'], ['animal']);
  assert.equal(one.cells.animal.a.pts, 10, 'un seul contestataire sur deux autres : pas assez');
  const two = scoreRound(round('A', answers, { animal: { a: ['b', 'c'] } }), ['a', 'b', 'c'], ['animal']);
  assert.equal(two.cells.animal.a.status, 'conteste');
  assert.equal(two.cells.animal.a.pts, 0);
  const self = scoreRound(round('A', answers, { animal: { a: ['a', 'a'] } }), ['a', 'b', 'c'], ['animal']);
  assert.equal(self.cells.animal.a.pts, 10, 'on ne peut pas contester son propre mot');
  const duo = scoreRound(round('A', { a: { animal: 'Ane' }, b: { animal: 'Aigle' } }, { animal: { a: ['b'] } }), ['a', 'b'], ['animal']);
  assert.equal(duo.cells.animal.a.pts, 0, 'à deux, l\'autre joueur suffit');
  assert.equal(duo.cells.animal.b.status, 'seul', 'un mot contesté ne compte plus comme concurrent');
});

test('classement : égalités au même rang', () => {
  assert.deepEqual(ranking({ a: 30, b: 50, c: 30, d: 10 }).map((x) => [x.uid, x.rank]), [['b', 1], ['a', 2], ['c', 2], ['d', 4]]);
});

import { botAnswers, BOT_NAMES } from './bots';
import { WORDS } from './words';

test('réserve des machines : tous les mots commencent par leur lettre', () => {
  for (const [cat, byLetter] of Object.entries(WORDS)) {
    for (const [letter, list] of Object.entries(byLetter)) {
      for (const w of list) assert.ok(startsWithLetter(w, letter), `${cat} ${letter} : « ${w} »`);
    }
  }
  assert.ok(Object.keys(WORDS).length >= 14);
});

test('machines : réponses valides, jamais hors catégories, parfois vides', () => {
  let seed = 7; const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const cats = ['prenom', 'pays', 'animal'];
  let empty = 0, total = 0;
  for (const l of LETTERS) for (let i = 0; i < 20; i++) {
    const a = botAnswers(l, cats, rng);
    assert.deepEqual(Object.keys(a), cats);
    for (const c of cats) { total++; if (!a[c]) empty++; else assert.ok(startsWithLetter(a[c], l)); }
  }
  assert.ok(empty > 0 && empty < total * 0.5, 'les machines ratent parfois');
  assert.ok(BOT_NAMES.length >= 7);
});

test('contestation : seuls les joueurs humains votent', () => {
  const answers = { h: { animal: 'Ane' }, b: { animal: 'Aigle' } };
  const r = { letter: 'A', answers, contests: { animal: { b: ['h'] } } };
  const s = scoreRound(r, ['h', 'b'], ['animal'], ['h']);
  assert.equal(s.cells.animal.b.status, 'conteste', 'seul humain : sa contestation suffit même si une machine est à la table');
  const none = scoreRound({ ...r, contests: { animal: { h: ['b'] } } }, ['h', 'b'], ['animal'], ['h']);
  assert.equal(none.cells.animal.h.pts, 10, 'une machine ne contestera jamais');
});

import { isRescued, makeKnown } from './engine';

test('dictionnaire : noms communs vérifiés, noms propres jamais, articles et mots composés tolérés', () => {
  const dict = new Set(['chat', 'ane', 'pomme', 'terre', 'aspirateur']);
  const known = makeKnown((w) => dict.has(w));
  assert.ok(known('animal', 'Âne') && known('animal', "l'âne") && known('animal', 'le chat'));
  assert.ok(!known('animal', 'Anhuzb'), 'un mot qui n\'existe pas');
  assert.ok(known('fruitleg', 'pomme de terre'), 'mot composé : chaque morceau existe');
  assert.ok(!known('fruitleg', 'pomme de zork'));
  assert.ok(known('prenom', 'Zorglub') && known('pays', 'Atlantis') && known('marque', 'Xyz'), 'noms propres : au vote seulement');
  assert.ok(makeKnown((w) => dict.has(w), (cat, f) => cat === 'objet' && f === 'agrafeuse')('objet', 'Agrafeuse'), 'la réserve des machines compte');
});

test('dictionnaire : un mot inconnu vaut 0, sauf si plus de la moitié des autres humains l\'acceptent', () => {
  const known = makeKnown((w) => ['aspirateur', 'ane'].includes(w));
  const base = { letter: 'A', answers: { a: { objet: 'Aspirateur', animal: 'Agzzu' }, b: { objet: 'Aqzqz', animal: 'Ane' }, c: { objet: '', animal: '' } }, contests: {} };
  const s = scoreRound(base, ['a', 'b', 'c'], ['objet', 'animal'], ['a', 'b', 'c'], known);
  assert.equal(s.cells.animal.a.status, 'inconnu'); assert.equal(s.cells.animal.a.pts, 0);
  assert.equal(s.cells.objet.b.status, 'inconnu');
  assert.equal(s.cells.objet.a.status, 'seul', 'le mot inconnu des autres ne compte pas comme concurrent');
  const rescued = { ...base, accepts: { animal: { a: ['b', 'c'] } } };
  assert.ok(isRescued(rescued, 'animal', 'a', ['a', 'b', 'c']));
  const r = scoreRound(rescued, ['a', 'b', 'c'], ['objet', 'animal'], ['a', 'b', 'c'], known);
  assert.equal(r.cells.animal.a.pts, 10, 'repêché par les deux autres joueurs');
  const half = scoreRound({ ...base, accepts: { animal: { a: ['b'] } } }, ['a', 'b', 'c'], ['animal'], ['a', 'b', 'c'], known);
  assert.equal(half.cells.animal.a.status, 'inconnu', 'un accord sur deux ne suffit pas');
});

test('pays : un pays inventé est refusé, les vrais passent (réserve des machines comprise)', async () => {
  const { COUNTRIES } = await import('./countries');
  const { WORDS } = await import('./words');
  const known = makeKnown(() => true, () => false, { pays: COUNTRIES });
  assert.equal(known('pays', 'Ogwanda'), false);
  assert.equal(known('pays', 'Ouganda'), true);
  assert.equal(known('pays', "Côte d'Ivoire"), true);
  for (const ws of Object.values(WORDS.pays)) for (const w of ws) assert.equal(known('pays', w), true, w);
});

test('ville : une ville inventée est refusée, les vraies passent (réserve des machines comprise)', async () => {
  const { CITIES_FR } = await import('./countries');
  const { WORDS } = await import('./words');
  const known = makeKnown(() => true, (cat, f) => Object.values(WORDS[cat] ?? {}).some((l) => l.some((w) => core(w) === f)), { ville: new Set(['paris', 'lyon', ...CITIES_FR]) });
  assert.equal(known('ville', 'Zorbaville'), false);
  assert.equal(known('ville', 'Londres'), true);
  assert.equal(known('ville', 'Lyon'), true);
  for (const ws of Object.values(WORDS.ville)) for (const w of ws) assert.equal(known('ville', w), true, w);
  assert.equal(makeKnown(() => true)('ville', 'Zorbaville'), true, 'sans liste de villes : pas de contrôle');
});
