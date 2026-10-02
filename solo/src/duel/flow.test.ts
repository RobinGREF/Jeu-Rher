import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { DEFAULT_CATEGORIES, newDuel } from './engine';
import { publicFlow, reduce, startFlow, type Action, type Flow } from './flow';
import { sectorPath } from './wheelPath';

const seeded = (seed = 1) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const run = (f: Flow, ...as: Action[]) => as.reduce((x, a) => reduce(x, a, seeded(4)), f);
const fresh = () => startFlow(newDuel(['A', 'B'], DEFAULT_CATEGORIES));
const toQuestion = () => run(fresh(), { t: 'cat', cat: 'geo' }, { t: 'diff', diff: 'facile' }, { t: 'reveal' });

test('parcours normal : catégorie, difficulté, question, réponse, tour suivant', () => {
  let f = toQuestion();
  assert.equal(f.step, 'question');
  const q = f.turn!.question!;
  f = run(f, { t: 'answer', i: q.correct });
  assert.equal(f.step, 'result');
  assert.ok(f.turn!.correct);
  f = run(f, { t: 'next' });
  assert.equal(f.step, 'category');
  assert.equal(f.game.current, 1);
  assert.equal(f.game.players[0].score, 1);
  assert.equal(f.turn, null);
});

test('mauvaise réponse : le tour passe, les points reculent sans passer sous 0', () => {
  let f = toQuestion();
  const q = f.turn!.question!;
  f = run(f, { t: 'answer', i: (q.correct + 1) % 4 }, { t: 'next' });
  assert.equal(f.game.players[0].score, 0);
  assert.equal(f.game.current, 1);
});

test("à l'aveugle : bonne réponse = points doublés, on rejoue", () => {
  let f = run(fresh(), { t: 'cat', cat: 'geo' }, { t: 'diff', diff: 'difficile' }, { t: 'blindMode' });
  const q = f.turn!.question!;
  f = run(f, { t: 'blindText', text: q.choices[q.correct] }, { t: 'blind' }, { t: 'next' });
  assert.equal(f.game.players[0].score, 4);
  assert.equal(f.game.current, 0);
});

test("l'aveugle sans texte n'est pas validé ; on peut renoncer et voir les propositions", () => {
  let f = run(fresh(), { t: 'cat', cat: 'geo' }, { t: 'diff', diff: 'facile' }, { t: 'blindMode' }, { t: 'blind' });
  assert.equal(f.step, 'blind');
  f = run(f, { t: 'reveal' });
  assert.equal(f.step, 'question');
});

test('un indice ne sert qu\'une fois ; une proposition éliminée ne se choisit pas', () => {
  let f = run(toQuestion(), { t: 'hint', kind: '5050' });
  assert.equal(f.turn!.eliminated.length, 2);
  const again = run(f, { t: 'hint', kind: 'one' });
  assert.equal(again.turn!.eliminated.length, 2);
  const out = f.turn!.eliminated[0];
  assert.equal(run(f, { t: 'answer', i: out }).step, 'question');
});

test('une action hors de propos est ignorée', () => {
  const f = fresh();
  assert.equal(run(f, { t: 'answer', i: 0 }), f);
  assert.equal(run(f, { t: 'next' }), f);
  assert.equal(run(f, { t: 'cat', cat: 'inconnue' }), f);
  const g = run(f, { t: 'cat', cat: 'geo' }, { t: 'back' });
  assert.equal(g.step, 'category');
});

test('la dernière catégorie gagnée mène à la victoire du joueur courant', () => {
  const cats = ['geo'];
  let f = startFlow(newDuel(['Solo'], cats));
  f = run(f, { t: 'cat', cat: 'geo' }, { t: 'diff', diff: 'difficile' }, { t: 'reveal' });
  f = run(f, { t: 'answer', i: f.turn!.question!.correct }, { t: 'next' });
  assert.equal(f.step, 'victory');
  assert.equal(f.game.current, 0);
});

test('les autres joueurs ne voient la bonne réponse qu\'après la question', () => {
  const f = toQuestion();
  const pub = publicFlow(f);
  assert.equal(pub.turn!.question!.correct, -1);
  assert.equal(pub.turn!.question!.info, undefined);
  assert.equal(pub.turn!.question!.choices.length, 4);
  const res = run(f, { t: 'answer', i: 0 });
  assert.equal(publicFlow(res), res);
  assert.ok(res.turn!.question!.correct >= 0);
});

test('la rosace : tracé d\'une part de couronne', () => {
  const d = sectorPath(65, 65, 20, 60, 0, 90);
  assert.ok(d.startsWith('M ') && d.endsWith('Z'));
  assert.equal((d.match(/A /g) ?? []).length, 2);
});
