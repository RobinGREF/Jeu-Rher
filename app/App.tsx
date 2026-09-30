import { useEffect, useRef, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  botDelayMs, botMove, canAnnounce, completedBetween, missionsLeft, newGame, play, playablePiles, setCanDo,
  syncBotAnnouncements, syncBotSignals, toggleSignal, tops,
  type GameState, type SignalKind,
} from './src/engine';
import { Celebration, CELEBRATION_MS, type Celebrate } from './src/Celebration';
import { InfoPanel } from './src/InfoPanel';
import { ScoreBoard } from './src/ScoreBoard';
import { addScore, cleanName, clearScores, loadScores, saveScores, type ScoreEntry } from './src/scores';
import { Lobby } from './src/Lobby';
import { useOnline } from './src/online/useOnline';
import { missionById } from './src/online/wire';
import { MissionToken } from './src/MissionToken';
import { TableScene, type LastPlay, type PileView } from './src/TableScene';
import { SYMBOLS } from './src/symbols';

type Mode = 'solo' | 'together' | 'online';
type Screen = 'home' | 'together' | 'settings';

const DEFAULTS = { bots: 2, pauseMs: 5000, manual: true, phrasesOn: false, openHands: false };
/** Réglages gardés d'une visite à l'autre (facultatif : sans stockage, on repart des valeurs par défaut). */
function loadSettings(): typeof DEFAULTS {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('50m-settings') ?? '{}') }; } catch { return DEFAULTS; }
}

const MEDAL = { bronze: '🥉 Bronze', argent: '🥈 Argent', or: '🥇 Or' } as const;
const KIND_ICON = { help: '✋', good: '👍', stop: '⛔' } as const;

function Toggle({ on, title, sub, onPress }: { on: boolean; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.toggle}>
      <View style={[s.box, on && s.boxOn]}>{on && <Text style={s.tick}>✓</Text>}</View>
      <View style={{ flex: 1 }}>
        <Text style={s.toggleTitle}>{title}</Text>
        <Text style={s.toggleSub}>{sub}</Text>
      </View>
    </Pressable>
  );
}

