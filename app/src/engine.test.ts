import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSymbolDeck, canPlayOn, newGame, play, playablePiles, setCanDo, canAnnounce, announcedBy, botDelayMs, tops, findMissionMoves, botMove, syncBotAnnouncements, reachableMissions, nextMedal, completedBetween, toggleSignal, syncBotSignals, botMoveGreedy, missionDifficulty, unseenCards } from './engine';

const seeded = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

test('deck : 56 cartes, chaque (symbole, valeur) en double', () => {
  const deck = buildSymbolDeck();
  assert.equal(deck.length, 56);
  assert.equal(deck.filter((c) => c.symbol === 0 && c.value === 3).length, 2);
});

test('canPlayOn : même symbole ou même valeur', () => {
  assert.ok(canPlayOn({ id: 0, symbol: 1, value: 2 }, { id: 1, symbol: 1, value: 5 }));
  assert.ok(canPlayOn({ id: 0, symbol: 1, value: 2 }, { id: 1, symbol: 3, value: 2 }));
  assert.ok(!canPlayOn({ id: 0, symbol: 1, value: 2 }, { id: 1, symbol: 3, value: 5 }));
});

test('mise en place : 4 tas, 4 missions, mains de 4', () => {
  const s = newGame(3, seeded(1));
  assert.equal(s.piles.length, 4);
  assert.equal(s.missions.length, 4);
  s.hands.forEach((h) => assert.equal(h.length, 4));
  assert.equal(s.symbolDeck.length, 56 - 4 - 12);
});

test('coup illégal refusé, coup légal accepté', () => {
  const s = newGame(2, seeded(7));
  const hand = s.hands[s.current];
  const legal = hand.map((c) => ({ c, p: playablePiles(s, c) })).find((x) => x.p.length);
  if (!legal) return;
  const bad = [0, 1, 2, 3].find((p) => !legal.p.includes(p));
  if (bad !== undefined) assert.equal(play(s, legal.c.id, bad).ok, false);
  const r = play(s, legal.c.id, legal.p[0]);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(tops(r.state)[legal.p[0]].id, legal.c.id);
    assert.equal(r.state.hands[s.current].length, 4);
  }
});

test('partie jouée au hasard : se termine, jamais d\'état incohérent', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const rng = seeded(seed);
    let s = newGame(1 + (seed % 4), rng);
    let guard = 0;
    while (!s.over && guard++ < 5000) {
      const moves = s.hands[s.current].flatMap((c) => playablePiles(s, c).map((p) => [c.id, p] as const));
      const [id, p] = moves[Math.floor(rng() * moves.length)];
      const r = play(s, id, p, rng);
      assert.ok(r.ok);
      if (r.ok) s = r.state;
    }
    assert.ok(s.over, `seed ${seed} ne termine pas`);
    const total = s.symbolDeck.length + s.hands.flat().length + s.piles.flat().length;
    assert.equal(total, 56);
  }
});

import { buildMissionDefs } from './missions';
const C = (symbol: 0 | 1 | 2 | 3, value: number) => ({ id: 0, symbol, value });
const JUM = 0, BOU = 1, BRI = 2, COU = 3;
const mission = (start: string) => buildMissionDefs().find((d) => d.label.startsWith(start))!;

test('missions : 50, ids et textes uniques', () => {
  const defs = buildMissionDefs();
  assert.equal(defs.length, 50);
  assert.equal(new Set(defs.map((d) => d.id)).size, 50);
  assert.equal(new Set(defs.map((d) => d.label)).size, 50);
});

test('missions : sommes', () => {
  assert.ok(mission('La somme des Boussoles est égale à 11').check([C(BOU, 5), C(BOU, 6), C(JUM, 1), C(COU, 2)]));
  assert.ok(!mission('La somme des Boussoles est égale à 11').check([C(BOU, 5), C(BOU, 5), C(JUM, 1), C(COU, 2)]));
  assert.ok(mission('La somme des 4 cartes est égale à 15').check([C(0, 4), C(1, 4), C(2, 4), C(3, 3)]));
});

