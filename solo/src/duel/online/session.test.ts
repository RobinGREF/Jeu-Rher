import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { StoreBackend, MemoryStore } from './localBackend';
import { DuelSession } from './session';

const wait = (ms = 15) => new Promise((r) => setTimeout(r, ms));
const until = async (f: () => boolean) => { for (let i = 0; i < 100 && !f(); i++) await wait(5); assert.ok(f(), 'condition non atteinte'); };

async function room(n: number) {
  const store = new MemoryStore();
  const host = await DuelSession.create(new StoreBackend(store, 'h0'), 'Robin');
  const guests: DuelSession[] = [];
  for (let i = 1; i < n; i++) guests.push(await DuelSession.join(new StoreBackend(store, `g${i}`), host.snapshot.code, `Invité ${i}`));
  await until(() => host.snapshot.players.length === n);
  return { store, host, guests, all: [host, ...guests] };
}

test('un salon à 4 lettres : les joueurs arrivent, l\'hôte est en premier', async () => {
  const { host, guests } = await room(3);
  assert.match(host.snapshot.code, /^[A-Z]{4}$/);
  assert.ok(host.snapshot.isHost);
  await until(() => guests[0].snapshot.players.length === 3);
  assert.deepEqual(guests[0].snapshot.players.map((p) => p.name), ['Robin', 'Invité 1', 'Invité 2']);
  assert.ok(!guests[0].snapshot.isHost);
});

test('rejoindre : mauvais code, code incomplet, salon complet', async () => {
  const empty = new MemoryStore();
  await assert.rejects(DuelSession.join(new StoreBackend(empty, 'x'), 'ABCD', 'X'), /Aucun salon/);
  await assert.rejects(DuelSession.join(new StoreBackend(empty, 'x'), 'AB', 'X'), /4 lettres/);
  const { host, store } = await room(6);
  await assert.rejects(DuelSession.join(new StoreBackend(store, 'z'), host.snapshot.code, 'Z'), /complet/);
});

test('une partie à 2 : seul le joueur dont c\'est le tour peut agir, tout le monde voit le même état', async () => {
  const { host, guests } = await room(2);
  const [g] = guests;
  await host.start(['geo', 'histoire', 'arts', 'sport']);
  await until(() => g.snapshot.phase === 'playing' && g.snapshot.mySeat === 1);
  assert.equal(host.snapshot.mySeat, 0);
  // Ce n'est pas le tour de l'invité : son action est ignorée.
  await g.act({ t: 'cat', cat: 'geo' });
  await wait(30);
  assert.equal(host.snapshot.view!.flow.step, 'category');
  // L'hôte joue.
  await host.act({ t: 'cat', cat: 'geo' });
  await host.act({ t: 'diff', diff: 'facile' });
  await until(() => g.snapshot.view!.flow.step === 'preq');
  await host.act({ t: 'reveal' });
  await until(() => g.snapshot.view!.flow.step === 'question');
  // L'invité voit la question mais pas la bonne réponse.
  const q = g.snapshot.view!.flow.turn!.question!;
  assert.equal(q.correct, -1);
  assert.equal(q.choices.length, 4);
  const secret = host.snapshot.view!.flow.turn!.question!;
  assert.equal(secret.correct, -1, 'même l\'état publié chez l\'hôte est épuré');
  // Les joueurs ne peuvent pas répondre à la place de l'autre.
  await g.act({ t: 'answer', i: 0 });
  await wait(30);
  assert.equal(host.snapshot.view!.flow.step, 'question');
  await host.act({ t: 'answer', i: 0 });
  await until(() => g.snapshot.view!.flow.step === 'result');
  assert.ok(g.snapshot.view!.flow.turn!.question!.correct >= 0, 'la réponse est révélée à la fin');
  await host.act({ t: 'next' });
  await until(() => g.snapshot.view!.flow.game.current === 1 && g.snapshot.view!.flow.step === 'category');
  // Maintenant c'est à l'invité.
  await g.act({ t: 'cat', cat: 'sport' });
  await until(() => host.snapshot.view!.flow.step === 'difficulty');
  assert.equal(host.snapshot.view!.flow.turn!.cat, 'sport');
});

test('arriver après le début : on regarde, sans pouvoir jouer', async () => {
  const { host, store } = await room(2);
  await host.start(['geo', 'arts', 'sport', 'histoire']);
  const late = await DuelSession.join(new StoreBackend(store, 'late'), host.snapshot.code, 'Retard');
  await until(() => late.snapshot.phase === 'playing');
  assert.equal(late.snapshot.mySeat, -1);
  await late.act({ t: 'cat', cat: 'geo' });
  await wait(30);
  assert.equal(host.snapshot.view!.flow.step, 'category');
});

test('l\'hôte quitte : les autres sont prévenus', async () => {
  const { host, guests } = await room(2);
  host.leave();
  await until(() => guests[0].snapshot.phase === 'error');
  assert.match(guests[0].snapshot.error!, /fermé/);
});