function Chips({ values, value, onChange }: { values: number[]; value: number; onChange: (n: number) => void }) {
  return (
    <View style={s.row}>
      {values.map((n) => (
        <Pressable key={n} onPress={() => onChange(n)} style={[s.chip, value === n && s.chipOn]}>
          <Text style={s.chipTxt}>{n}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function App() {
  const saved = useRef(loadSettings()).current;
  const [mode, setMode] = useState<Mode>('online'); // en ligne par défaut
  const [screen, setScreen] = useState<Screen>('home');
  const [pendingStart, setPendingStart] = useState(false);
  const [bots, setBots] = useState(saved.bots);
  const [players, setPlayers] = useState(2);
  const [openHands, setOpenHands] = useState(saved.openHands);
  const [phrasesOn, setPhrasesOn] = useState(saved.phrasesOn);
  const [manual, setManual] = useState(saved.manual); // les machines attendent mon clic

  const [localGame, setGame] = useState<GameState | null>(null);
  const [myName, setMyName] = useState(() => {
    try { return localStorage.getItem('50m-name') ?? ''; } catch { return ''; }
  });
  const [codeInput, setCodeInput] = useState('');
  const onl = useOnline();
  const online = mode === 'online';
  const osnap = online ? onl.snap : null;
  const pub = osnap?.pub ?? null;
  const game = online ? osnap?.view ?? null : localGame;
  const seenPlay = useRef<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [textFor, setTextFor] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [info, setInfo] = useState(false);
  const [pauseMs, setPauseMs] = useState(saved.pauseMs);
  const [lastPlay, setLastPlay] = useState<LastPlay | null>(null);
  const [party, setParty] = useState<Celebrate | null>(null);
  const [rowY, setRowY] = useState(46);
  const [history, setHistory] = useState<string[]>([]);
  const [sigMode, setSigMode] = useState<'play' | SignalKind>('play');
  const [speaker, setSpeaker] = useState<number | null>(null);
  // Annonce « je peux » en cours de saisie : le joueur qui choisit, et les missions déjà touchées.
  // Meilleurs scores de cet appareil : enregistrés à la fin de chaque partie, avec les noms des participants.
  const [scores, setScores] = useState<ScoreEntry[]>(loadScores);
  const [scoresOpen, setScoresOpen] = useState(false);
  const [lastRank, setLastRank] = useState<number | null>(null);
  const [lastScoreId, setLastScoreId] = useState<string | null>(null);
  const startedAt = useRef(Date.now());
  const savedKey = useRef<string | null>(null);
  const [picking, setPicking] = useState<number | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  const { width, height } = useWindowDimensions();
  const tokenSize = Math.min(96, (width - 32 - 3 * 6) / 4);
  const scale = Math.min(1, Math.max(0.72, (height - 200) / 560));

  const solo = mode === 'solo';
  const botSeats = (n: number) => (solo ? Array.from({ length: n - 1 }, (_, i) => i + 1) : []);
  const seat = (p: number) => (online ? pub?.seats[p]?.name ?? `Joueur ${p + 1}` : `Joueur ${p + 1}${botSeats(99).includes(p) ? ' (machine)' : ''}`);
  const effPause = online ? pub?.options.pauseMs ?? 5000 : pauseMs;
  /** Applique les annonces automatiques des machines après chaque changement du tapis. */
  const sync = (g: GameState) => {
    const bs = botSeats(g.players);
    const a = syncBotAnnouncements(g, bs);
    return phrasesOn ? syncBotSignals(a, bs) : a;
  };
  /** Fête les missions réussies entre deux états du jeu. */
  const celebrate = (before: GameState, after: GameState) => {
    const { done, gained } = completedBetween(before, after);
    if (gained <= 0) return;
    const medal = after.medal !== before.medal && after.medal ? { bronze: 'de bronze', argent: 'd\'argent', or: 'd\'or' }[after.medal] : null;
    setParty({ key: Date.now(), done, gained, medal });
  };
  const log = (entry: string) => setHistory((h) => [entry, ...h].slice(0, 300));

  /** Un coup de machine pour le joueur courant. */
  const doBotMove = (g: GameState) => {
    const who = g.current;
    const mv = botMove(g, who);
    if (!mv) return;
    const card = g.hands[who].find((c) => c.id === mv.cardId)!;
    const covered = g.piles[mv.pile][g.piles[mv.pile].length - 1];
    const r = play(g, mv.cardId, mv.pile);
    if (!r.ok) return;
    const gained = r.state.completed - g.completed;
    setLastPlay({ key: Date.now(), seat: who, card, covered, pile: mv.pile, gained });
    celebrate(g, r.state);
    log(`${seat(who)} : ${card.value}${SYMBOLS[card.symbol].emoji} sur le tas ${mv.pile + 1}${gained ? ` · 🎯 +${gained} mission${gained > 1 ? 's' : ''}` : ''}`);
    setGame(sync(r.state));
  };

  // Tour d'une machine : une courte pause pour qu'on voie ce qui se passe, puis elle joue.
  useEffect(() => {
    if (!game || game.over) return;
    if (!solo || game.current === 0 || manual) return; // « à mon clic » : la machine attend le bouton
    // Si une machine vient d'annoncer « je peux », on laisse plus de temps pour repérer sur quelles missions.
    const announced = game.canDo.some((a) => botSeats(game.players).includes(a.player));
    const id = setTimeout(() => doBotMove(game), botDelayMs(pauseMs, announced));
    return () => clearTimeout(id);
  }, [game, mode, pauseMs, manual]);

  // La saisie d'une annonce s'arrête dès que le tapis change (carte posée, mission remplacée).
  const boardKey = game ? game.piles.map((p) => p[p.length - 1].id).join('-') + game.missions.map((m) => m.id).join('') : '';
  useEffect(() => { setPicking(null); setPicked([]); }, [boardKey]);

  // Fin de partie : on garde le score et les noms de tous les participants (une seule fois par partie).
  useEffect(() => {
    if (!game?.over) return;
    const key = online ? `o-${osnap?.code}` : `l-${startedAt.current}`;
    if (savedKey.current === key) return;
    savedKey.current = key;
    const players = online
      ? (pub?.seats ?? []).map((s) => ({ name: s.name, bot: s.bot }))
      : solo
        ? [{ name: cleanName(myName, 'Moi'), bot: false }, ...Array.from({ length: game.players - 1 }, (_, i) => ({ name: `Machine ${i + 1}`, bot: true }))]
        : Array.from({ length: game.players }, (_, i) => ({ name: `Joueur ${i + 1}`, bot: false }));
    const entry: ScoreEntry = {
      id: `${key}-${game.completed}`, at: Date.now(), completed: game.completed, medal: game.medal,
      plays: online ? pub?.last?.n ?? 0 : history.length, mode, players,
    };
    const { list, rank } = addScore(loadScores(), entry);
    saveScores(list);
    setScores(list); setLastRank(rank); setLastScoreId(entry.id);
  }, [game?.over]);

  useEffect(() => {
    if (!party) return;
    const id = setTimeout(() => setParty((cur) => (cur && cur.key === party.key ? null : cur)), CELEBRATION_MS);
    return () => clearTimeout(id);
  }, [party]);

  // La carte posée reste mise en évidence le temps choisi, puis la vue se remet à plat.
  useEffect(() => {
    if (!lastPlay) return;
    const id = setTimeout(() => setLastPlay((cur) => (cur && cur.key === lastPlay.key ? null : cur)), effPause);
    return () => clearTimeout(id);
  }, [lastPlay, effPause]);

  // En ligne : la carte posée et la fête viennent du dernier coup publié par l'hôte, pour tout le monde.
  useEffect(() => {
    if (!pub) { seenPlay.current = null; return; }
    const last = pub.last;
    if (seenPlay.current === null) { seenPlay.current = last?.n ?? 0; return; } // en rejoignant, pas de coup rejoué
    if (!last || last.n <= seenPlay.current) return;
    seenPlay.current = last.n;
    setLastPlay({ key: last.n, seat: last.seat, card: last.card, covered: last.covered, pile: last.pile, gained: last.gained });
    if (last.gained > 0) setParty({ key: Date.now(), done: last.done.map((d) => ({ def: missionById(d.id), idx: d.idx })), gained: last.gained, medal: last.medal });
  }, [pub?.v]);

  useEffect(() => {
    try { localStorage.setItem('50m-settings', JSON.stringify({ bots, pauseMs, manual, phrasesOn, openHands })); } catch { /* sans stockage */ }
  }, [bots, pauseMs, manual, phrasesOn, openHands]);

  useEffect(() => {
    if (pendingStart) { setPendingStart(false); start(); }
  }, [pendingStart]);

  const start = () => {
    const n = solo ? bots + 1 : players;
    const g = newGame(n);
    setGame(sync(g));
    setRevealed(false); setSelected(null); setHistory([]); setError('');
    setSigMode('play'); setSpeaker(null); setMenu(false); setInfo(false); setTextFor(null); setLastPlay(null); setParty(null); setPicking(null); setPicked([]);
    startedAt.current = Date.now(); savedKey.current = null; setLastRank(null); setLastScoreId(null);
  };

  if (scoresOpen) {
    return <ScoreBoard list={scores} highlightId={lastScoreId} onBack={() => setScoresOpen(false)} onClear={() => { clearScores(); setScores([]); setLastRank(null); setLastScoreId(null); }} />;
  }

  const quit = () => { if (online) onl.leave(); setGame(null); setMenu(false); setScreen('home'); };

  if (online && osnap && osnap.phase !== 'playing' && osnap.phase !== 'over') {
    return <Lobby snap={osnap} session={onl.session.current} onLeave={quit} local={onl.kind === 'local'} />;
  }
  if (online && osnap && !game) {
    return (
      <SafeAreaView style={s.root}>
        <StatusBar style="light" />
        <Text style={s.title}>Connexion à la table…</Text>
        <Pressable onPress={quit} style={s.quit}><Text style={s.quitTxt}>Quitter</Text></Pressable>
      </SafeAreaView>
    );
  }

  if (!game) {
    const back = <Pressable onPress={() => setScreen('home')} style={s.link}><Text style={s.linkTxt}>← Retour</Text></Pressable>;

    if (screen === 'together') {
      return (
        <SafeAreaView style={s.root}>
          <StatusBar style="light" />
          <ScrollView contentContainerStyle={s.home}>
            <Text style={s.title}>À plusieurs</Text>
            <Text style={s.sub}>Un seul téléphone, on se le passe.{'\n'}Combien de joueurs ?</Text>
            <View style={s.row}>
              {[2, 3, 4].map((n) => (
                <Pressable key={n} onPress={() => { setMode('together'); setPlayers(n); setPendingStart(true); }} style={s.chip}>
                  <Text style={s.chipTxt}>{n}</Text>
                </Pressable>
              ))}
            </View>
            {back}
          </ScrollView>
        </SafeAreaView>
      );
    }

    if (screen === 'settings') {
      return (
        <SafeAreaView style={s.root}>
          <StatusBar style="light" />
          <ScrollView contentContainerStyle={s.home}>
            <Text style={s.title}>Réglages</Text>
            <Text style={s.label}>Nombre de machines</Text>
            <Chips values={[1, 2, 3]} value={bots} onChange={setBots} />
            <Toggle on={manual} onPress={() => setManual(!manual)} title="👆 Machines : attendre mon clic" sub="Avant chaque machine, un message te prévient et elle ne joue que quand tu touches « Laisser jouer »." />
            <Text style={s.label}>Pause entre les coups</Text>
            <View style={s.row}>
              {([5000, 2000, 1000] as const).map((ms) => (
                <Pressable key={ms} onPress={() => setPauseMs(ms)} style={[s.mode, pauseMs === ms && s.modeOn]}>
                  <Text style={[s.modeTxt, pauseMs === ms && s.modeTxtOn]}>{ms / 1000} s</Text>
                </Pressable>
              ))}
            </View>
            <Text style={s.hint}>Temps pendant lequel on voit la carte se poser sur celle qu'elle recouvre. Sans « attendre mon clic », c'est aussi le délai avant que la machine suivante joue.</Text>
            <Text style={s.label}>Options</Text>
            <Toggle on={phrasesOn} onPress={() => setPhrasesOn(!phrasesOn)} title="💬 Phrases du livret" sub="En plus de l'annonce « je peux » : « je peux aider », « bonne carte ici », « ne jouez pas ici »." />
            <Toggle on={openHands} onPress={() => setOpenHands(!openHands)} title="👀 Mains visibles (test)" sub="À plusieurs sur un téléphone : toutes les mains sont affichées." />
            <Pressable style={s.btn} onPress={() => setScreen('home')}><Text style={s.btnTxt}>Terminé</Text></Pressable>
          </ScrollView>
        </SafeAreaView>
      );
    }

    const createOnline = () => { setMode('online'); onl.create(myName); };
    const joinOnline = () => { setMode('online'); onl.join(codeInput, myName); };
    return (
      <SafeAreaView style={s.root}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={s.home}>
          <Text style={s.title}>50 Missions</Text>
          <Text style={s.sub}>Jeu de cartes coopératif, en ligne avec tes amis</Text>

          <Text style={s.label}>Ton prénom</Text>
          <TextInput value={myName} onChangeText={(v) => { setMyName(v); try { localStorage.setItem('50m-name', v); } catch { /* sans stockage */ } }}
            placeholder="Robin" placeholderTextColor="#64748b" maxLength={14} style={s.input} accessibilityLabel="Ton prénom" />

          {!onl.kind ? (
            <Text style={s.err}>Le mode en ligne n'est pas configuré sur cette version (voir docs/en-ligne.md). Tu peux jouer contre des machines.</Text>
          ) : (
            <>
              <Pressable style={s.btn} disabled={onl.busy} onPress={createOnline}>
                <Text style={s.btnTxt}>🌐 Créer une partie</Text>
              </Pressable>
              <View style={s.row}>
                <TextInput value={codeInput} onChangeText={(v) => setCodeInput(v.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))}
                  placeholder="CODE" placeholderTextColor="#64748b" autoCapitalize="characters" maxLength={4}
                  style={[s.input, s.codeInput]} accessibilityLabel="Code du salon" />
                <Pressable style={[s.mode, codeInput.length === 4 && s.modeOn]} disabled={onl.busy || codeInput.length !== 4} onPress={joinOnline}>
                  <Text style={[s.modeTxt, codeInput.length === 4 && s.modeTxtOn]}>Rejoindre</Text>
                </Pressable>
              </View>
              {!!onl.error && <Text style={s.err}>{onl.error}</Text>}
              {onl.kind === 'local' && <Text style={s.hint}>Test local : les autres joueurs sont les autres onglets de ce navigateur.</Text>}
            </>
          )}

          <Text style={[s.label, { marginTop: 8 }]}>Autres façons de jouer</Text>
          <Pressable style={s.bigBtn} onPress={() => { setMode('solo'); setPendingStart(true); }}>
            <Text style={s.bigTitle}>🤖 Contre des machines</Text>
            <Text style={s.bigSub}>Seul, avec {bots} joueur{bots > 1 ? 's' : ''} machine</Text>
          </Pressable>
          <Pressable style={s.bigBtn} onPress={() => setScreen('together')}>
            <Text style={s.bigTitle}>📱 À plusieurs, un téléphone</Text>
            <Text style={s.bigSub}>On se passe le téléphone</Text>
          </Pressable>
          <View style={s.row}>
            <Pressable onPress={() => setScoresOpen(true)} style={s.link}><Text style={s.linkTxt}>🏆 Meilleurs scores</Text></Pressable>
            <Pressable onPress={() => setScreen('settings')} style={s.link}><Text style={s.linkTxt}>⚙️ Réglages</Text></Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const status = (
    <Text style={s.sub}>
      Missions réussies : {game.completed}/50 · {game.medal ? MEDAL[game.medal] : 'Pas encore de médaille'}
    </Text>
  );

  if (game.over) {
    return (
      <SafeAreaView style={s.root}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={s.setup}>
          <Text style={s.title}>{game.completed >= 50 ? '🎉 50 missions !' : 'Fin de partie'}</Text>
          {status}
          {game.completed < 50 && game.goldReached && <Text style={s.sub}>Il manquait {missionsLeft(game)} missions.</Text>}
          {lastRank !== null && <Text style={s.record}>{lastRank === 1 ? '🏆 Nouveau record !' : `🏅 ${lastRank}ᵉ au classement des meilleurs scores`}</Text>}
          <Text style={s.sub}>{(online ? (pub?.seats ?? []).map((x) => x.name) : solo ? [cleanName(myName, 'Moi'), ...Array.from({ length: game.players - 1 }, (_, i) => `Machine ${i + 1}`)] : Array.from({ length: game.players }, (_, i) => `Joueur ${i + 1}`)).join(' · ')}</Text>
          <Text style={s.sub}>{online ? pub?.last?.n ?? 0 : history.length} coups joués</Text>
          <Pressable style={s.bigBtn} onPress={() => setScoresOpen(true)}><Text style={s.bigTitle}>🏆 Meilleurs scores</Text></Pressable>
          <Pressable style={s.btn} onPress={quit}><Text style={s.btnTxt}>{online ? 'Quitter' : 'Rejouer'}</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const me = online ? Math.max(0, osnap?.mySeat ?? 0) : solo ? 0 : game.current;
  const hand = game.hands[me];
  const sel = hand.find((c) => c.id === selected) ?? null;
  const ok = sel ? playablePiles(game, sel) : [];
  const t = tops(game);
  const handShown = online || solo || openHands || revealed;
  const canSignal = (online ? !!pub?.options.phrases : phrasesOn) && game.players > 1;
  const hist = online ? pub?.history ?? [] : history;
  const session = () => onl.session.current;
  // Celui qui parle : toi en solo ; sinon, par défaut, le joueur suivant.
  const who = online || solo ? me : speaker ?? (game.current + 1) % game.players;

  const signalTags = (kind: SignalKind, target: { mission?: string; pile?: number }) =>
    game.signals.filter((g) => g.kind === kind && g.mission === target.mission && g.pile === target.pile).map((g) => `${KIND_ICON[kind]} J${g.player + 1}`);

  const who2 = (p: number) => (online || solo ? (p === me ? 'Toi' : `J${p + 1}`) : `J${p + 1}`);
  /** Qui se positionne sur quelle mission (annonces « je peux »), et ce que tu es en train de choisir. */
  const missionBadges = (id: string) => [
    ...(picking !== null && picked.includes(id) ? ['✅'] : []),
    ...game.canDo.filter((a) => a.missions.includes(id)).map((a) => `🙋 ${who2(a.player)}`),
    ...signalTags('help', { mission: id }),
  ];
  // Une machine attend le feu vert (à mon clic) : message et bouton « Laisser jouer ».
  const waitingBot = !game.over && (online ? pub?.awaitingGo != null && pub.awaitingGo === game.current : solo && manual && game.current !== 0);
  const goBot = () => { if (online) session()?.go(); else doBotMove(game); setError(''); };
  const botName = seat(game.current).replace(' (machine)', '');
  const botShort = online ? botName : `J${game.current + 1}`;
  const announced = (p: number) => game.canDo.some((a) => a.player === p);
  // Le bouton d'annonce n'apparaît que si le joueur peut vraiment réussir une mission : c'est l'indice, sans dire laquelle ni avec quelle carte.
  const announcers: number[] = online || solo
    ? (canAnnounce(game, me) ? [me] : [])
    : openHands ? game.hands.map((_, i) => i).filter((i) => canAnnounce(game, i)) : handShown && canAnnounce(game, me) ? [me] : [];
  const sendAnnounce = (p: number, ids: string[]) => {
    if (online) session()?.announce(ids);
    else setGame(setCanDo(game, p, ids));
  };
  const onAnnounceButton = (p: number) => {
    if (announced(p)) return sendAnnounce(p, []); // retirer son annonce
    setPicking(p); setPicked([]); setTextFor(null); setSigMode('play'); setError('');
  };
  const confirmPick = () => {
    if (picking === null) return;
    if (!picked.length) return setError('Touche au moins une mission');
    sendAnnounce(picking, picked);
    setPicking(null); setPicked([]); setError('');
  };
  const onMissionPress = (id: string) => {
    if (picking !== null) return setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);
    if (canSignal && sigMode === 'help') return online ? session()?.toggleSignal('help', { mission: id }) : setGame(toggleSignal(game, { player: who, kind: 'help', mission: id }));
    setTextFor(textFor === id ? null : id);
  };

  const drop = (pile: number) => {
    if (canSignal && (sigMode === 'good' || sigMode === 'stop')) {
      return online ? session()?.toggleSignal(sigMode, { pile }) : setGame(toggleSignal(game, { player: who, kind: sigMode, pile }));
    }
    if (!handShown) return setError("Affiche d'abord ta main");
    if (online) {
      if (game.current !== me) return setError("Ce n'est pas encore ton tour");
      if (!sel) return setError("Choisis d'abord une carte");
      if (!ok.includes(pile)) return setError('Même symbole ou même valeur requis');
      session()?.play(sel.id, pile);
      setError(''); setSelected(null); setSigMode('play');
      return;
    }
    if (solo && game.current !== 0) return setError("Ce n'est pas encore ton tour");
    if (!sel) return setError("Choisis d'abord une carte");
    const covered = game.piles[pile][game.piles[pile].length - 1];
    const r = play(game, sel.id, pile);
    if (!r.ok) return setError(r.error);
    const gained = r.state.completed - game.completed;
    setLastPlay({ key: Date.now(), seat: game.current, card: sel, covered, pile, gained });
    celebrate(game, r.state);
    log(`${solo ? 'Toi' : seat(game.current)} : ${sel.value}${SYMBOLS[sel.symbol].emoji} sur le tas ${pile + 1}${gained ? ` · 🎯 +${gained} mission${gained > 1 ? 's' : ''}` : ''}`);
    setError(''); setSelected(null); setRevealed(false); setSpeaker(null); setSigMode('play');
    setGame(sync(r.state));
  };

  const pileViews: PileView[] = t.map((card, i) => ({
    card,
    dim: !!sel && !ok.includes(i),
    glowColor: sel && ok.includes(i) ? SYMBOLS[sel.symbol].color : undefined,
    tags: [...signalTags('good', { pile: i }), ...signalTags('stop', { pile: i })].map((text) => ({ text, stop: text.startsWith(KIND_ICON.stop) })),
  }));

  const missionText = game.missions.find((m) => m.id === textFor)?.label;
  const sigHint = { play: '', help: 'Touche la mission pour laquelle tu peux aider', good: 'Touche le tas où tu as une bonne carte', stop: 'Touche le tas où il ne faut pas jouer' }[sigMode];
  const toggleSig = (k: SignalKind) => setSigMode(sigMode === k ? 'play' : k);
  const turnTitle = solo || online ? (game.current === me ? 'À toi de jouer' : waitingBot ? `${botName} va jouer` : `${seat(game.current)} joue…`) : `Joueur ${game.current + 1} joue`;
  const labels = online ? game.hands.map((_, i) => ({ name: i === me ? 'Toi' : seat(i).replace(' (machine)', ''), avatar: pub?.seats[i]?.bot ? '🤖' : i === me ? '🙂' : '👤' })) : undefined;

  return (
    <SafeAreaView style={s.game}>
      <StatusBar style="light" />

      <View style={s.head}>
        <Text style={s.headTitle} numberOfLines={1}>{turnTitle}</Text>
        <Text style={[s.headStat, !!party && s.headStatOn]} numberOfLines={1}>🎯 {game.completed}/50{game.medal ? ` ${MEDAL[game.medal].split(' ')[0]}` : ''} · 📚 {game.symbolDeck.length}</Text>
        <Pressable onPress={() => { setInfo(true); setMenu(false); }} style={s.menuBtn} accessibilityLabel="Infos sur la partie"><Text style={s.menuTxt}>ℹ️</Text></Pressable>
        <Pressable onPress={() => setMenu(!menu)} style={s.menuBtn} accessibilityLabel="Menu"><Text style={s.menuTxt}>☰</Text></Pressable>
      </View>

      <View style={s.missRow} onLayout={(e) => setRowY(e.nativeEvent.layout.y)}>
        {game.missions.map((m) => (
          <MissionToken key={m.id} def={m} size={tokenSize} showText={false} badges={missionBadges(m.id)}
            mark={picking !== null && picked.includes(m.id) ? 'picked' : game.canDo.some((a) => a.missions.includes(m.id)) ? 'announced' : undefined}
            onPress={() => onMissionPress(m.id)} />
        ))}
      </View>

      <View style={s.tableWrap}>
        <TableScene game={game} solo={solo} labels={labels} piles={pileViews} onPile={drop}
          meIndex={me} hand={hand} handShown={handShown} selectedId={selected}
          onSelect={(id) => { setSelected(id); setError(''); setSigMode('play'); }}
          onReveal={() => { setRevealed(true); setSigMode('play'); }} revealAll={openHands} scale={scale}
          lastPlay={lastPlay} pauseMs={effPause}
          who={(i) => (online ? (i === me ? 'Toi' : seat(i)) : solo && i === 0 ? 'Toi' : `J${i + 1}${solo ? ' (machine)' : ''}`)}
          onSkip={() => { if (solo && game.current !== 0 && !manual) doBotMove(game); else setLastPlay(null); }} />
        {!!missionText && (
          <Pressable onPress={() => setTextFor(null)} style={s.tip}><Text style={s.tipTxt}>{missionText}</Text></Pressable>
        )}
      </View>

      <View style={s.bar}>
        {!!error ? <Text style={s.barErr} numberOfLines={1}>{error}</Text>
          : picking !== null ? <Text style={s.barTxt} numberOfLines={1}>Touche la ou les missions que tu peux réussir, puis valide</Text>
          : sigMode !== 'play' ? <Text style={s.barTxt} numberOfLines={1}>{sigHint}</Text>
          : waitingBot ? <Text style={s.barWait} numberOfLines={1}>🤖 {botName} va jouer{announcers.length ? ' · tu peux annoncer avant' : ''}</Text>
          : <Text style={s.barTxt} numberOfLines={1}>{hist[0] ?? (game.current === me ? 'À toi de commencer' : `${seat(game.current)} commence`)}</Text>}
        <View style={s.barRow}>
          {picking !== null ? (
            <>
              <Pressable onPress={confirmPick} style={[s.mode, s.grow, picked.length > 0 && s.modeOn]}>
                <Text style={[s.modeTxt, picked.length > 0 && s.modeTxtOn]}>✔ Valider{picked.length ? ` (${picked.length})` : ''}</Text>
              </Pressable>
              <Pressable onPress={() => { setPicking(null); setPicked([]); setError(''); }} style={s.mode}>
                <Text style={s.modeTxt}>Annuler</Text>
              </Pressable>
            </>
          ) : announcers.length > 0 ? announcers.map((i) => {
            const on = announced(i);
            return (
              <Pressable key={i} onPress={() => onAnnounceButton(i)} style={[s.mode, s.grow, on && s.modeOn]}>
                <Text style={[s.modeTxt, on && s.modeTxtOn]} numberOfLines={1}>
                  {solo || online ? (waitingBot ? (on ? '🙋 Retirer' : '🙋 Je peux') : on ? '🙋 Retirer mon annonce' : '🙋 Je peux réussir une mission') : on ? `🙋 J${i + 1} : retirer` : `🙋 J${i + 1} peut réussir`}
                </Text>
              </Pressable>
            );
          }) : !canSignal && !waitingBot && <View style={s.barSpacer} />}
          {waitingBot && picking === null && (
            <Pressable onPress={goBot} style={[s.goBtn, s.grow]} accessibilityLabel={`Laisser ${botName} jouer`}>
              <Text style={s.goTxt} numberOfLines={1}>▶ Laisser {botShort} jouer</Text>
            </Pressable>
          )}
          {canSignal && picking === null && (['help', 'good', 'stop'] as const).map((k) => (
            <Pressable key={k} onPress={() => toggleSig(k)} style={[s.mode, sigMode === k && s.modeOn]}>
              <Text style={[s.modeTxt, sigMode === k && s.modeTxtOn]}>{KIND_ICON[k]}</Text>
            </Pressable>
          ))}
        </View>
        {canSignal && !solo && !online && sigMode !== 'play' && (
          <View style={s.barRow}>
            <Text style={s.barTxt}>Qui parle ?</Text>
            {game.hands.map((_, i) => (
              <Pressable key={i} onPress={() => setSpeaker(i)} style={[s.who, who === i && s.modeOn]}>
                <Text style={[s.modeTxt, who === i && s.modeTxtOn]}>J{i + 1}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {party && (
        <Celebration c={party} width={width} height={height} tokenSize={tokenSize} rowY={rowY} target={{ x: width - 126, y: 16 }} />
      )}

      {info && (
        <InfoPanel game={game} solo={solo} onClose={() => setInfo(false)} options={{ phrases: online ? !!pub?.options.phrases : phrasesOn }}
          nameOf={online ? (i) => (i === me ? 'Toi' : seat(i)) : undefined} />
      )}

      {menu && (
        <View style={s.menu}>
          <Text style={s.label}>Derniers coups</Text>
          {hist.slice(0, 8).map((h, i) => (
            <Text key={i} style={[s.histLine, i === 0 && s.histFirst]}>{h}</Text>
          ))}
          {hist.length === 0 && <Text style={s.histLine}>Aucun coup joué.</Text>}
          {online && osnap?.isHost && pub?.seats.map((sd, i) => (i !== me && !sd.bot ? (
            <Pressable key={i} onPress={() => { session()?.botify(i); setMenu(false); }} style={s.quit}>
              <Text style={s.quitTxt}>Remplacer {sd.name} par une machine</Text>
            </Pressable>
          ) : null))}
          <Pressable onPress={quit} style={s.quit}><Text style={s.quitTxt}>Quitter la partie</Text></Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  game: { flex: 1, backgroundColor: '#0f172a', paddingLeft: 16, paddingRight: 16, paddingTop: 6, paddingBottom: 8, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headTitle: { color: '#fff', fontSize: 17, fontWeight: '800', flexShrink: 1 },
  headStat: { color: '#cbd5e1', fontSize: 12, flexShrink: 0, marginLeft: 'auto' },
  headStatOn: { color: '#fde047', fontWeight: '900' },
  menuBtn: { paddingHorizontal: 6, paddingVertical: 2 },
  menuTxt: { color: '#f8fafc', fontSize: 20 },
  missRow: { flexDirection: 'row', justifyContent: 'space-between' },
  tableWrap: { flex: 1 },
  tip: { position: 'absolute', top: 6, left: 8, right: 8, backgroundColor: '#f59e0b', borderRadius: 10, padding: 8 },
  tipTxt: { color: '#111827', fontWeight: '800', fontSize: 13, textAlign: 'center' },
  bar: { gap: 4 },
  barTxt: { color: '#94a3b8', fontSize: 12, textAlign: 'center' },
  barErr: { color: '#fca5a5', fontSize: 12, textAlign: 'center', fontWeight: '700' },
  barRow: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  barWait: { color: '#fde68a', fontSize: 13, textAlign: 'center', fontWeight: '800' },
  goBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#22c55e' },
  goTxt: { color: '#052e16', fontWeight: '900', fontSize: 15 },
  barSpacer: { height: 39 },
  grow: { flex: 1, alignItems: 'center' },
  menu: { position: 'absolute', top: 40, left: 16, right: 16, backgroundColor: '#111c33', borderRadius: 12, padding: 12, gap: 4, borderWidth: 1, borderColor: '#334155' },
  root: { flex: 1, backgroundColor: '#0f172a', padding: 16, justifyContent: 'center', gap: 14 },
  home: { gap: 14, paddingVertical: 8, paddingLeft: 16, paddingRight: 16, flexGrow: 1, justifyContent: 'center' },
  record: { color: '#fbbf24', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  bigBtn: { backgroundColor: '#1e293b', borderRadius: 16, padding: 18, gap: 4, borderWidth: 2, borderColor: '#334155' },
  bigTitle: { color: '#f8fafc', fontSize: 19, fontWeight: '800' },
  bigSub: { color: '#94a3b8', fontSize: 14 },
  link: { alignSelf: 'center', padding: 12 },
  linkTxt: { color: '#cbd5e1', fontSize: 16, fontWeight: '700' },
  setup: { gap: 14, paddingVertical: 8, paddingLeft: 16, paddingRight: 16, flexGrow: 1, justifyContent: 'center' },
  title: { color: '#fff', fontSize: 30, fontWeight: '800', textAlign: 'center' },
  sub: { color: '#cbd5e1', fontSize: 15, textAlign: 'center' },
  label: { color: '#94a3b8', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' },
  chip: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: '#f59e0b' },
  chipTxt: { color: '#fff', fontSize: 20, fontWeight: '700' },
  btn: { backgroundColor: '#f59e0b', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  btnTxt: { color: '#111827', fontSize: 18, fontWeight: '800' },
  card: { width: 70, height: 100, borderRadius: 10, borderWidth: 3, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  cardSel: { transform: [{ translateY: -10 }], borderWidth: 5 },
  cardGlow: { borderColor: '#facc15', shadowColor: '#facc15', shadowOpacity: 0.9, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
  cardVal: { fontSize: 32, fontWeight: '800' },
  cardSym: { fontSize: 26 },
  opt: { flex: 1, minWidth: 150, backgroundColor: '#1e293b', borderRadius: 12, padding: 14, gap: 4 },
  optOn: { backgroundColor: '#f59e0b' },
  optTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '800' },
  optTitleOn: { color: '#111827' },
  optSub: { color: '#94a3b8', fontSize: 13 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1e293b', padding: 14, borderRadius: 12 },
  box: { width: 26, height: 26, borderRadius: 6, borderWidth: 2, borderColor: '#94a3b8', alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
  tick: { color: '#111827', fontWeight: '900' },
  toggleTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '700' },
  toggleSub: { color: '#94a3b8', fontSize: 13 },
  mode: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#1e293b' },
  modeOn: { backgroundColor: '#f59e0b' },
  modeTxt: { color: '#e2e8f0', fontWeight: '700', fontSize: 14 },
  modeTxtOn: { color: '#111827', fontWeight: '700', fontSize: 14 },
  who: { width: 44, paddingVertical: 8, borderRadius: 10, backgroundColor: '#1e293b', alignItems: 'center' },
  banner: { backgroundColor: '#f59e0b', borderRadius: 12, padding: 12 },
  bannerTxt: { color: '#111827', fontSize: 16, fontWeight: '800', textAlign: 'center' },
  pileNo: { color: '#94a3b8', fontSize: 12 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'center', minHeight: 22, maxWidth: 80 },
  badge: { backgroundColor: '#22c55e', color: '#052e16', fontWeight: '800', fontSize: 12, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
  badgeStop: { backgroundColor: '#ef4444', color: '#450a0a' },
  hintOn: { color: '#facc15', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  hint: { color: '#94a3b8', fontSize: 13, textAlign: 'center' },
  table: { backgroundColor: '#111c33', borderRadius: 12, padding: 12, gap: 8 },
  seats: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  seatWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seat: { minWidth: 62, alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 8, borderWidth: 2, borderColor: 'transparent' },
  seatOn: { backgroundColor: '#f59e0b', borderColor: '#fde68a' },
  seatName: { color: '#f8fafc', fontWeight: '800', fontSize: 15 },
  seatNameOn: { color: '#111827' },
  seatSub: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
  seatCan: { position: 'absolute', top: -10, right: -6, fontSize: 16 },
  arrow: { color: '#64748b', fontSize: 16 },
  hist: { backgroundColor: '#111c33', borderRadius: 12, padding: 12, gap: 4 },
  histLine: { color: '#94a3b8', fontSize: 13 },
  histFirst: { color: '#f8fafc', fontWeight: '700' },
  cover: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, gap: 8 },
  tokens: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  err: { color: '#fca5a5', textAlign: 'center' },
  input: { backgroundColor: '#1e293b', color: '#f8fafc', borderRadius: 12, padding: 14, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  codeInput: { width: 130, letterSpacing: 6 },
  quit: { alignSelf: 'center', padding: 10 },
  quitTxt: { color: '#94a3b8', textDecorationLine: 'underline' },
});