test('missions : égalité et double exigent au moins une carte de chaque', () => {
  const eq = mission('La somme des Boussoles est égale à celle des Jumelles');
  assert.ok(eq.check([C(BOU, 3), C(JUM, 3), C(BRI, 1), C(COU, 1)]));
  assert.ok(!eq.check([C(BRI, 3), C(COU, 3), C(BRI, 1), C(COU, 1)])); // 0 = 0 ne compte pas
  const dbl = mission('La somme des Couteaux est le double de celle des Boussoles');
  assert.ok(dbl.check([C(COU, 6), C(COU, 4), C(BOU, 5), C(BRI, 1)]));
  assert.ok(!dbl.check([C(COU, 5), C(BOU, 5), C(BRI, 1), C(BRI, 2)]));
});

test('missions : positions', () => {
  const touch = mission('Exactement 2 cartes sont des Couteaux et elles se touchent');
  const apart = mission('Exactement 2 cartes sont des Couteaux et elles ne se touchent pas');
  const gap1 = mission("Exactement 2 cartes sont des Couteaux et elles sont espacées");
  const a = [C(COU, 1), C(COU, 2), C(JUM, 3), C(BRI, 4)];
  const b = [C(COU, 1), C(JUM, 2), C(COU, 3), C(BRI, 4)];
  const c = [C(COU, 1), C(JUM, 2), C(BRI, 3), C(COU, 4)];
  assert.deepEqual([touch.check(a), touch.check(b), touch.check(c)], [true, false, false]);
  assert.deepEqual([apart.check(a), apart.check(b), apart.check(c)], [false, true, true]);
  assert.deepEqual([gap1.check(a), gap1.check(b), gap1.check(c)], [false, true, false]);
  assert.ok(!touch.check([C(COU, 1), C(COU, 2), C(COU, 3), C(BRI, 4)])); // 3 couteaux : pas « exactement 2 »
});

test('missions : valeurs', () => {
  const three = mission('Les valeurs des 3 cartes qui se touchent');
  assert.ok(three.check([C(0, 1), C(1, 5), C(2, 4), C(3, 3)])); // 5 4 3
  assert.ok(three.check([C(0, 3), C(1, 4), C(2, 5), C(3, 1)]));
  assert.ok(!three.check([C(0, 3), C(1, 5), C(2, 4), C(3, 6)])); // consécutives mais pas dans l'ordre
  const four = mission('Les valeurs des 4 cartes se suivent');
  assert.ok(four.check([C(0, 6), C(1, 3), C(2, 5), C(3, 4)]));
  assert.ok(!four.check([C(0, 6), C(1, 3), C(2, 5), C(3, 5)]));
  assert.ok(mission('Chaque carte a une valeur inférieure à 4').check([C(0, 1), C(1, 2), C(2, 3), C(3, 3)]));
  assert.ok(!mission('Chaque carte a une valeur inférieure à 4').check([C(0, 1), C(1, 2), C(2, 3), C(3, 4)]));
  assert.ok(!mission('Chaque carte a une valeur supérieure à 4').check([C(0, 4), C(1, 5), C(2, 6), C(3, 7)]));
  const odd2 = mission('Exactement 2 cartes sont impaires');
  assert.ok(odd2.check([C(0, 1), C(1, 2), C(2, 3), C(3, 4)]));
  assert.ok(!odd2.check([C(0, 1), C(1, 3), C(2, 2), C(3, 4)]));
});

test('missions : que des X et/ou Y, symboles différents', () => {
  assert.ok(mission("Il n'y a que des cartes Couteaux et/ou Briquets").check([C(COU, 1), C(BRI, 2), C(COU, 3), C(COU, 4)]));
  assert.ok(!mission("Il n'y a que des cartes Couteaux et/ou Briquets").check([C(COU, 1), C(BRI, 2), C(JUM, 3), C(COU, 4)]));
  assert.ok(mission('Chaque carte a une valeur et un symbole différent').check([C(BOU, 3), C(JUM, 7), C(COU, 2), C(BRI, 6)]));
  assert.ok(!mission('Chaque carte a une valeur et un symbole différent').check([C(BOU, 3), C(JUM, 3), C(COU, 2), C(BRI, 6)]));
});

