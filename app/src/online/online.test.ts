import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { botMove, canAnnounce, newGame, play, playablePiles, type GameState } from '../engine';
import { canRead, canWrite, validScore } from './rules';
import { fetchScores, fromWireScores, toWireScore } from './sharedScores';
import type { ScoreEntry } from '../scores';
import { LocalStorageStore, MemoryStore, StoreBackend } from './localBackend';
import { Host } from './host';
import { OnlineSession, type Snapshot } from './session';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(cond: () => boolean, what: string, ms = 8000) {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) assert.fail(`délai dépassé : ${what}`);
    await sleep(2);
  }
}
const seeded = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

// Toute session ouverte par un test est fermée à la fin, même si le test échoue (sinon la partie continue en fond).
const opened: OnlineSession[] = [];
afterEach(() => { opened.splice(0).forEach((s) => s.leave()); });
const track = <T extends OnlineSession>(s: T): T => { opened.push(s); return s; };
const create = async (be: StoreBackend, name: string) => track(await OnlineSession.create(be, name));
const join = async (be: StoreBackend, code: string, name: string) => track(await OnlineSession.join(be, code, name));

/** Tout le monde sur le même « serveur » en mémoire, chacun avec son identifiant. */
const world = () => {
  const store = new MemoryStore();
  return { store, client: (uid: string, enforce = true) => new StoreBackend(store, uid, enforce) };
};

/** Premier coup légal du joueur (toujours le même à situation égale : les tests ne dépendent ni du hasard ni du timing). */
function firstLegal(s: GameState, player: number) {
  for (const c of s.hands[player]) {
    const piles = playablePiles(s, c);
    if (piles.length) return { cardId: c.id, pile: piles[0] };
  }
  return null;
}

/** Joue le premier coup légal si c'est le tour de cette session. */
function act(s: OnlineSession): boolean {
  const { view, mySeat } = s.snapshot;
  if (!view || view.over || view.current !== mySeat) return false;
  const mv = firstLegal(view, mySeat);
  if (!mv) return false;
  s.play(mv.cardId, mv.pile);
  return true;
}

/**
 * Une donne (graine) dont la partie dure au moins `minPlays` coups quand les `humans` premiers sièges jouent
 * leur premier coup légal et que les machines jouent comme d'habitude : une donne malchanceuse peut finir en
 * quelques coups, ce qui rendrait les tests fragiles.
 */
function seedFor(players: number, humans: number, minPlays: number) {
  for (let seed = 1; seed < 3000; seed++) {
    const rng = seeded(seed);
    let s = newGame(players, rng);
    let n = 0;
    while (!s.over && n < 500) {
      const mv = s.current < humans ? firstLegal(s, s.current) : botMove(s, s.current, rng);
      if (!mv) break;
      const r = play(s, mv.cardId, mv.pile, rng);
      if (!r.ok) break;
      s = r.state;
      n++;
    }
    if (n >= minPlays) return seed;
  }
  throw new Error('aucune donne assez longue');
}

test('règles d\'accès : mains privées, seul l\'hôte écrit la partie', () => {
  const data: Record<string, unknown> = { 'rooms/ABCD/meta/hostUid': 'host' };
  const peek = (p: string) => data[p];
  assert.equal(canRead('rooms/ABCD/hands/bob', 'bob', peek), true);
  assert.equal(canRead('rooms/ABCD/hands/bob', 'eve', peek), false);
  assert.equal(canRead('rooms/ABCD/hands/bob', null, peek), false);
  assert.equal(canRead('rooms/ABCD/hostState', 'bob', peek), false);
  assert.equal(canRead('rooms/ABCD/hostState', 'host', peek), true);
  assert.equal(canRead('rooms', 'host', peek), false);
  assert.equal(canRead('rooms/ABCD/intents', 'bob', peek), false);
  assert.equal(canRead('rooms/ABCD/public', 'bob', peek), true);
  assert.equal(canWrite('rooms/ABCD/public', 'bob', {}, peek), false);
  assert.equal(canWrite('rooms/ABCD/public', 'host', {}, peek), true);
  assert.equal(canWrite('rooms/ABCD/hands/bob', 'bob', {}, peek), false);
  assert.equal(canWrite('rooms/ABCD/players/bob', 'bob', {}, peek), true);
  assert.equal(canWrite('rooms/ABCD/players/bob', 'eve', {}, peek), false);
  assert.equal(canWrite('rooms/ABCD/intents/x1', 'bob', { uid: 'bob' }, peek), true);
  assert.equal(canWrite('rooms/ABCD/intents/x1', 'bob', { uid: 'eve' }, peek), false);
  assert.equal(canWrite('rooms/ABCD/intents/x1', 'bob', null, peek), false);
  assert.equal(canWrite('rooms/ABCD/intents/x1', 'host', null, peek), true);
  assert.equal(canWrite('rooms/ABCD/meta', 'bob', { hostUid: 'bob' }, peek), false); // salon existant : pas de prise de contrôle
  assert.equal(canWrite('rooms/ZZZZ/meta', 'bob', { hostUid: 'bob' }, () => undefined), true); // création
  assert.equal(canWrite('rooms/ZZZZ/meta', 'bob', { hostUid: 'eve' }, () => undefined), false);
});

