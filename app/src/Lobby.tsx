import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MAX_PLAYERS, type OnlineSession, type Snapshot } from './online/session';

/** Salon d'attente : le code à partager, les joueurs présents, et pour l'hôte les réglages et le départ. */
export function Lobby({ snap, session, onLeave, local }: { snap: Snapshot; session: OnlineSession | null; onLeave: () => void; local: boolean }) {
  const humans = snap.players.length;
  const [total, setTotal] = useState(Math.max(2, humans));
  const seats = Math.max(total, humans, 2);

  if (snap.phase === 'error') {
    return (
      <SafeAreaView style={s.root}>
        <StatusBar style="light" />
        <Text style={s.title}>Connexion perdue</Text>
        <Text style={s.err}>{snap.error}</Text>
        <Pressable style={s.btn} onPress={onLeave}><Text style={s.btnTxt}>Retour</Text></Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.label}>Code du salon</Text>
        <Text style={s.code} accessibilityLabel={`Code ${snap.code.split('').join(' ')}`}>{snap.code}</Text>
        <Text style={s.sub}>Les autres joueurs saisissent ce code pour te rejoindre.{local ? '\n(Test local : ouvre un autre onglet de ce navigateur.)' : ''}</Text>

        <Text style={s.label}>Joueurs ({humans}/{MAX_PLAYERS})</Text>
        <View style={s.list}>
          {snap.players.map((p, i) => (
            <View key={p.uid} style={s.player}>
              <Text style={s.avatar}>{p.uid === snap.uid ? '🙂' : '👤'}</Text>
              <Text style={s.pname}>{p.name}{p.uid === snap.uid ? ' (toi)' : ''}</Text>
              {i === 0 && <Text style={s.tag}>hôte</Text>}
            </View>
          ))}
          {snap.isHost && Array.from({ length: Math.max(0, seats - humans) }, (_, i) => (
            <View key={`bot${i}`} style={[s.player, s.bot]}>
              <Text style={s.avatar}>🤖</Text>
              <Text style={s.pname}>Machine {i + 1}</Text>
            </View>
          ))}
        </View>

        {snap.isHost ? (
          <>
            <Text style={s.label}>Joueurs à la table</Text>
            <View style={s.row}>
              {[2, 3, 4].map((n) => (
                <Pressable key={n} disabled={n < humans} onPress={() => setTotal(n)} style={[s.chip, seats === n && s.chipOn, n < humans && { opacity: 0.35 }]}>
                  <Text style={s.chipTxt}>{n}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={s.hint}>Les places libres sont tenues par des machines.</Text>

            <Text style={s.label}>Pause entre les coups</Text>
            <View style={s.row}>
              {[5000, 2000, 1000].map((ms) => (
                <Pressable key={ms} onPress={() => session?.configure({ ...snap.options, pauseMs: ms })} style={[s.pill, snap.options.pauseMs === ms && s.pillOn]}>
                  <Text style={[s.pillTxt, snap.options.pauseMs === ms && s.pillTxtOn]}>{ms / 1000} s</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => session?.configure({ ...snap.options, phrases: !snap.options.phrases })} style={s.toggle}>
              <View style={[s.box, snap.options.phrases && s.boxOn]}>{snap.options.phrases && <Text style={s.tick}>✓</Text>}</View>
              <View style={{ flex: 1 }}>
                <Text style={s.toggleTitle}>💬 Phrases du livret</Text>
                <Text style={s.toggleSub}>« Je peux aider », « bonne carte ici », « ne jouez pas ici ».</Text>
              </View>
            </Pressable>

            <Pressable style={s.btn} onPress={() => session?.startGame(seats)}>
              <Text style={s.btnTxt}>Lancer la partie{humans < 2 && seats >= 2 ? ' avec des machines' : ''}</Text>
            </Pressable>
          </>
        ) : (
          <Text style={s.wait}>En attente du lancement par l'hôte…</Text>
        )}

        <Pressable onPress={onLeave} style={s.quit}><Text style={s.quitTxt}>Quitter le salon</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a', padding: 16, justifyContent: 'center', gap: 14 },
  body: { gap: 12, paddingVertical: 8 },
  title: { color: '#fff', fontSize: 26, fontWeight: '800', textAlign: 'center' },
  label: { color: '#94a3b8', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' },
  code: { color: '#fbbf24', fontSize: 64, fontWeight: '900', letterSpacing: 12, textAlign: 'center' },
  sub: { color: '#cbd5e1', fontSize: 14, textAlign: 'center' },
  hint: { color: '#94a3b8', fontSize: 12, textAlign: 'center' },
  err: { color: '#fca5a5', textAlign: 'center' },
  wait: { color: '#cbd5e1', fontSize: 16, textAlign: 'center', paddingVertical: 12 },
  list: { gap: 6 },
  player: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1e293b', borderRadius: 12, padding: 12 },
  bot: { opacity: 0.6 },
  avatar: { fontSize: 22 },
  pname: { color: '#f8fafc', fontSize: 16, fontWeight: '700', flex: 1 },
  tag: { color: '#111827', backgroundColor: '#f59e0b', fontWeight: '800', fontSize: 11, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
  row: { flexDirection: 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap' },
  chip: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: '#f59e0b' },
  chipTxt: { color: '#fff', fontSize: 20, fontWeight: '700' },
  pill: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#1e293b' },
  pillOn: { backgroundColor: '#f59e0b' },
  pillTxt: { color: '#e2e8f0', fontWeight: '700' },
  pillTxtOn: { color: '#111827' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1e293b', padding: 14, borderRadius: 12 },
  box: { width: 26, height: 26, borderRadius: 6, borderWidth: 2, borderColor: '#94a3b8', alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
  tick: { color: '#111827', fontWeight: '900' },
  toggleTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '700' },
  toggleSub: { color: '#94a3b8', fontSize: 13 },
  btn: { backgroundColor: '#f59e0b', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  btnTxt: { color: '#111827', fontSize: 18, fontWeight: '800' },
  quit: { alignSelf: 'center', padding: 10 },
  quitTxt: { color: '#94a3b8', textDecorationLine: 'underline' },
});