test('missions : chaque mission a un dessin', () => {
  for (const d of buildMissionDefs()) {
    assert.ok(d.visual.kind === 'row' ? d.visual.items.length >= 3 : true, d.label);
  }
});

/** Une partie où ce joueur peut réussir au moins une mission tout de suite (et un autre qui ne le peut pas, si possible). */
function findState(pred: (s: ReturnType<typeof newGame>) => boolean) {
  for (let seed = 1; seed < 400; seed++) { const s = newGame(3, seeded(seed)); if (pred(s)) return s; }
  throw new Error('aucune partie adaptée trouvée');
}

test('annonce « je peux » : seulement si on peut, avec les missions choisies', () => {
  const s0 = findState((s) => [0, 1, 2].some((p) => canAnnounce(s, p)) && [0, 1, 2].some((p) => !canAnnounce(s, p)));
  const can = [0, 1, 2].find((p) => canAnnounce(s0, p))!;
  const cannot = [0, 1, 2].find((p) => !canAnnounce(s0, p))!;
  const ids = s0.missions.map((m) => m.id);
  // impossible d'annoncer quand on ne peut rien réussir
  assert.equal(setCanDo(s0, cannot, [ids[0]]), s0);
  // on annonce une ou plusieurs missions ; les inconnues sont ignorées, les doublons aussi
  let s = setCanDo(s0, can, [ids[1], ids[0], ids[0], 'inconnue']);
  assert.deepEqual(announcedBy(s, can)?.missions.sort(), [ids[0], ids[1]].sort());
  // une nouvelle annonce remplace la précédente ; une liste vide la retire
  s = setCanDo(s, can, [ids[2]]);
  assert.deepEqual(announcedBy(s, can)?.missions, [ids[2]]);
  s = setCanDo(s, can, []);
  assert.equal(announcedBy(s, can), null);
  // joueurs hors table refusés
  assert.equal(setCanDo(s0, 3, [ids[0]]), s0);
  assert.equal(setCanDo(s0, -1, [ids[0]]), s0);
});

test('annonce « je peux » : possible hors tour, conservée seulement si le coup suivant ne la touche pas', () => {
  let kept = 0, dropped = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const s0 = newGame(3, seeded(seed));
    const who = (s0.current + 1) % 3;
    const reach = reachableMissions(s0, who);
    if (!reach.length) continue;
    const s = setCanDo(s0, who, reach);
    assert.equal(announcedBy(s, who)?.player, who);
    for (const c of s.hands[s.current]) for (const pile of playablePiles(s, c)) {
      const r = play(s, c.id, pile, seeded(seed));
      assert.ok(r.ok);
      if (!r.ok) continue;
      const still = reach.filter((id) => r.state.missions.some((m) => m.id === id) && reachableMissions(r.state, who).includes(id));
      const a = announcedBy(r.state, who);
      if (still.length) { kept++; assert.deepEqual(a?.missions, still, `seed ${seed} : l'annonce intacte reste positionnée`); }
      else { dropped++; assert.equal(a, null, `seed ${seed} : annonce touchée, elle tombe`); }
      assert.deepEqual(r.state.passed, []);
    }
  }
  assert.ok(kept > 0 && dropped > 0, `cas couverts : conservée ${kept}, tombée ${dropped}`);
});

