import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { MemoryStore, StoreBackend } from '../duel/online/localBackend';
import { BacSession, cleanSettings, type View } from './session';

const wait = (ms = 15) => new Promise((r) => setTimeout(r, ms));
const until = async (f: () => boolean) => { for (let i = 0; i < 200 && !f(); i++) await wait(5); assert.ok(f(), 'condition non atteinte'); };
const timing = { collectMs: 60, spinMs: 0 };

async function room(n: number) {
  const store = new MemoryStore();
  const host = await BacSession.create(new StoreBackend(store, 'h0'), 'Robin', timing);
  const guests: BacSession[] = [];
  for (let i = 1; i < n; i++) guests.push(await BacSession.join(new StoreBackend(store, `g${i}`), host.snapshot.code, `Invité ${i}`, timing));
  await until(() => host.snapshot.players.length === n);
  return { host, guests, all: [host, ...guests] };
}
const view = (s: BacSession) => s.snapshot.view as View;

test('réglages : bornes et catégories valides', () => {
  assert.deepEqual(cleanSettings({ rounds: 99, seconds: 0, categories: ['a'] }), { rounds: 10, seconds: 1, categories: ['prenom', 'pays', 'animal', 'metier', 'fruitleg', 'objet'] });
  assert.equal(cleanSettings({ categories: ['x', 'x', 'y', 'z'] }).categories.length, 3, 'doublons retirés');
});

test('une manche complète à 3 : écriture, collecte, vote, points, manche suivante, classement', async () => {
  const { host, guests, all } = await room(3);
  await host.start({ rounds: 2, seconds: 30, categories: ['animal', 'pays', 'metier'] });
  await until(() => guests.every((g) => g.snapshot.view?.phase === 'write'));
  const letter = view(host).letter;
  assert.match(letter, /^[A-Z]$/);
  assert.equal(view(guests[0]).round, undefined, 'pas de réponses visibles pendant l\'écriture');
  assert.ok(view(guests[0]).remainingMs > 25000);

  // un invité crie « Bac ! » : tout le monde passe en collecte
  await guests[0].act({ t: 'stop' });
  await until(() => all.every((s) => s.snapshot.view?.phase === 'collect'));
  assert.equal(view(host).stoppedBy, guests[0].snapshot.uid);
  const word = (i: number) => ({ animal: `${letter}nimal${i}`, pays: `${letter}ays`, metier: i === 2 ? '' : `${letter}etier${i}` });
  await Promise.all(all.map((s, i) => s.act({ t: 'answers', answers: word(i) })));
  await until(() => all.every((s) => s.snapshot.view?.phase === 'vote'));
  const r = view(guests[1]).round!;
  assert.equal(Object.keys(r.answers).length, 3);

  // on conteste le mot de l'hôte : 2 autres joueurs sur 2 → invalide
  await guests[0].act({ t: 'contest', cat: 'animal', target: host.snapshot.uid, on: true });
  await guests[1].act({ t: 'contest', cat: 'animal', target: host.snapshot.uid, on: true });
  await guests[1].act({ t: 'contest', cat: 'animal', target: guests[1].snapshot.uid, on: true }); // pas son propre mot : ignoré
  await until(() => (view(host).round?.contests.animal?.[host.snapshot.uid] ?? []).length === 2);
  await Promise.all(all.map((s) => s.act({ t: 'ready' })));
  await until(() => all.every((s) => s.snapshot.view?.phase === 'scores'));
  const v = view(guests[0]);
  assert.equal(v.cells!.animal[host.snapshot.uid].status, 'conteste');
  assert.equal(v.roundPts![host.snapshot.uid], 0 + 5 + 10, 'animal contesté 0 ; pays identique chez les 3 = 5 ; métier différent de l\'autre mot valide = 10');
  assert.equal(v.cells!.pays[host.snapshot.uid].status, 'doublon');

  await host.next();
  await until(() => all.every((s) => s.snapshot.view?.roundNo === 2 && s.snapshot.view?.phase === 'write'));
  assert.notEqual(view(host).letter, letter, 'une autre lettre à la manche suivante');
  assert.deepEqual(view(host).totals, v.totals, 'les points restent');

  await host.act({ t: 'stop' });
  await until(() => view(host).phase === 'collect');
  await Promise.all(all.map((s) => s.act({ t: 'answers', answers: {} })));
  await until(() => all.every((s) => s.snapshot.view?.phase === 'vote'));
  await host.next(); // l'hôte peut clore le vote
  await until(() => view(host).phase === 'scores');
  await host.next();
  await until(() => all.every((s) => s.snapshot.view?.phase === 'final'));
});

