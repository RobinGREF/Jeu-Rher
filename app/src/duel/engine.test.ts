import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { CATEGORIES, QUESTIONS } from './questions';
import {
  applyAnswer, drawQuestion, eliminate, hasWon, isBlindCorrect, matchesOneAnswer, newDuel, randomCategories, stepGain, wonCount,
  CATEGORY_TARGET, DEFAULT_CATEGORIES,
} from './engine';

const seeded = (seed = 1) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

test('la banque est cohérente : 20 catégories, 4 propositions, une bonne réponse valide', () => {
  assert.equal(CATEGORIES.length, 20);
  for (const c of CATEGORIES) {
    const qs = QUESTIONS[c.key];
    assert.ok(qs.some((q) => q.diff === 'facile') && qs.some((q) => q.diff === 'difficile'), c.key);
    for (const q of qs) {
      assert.equal(q.choices.length, 4, q.q);
      assert.ok(q.correct >= 0 && q.correct < 4, q.q);
      assert.equal(new Set(q.choices).size, 4, q.q);
    }
  }
  assert.equal(Object.values(QUESTIONS).flat().length, 744);
});

test('le tirage ne répète pas avant épuisement, puis recommence un cycle', () => {
  const rng = seeded(7);
  let seen: Record<string, number[]> = {};
  const total = QUESTIONS.geo.filter((q) => q.diff === 'facile').length;
  const texts = new Set<string>();
  for (let i = 0; i < total; i++) {
    const d = drawQuestion('geo', 'facile', seen, rng);
    seen = d.seen;
    texts.add(d.question.q);
  }
  assert.equal(texts.size, total);
  const again = drawQuestion('geo', 'facile', seen, rng);
  assert.equal(again.seen['geo|facile'].length, 1);
});

test('le tirage mélange les propositions sans perdre la bonne réponse', () => {
  for (let s = 1; s < 30; s++) {
    const { question } = drawQuestion('histoire', 'difficile', {}, seeded(s));
    const original = QUESTIONS.histoire.find((q) => q.q === question.q)!;
    assert.equal(question.choices[question.correct], original.choices[original.correct]);
  }
});

test('les indices éliminent 1 ou 2 mauvaises réponses, jamais la bonne', () => {
  const q = QUESTIONS.geo[0];
  for (let s = 1; s < 20; s++) {
    const one = eliminate(q, 'one', seeded(s));
    const two = eliminate(q, '5050', seeded(s));
    assert.equal(one.length, 1);
    assert.equal(two.length, 2);
    assert.ok(!one.includes(q.correct) && !two.includes(q.correct));
  }
});

test('progression : facile = 1, difficile = 2, 50/50 coûte 1 barre', () => {
  assert.equal(stepGain('facile', null), 1);
  assert.equal(stepGain('difficile', null), 2);
  assert.equal(stepGain('difficile', 'one'), 2);
  assert.equal(stepGain('difficile', '5050'), 1);
  assert.equal(stepGain('facile', '5050'), 0);
});

test('bonne réponse : points, progression plafonnée, tour suivant', () => {
  const g = newDuel(['A', 'B'], DEFAULT_CATEGORIES);
  let o = applyAnswer(g, { correct: true, cat: 'geo', diff: 'facile', hint: null, blind: false });
  assert.equal(o.game.players[0].score, 1);
  assert.equal(o.game.players[0].progress.geo, 1);
  assert.equal(o.game.current, 1);
  assert.equal(g.players[0].score, 0, "l'état d'origine n'est pas modifié");
  o = applyAnswer({ ...o.game, current: 0 }, { correct: true, cat: 'geo', diff: 'difficile', hint: null, blind: false });
  assert.equal(o.game.players[0].progress.geo, CATEGORY_TARGET);
});

test('mauvaise réponse : perte de points sans passer sous 0', () => {
  const g = newDuel(['A', 'B'], DEFAULT_CATEGORIES);
  const o = applyAnswer(g, { correct: false, cat: 'geo', diff: 'difficile', hint: null, blind: false });
  assert.equal(o.game.players[0].score, 0);
  assert.equal(o.gained, 0);
  assert.equal(o.game.current, 1);
});

test("réponse à l'aveugle : points doublés et on rejoue ; raté, le tour passe", () => {
  const g = newDuel(['A', 'B'], DEFAULT_CATEGORIES);
  const ok = applyAnswer(g, { correct: true, cat: 'sport', diff: 'difficile', hint: null, blind: true });
  assert.equal(ok.game.players[0].score, 4);
  assert.equal(ok.game.current, 0);
  const ko = applyAnswer(ok.game, { correct: false, cat: 'sport', diff: 'facile', hint: null, blind: true });
  assert.equal(ko.game.players[0].score, 3);
  assert.equal(ko.game.current, 1);
});

test('victoire quand toutes les catégories sont acquises', () => {
  const cats = ['geo', 'histoire', 'arts', 'sport'];
  let g = newDuel(['Solo'], cats);
  let won = false;
  for (const c of cats) {
    const o = applyAnswer(g, { correct: true, cat: c, diff: 'difficile', hint: null, blind: false });
    g = o.game; won = o.won;
  }
  assert.ok(won);
  assert.equal(wonCount(g, g.players[0]), 4);
  assert.ok(hasWon(g, g.players[0]));
});

test('choix de catégories : tirage sans doublon, en gardant les choix existants', () => {
  const cats = randomCategories(8, ['geo', 'arts'], seeded(3));
  assert.equal(cats.length, 8);
  assert.equal(new Set(cats).size, 8);
  assert.deepEqual(cats.slice(0, 2), ['geo', 'arts']);
  assert.equal(randomCategories(20).length, 20);
});

test("réponse à l'aveugle : fautes, accents, articles, chiffres isolés", () => {
  assert.ok(matchesOneAnswer('paris', 'Paris'));
  assert.ok(matchesOneAnswer('le Pacifique', 'Pacifique'));
  assert.ok(matchesOneAnswer('Marciano', 'Rocky Marciano'));
  assert.ok(matchesOneAnswer('etre en forme', 'être en pleine forme'));
  assert.ok(matchesOneAnswer('5', '5'));
  assert.ok(!matchesOneAnswer('7', '5'));
  assert.ok(!matchesOneAnswer('x', 'Paris'));
  assert.ok(!matchesOneAnswer('', 'Paris'));
  const q = { diff: 'facile' as const, q: '', choices: ['Molière', 'a', 'b', 'c'], correct: 0, alt: ['Jean-Baptiste Poquelin'] };
  assert.ok(isBlindCorrect('moliere', q));
  assert.ok(isBlindCorrect('poquelin', q));
});