test('coup de pouce : chaque coup proposé réussit bien ses missions, tous les joueurs, hors tour compris', () => {
  let proposed = 0;
  for (let seed = 1; seed <= 150; seed++) {
    const rng = seeded(seed);
    let s = newGame(3, rng);
    let guard = 0;
    while (!s.over && guard++ < 5000) {
      for (let p = 0; p < 3; p++) {
        for (const mv of findMissionMoves(s, p)) {
          proposed++;
          assert.ok(mv.missions.length >= 1);
          // On fait jouer ce joueur à la place du joueur courant pour vérifier la promesse.
          const alt = { ...s, current: p };
          const r = play(alt, mv.cardId, mv.pile, rng);
          assert.ok(r.ok);
          if (r.ok) assert.ok(r.state.completed - s.completed >= mv.missions.length, `seed ${seed}`);
        }
      }
      const sorted = findMissionMoves(s, s.current).map((m) => m.missions.length);
      assert.deepEqual(sorted, [...sorted].sort((a, b) => b - a));
      const moves = s.hands[s.current].flatMap((c) => playablePiles(s, c).map((p) => [c.id, p] as const));
      const [id, p] = moves[Math.floor(rng() * moves.length)];
      const r = play(s, id, p, rng);
      if (!r.ok) return assert.fail(r.error);
      s = r.state;
    }
  }
  assert.ok(proposed > 0, 'aucun coup de pouce rencontré : test sans valeur');
});

function playBots(seed: number, players: number, chooser: 'bot' | 'random') {
  const rng = seeded(seed);
  let s = newGame(players, rng);
  let guard = 0;
  while (!s.over && guard++ < 5000) {
    let mv;
    if (chooser === 'bot') mv = botMove(s, s.current, rng);
    else {
      const moves = s.hands[s.current].flatMap((c) => playablePiles(s, c).map((p) => ({ cardId: c.id, pile: p })));
      mv = moves[Math.floor(rng() * moves.length)];
    }
    assert.ok(mv, 'un joueur non bloqué doit avoir un coup');
    const r = play(s, mv!.cardId, mv!.pile, rng);
    assert.ok(r.ok);
    if (r.ok) s = r.state;
  }
  assert.ok(s.over);
  return s.completed;
}

test('machines : ne jouent que des coups légaux, terminent la partie, et font mieux que le hasard', () => {
  let bots = 0, random = 0;
  for (let seed = 1; seed <= 150; seed++) {
    bots += playBots(seed, 3, 'bot');
    random += playBots(seed, 3, 'random');
  }
  assert.ok(bots > random, `machines ${bots / 150} contre hasard ${random / 150}`);
});

test('machines : prennent une mission quand elles le peuvent, et refusent de jouer hors de leur tour', () => {
  const rng = seeded(11);
  let checked = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const r0 = seeded(seed);
    let s = newGame(3, r0);
    let guard = 0;
    while (!s.over && guard++ < 5000) {
      const hint = findMissionMoves(s, s.current);
      const mv = botMove(s, s.current, r0)!;
      assert.equal(botMove(s, (s.current + 1) % 3, r0), null);
      const r = play(s, mv.cardId, mv.pile, r0);
      assert.ok(r.ok);
      if (r.ok) {
        if (hint.length) {
          checked++;
          const gain = r.state.completed - s.completed;
          if (gain < hint[0].missions.length) {
            // Seule raison de renoncer à une mission : le coup gagnant aurait bloqué le joueur suivant.
            const alt = play(s, hint[0].cardId, hint[0].pile, r0);
            assert.ok(alt.ok && alt.state.over, `seed ${seed} : mission refusée sans raison`);
          }
        }
        s = r.state;
      }
    }
  }
  assert.ok(checked > 0);
  void rng;
});

test('machines : annoncent toutes les missions à leur portée, sans toucher aux annonces humaines', () => {
  let seen = 0;
  for (let seed = 1; seed <= 80; seed++) {
    let s = newGame(3, seeded(seed));
    if (canAnnounce(s, 0)) s = setCanDo(s, 0, [reachableMissions(s, 0)[0]]);
    const human = announcedBy(s, 0);
    s = syncBotAnnouncements(s, [1, 2]);
    assert.deepEqual(announcedBy(s, 0), human);
    for (const b of [1, 2]) {
      const a = announcedBy(s, b);
      const r = reachableMissions(s, b);
      assert.deepEqual(a ? [...a.missions].sort() : [], [...r].sort());
      if (a) seen++;
    }
  }
  assert.ok(seen > 0, 'aucune annonce de machine rencontrée : test sans valeur');
});

