import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  botMove, findMissionMoves, missionsLeft, newGame, play, playablePiles, reachableMissions,
  syncBotAnnouncements, syncBotSignals, toggleCanDo, toggleSignal, tops,
  type GameState, type SignalKind,
} from './src/engine';
import { InfoPanel } from './src/InfoPanel';
import { MissionToken } from './src/MissionToken';
import { TableScene, type PileView } from './src/TableScene';
import { SYMBOLS } from './src/symbols';

type Mode = 'solo' | 'together';

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
  const [mode, setMode] = useState<Mode>('solo');
  const [bots, setBots] = useState(2);
  const [players, setPlayers] = useState(2);
  const [openHands, setOpenHands] = useState(false);
  const [helpOn, setHelpOn] = useState(false);
  const [showTargets, setShowTargets] = useState(true);
  const [phrasesOn, setPhrasesOn] = useState(false);

  const [game, setGame] = useState<GameState | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [textFor, setTextFor] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [info, setInfo] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [sigMode, setSigMode] = useState<'play' | SignalKind>('play');
  const [speaker, setSpeaker] = useState<number | null>(null);

  const { width, height } = useWindowDimensions();
  const tokenSize = Math.min(96, (width - 32 - 3 * 6) / 4);
  const scale = Math.min(1, Math.max(0.72, (height - 200) / 560));

  const solo = mode === 'solo';
  const botSeats = (n: number) => (solo ? Array.from({ length: n - 1 }, (_, i) => i + 1) : []);
  const seat = (p: number) => `Joueur ${p + 1}${botSeats(99).includes(p) ? ' (machine)' : ''}`;
  /** Applique les annonces automatiques des machines après chaque changement du tapis. */
  const sync = (g: GameState) => {
    const bs = botSeats(g.players);
    const a = syncBotAnnouncements(g, bs);
    return phrasesOn ? syncBotSignals(a, bs) : a;
  };
  const log = (entry: string) => setHistory((h) => [entry, ...h].slice(0, 300));

  /** Un coup de machine pour le joueur courant. */
  const doBotMove = (g: GameState) => {
    const who = g.current;
    const mv = botMove(g, who);
    if (!mv) return;
    const card = g.hands[who].find((c) => c.id === mv.cardId)!;
    const r = play(g, mv.cardId, mv.pile);
    if (!r.ok) return;
    const gained = r.state.completed - g.completed;
    log(`${seat(who)} : ${card.value}${SYMBOLS[card.symbol].emoji} sur le tas ${mv.pile + 1}${gained ? ` · 🎯 +${gained} mission${gained > 1 ? 's' : ''}` : ''}`);
    setGame(sync(r.state));
  };

  // Tour d'une machine : une courte pause pour qu'on voie ce qui se passe, puis elle joue.
  useEffect(() => {
    if (!game || game.over) return;
    if (!solo || game.current === 0) return;
    const id = setTimeout(() => doBotMove(game), 1300);
    return () => clearTimeout(id);
  }, [game, mode]);

  const start = () => {
    const n = solo ? bots + 1 : players;
    const g = newGame(n);
    setGame(sync(g));
    setRevealed(false); setSelected(null); setHistory([]); setError('');
    setSigMode('play'); setSpeaker(null); setMenu(false); setInfo(false); setTextFor(null);
  };

  if (!game) {
    return (
      <SafeAreaView style={s.root}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={s.setup}>
          <Text style={s.title}>50 Missions</Text>
          <Text style={s.sub}>Jeu coopératif</Text>
          <View style={s.row}>
            {([
              ['solo', 'Seul avec des machines', 'Tu joues, les autres joueurs sont simulés.'],
              ['together', 'À plusieurs, un téléphone', 'On se passe le téléphone.'],
            ] as const).map(([key, title, sub]) => (
              <Pressable key={key} onPress={() => setMode(key)} style={[s.opt, mode === key && s.optOn]}>
                <Text style={[s.optTitle, mode === key && s.optTitleOn]}>{title}</Text>
                <Text style={[s.optSub, mode === key && s.optTitleOn]}>{sub}</Text>
              </Pressable>
            ))}
          </View>

          {solo && (<><Text style={s.label}>Joueurs machine</Text><Chips values={[1, 2, 3]} value={bots} onChange={setBots} /></>)}
          {mode === 'together' && (
            <>
              <Text style={s.label}>Nombre de joueurs</Text>
              <Chips values={[1, 2, 3, 4]} value={players} onChange={setPlayers} />
              <Toggle on={openHands} onPress={() => setOpenHands(!openHands)} title="Mains visibles (mode test)" sub="Toutes les mains sont affichées, sans passer le téléphone." />
            </>
          )}

          <Text style={s.label}>Options</Text>
          <Toggle on={helpOn} onPress={() => setHelpOn(!helpOn)} title="💡 Coup de pouce" sub="Le jeu montre les cartes qui réussissent une ou plusieurs missions." />
          {mode !== 'together' && (
            <Toggle on={showTargets} onPress={() => setShowTargets(!showTargets)} title="🎯 Voir les missions visées" sub="Des pastilles montrent quelles missions chaque machine peut réussir." />
          )}
          <Toggle on={phrasesOn} onPress={() => setPhrasesOn(!phrasesOn)} title="💬 Phrases du livret" sub="En plus de « je peux » : « je peux aider » (mission), « bonne carte ici » et « ne jouez pas ici » (tas)." />

          <Pressable style={s.btn} onPress={start}>
            <Text style={s.btnTxt}>Commencer</Text>
          </Pressable>
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
          <Text style={s.sub}>{history.length} coups joués</Text>
          <Pressable style={s.btn} onPress={() => setGame(null)}><Text style={s.btnTxt}>Rejouer</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const me = solo ? 0 : game.current;
  const hand = game.hands[me];
  const sel = hand.find((c) => c.id === selected) ?? null;
  const ok = sel ? playablePiles(game, sel) : [];
  const t = tops(game);
  const handShown = solo || openHands || revealed;
  const canSignal = phrasesOn && game.players > 1;
  // Celui qui parle : toi en solo ; sinon, par défaut, le joueur suivant.
  const who = solo ? 0 : speaker ?? (game.current + 1) % game.players;

  const hintsOf = (p: number) => (helpOn ? findMissionMoves(game, p) : []);
  const hintCards = new Set(hintsOf(me).map((m) => m.cardId));
  const hintPiles = new Set(hintsOf(me).filter((m) => m.cardId === selected).map((m) => m.pile));
  const hintLine = (() => {
    const h = hintsOf(me);
    if (!h.length) return null;
    const best = Math.max(...h.map((m) => m.missions.length));
    const cards = new Set(h.map((m) => m.cardId)).size;
    return `💡 ${cards} carte${cards > 1 ? 's' : ''} réussi${cards > 1 ? 'ssent' : 't'} une mission${best > 1 ? ` (jusqu'à ${best})` : ''}`;
  })();

  const signalTags = (kind: SignalKind, target: { mission?: string; pile?: number }) =>
    game.signals.filter((g) => g.kind === kind && g.mission === target.mission && g.pile === target.pile).map((g) => `${KIND_ICON[kind]} J${g.player + 1}`);

  const missionBadges = (id: string) => {
    const help = signalTags('help', { mission: id });
    const helpers = new Set(game.signals.filter((g) => g.kind === 'help' && g.mission === id).map((g) => g.player));
    const targets =
      showTargets && mode !== 'together'
        ? botSeats(game.players).filter((b) => !helpers.has(b) && reachableMissions(game, b).includes(id)).map((b) => `🙋J${b + 1}`)
        : [];
    const mine = helpOn && reachableMissions(game, me).includes(id) ? [solo ? '💡Toi' : `💡J${me + 1}`] : [];
    return [...mine, ...help, ...targets];
  };

  const drop = (pile: number) => {
    if (canSignal && (sigMode === 'good' || sigMode === 'stop')) return setGame(toggleSignal(game, { player: who, kind: sigMode, pile }));
    if (!handShown) return setError("Affiche d'abord ta main");
    if (solo && game.current !== 0) return setError("Ce n'est pas encore ton tour");
    if (!sel) return setError("Choisis d'abord une carte");
    const r = play(game, sel.id, pile);
    if (!r.ok) return setError(r.error);
    const gained = r.state.completed - game.completed;
    log(`${solo ? 'Toi' : seat(game.current)} : ${sel.value}${SYMBOLS[sel.symbol].emoji} sur le tas ${pile + 1}${gained ? ` · 🎯 +${gained} mission${gained > 1 ? 's' : ''}` : ''}`);
    setError(''); setSelected(null); setRevealed(false); setSpeaker(null); setSigMode('play');
    setGame(sync(r.state));
  };

  const pileViews: PileView[] = t.map((card, i) => ({
    card,
    dim: !!sel && !ok.includes(i),
    glow: hintPiles.has(i),
    tags: [...signalTags('good', { pile: i }), ...signalTags('stop', { pile: i })].map((text) => ({ text, stop: text.startsWith(KIND_ICON.stop) })),
  }));

  const missionText = game.missions.find((m) => m.id === textFor)?.label;
  const sigHint = { play: '', help: 'Touche la mission pour laquelle tu peux aider', good: 'Touche le tas où tu as une bonne carte', stop: 'Touche le tas où il ne faut pas jouer' }[sigMode];
  const toggleSig = (k: SignalKind) => setSigMode(sigMode === k ? 'play' : k);
  const turnTitle = solo ? (game.current === 0 ? 'À toi de jouer' : `${seat(game.current)} joue…`) : `Joueur ${game.current + 1} joue`;

  return (
    <SafeAreaView style={s.game}>
      <StatusBar style="light" />

      <View style={s.head}>
        <Text style={s.headTitle} numberOfLines={1}>{turnTitle}</Text>
        <Text style={s.headStat}>🎯 {game.completed}/50{game.medal ? ` ${MEDAL[game.medal]}` : ''} · pioche {game.symbolDeck.length}</Text>
        <Pressable onPress={() => { setInfo(true); setMenu(false); }} style={s.menuBtn} accessibilityLabel="Infos sur la partie"><Text style={s.menuTxt}>ℹ️</Text></Pressable>
        <Pressable onPress={() => setMenu(!menu)} style={s.menuBtn} accessibilityLabel="Menu"><Text style={s.menuTxt}>☰</Text></Pressable>
      </View>

      <View style={s.missRow}>
        {game.missions.map((m) => (
          <MissionToken key={m.id} def={m} size={tokenSize} showText={false} badges={missionBadges(m.id)}
            onPress={() => (canSignal && sigMode === 'help'
              ? setGame(toggleSignal(game, { player: who, kind: 'help', mission: m.id }))
              : setTextFor(textFor === m.id ? null : m.id))} />
        ))}
      </View>

      <View style={s.tableWrap}>
        <TableScene game={game} solo={solo} piles={pileViews} onPile={drop}
          meIndex={me} hand={hand} handShown={handShown} selectedId={selected} hintCards={hintCards} hintLine={hintLine}
          onSelect={(id) => { setSelected(id); setError(''); setSigMode('play'); }}
          onReveal={() => { setRevealed(true); setSigMode('play'); }} revealAll={openHands} scale={scale} />
        {!!missionText && (
          <Pressable onPress={() => setTextFor(null)} style={s.tip}><Text style={s.tipTxt}>{missionText}</Text></Pressable>
        )}
      </View>

      <View style={s.bar}>
        {!!error ? <Text style={s.barErr} numberOfLines={1}>{error}</Text>
          : sigMode !== 'play' ? <Text style={s.barTxt} numberOfLines={1}>{sigHint}</Text>
          : <Text style={s.barTxt} numberOfLines={1}>{history[0] ?? 'À toi de commencer'}</Text>}
        <View style={s.barRow}>
          {(solo ? [0] : game.hands.map((_, i) => i)).map((i) => {
            const on = game.canDo.includes(i);
            return (
              <Pressable key={i} onPress={() => setGame(toggleCanDo(game, i))} style={[s.mode, s.grow, on && s.modeOn]}>
                <Text style={[s.modeTxt, on && s.modeTxtOn]} numberOfLines={1}>{solo ? '🙋 Je peux réussir une mission' : `🙋 J${i + 1}`}</Text>
              </Pressable>
            );
          })}
          {canSignal && (['help', 'good', 'stop'] as const).map((k) => (
            <Pressable key={k} onPress={() => toggleSig(k)} style={[s.mode, sigMode === k && s.modeOn]}>
              <Text style={[s.modeTxt, sigMode === k && s.modeTxtOn]}>{KIND_ICON[k]}</Text>
            </Pressable>
          ))}
        </View>
        {canSignal && !solo && sigMode !== 'play' && (
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

      {info && (
        <InfoPanel game={game} solo={solo} onClose={() => setInfo(false)} options={{ help: helpOn, targets: showTargets, phrases: phrasesOn }} />
      )}

      {menu && (
        <View style={s.menu}>
          <Text style={s.label}>Derniers coups</Text>
          {history.slice(0, 8).map((h, i) => (
            <Text key={history.length - i} style={[s.histLine, i === 0 && s.histFirst]}>{history.length - i}. {h}</Text>
          ))}
          {history.length === 0 && <Text style={s.histLine}>Aucun coup joué.</Text>}
          <Pressable onPress={() => setGame(null)} style={s.quit}><Text style={s.quitTxt}>Quitter la partie</Text></Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  game: { flex: 1, backgroundColor: '#0f172a', paddingLeft: 16, paddingRight: 16, paddingTop: 6, paddingBottom: 8, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headTitle: { color: '#fff', fontSize: 17, fontWeight: '800', flexShrink: 1 },
  headStat: { color: '#cbd5e1', fontSize: 12, flex: 1, textAlign: 'right' },
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
  grow: { flex: 1, alignItems: 'center' },
  menu: { position: 'absolute', top: 40, left: 16, right: 16, backgroundColor: '#111c33', borderRadius: 12, padding: 12, gap: 4, borderWidth: 1, borderColor: '#334155' },
  root: { flex: 1, backgroundColor: '#0f172a', padding: 16, justifyContent: 'center', gap: 14 },
  setup: { gap: 14, paddingVertical: 8 },
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
  quit: { alignSelf: 'center', padding: 10 },
  quitTxt: { color: '#94a3b8', textDecorationLine: 'underline' },
});