test('salon : créer, rejoindre, refus (code inconnu, complet, partie commencée)', async () => {
  const w = world();
  const host = await create(w.client('h'), 'Robin');
  const code = host.snapshot.code;
  assert.match(code, /^[A-HJ-NP-Z]{4}$/);
  await until(() => host.snapshot.isHost && host.snapshot.players.length === 1, 'hôte dans le salon');
  await assert.rejects(join(w.client('x'), 'ZZZZ', 'X'), /Aucun salon/);
  await assert.rejects(join(w.client('x'), 'ab', 'X'), /4 lettres/);
  const a = await join(w.client('a'), code.toLowerCase(), 'Alice');
  await join(w.client('b'), code, 'Bob');
  await join(w.client('c'), code, 'Chloé');
  await assert.rejects(join(w.client('d'), code, 'Dan'), /complet/);
  await until(() => host.snapshot.players.length === 4, '4 joueurs vus par l\'hôte');
  assert.deepEqual(host.snapshot.players.map((p) => p.name), ['Robin', 'Alice', 'Bob', 'Chloé']);
  await until(() => a.snapshot.players.length === 4, 'Alice voit le salon');
  await host.startGame(4);
  await until(() => a.snapshot.phase === 'playing', 'Alice voit la partie');
  await assert.rejects(join(w.client('z'), code, 'Zoé'), /déjà commencé/);
  // reconnexion d'un joueur déjà assis : acceptée
  const a2 = await join(w.client('a'), code, 'Alice');
  await until(() => a2.snapshot.phase === 'playing' && a2.snapshot.view !== null, 'reconnexion d\'Alice');
  [host, a, a2].forEach((s) => s.leave());
});