test('missions visées : celles du coup de pouce, sans doublon, toutes présentes sur le tapis', () => {
  let seen = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const s = newGame(3, seeded(seed));
    for (let p = 0; p < 3; p++) {
      const r = reachableMissions(s, p);
      assert.equal(new Set(r).size, r.length);
      for (const id of r) assert.ok(s.missions.some((m) => m.id === id));
      assert.equal(r.length > 0, findMissionMoves(s, p).length > 0);
      seen += r.length;
    }
  }
  assert.ok(seen > 0);
});

test('phrases du livret : poser, retirer, exclusion bonne carte / ne jouez pas, cibles invalides', () => {
  let s = newGame(3, seeded(3));
  const m = s.missions[0].id;
  s = toggleSignal(s, { player: 1, kind: 'help', mission: m });
  assert.equal(s.signals.length, 1);
  s = toggleSignal(s, { player: 1, kind: 'help', mission: m });
  assert.equal(s.signals.length, 0);
  assert.equal(toggleSignal(s, { player: 1, kind: 'help', mission: 'inconnue' }), s);
  assert.equal(toggleSignal(s, { player: 1, kind: 'good', pile: 4 }), s);
  s = toggleSignal(s, { player: 1, kind: 'good', pile: 2 });
  s = toggleSignal(s, { player: 1, kind: 'stop', pile: 2 });
  assert.deepEqual(s.signals.map((g) => g.kind), ['stop']);
  s = toggleSignal(s, { player: 2, kind: 'good', pile: 2 });
  assert.equal(s.signals.length, 2);
});

test('phrases du livret : effacées quand le tas est recouvert ou la mission remplacée ; machines cohérentes', () => {
  for (let seed = 1; seed <= 80; seed++) {
    const rng = seeded(seed);
    let s = newGame(3, rng);
    let guard = 0;
    while (!s.over && guard++ < 5000) {
      s = syncBotSignals(s, [1, 2]);
      for (const g of s.signals) {
        if (g.kind === 'help') assert.ok(reachableMissions(s, g.player).includes(g.mission!));
        if (g.kind === 'good') assert.ok(findMissionMoves(s, g.player).some((m) => m.pile === g.pile));
      }
      s = toggleSignal(s, { player: s.current, kind: 'stop', pile: (s.current + 1) % 4 });
      const mv = botMove(s, s.current, rng)!;
      const r = play(s, mv.cardId, mv.pile, rng);
      assert.ok(r.ok);
      if (!r.ok) return;
      assert.ok(!r.state.signals.some((g) => g.kind !== 'help' && g.pile === mv.pile));
      for (const g of r.state.signals.filter((x) => x.kind === 'help')) assert.ok(r.state.missions.some((m) => m.id === g.mission));
      s = r.state;
    }
  }
});

test('prochaine médaille : le décompte reste cohérent avec les missions réussies', () => {
  const TOTAL = { bronze: 16, argent: 20, or: 24 } as const; // 15 cartes puis 4 puis 4, la médaille tombant à la pioche suivante
  const seen = new Set<string>();
  for (let seed = 1; seed <= 100; seed++) {
    const rng = seeded(seed);
    let s = newGame(3, rng);
    let guard = 0;
    while (!s.over && guard++ < 5000) {
      const nm = nextMedal(s);
      if (nm) {
        seen.add(nm.medal);
        assert.equal(s.completed + nm.missionsNeeded, TOTAL[nm.medal], `seed ${seed} ${nm.medal}`);
        assert.ok(nm.missionsNeeded >= 1);
      } else assert.equal(s.medal, 'or');
      const mv = botMove(s, s.current, rng);
      if (!mv) break;
      const r = play(s, mv.cardId, mv.pile, rng);
      assert.ok(r.ok);
      if (r.ok) s = r.state;
    }
  }
  assert.ok(seen.has('bronze'));
});