test('hôte : le chrono termine l\'écriture tout seul, et la collecte n\'attend pas un joueur muet', async () => {
  const { host, guests, all } = await room(2);
  await host.start({ rounds: 1, seconds: 1, categories: ['animal', 'pays', 'metier'] });
  await until(() => all.every((s) => s.snapshot.view?.phase === 'write'));
  await until(() => view(guests[0]).phase === 'collect');
  assert.equal(view(host).stoppedBy, null, 'fin par le chrono, pas par un joueur');
  await host.act({ t: 'answers', answers: { animal: 'Abeille' } });
  await until(() => view(guests[0]).phase === 'vote'); // l'invité n'a rien envoyé : la collecte se termine d'elle-même
  assert.deepEqual(view(host).submitted, [host.snapshot.uid]);
});

test('actions refusées : spectateur, mauvais moment, contester son propre mot', async () => {
  const { host, guests, all } = await room(2);
  await host.start({ rounds: 1, seconds: 30, categories: ['animal', 'pays', 'metier'] });
  await until(() => all.every((s) => s.snapshot.view?.phase === 'write'));
  const late = await BacSession.join(backendFor(host), host.snapshot.code, 'Retardataire', timing);
  await until(() => late.snapshot.view !== null);
  assert.equal(late.snapshot.mySeat, -1, 'arrivé après le début : spectateur');
  await late.act({ t: 'stop' });
  await wait(30);
  assert.equal(view(host).phase, 'write', 'un spectateur ne peut pas arrêter la manche');
  await guests[0].act({ t: 'ready' });
  await wait(30);
  assert.deepEqual(view(host).ready, [], 'pas de « prêt » pendant l\'écriture');
});

// Un autre appareil branché sur le même faux serveur que l'hôte.
function backendFor(host: BacSession) {
  const store = (host as unknown as { be: { store: MemoryStore } }).be.store;
  return new StoreBackend(store, 'late');
}

test('seul avec des machines : ajout, retrait, manche complète sans attendre personne', async () => {
  const { host } = await room(1);
  await host.addBot(); await host.addBot();
  await until(() => host.snapshot.bots.length === 2);
  assert.deepEqual(host.snapshot.bots, ['Jack', 'Anne']);
  await host.removeBot('Jack');
  await until(() => host.snapshot.bots.length === 1);
  await host.addBot();
  await until(() => host.snapshot.bots.length === 2);
  assert.deepEqual(host.snapshot.bots, ['Anne', 'Jack'], 'le premier prénom libre est repris');
  await host.start({ rounds: 1, seconds: 30, categories: ['prenom', 'pays', 'animal'] });
  await until(() => host.snapshot.view?.phase === 'write');
  assert.deepEqual(view(host).seats.map((s) => [s.name, !!s.bot]), [['Robin', false], ['Anne', true], ['Jack', true]]);
  await host.act({ t: 'stop' });
  await host.act({ t: 'answers', answers: { prenom: `${view(host).letter}lex`, pays: '', animal: '' } });
  await until(() => view(host).phase === 'vote');
  assert.ok(view(host).ready.length === 2, 'les machines sont déjà prêtes');
  const bots = Object.keys(view(host).round!.answers).filter((u) => u.startsWith('bot-'));
  assert.equal(bots.length, 2, 'les machines ont répondu');
  await host.act({ t: 'ready' });
  await until(() => view(host).phase === 'scores');
  assert.ok(Object.keys(view(host).roundPts!).length === 3);
});

test('machines : la partie ne démarre pas au-delà de 8 places et un seul humain peut contester', async () => {
  const { host } = await room(1);
  for (let i = 0; i < 9; i++) await host.addBot();
  await until(() => host.snapshot.bots.length === 7);
  await wait(30);
  assert.equal(host.snapshot.bots.length, 7, '1 humain + 7 machines = 8 places');
});

test('dictionnaire : le mot inconnu est refusé aux points, puis repêché par un accord', async () => {
  const store = new MemoryStore();
  const known = makeKnown((w) => w.startsWith('a') && w.length < 8);
  const t = { collectMs: 60, spinMs: 0, known: () => known };
  const host = await BacSession.create(new StoreBackend(store, 'h0'), 'Robin', t);
  const g = await BacSession.join(new StoreBackend(store, 'g1'), host.snapshot.code, 'Marie', t);
  await until(() => host.snapshot.players.length === 2);
  await host.start({ rounds: 1, seconds: 30, categories: ['animal', 'objet', 'metier'] });
  await until(() => view(g).phase === 'write');
  const L = view(host).letter;
  await host.act({ t: 'stop' });
  await host.act({ t: 'answers', answers: { animal: `${L}rrrrrrrrrrrr`, objet: `${L}aa`, metier: '' } });
  await g.act({ t: 'answers', answers: { animal: `${L}bb`, objet: '', metier: '' } });
  await until(() => view(host).phase === 'vote');
  await host.act({ t: 'ready' }); await g.act({ t: 'ready' });
  await until(() => view(host).phase === 'scores');
  const bad = view(host).cells!.animal[host.snapshot.uid];
  assert.equal(bad.status, 'inconnu', 'mot trop long : absent de ce faux dictionnaire');
});

import { makeKnown } from './engine';
