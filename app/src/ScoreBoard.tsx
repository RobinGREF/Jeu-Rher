import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { ScoreEntry } from './scores';

const MEDAL = { bronze: '🥉', argent: '🥈', or: '🥇' } as const;
const MODE = { solo: '🤖 Avec des machines', together: '📱 Un téléphone', online: '🌐 En ligne' } as const;
const RANK = ['🥇', '🥈', '🥉'];

const dateFr = (at: number) => {
  try { return new Date(at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); } catch { return ''; }
};

/** Les meilleures parties de cet appareil, avec les noms des participants. */
export function ScoreBoard({ list, highlightId, onBack, onClear }: { list: ScoreEntry[]; highlightId?: string | null; onBack: () => void; onClear: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <SafeAreaView style={s.root}>
      <StatusBar style="light" />
      <Text style={s.title}>🏆 Meilleurs scores</Text>
      <ScrollView contentContainerStyle={s.list}>
        {list.length === 0 && <Text style={s.empty}>Aucune partie terminée pour l'instant.{'\n'}Les scores apparaissent ici à la fin de chaque partie.</Text>}
        {list.slice(0, 20).map((e, i) => (
          <View key={e.id} style={[s.row, e.id === highlightId && s.rowNew]}>
            <Text style={s.rank}>{RANK[i] ?? `${i + 1}.`}</Text>
            <View style={s.body}>
              <Text style={s.score}>{e.completed}<Text style={s.of}>/50</Text> {e.medal ? MEDAL[e.medal] : ''}</Text>
              <Text style={s.names}>{e.players.map((p) => (p.bot ? `🤖 ${p.name}` : p.name)).join(' · ')}</Text>
              <Text style={s.meta}>{dateFr(e.at)} · {MODE[e.mode]} · {e.plays} coups</Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={s.foot}>
        <Pressable style={s.btn} onPress={onBack}><Text style={s.btnTxt}>← Retour</Text></Pressable>
        {list.length > 0 && (
          <Pressable onPress={() => { if (confirm) { onClear(); setConfirm(false); } else setConfirm(true); }} style={s.link}>
            <Text style={[s.linkTxt, confirm && s.danger]}>{confirm ? 'Touche encore pour tout effacer' : 'Effacer les scores'}</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a', paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 8, gap: 10 },
  title: { color: '#fff', fontSize: 26, fontWeight: '800', textAlign: 'center' },
  list: { gap: 8, paddingBottom: 8 },
  empty: { color: '#94a3b8', textAlign: 'center', fontSize: 15, paddingVertical: 30 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 14, padding: 12, borderWidth: 2, borderColor: 'transparent' },
  rowNew: { borderColor: '#f59e0b' },
  rank: { color: '#f8fafc', fontSize: 22, fontWeight: '800', width: 38, textAlign: 'center' },
  body: { flex: 1, gap: 2 },
  score: { color: '#fbbf24', fontSize: 22, fontWeight: '900' },
  of: { color: '#94a3b8', fontSize: 14, fontWeight: '700' },
  names: { color: '#f8fafc', fontSize: 15, fontWeight: '700' },
  meta: { color: '#94a3b8', fontSize: 12 },
  foot: { gap: 4 },
  btn: { backgroundColor: '#f59e0b', padding: 14, borderRadius: 12, alignItems: 'center' },
  btnTxt: { color: '#111827', fontSize: 17, fontWeight: '800' },
  link: { alignSelf: 'center', padding: 8 },
  linkTxt: { color: '#94a3b8', fontSize: 14, textDecorationLine: 'underline' },
  danger: { color: '#fca5a5', fontWeight: '800' },
});
