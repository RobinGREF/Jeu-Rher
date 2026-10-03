import { StyleSheet, Text, View } from 'react-native';
import type { PlayerStats } from './engine';

const COLS: { key: keyof PlayerStats; icon: string; label: string }[] = [
  { key: 'done', icon: '✅', label: 'Missions réussies' },
  { key: 'missed', icon: '😬', label: 'Missions ratées alors qu\'elles étaient possibles' },
  { key: 'calls', icon: '🙋', label: 'Appels « je peux » faits' },
  { key: 'kept', icon: '🎯', label: 'Appels suivis d\'une mission réussie' },
  { key: 'wrongCalls', icon: '❌', label: 'Appels à tort (rien de réalisable)' },
  { key: 'wrongNo', icon: '🙈', label: 'Appels non détectés (« non » alors qu\'une mission était possible)' },
];

/** Stats de fin de partie : une ligne par joueur, une colonne par statistique, légende dessous. */
export function StatsTable({ names, stats }: { names: string[]; stats: PlayerStats[] }) {
  return (
    <View style={s.box} accessibilityLabel="Statistiques de la partie">
      <Text style={s.title}>📊 Statistiques de la partie</Text>
      <View style={s.row}>
        <Text style={[s.name, s.head]} />
        {COLS.map((c) => <Text key={c.key} style={[s.cell, s.head]}>{c.icon}</Text>)}
      </View>
      {stats.map((st, i) => (
        <View key={i} style={s.row}>
          <Text style={s.name} numberOfLines={1}>{names[i] ?? `Joueur ${i + 1}`}</Text>
          {COLS.map((c) => <Text key={c.key} style={s.cell}>{st[c.key]}</Text>)}
        </View>
      ))}
      <View style={s.legend}>
        {COLS.map((c) => <Text key={c.key} style={s.leg}>{c.icon} {c.label}</Text>)}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  box: { backgroundColor: '#1e293b', borderRadius: 12, padding: 12, gap: 6, alignSelf: 'stretch' },
  title: { color: '#e2e8f0', fontWeight: '800', fontSize: 15, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  name: { flex: 2.2, color: '#e2e8f0', fontWeight: '700', fontSize: 14 },
  cell: { flex: 1, textAlign: 'center', color: '#f8fafc', fontWeight: '700', fontSize: 15 },
  head: { fontSize: 16 },
  legend: { gap: 2, marginTop: 4 },
  leg: { color: '#94a3b8', fontSize: 12 },
});