test('partie à 3 humains + 1 machine, jusqu\'au bout : confidentialité et cohérence', async () => {
  const w = world();
  const seed = seedFor(4, 3, 20);
  const host = await create(w.client('h'), 'Robin');
  await host.configure({ pauseMs: 2, phrases: false, manual: false });
  const code = host.snapshot.code;
  const a = await join(w.client('a'), code, 'Alice');
  const b = await join(w.client('b'), code, 'Bob');
  await until(() => host.snapshot.players.length === 3, 'salon plein');
  await host.startGame(4, seeded(seed));
  const all = [host, a, b];
  await until(() => all.every((s) => s.snapshot.view !== null), 'tous ont leur vue');

  // 1. Chacun voit sa vraie main, et seulement des dos pour les autres.
  for (const s of all) {
    const { view, mySeat, pub } = s.snapshot;
    assert.equal(mySeat, all.indexOf(s));
    view!.hands.forEach((h, i) => {
      assert.equal(h.length, pub!.handCounts[i]);
      if (i === mySeat) assert.ok(h.every((c) => c.value >= 1 && c.value <= 7), 'ma main est réelle');
      else assert.ok(h.every((c) => c.value === 0 && c.id < 0), `main de ${i} masquée pour ${mySeat}`);
    });
    assert.ok(!('hands' in (pub as object)), 'l\'état public ne contient aucune main');
    assert.equal(pub!.seats[3].bot, true);
  }
  // 2. Le serveur refuse de montrer la main d'un autre, et à un joueur d'écrire l'état de la partie.
  const eve = w.client('a');
  await assert.rejects(eve.get(`rooms/${code}/hands/b`), /permission_denied/);
  await assert.rejects(eve.get(`rooms/${code}/hostState`), /permission_denied/);
  await assert.rejects(eve.set(`rooms/${code}/public`, { json: '{}' }), /permission_denied/);
  await assert.rejects(eve.set(`rooms/${code}/hands/a`, { json: '[]' }), /permission_denied/);
  await assert.rejects(eve.set(`rooms/${code}/meta`, { hostUid: 'a' }), /permission_denied/);

  // 3. Tout le monde joue au hasard, la machine joue seule, jusqu'à la fin de la partie.
  let plays = 0;
  const t0 = Date.now();
  while (!all.every((s) => s.snapshot.phase === 'over')) {
    if (Date.now() - t0 > 25000) assert.fail('la partie ne se termine pas');
    for (const s of all) if (act(s)) plays++;
    await sleep(2);
    // à tout instant, les trois vues sont cohérentes entre elles
    const p = all.map((s) => s.snapshot.pub!);
    if (p[0].v === p[1].v && p[1].v === p[2].v) assert.deepEqual(p[0].piles, p[1].piles);
  }
  assert.ok(plays > 5, 'au moins quelques coups humains');
  const finals = all.map((s) => s.snapshot.pub!);
  assert.ok(finals.every((f) => f.over && f.completed === finals[0].completed));
  assert.ok(finals[0].history.length > 5);

  // Fin de partie : l'hôte a inscrit le résultat au tableau partagé, avec les noms de tous les participants.
  const viewer = w.client('a'); // n'importe quel joueur connecté peut lire le tableau
  await until(() => (w.store.read() as { scores?: Record<string, unknown> }).scores?.[code] !== undefined, 'score publié');
  const shared = await fetchScores(viewer);
  assert.equal(shared.length, 1);
  assert.equal(shared[0].id, code);
  assert.equal(shared[0].mode, 'online');
  assert.equal(shared[0].completed, finals[0].completed);
  assert.deepEqual(shared[0].players, [
    { name: 'Robin', bot: false }, { name: 'Alice', bot: false }, { name: 'Bob', bot: false }, { name: 'Machine 1', bot: true },
  ]);
  // personne ne peut écraser ni falsifier : ni un joueur, ni même l'hôte une seconde fois, ni une valeur hors limites
  const forged = toWireScore({ ...shared[0], completed: 50 });
  await assert.rejects(viewer.set(`scores/${code}`, forged), /permission_denied/);
  await assert.rejects(w.client('h').set(`scores/${code}`, forged), /permission_denied/, 'un score déjà écrit ne se remplace pas');
  await assert.rejects(w.client('a').remove(`scores/${code}`), /permission_denied/);
  all.forEach((s) => s.leave());
});

test('un coup hors de son tour ou d\'une carte qu\'on n\'a pas est ignoré ; annonces « je peux »', async () => {
  const w = world();
  const host = await create(w.client('h'), 'Robin');
  await host.configure({ pauseMs: 60000, phrases: true, manual: false });
  const a = await join(w.client('a'), host.snapshot.code, 'Alice');
  await until(() => host.snapshot.players.length === 2, 'salon');
  // Une donne où Alice (siège 1) peut réussir une mission et pas l'hôte (siège 0) : le test ne dépend pas du hasard.
  let seed = 1;
  while (seed < 2000 && !(canAnnounce(newGame(2, seeded(seed)), 1) && !canAnnounce(newGame(2, seeded(seed)), 0))) seed++;
  assert.ok(seed < 2000, 'aucune donne adaptée');
  await host.startGame(2, seeded(seed));
  await until(() => a.snapshot.view !== null && host.snapshot.view !== null, 'vues');
  // c'est à l'hôte de jouer : Alice tente un coup (refusé) et une annonce (acceptée, elle n'a pas besoin de son tour)
  const v0 = a.snapshot.pub!.v;
  const mine = a.snapshot.view!.hands[1][0];
  a.play(mine.id, 0);
  const target = a.snapshot.view!.missions[0].id;
  a.announce([target]);
  await until(() => a.snapshot.pub!.canDo.some((x) => x.player === 1), 'annonce d\'Alice visible');
  assert.deepEqual(a.snapshot.pub!.canDo, [{ player: 1, missions: [target] }], 'l\'annonce dit sur quelle mission');
  // l'hôte, qui ne peut rien réussir, n'est pas autorisé à annoncer
  host.announce([target]);
  await sleep(30);
  assert.ok(!host.snapshot.pub!.canDo.some((x) => x.player === 0), 'annonce refusée à qui ne peut rien réussir');
  assert.equal(a.snapshot.pub!.current, 0, 'le tour n\'a pas bougé');
  assert.ok(a.snapshot.pub!.v > v0);
  // l'hôte, lui, ne peut pas jouer une carte qui n'est pas dans sa main
  host.play(a.snapshot.view!.hands[1][0].id, 0);
  await sleep(30);
  assert.equal(host.snapshot.pub!.current, 0);
  // phrases du livret acceptées quand l'option est active
  a.toggleSignal('good', { pile: 2 });
  await until(() => a.snapshot.pub!.signals.length === 1, 'phrase visible');
  assert.deepEqual(a.snapshot.pub!.signals[0], { player: 1, kind: 'good', pile: 2 });
  [host, a].forEach((s) => s.leave());
});

