import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export type StatRow = { label: string; value: string | number };
export type StatSection = { title: string; rows: StatRow[] };

/** Page « Stats » d'un jeu : sections de lignes « libellé — valeur », et un bouton pour effacer. */
export function StatsView({ title, intro, sections, onBack, onReset }: { title: string; intro?: string; sections: StatSection[]; onBack: () => void; onReset?: () => void }) {
  return (
    <ScrollView contentContainerStyle={s.body}>
      <Text style={s.title}>📊 {title}</Text>
      {!!intro && <Text style={s.intro}>{intro}</Text>}
      {sections.map((sec) => (
        <View key={sec.title} style={s.card}>
          <Text style={s.head}>{sec.title}</Text>
          {sec.rows.map((r) => (
            <View key={r.label} style={s.row}>
              <Text style={s.label}>{r.label}</Text>
              <Text style={s.value}>{r.value}</Text>
            </View>
          ))}
        </View>
      ))}
      <Pressable onPress={onBack} style={s.btn} accessibilityRole="button"><Text style={s.btnTxt}>← Retour</Text></Pressable>
      {onReset && <Pressable onPress={onReset} style={s.ghost} accessibilityRole="button"><Text style={s.ghostTxt}>Effacer mes stats</Text></Pressable>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  body: { padding: 16, gap: 12, alignItems: 'center' },
  title: { color: '#f59e0b', fontSize: 26, fontWeight: '900', textAlign: 'center' },
  intro: { color: '#94a3b8', fontSize: 14, textAlign: 'center' },
  card: { alignSelf: 'stretch', maxWidth: 520, backgroundColor: '#1e293b', borderRadius: 14, padding: 14, gap: 6 },
  head: { color: '#f8fafc', fontSize: 16, fontWeight: '800', marginBottom: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  label: { color: '#94a3b8', fontSize: 14, flexShrink: 1 },
  value: { color: '#f8fafc', fontSize: 14, fontWeight: '800' },
  btn: { alignSelf: 'stretch', maxWidth: 520, backgroundColor: '#f59e0b', borderRadius: 12, padding: 14, alignItems: 'center' },
  btnTxt: { color: '#111827', fontWeight: '800', fontSize: 16 },
  ghost: { padding: 10 },
  ghostTxt: { color: '#94a3b8', fontSize: 13, textDecorationLine: 'underline' },
});