test('missions réussies entre deux états : cohérent avec le compteur, présentes avant et absentes après', () => {
  let coups = 0, avecMission = 0, chaines = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const rng = seeded(seed);
    let s = newGame(3, rng);
    let guard = 0;
    while (!s.over && guard++ < 5000) {
      const mv = botMove(s, s.current, rng);
      if (!mv) break;
      const r = play(s, mv.cardId, mv.pile, rng);
      assert.ok(r.ok);
      if (!r.ok) return;
      const { done, gained } = completedBetween(s, r.state);
      coups++;
      assert.ok(gained >= 0);
      assert.ok(done.length <= gained, 'plus de jetons envolés que de missions gagnées');
      if (gained > 0) { avecMission++; assert.ok(done.length >= 1); if (done.length < gained) chaines++; }
      for (const d of done) {
        assert.ok(s.missions[d.idx].id === d.def.id, 'place dans la rangée');
        assert.ok(!r.state.missions.some((m) => m.id === d.def.id));
      }
      s = r.state;
    }
  }
  assert.ok(avecMission > 0, 'aucune mission réussie rencontrée : test sans valeur');
  void coups; void chaines;
});

test('délai des machines : plus long quand une machine vient d\'annoncer, pour laisser le temps de l\'identifier', () => {
  assert.equal(botDelayMs(5000, false), 5000);
  assert.equal(botDelayMs(5000, true), 8000);
  assert.equal(botDelayMs(1000, true), 1600);
  assert.ok(botDelayMs(2, true) >= 2);
});

test('une machine ne défait pas la mission annoncée par un autre joueur', () => {
  let checked = 0;
  for (let seed = 1; seed < 4000 && checked < 5; seed++) {
    const s0 = newGame(3, seeded(seed));
    // le joueur courant (machine) joue ; le joueur suivant annonce
    const bot = s0.current;
    const other = (bot + 1) % 3;
    const reach = reachableMissions(s0, other);
    if (!reach.length) continue;
    const base = botMove(s0, bot, seeded(5))!;
    const ruins = (mv: { cardId: number; pile: number }) => {
      const r = play(s0, mv.cardId, mv.pile, seeded(5));
      if (!r.ok) return true;
      const still = reachableMissions(r.state, other);
      return reach.some((id) => r.state.missions.some((m) => m.id === id) && !still.includes(id));
    };
    // existe-t-il un coup qui préserve l'annonce ? alors la machine doit le choisir
    const safe = s0.hands[bot].some((c) => playablePiles(s0, c).some((p) => !ruins({ cardId: c.id, pile: p })));
    if (!safe || !ruins(base)) continue;
    checked++;
    const s1 = setCanDo(s0, other, reach);
    const mv = botMove(s1, bot, seeded(5))!;
    assert.ok(!ruins(mv), `seed ${seed} : la machine a défait l'annonce`);
  }
  assert.ok(checked > 0, 'aucune situation de test trouvée');
});

test('tour de table : chacun répond (je peux / je ne peux pas) avant le coup, effacé à chaque carte posée', async () => {
  const { setPass, unanswered } = await import('./engine');
  let s = newGame(3, seeded(11));
  assert.deepEqual(unanswered(s), [1, 2], 'le joueur dont c\'est le tour ne répond pas');
  const other = unanswered(s)[0];
  s = setPass(s, other);
  assert.deepEqual(s.passed, [other]);
  assert.equal(unanswered(s).includes(other), false);
  // une annonce vaut réponse et retire le « non »
  const can = [0, 1, 2].find((p) => p !== s.current && canAnnounce(s, p));
  if (can !== undefined) {
    const s2 = setCanDo(s, can, reachableMissions(s, can));
    assert.equal(s2.passed.includes(can), false);
    assert.equal(unanswered(s2).includes(can), false);
    // et un « non » retire l'annonce
    assert.equal(setPass(s2, can).canDo.some((a) => a.player === can), false);
  }
  // les machines répondent toutes seules : « je ne peux pas » quand elles n'ont rien
  const bots = [1, 2];
  const synced = syncBotAnnouncements(newGame(3, seeded(11)), bots);
  for (const b of bots) {
    if (b === synced.current) continue;
    assert.ok(synced.passed.includes(b) !== synced.canDo.some((a) => a.player === b), `machine ${b} : oui ou non, pas les deux ni aucun`);
  }
  // poser une carte efface les réponses
  const c = s.hands[s.current].find((x) => playablePiles(s, x).length)!;
  const r = play(s, c.id, playablePiles(s, c)[0]);
  assert.ok(r.ok);
  assert.deepEqual(r.state.passed, []);
});