test('l\'hôte recharge la page : la partie reprend là où elle en était', async () => {
  const w = world();
  const seed = seedFor(2, 2, 12);
  let host = await create(w.client('h'), 'Robin');
  await host.configure({ pauseMs: 60000, phrases: false, manual: false });
  const code = host.snapshot.code;
  const a = await join(w.client('a'), code, 'Alice');
  await until(() => host.snapshot.players.length === 2, 'salon');
  await host.startGame(2, seeded(seed));
  await until(() => host.snapshot.view !== null && a.snapshot.view !== null, 'vues');
  for (let i = 0; i < 4; i++) {
    const s = [host, a][host.snapshot.pub!.current];
    const before = host.snapshot.pub!.v;
    assert.ok(act(s));
    await until(() => host.snapshot.pub!.v > before, 'coup publié');
    await until(() => a.snapshot.pub!.v === host.snapshot.pub!.v && a.snapshot.view !== null, 'Alice à jour');
  }
  const snap = host.snapshot.pub!;
  const handBefore = JSON.stringify(host.snapshot.view!.hands[0]);
  host.leave(); // « rechargement »
  host = await join(w.client('h'), code, 'Robin');
  await until(() => host.snapshot.isHost && host.snapshot.view !== null && host.snapshot.pub!.v >= snap.v, 'hôte de retour');
  await sleep(20);
  assert.equal(host.snapshot.pub!.current, snap.current);
  assert.equal(host.snapshot.pub!.completed, snap.completed);
  assert.equal(JSON.stringify(host.snapshot.view!.hands[0]), handBefore);
  // et la partie continue : le joueur dont c'est le tour peut jouer
  const s = [host, a][host.snapshot.pub!.current];
  const v = host.snapshot.pub!.v;
  assert.ok(act(s));
  await until(() => host.snapshot.pub!.v > v, 'la partie continue');
  [host, a].forEach((x) => x.leave());
});

test('un joueur absent est remplacé par une machine et la partie continue', async () => {
  const w = world();
  const host = await create(w.client('h'), 'Robin');
  await host.configure({ pauseMs: 3, phrases: false, manual: false });
  const a = await join(w.client('a'), host.snapshot.code, 'Alice');
  await until(() => host.snapshot.players.length === 2, 'salon');
  await host.startGame(2, seeded(seedFor(2, 1, 8)));
  await until(() => host.snapshot.view !== null, 'vue');
  host.botify(1); // Alice a disparu
  await until(() => host.snapshot.pub!.seats[1].bot, 'siège 1 devenu machine');
  assert.match(host.snapshot.pub!.seats[1].name, /Alice \(machine\)/);
  // l'hôte joue ; la machine (siège 1) répond seule
  const t0 = Date.now();
  let seat1Played = false;
  while (!seat1Played && Date.now() - t0 < 8000) {
    act(host);
    await sleep(3);
    seat1Played = host.snapshot.pub!.history.some((h) => h.startsWith('Alice (machine)'));
  }
  assert.ok(seat1Played, 'la machine a joué à la place d\'Alice');
  [host, a].forEach((x) => x.leave());
});

