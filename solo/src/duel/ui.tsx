import { Pressable, StyleSheet, Text, View } from 'react-native';
import { catInfo, diffInfo } from './engine';
import type { DiffKey } from './types';

export function Btn({ label, onPress, kind = 'main', disabled }: { label: string; onPress: () => void; kind?: 'main' | 'ghost'; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={[s.btn, kind === 'ghost' && s.btnGhost, disabled && s.off]}>
      <Text style={[s.btnTxt, kind === 'ghost' && s.btnGhostTxt]}>{label}</Text>
    </Pressable>
  );
}

export function Pill({ cat, diff }: { cat: string; diff: DiffKey | null }) {
  const c = catInfo(cat);
  const d = diff ? diffInfo(diff) : null;
  return (
    <View style={s.pills}>
      <Text style={[s.pill, { backgroundColor: c.color }]}>{c.emoji} {c.label}</Text>
      {d && <Text style={[s.pill, { backgroundColor: d.color }]}>{d.label}</Text>}
    </View>
  );
}

export const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#12141c' },
  body: { padding: 16, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  topBtn: { padding: 8, minWidth: 64 },
  topRight: { flexDirection: 'row', minWidth: 64, justifyContent: 'flex-end' },
  topIcon: { padding: 8 },
  topTxt: { color: '#d4af37', fontWeight: '800', fontSize: 15 },
  topTitle: { color: '#ece7db', fontWeight: '800', fontSize: 16 },
  title: { color: '#d4af37', fontSize: 28, fontWeight: '900', textAlign: 'center' },
  heading: { color: '#d4af37', fontSize: 16, fontWeight: '800' },
  muted: { color: '#8b93a7', fontSize: 14, textAlign: 'center' },
  text: { color: '#ece7db', fontSize: 15 },
  bold: { fontWeight: '900', color: '#d4af37' },
  label: { color: '#ece7db', fontSize: 15, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  record: { color: '#d4af37', fontWeight: '800', textAlign: 'center' },
  card: { backgroundColor: '#1a1e2a', borderRadius: 14, padding: 16, gap: 10 },
  row: { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' },
  chip: { minWidth: 44, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#21273a', alignItems: 'center' },
  chipWide: { paddingHorizontal: 18 },
  chipOn: { backgroundColor: '#d4af37' },
  chipTxt: { color: '#ece7db', fontWeight: '800', fontSize: 16 },
  chipTxtOn: { color: '#12141c' },
  count: { color: '#ece7db', fontWeight: '800', fontSize: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  swatch: { width: 14, height: 36, borderRadius: 7 },
  input: { flex: 1, backgroundColor: '#21273a', color: '#ece7db', borderRadius: 10, padding: 12, fontSize: 16, fontWeight: '600' },
  codeInput: { flex: 0, width: 130, letterSpacing: 6, textAlign: 'center' },
  code: { color: '#d4af37', fontSize: 44, fontWeight: '900', letterSpacing: 10, textAlign: 'center' },
  btn: { backgroundColor: '#d4af37', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#8b93a7' },
  btnTxt: { color: '#12141c', fontWeight: '800', fontSize: 15, textAlign: 'center' },
  btnGhostTxt: { color: '#ece7db' },
  off: { opacity: 0.4 },
  err: { color: '#fca5a5', textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  // deux colonnes : chaque carte prend un peu moins de la moitié de la largeur (l'écart de 8 s'y glisse)
  cat: { width: '48.5%', borderWidth: 2, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, justifyContent: 'center', minHeight: 48 },
  catBig: { paddingVertical: 14, paddingHorizontal: 14, alignItems: 'center' },
  catTxt: { color: '#ece7db', fontWeight: '700', fontSize: 14, textAlign: 'center' },
  catSub: { color: '#8b93a7', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  turn: { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  // bandeau « à qui de jouer » : collé en haut (sur le web) pour rester visible quand on fait défiler
  turnBar: { position: 'sticky' as never, top: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#1a1e2a', borderWidth: 2, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  turnDot: { width: 14, height: 14, borderRadius: 7 },
  turnBarTxt: { fontSize: 18, fontWeight: '900', flexShrink: 1 },
  watch: { backgroundColor: '#21273a', borderRadius: 10, padding: 10 },
  watchTxt: { color: '#d4af37', fontWeight: '800', textAlign: 'center' },
  center: { alignItems: 'center', gap: 8 },
  pills: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: { color: '#fff', fontWeight: '800', fontSize: 13, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, overflow: 'hidden' },
  q: { color: '#ece7db', fontSize: 19, fontWeight: '700', lineHeight: 26 },
  diff: { borderWidth: 2, borderRadius: 12, padding: 16, gap: 4, backgroundColor: '#1a1e2a' },
  diffTitle: { fontSize: 18, fontWeight: '900' },
  choice: { backgroundColor: '#21273a', borderRadius: 10, padding: 14, borderWidth: 2, borderColor: 'transparent' },
  choiceTxt: { color: '#ece7db', fontSize: 16, fontWeight: '600' },
  right: { borderColor: '#5aab63', backgroundColor: '#1d3a26' },
  wrong: { borderColor: '#d9534f', backgroundColor: '#3a1e1e' },
  out: { opacity: 0.4 },
  outTxt: { textDecorationLine: 'line-through' },
  hints: { gap: 8 },
  verdict: { fontSize: 18, fontWeight: '900' },
  ok: { color: '#5aab63' },
  ko: { color: '#d9534f', fontWeight: '700' },
  info: { color: '#ece7db', backgroundColor: '#21273a', borderRadius: 10, padding: 12, lineHeight: 21 },
  link: { color: '#d4af37', textDecorationLine: 'underline', fontWeight: '700' },
  big: { color: '#ece7db', fontSize: 48, fontWeight: '900' },
});
