import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { botMove, findMissionMoves, missionsLeft, newGame, play, playablePiles, syncBotAnnouncements, toggleCanDo, tops, type GameState } from './src/engine';
import { MissionToken } from './src/MissionToken';
import { SYMBOLS } from './src/symbols';
import type { Card } from './src/types';


function CardView({ card, selected, dim, glow, onPress }: { card: Card; selected?: boolean; dim?: boolean; glow?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.card, { borderColor: SYMBOLS[card.symbol].color }, selected && s.cardSel, glow && s.cardGlow, dim && { opacity: 0.35 }]}>
      <Text style={[s.cardVal, { color: SYMBOLS[card.symbol].color }]}>{card.value}</Text>
      <Text style={[s.cardSym, { color: SYMBOLS[card.symbol].color }]}>{SYMBOLS[card.symbol].emoji}</Text>
    </Pressable>
  );
}

const MEDAL = { bronze: '🥉 Bronze', argent: '🥈 Argent', or: '🥇 Or' } as const;

export default function App() {
  const [mode, setMode] = useState<'solo' | 'together'>('solo');
  const [bots, setBots] = useState(2);
  const [players, setPlayers] = useState(2);
  const [game, setGame] = useState<GameState | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [openHands, setOpenHands] = useState(false);
  const [helpOn, setHelpOn] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [textFor, setTextFor] = useState<string | null>(null);
  const [log, setLog] = useState('');
  const solo = mode === 'solo';
  const botSeats = (n: number) => Array.from({ length: n - 1 }, (_, i) => i + 1);
  const { width } = useWindowDimensions();
  const tokenSize = Math.min(170, (width - 48) / 2);

  // Tour d'une machine : une courte pause pour qu'on voie ce qui se passe, puis elle joue.
  useEffect(() => {
    if (!game || !solo || game.over || game.current === 0) return;
    const id = setTimeout(() => {
      const who = game.current;
      const mv = botMove(game, who);
      if (!mv) return;
      const card = game.hands[who].find((c) => c.id === mv.cardId)!;
      const r = play(game, mv.cardId, mv.pile);
      if (!r.ok) return;
      const gained = r.state.completed - game.completed;
      setLog(`Joueur ${who + 1} (machine) : ${card.value}${SYMBOLS[card.symbol].emoji} sur le tas ${mv.pile + 1}${gained ? ` · 🎯 +${gained} mission${gained > 1 ? 's' : ''}` : ''}`);
      setGame(syncBotAnnouncements(r.state, botSeats(game.players)));
    }, 1300);
    return () => clearTimeout(id);
  }, [game, solo]);

  if (!game) {
    return (
      <SafeAreaView style={s.root}>
        <StatusBar style="light" />
        <Text style={s.title}>50 Missions</Text>
        <Text style={s.sub}>Jeu coopératif</Text>
        <View style={s.row}>
          <Pressable onPress={() => setMode('solo')} style={[s.opt, solo && s.optOn]}>
            <Text style={[s.optTitle, solo && s.optTitleOn]}>Seul avec des machines</Text>
            <Text style={[s.optSub, solo && s.optTitleOn]}>Tu joues, les autres joueurs sont simulés.</Text>
          </Pressable>
          <Pressable onPress={() => setMode('together')} style={[s.opt, !solo && s.optOn]}>
            <Text style={[s.optTitle, !solo && s.optTitleOn]}>À plusieurs, un téléphone</Text>
            <Text style={[s.optSub, !solo && s.optTitleOn]}>On se passe le téléphone.</Text>
          </Pressable>
        </View>
        {solo ? (
          <>
            <Text style={s.label}>Joueurs machine</Text>
            <View style={s.row}>
              {[1, 2, 3].map((n) => (
                <Pressable key={n} onPress={() => setBots(n)} style={[s.chip, bots === n && s.chipOn]}>
                  <Text style={s.chipTxt}>{n}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <>
            <Text style={s.label}>Nombre de joueurs</Text>
            <View style={s.row}>
              {[1, 2, 3, 4].map((n) => (
                <Pressable key={n} onPress={() => setPlayers(n)} style={[s.chip, players === n && s.chipOn]}>
                  <Text style={s.chipTxt}>{n}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => setOpenHands(!openHands)} style={s.toggle}>
              <View style={[s.box, openHands && s.boxOn]}>{openHands && <Text style={s.tick}>✓</Text>}</View>
              <View style={{ flex: 1 }}>
                <Text style={s.toggleTitle}>Mains visibles (mode test)</Text>
                <Text style={s.toggleSub}>Toutes les mains sont affichées, sans passer le téléphone.</Text>
              </View>
            </Pressable>
          </>
        )}
        <Pressable onPress={() => setHelpOn(!helpOn)} style={s.toggle}>
          <View style={[s.box, helpOn && s.boxOn]}>{helpOn && <Text style={s.tick}>✓</Text>}</View>
          <View style={{ flex: 1 }}>
            <Text style={s.toggleTitle}>💡 Coup de pouce</Text>
            <Text style={s.toggleSub}>Le jeu montre à chaque joueur les cartes qui réussissent une ou plusieurs missions.</Text>
          </View>
        </Pressable>
        <Pressable style={s.btn} onPress={() => {
          const g = newGame(solo ? bots + 1 : players);
          setGame(solo ? syncBotAnnouncements(g, botSeats(g.players)) : g);
          setRevealed(false); setSelected(null); setLog(''); setError('');
        }}>
          <Text style={s.btnTxt}>Commencer</Text>
        </Pressable>
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
        <Text style={s.title}>{game.completed >= 50 ? '🎉 50 missions !' : 'Fin de partie'}</Text>
        {status}
        {game.completed < 50 && game.goldReached && <Text style={s.sub}>Il manquait {missionsLeft(game)} missions.</Text>}
        <Pressable style={s.btn} onPress={() => setGame(null)}><Text style={s.btnTxt}>Rejouer</Text></Pressable>
      </SafeAreaView>
    );
  }

  const me = solo ? 0 : game.current;
  const hand = game.hands[me];
  const sel = hand.find((c) => c.id === selected) ?? null;
  const ok = sel ? playablePiles(game, sel) : [];
  const t = tops(game);
  const handShown = solo || openHands || revealed;
  const seat = (p: number) => `Joueur ${p + 1}${solo && p > 0 ? ' (machine)' : ''}`;
  const hintsOf = (p: number) => (helpOn ? findMissionMoves(game, p) : []);
  const myHints = hintsOf(me);
  const hintCards = (p: number) => new Set(hintsOf(p).map((m) => m.cardId));
  const hintPiles = new Set(myHints.filter((m) => m.cardId === selected).map((m) => m.pile));
  const hintText = (p: number) => {
    const h = hintsOf(p);
    if (!h.length) return null;
    const best = Math.max(...h.map((m) => m.missions.length));
    const cards = new Set(h.map((m) => m.cardId)).size;
    return `💡 ${cards} carte${cards > 1 ? 's' : ''} réussi${cards > 1 ? 'ssent' : 't'} une mission${best > 1 ? ` (jusqu'à ${best} d'un coup)` : ''}`;
  };

  const drop = (pile: number) => {
    if (!handShown) return setError("Affiche d'abord ta main");
    if (solo && game.current !== 0) return setError("Ce n'est pas encore ton tour");
    if (!sel) return setError("Choisis d'abord une carte");
    const r = play(game, sel.id, pile);
    if (!r.ok) return setError(r.error);
    const gained = r.state.completed - game.completed;
    if (solo) setLog(`Toi : ${sel.value}${SYMBOLS[sel.symbol].emoji} sur le tas ${pile + 1}${gained ? ` · 🎯 +${gained} mission${gained > 1 ? 's' : ''}` : ''}`);
    setError(''); setSelected(null); setRevealed(false);
    setGame(solo ? syncBotAnnouncements(r.state, botSeats(game.players)) : r.state);
  };

  return (
    <SafeAreaView style={s.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <Text style={s.title}>
          {solo ? (game.current === 0 ? 'À toi de jouer' : `${seat(game.current)} joue…`) : `Joueur ${game.current + 1}`}
        </Text>
        {status}
        {!!log && <Text style={s.log}>{log}</Text>}
        {game.canDo.length > 0 && (
          <View style={s.banner}>
            <Text style={s.bannerTxt}>
              🙋 {game.canDo.map(seat).join(' et ')} {game.canDo.length > 1 ? 'peuvent' : 'peut'} réussir une mission
            </Text>
          </View>
        )}

        <Text style={s.label}>Missions (touche un jeton pour lire le texte)</Text>
        <View style={s.tokens}>
          {game.missions.map((m) => (
            <MissionToken key={m.id} def={m} size={tokenSize} showText={textFor === m.id}
              onPress={() => setTextFor(textFor === m.id ? null : m.id)} />
          ))}
        </View>

        <Text style={s.label}>Tas</Text>
        <View style={s.row}>
          {t.map((c, i) => (
            <View key={i} style={{ alignItems: 'center', gap: 4 }}>
              <CardView card={c} dim={!!sel && !ok.includes(i)} glow={hintPiles.has(i)} onPress={() => drop(i)} />
              <Text style={s.pileNo}>tas {i + 1}</Text>
            </View>
          ))}
        </View>

        {game.players > 1 && (
          <>
            <Text style={s.label}>Je peux réussir une mission</Text>
            <View style={s.row}>
              {(solo ? [0] : game.hands.map((_, i) => i)).map((i) => {
                const on = game.canDo.includes(i);
                return (
                  <Pressable key={i} onPress={() => setGame(toggleCanDo(game, i))} style={[s.mode, on && s.modeOn]}>
                    <Text style={[s.modeTxt, on && s.modeTxtOn]}>{solo ? '🙋 Je peux réussir une mission' : `🙋 Joueur ${i + 1}`}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={s.hint}>
              {solo ? 'Les machines l\'annoncent toutes seules. ' : ''}À dire à tout moment, même hors de ton tour, sans préciser laquelle ni avec quelle carte. Touche encore pour retirer.
            </Text>
          </>
        )}

        {openHands ? (
          game.hands.map((h, i) => (
            <View key={i} style={{ gap: 8, opacity: i === game.current ? 1 : 0.55 }}>
              <Text style={s.label}>
                Joueur {i + 1}{i === game.current ? ' · à toi de jouer' : ''}{i === 0 ? ` · pioche : ${game.symbolDeck.length}` : ''}
              </Text>
              {hintText(i) && <Text style={s.hintOn}>{hintText(i)}</Text>}
              <View style={s.row}>
                {h.map((c) => (
                  <CardView key={c.id} card={c} glow={hintCards(i).has(c.id)} selected={i === game.current && c.id === selected}
                    onPress={i === game.current ? () => { setSelected(c.id); setError(''); } : undefined} />
                ))}
              </View>
            </View>
          ))
        ) : handShown ? (
          <>
            <Text style={s.label}>Ta main · pioche : {game.symbolDeck.length}{solo && game.current === 0 ? ' · à toi' : ''}</Text>
            {hintText(me) && <Text style={s.hintOn}>{hintText(me)} · touche-la pour voir le tas</Text>}
            <View style={s.row}>
              {hand.map((c) => (
                <CardView key={c.id} card={c} glow={hintCards(me).has(c.id)} selected={c.id === selected} onPress={() => { setSelected(c.id); setError(''); }} />
              ))}
            </View>
          </>
        ) : (
          <View style={s.cover}>
            <Text style={s.sub}>Passe le téléphone au joueur {game.current + 1}, puis touche pour voir ta main.</Text>
            <Pressable style={s.btn} onPress={() => { setRevealed(true); }}>
              <Text style={s.btnTxt}>Voir ma main</Text>
            </Pressable>
          </View>
        )}
        {!!error && <Text style={s.err}>{error}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a', padding: 16, justifyContent: 'center', gap: 14 },
  title: { color: '#fff', fontSize: 30, fontWeight: '800', textAlign: 'center' },
  sub: { color: '#cbd5e1', fontSize: 15, textAlign: 'center' },
  label: { color: '#94a3b8', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap' },
  chip: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: '#f59e0b' },
  chipTxt: { color: '#fff', fontSize: 20, fontWeight: '700' },
  btn: { backgroundColor: '#f59e0b', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  btnTxt: { color: '#111827', fontSize: 18, fontWeight: '800' },
  card: { width: 70, height: 100, borderRadius: 10, borderWidth: 3, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  cardSel: { transform: [{ translateY: -10 }], borderWidth: 5 },
  cardVal: { fontSize: 32, fontWeight: '800' },
  cardSym: { fontSize: 26 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1e293b', padding: 14, borderRadius: 12 },
  box: { width: 26, height: 26, borderRadius: 6, borderWidth: 2, borderColor: '#94a3b8', alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
  tick: { color: '#111827', fontWeight: '900' },
  toggleTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '700' },
  toggleSub: { color: '#94a3b8', fontSize: 13 },
  mode: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#1e293b' },
  modeOn: { backgroundColor: '#f59e0b' },
  modeTxt: { color: '#e2e8f0', fontWeight: '700', fontSize: 14 },
  modeTxtOn: { color: '#111827' },
  banner: { backgroundColor: '#f59e0b', borderRadius: 12, padding: 12 },
  bannerTxt: { color: '#111827', fontSize: 16, fontWeight: '800', textAlign: 'center' },
  cardGlow: { borderColor: '#facc15', shadowColor: '#facc15', shadowOpacity: 0.9, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
  pileNo: { color: '#94a3b8', fontSize: 12 },
  hintOn: { color: '#facc15', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  opt: { flex: 1, minWidth: 150, backgroundColor: '#1e293b', borderRadius: 12, padding: 14, gap: 4 },
  optOn: { backgroundColor: '#f59e0b' },
  optTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '800' },
  optTitleOn: { color: '#111827' },
  optSub: { color: '#94a3b8', fontSize: 13 },
  log: { color: '#cbd5e1', fontSize: 14, textAlign: 'center', fontStyle: 'italic' },
  hint: { color: '#94a3b8', fontSize: 13, textAlign: 'center' },
  cover: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, gap: 8 },
  tokens: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  mission: { backgroundColor: '#1e293b', padding: 12, borderRadius: 10 },
  missionTxt: { color: '#f8fafc', fontSize: 15 },
  err: { color: '#fca5a5', textAlign: 'center' },
});