test('missions « exactement 2 cartes d\'un symbole » : 3 cartes du symbole ne valident jamais les missions à 2 (1024 configurations)', () => {
  const defs = buildMissionDefs();
  const names = ['Jumelles', 'Boussoles', 'Briquets', 'Couteaux'];
  const find = (s: number, end: string) => defs.find((d) => d.label.includes(names[s]) && d.label.endsWith(end))!;
  for (let k = 0; k < 256; k++) {
    const syms = [k & 3, (k >> 2) & 3, (k >> 4) & 3, (k >> 6) & 3];
    const t = syms.map((symbol, i) => ({ id: i, symbol, value: 1 + ((i * 2) % 7) })) as never;
    for (let s = 0; s < 4; s++) {
      const pos = syms.flatMap((x, i) => (x === s ? [i] : []));
      const two = pos.length === 2;
      assert.equal(find(s, 'elles se touchent').check(t), two && pos[1] - pos[0] === 1);
      assert.equal(find(s, 'elles ne se touchent pas').check(t), two && pos[1] - pos[0] > 1);
      assert.equal(find(s, "espacées d'une seule carte").check(t), two && pos[1] - pos[0] === 2);
      assert.equal(defs.find((d) => d.label === `Exactement 3 des 4 cartes sont des ${names[s]}`)!.check(t), pos.length === 3);
    }
  }
});

test('machines : la difficulté d\'une mission dépend du contexte de la partie', () => {
  const s = newGame(3, seeded(5));
  const pool = unseenCards(s, 0);
  assert.equal(pool.length, 56 - 4 - 4);
  const easy = missionDifficulty(mission('Exactement 2 cartes sont des Boussoles et elles ne se touchent pas'), pool, seeded(1), 600);
  const hardM = missionDifficulty(mission('Chaque carte a une valeur inférieure à 4'), pool, seeded(1), 600);
  assert.ok(hardM > easy, `toutes < 4 (${hardM.toFixed(2)}) plus dure que 2 boussoles qui ne se touchent pas (${easy.toFixed(2)})`);
  // plus aucune Boussole en jeu : « exactement 2 boussoles » devient impossible
  const noBou = pool.filter((c) => c.symbol !== 1);
  assert.equal(missionDifficulty(mission('Exactement 2 cartes sont des Boussoles et elles ne se touchent pas'), noBou, seeded(1), 600), 1);
  // plus aucune carte de valeur ≥ 4 : « toutes < 4 » devient facile
  const low = pool.filter((c) => c.value < 4);
  assert.ok(missionDifficulty(mission('Chaque carte a une valeur inférieure à 4'), low, seeded(1), 600) < 0.05);
});

test('machines : la nouvelle machine réussit nettement plus de missions que l\'ancienne, parties de 3 machines', () => {
  const run = (choose: typeof botMove) => {
    let total = 0;
    for (let g = 1; g <= 40; g++) {
      const rng = seeded(g * 7919); let s = newGame(3, seeded(g)); let guard = 0;
      while (!s.over && guard++ < 4000) { const mv = choose(s, s.current, rng); if (!mv) break; const r = play(s, mv.cardId, mv.pile, rng); if (!r.ok) break; s = r.state; }
      total += s.completed;
    }
    return total / 40;
  };
  const greedy = run(botMoveGreedy), smart = run(botMove);
  assert.ok(smart > greedy * 1.3, `nouvelle ${smart.toFixed(1)} contre ancienne ${greedy.toFixed(1)}`);
});
