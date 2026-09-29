import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { missionsLeft, newGame, play, playablePiles, toggleCanDo, tops, type GameState } from './src/engine';
import { MissionToken } from './src/MissionToken';
import { SYMBOLS } from './src/symbols';
import type { Card } from './src/types';


function CardView({ card, selected, dim, onPress }: { card: Card; selected?: boolean; dim?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.card, { borderColor: SYMBOLS[card.symbol].color }, selected && s.cardSel, dim && { opacity: 0.35 }]}>
      <Text style={[s.cardVal, { color: SYMBOLS[card.symbol].color }]}>{card.value}</Text>
      <Text style={[s.cardSym, { color: SYMBOLS[card.symbol].color }]}>{SYMBOLS[card.symbol].emoji}</Text>
    </Pressable>
  );
}

const MEDAL = { bronze: '🥉 Bronze', argent: '🥈 Argent', or: '🥇 Or' } as const;

export default function App() {
  const [players, setPlayers] = useState(2);
  const [game, setGame] = useState<GameState | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [openHands, setOpenHands] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [textFor, setTextFor] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const tokenSize = Math.min(170, (width - 48) / 2);

  if (!game) {
    return (
      <SafeAreaView style={s.root}>
        <StatusBar style="light" />
        <Text style={s.title}>50 Missions</Text>
        <Text style={s.sub}>Jeu coopératif · un seul téléphone</Text>
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
        <Pressable style={s.btn} onPress={() => { setGame(newGame(players)); setRevealed(false); setSelected(null); }}>
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

  const hand = game.hands[game.current];
  const sel = hand.find((c) => c.id === selected) ?? null;
  const ok = sel ? playablePiles(game, sel) : [];
  const t = tops(game);
  const handShown = openHands || revealed;
  const drop = (pile: number) => {
    if (!handShown) return setError("Affiche d'abord ta main");
    if (!sel) return setError("Choisis d'abord une carte");
    const r = play(game, sel.id, pile);
    if (!r.ok) return setError(r.error);
    setError(''); setSelected(null); setRevealed(false); setGame(r.state);
  };

  return (
    <SafeAreaView style={s.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <Text style={s.title}>Joueur {game.current + 1}</Text>
        {status}
        {game.canDo.length > 0 && (
          <View style={s.banner}>
            <Text style={s.bannerTxt}>
              🙋 {game.canDo.map((p) => `Joueur ${p + 1}`).join(' et ')} {game.canDo.length > 1 ? 'peuvent' : 'peut'} réussir une mission
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
            <CardView key={i} card={c} dim={!!sel && !ok.includes(i)} onPress={() => drop(i)} />
          ))}
        </View>

        {game.players > 1 && (
          <>
            <Text style={s.label}>Je peux réussir une mission</Text>
            <View style={s.row}>
              {game.hands.map((_, i) => {
                const on = game.canDo.includes(i);
                return (
                  <Pressable key={i} onPress={() => setGame(toggleCanDo(game, i))} style={[s.mode, on && s.modeOn]}>
                    <Text style={[s.modeTxt, on && s.modeTxtOn]}>🙋 Joueur {i + 1}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={s.hint}>Tu peux le dire à tout moment, même hors de ton tour. On ne dit pas laquelle ni avec quelle carte. Touche encore pour retirer.</Text>
          </>
        )}

        {openHands ? (
          game.hands.map((h, i) => (
            <View key={i} style={{ gap: 8, opacity: i === game.current ? 1 : 0.55 }}>
              <Text style={s.label}>
                Joueur {i + 1}{i === game.current ? ' · à toi de jouer' : ''}{i === 0 ? ` · pioche : ${game.symbolDeck.length}` : ''}
              </Text>
              <View style={s.row}>
                {h.map((c) => (
                  <CardView key={c.id} card={c} selected={i === game.current && c.id === selected}
                    onPress={i === game.current ? () => { setSelected(c.id); setError(''); } : undefined} />
                ))}
              </View>
            </View>
          ))
        ) : revealed ? (
          <>
            <Text style={s.label}>Ta main · pioche : {game.symbolDeck.length}</Text>
            <View style={s.row}>
              {hand.map((c) => (
                <CardView key={c.id} card={c} selected={c.id === selected} onPress={() => { setSelected(c.id); setError(''); }} />
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
  hint: { color: '#94a3b8', fontSize: 13, textAlign: 'center' },
  cover: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, gap: 8 },
  tokens: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  mission: { backgroundColor: '#1e293b', padding: 12, borderRadius: 10 },
  missionTxt: { color: '#f8fafc', fontSize: 15 },
  err: { color: '#fca5a5', textAlign: 'center' },
});