test('Host.launch direct : refuse un coup illégal', async () => {
  const w = world();
  const be = w.client('h');
  await be.set('rooms/WXYZ/meta', { hostUid: 'h', createdAt: 0, phase: 'lobby', options: { pauseMs: 60000, phrases: false, manual: false } });
  const host = await Host.launch(be, 'WXYZ', [{ name: 'A', bot: false, uid: 'h' }, { name: 'B', bot: true }], { pauseMs: 60000, phrases: false, manual: false });
  const snap = (await be.get('rooms/WXYZ/public')) as { json: string };
  const before = JSON.parse(snap.json).v;
  host.submit({ uid: 'h', type: 'play', cardId: 99999, pile: 0 });
  host.submit({ uid: 'intrus', type: 'canDo', missions: [] });
  await sleep(20);
  assert.equal(JSON.parse(((await be.get('rooms/WXYZ/public')) as { json: string }).json).v, before);
  host.stop();
});

void (null as unknown as Snapshot);

test('stockage entre onglets : mêmes résultats que la mémoire, écritures atomiques, suppressions', () => {
  // Un localStorage de fortune, comme dans un navigateur.
  const data = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    get length() { return data.size; },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
    clear: () => data.clear(),
  } as Storage;
  const mem = new MemoryStore();
  const ls = new LocalStorageStore('t:');
  const ops: [string, unknown][] = [
    ['rooms/A/meta', { hostUid: 'h', phase: 'lobby', options: { pauseMs: 1, phrases: false } }],
    ['rooms/A/players/h', { name: 'Robin', joinedAt: 1 }],
    ['rooms/A/players/a', { name: 'Alice', joinedAt: 2 }],
    ['rooms/A/intents/k1', { uid: 'a', type: 'play', cardId: 3, pile: 1 }],
    ['rooms/A/intents/k1', null],
    ['rooms/A/meta/phase', 'playing'],
    ['rooms/A/players', { z: { name: 'Zoé', joinedAt: 9 } }],
    ['rooms/A/players/z/name', null],
    ['rooms/B/meta', { hostUid: 'x' }],
    ['rooms/B', null],
  ];
  for (const [path, v] of ops) {
    mem.write(path, v); ls.write(path, v);
    assert.deepEqual(ls.read(), mem.read(), `après ${path}`);
  }
  // une écriture = une seule clé : jamais d'état à moitié écrit
  ls.write('rooms/C/intents/k9', { uid: 'a', type: 'play', cardId: 7, pile: 2 });
  assert.equal([...data.keys()].filter((k) => k.startsWith('t:rooms/C/intents/k9')).length, 1);
});

test('machines « à mon clic » : elle attend le feu vert, n\'importe quel joueur peut le donner, sinon rien ne bouge', async () => {
  const w = world();
  const host = await create(w.client('h'), 'Robin');
  await host.configure({ pauseMs: 2, phrases: false, manual: true });
  const a = await join(w.client('a'), host.snapshot.code, 'Alice');
  await until(() => host.snapshot.players.length === 2, 'salon');
  await host.startGame(3, seeded(seedFor(3, 2, 6))); // Robin, Alice, Machine 1
  await until(() => host.snapshot.view !== null && a.snapshot.view !== null, 'vues');
  const played = () => host.snapshot.pub!.history.length;
  // Robin puis Alice jouent ; ensuite c'est à la machine (siège 2)
  for (const who of [host, a]) {
    const before = who.snapshot.pub!.v;
    await until(() => who.snapshot.pub!.current === who.snapshot.mySeat, 'son tour');
    assert.ok(act(who));
    await until(() => host.snapshot.pub!.v > before && a.snapshot.pub!.v === host.snapshot.pub!.v, 'coup publié');
  }
  await until(() => host.snapshot.pub!.awaitingGo === 2 && a.snapshot.pub!.awaitingGo === 2, 'la machine attend, chez tous les joueurs');
  const n = played();
  await sleep(120); // largement plus que la pause de 2 ms : sans clic, la machine ne joue pas
  assert.equal(played(), n, 'la machine a joué sans feu vert');
  assert.equal(host.snapshot.pub!.awaitingGo, 2);
  // un joueur donne le feu vert (ici Alice, pas l'hôte) : la machine joue, une seule fois
  a.go();
  await until(() => played() === n + 1, 'la machine joue après le feu vert');
  a.go(); // feu vert de trop : c'est maintenant à Robin, rien ne doit se passer
  await sleep(40);
  assert.equal(played(), n + 1);
  assert.equal(host.snapshot.pub!.awaitingGo, null);
  assert.equal(host.snapshot.pub!.current, 0);
});

test('tableau partagé : règles de lecture et d\'écriture, contrôle des valeurs', () => {
  const data: Record<string, unknown> = { 'rooms/ABCD/meta/hostUid': 'host', 'scores/DONE': { at: 1 } };
  const peek = (p: string) => data[p];
  const ok = { at: 1, completed: 12, plays: 40, medal: '', players: { 0: { name: 'Robin', bot: false }, 1: { name: 'Machine 1', bot: true } } };
  assert.equal(canRead('scores', 'bob', peek), true);
  assert.equal(canRead('scores', null, peek), false);
  assert.equal(canWrite('scores/ABCD', 'host', ok, peek), true);
  assert.equal(canWrite('scores/ABCD', 'bob', ok, peek), false, 'pas l\'hôte du salon');
  assert.equal(canWrite('scores/ABCD', null, ok, peek), false);
  assert.equal(canWrite('scores/ZZZZ', 'host', ok, peek), false, 'salon inconnu');
  assert.equal(canWrite('scores/DONE', 'host', ok, (p) => (p === 'rooms/DONE/meta/hostUid' ? 'host' : peek(p))), false, 'déjà écrit');
  assert.equal(canWrite('scores/ABCD', 'host', null, peek), false, 'pas de suppression');
  assert.equal(canWrite('scores', 'host', ok, peek), false, 'pas d\'écriture en bloc');
  for (const bad of [
    { ...ok, completed: 51 }, { ...ok, completed: -1 }, { ...ok, plays: 5000 }, { ...ok, medal: 'médaille-trop-longue' },
    { ...ok, extra: 1 }, { ...ok, players: {} }, { ...ok, players: { 0: { name: 'x'.repeat(15), bot: false } } },
    { ...ok, players: { 0: { name: 'Robin', bot: 'oui' } } }, { ...ok, players: { 0: { name: 'Robin', bot: false, x: 1 } } }, { at: 1 },
  ]) assert.equal(validScore(bad), false, JSON.stringify(bad).slice(0, 60));
  assert.equal(validScore(ok), true);
});

test('tableau partagé : lecture tolérante (listes Firebase, entrées abîmées), classement', () => {
  const e = (id: string, completed: number, plays: number): ScoreEntry => ({ id, at: 1, completed, plays, medal: completed >= 24 ? 'or' : null, mode: 'online', players: [{ name: 'Robin', bot: false }, { name: 'Machine 1', bot: true }] });
  const wire = { AAAA: toWireScore(e('AAAA', 12, 30)), BBBB: toWireScore(e('BBBB', 30, 50)), CCCC: toWireScore(e('CCCC', 30, 40)) };
  const back = fromWireScores(wire);
  assert.deepEqual(back.map((x) => x.id), ['CCCC', 'BBBB', 'AAAA']);
  assert.deepEqual(back[0], e('CCCC', 30, 40));
  // Firebase renvoie une liste à clés 0, 1, 2… sous forme de tableau
  const asArray = { ZZZZ: { ...toWireScore(e('ZZZZ', 5, 9)), players: [{ name: 'Robin', bot: false }, { name: 'Alice', bot: false }] } };
  assert.deepEqual(fromWireScores(asArray)[0].players.map((p) => p.name), ['Robin', 'Alice']);
  // entrées mal formées ignorées, base vide ou absente sans erreur
  assert.deepEqual(fromWireScores({ X: { at: 'hier' }, Y: null, Z: { ...toWireScore(e('Z', 5, 9)), completed: 99 }, W: { ...toWireScore(e('W', 5, 9)), players: {} } }), []);
  assert.deepEqual(fromWireScores(null), []);
  assert.deepEqual(fromWireScores('n\'importe quoi'), []);
});

test('fin de partie : les mains de tous sont visibles, avant elles restent des dos', async () => {
  const { buildView } = await import('./wire');
  const card = (id: number): any => ({ id, symbol: 1, value: 3 });
  const pub: any = { seats: [{ name: 'A', bot: false }, { name: 'B', bot: false }], current: 1, completed: 4, medal: null, goldReached: false, over: false,
    missions: [], piles: [0, 1, 2, 3].map((i) => ({ top: card(i), depth: 0 })), deckCount: 0, handCounts: [1, 1], canDo: [], signals: [], nextMedal: null,
    finalHands: [[card(10)], [card(11)]] };
  assert.equal(buildView(pub, [card(10)], 0).hands[1][0].id < 0, true);
  assert.equal(buildView({ ...pub, over: true }, [card(10)], 0).hands[1][0].id, 11);
});
