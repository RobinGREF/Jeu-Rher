import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MissionDef, Term, VisualCard, VisualItem } from './missions';
import { SYMBOLS } from './symbols';

const CREAM = '#fef9c3';
const INK = '#7c2d12';

/** Mélange d'une couleur avec du blanc (t = part de blanc) : fond clair mais bien teinté. */
const tint = (hex: string, t: number) => {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  return `rgb(${mix((n >> 16) & 255)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
};

/** Le symbole sur un disque blanc cerclé de la couleur de sa famille (vert, jaune, bleu, rouge) : lisible même petit. */
function SymIcon({ sym, size }: { sym: number; size: number }) {
  const s = SYMBOLS[sym];
  const ring = Math.max(2, Math.round(size * 0.1));
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#fff', borderWidth: ring, borderColor: s.color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.62 }}>{s.emoji}</Text>
    </View>
  );
}

function MiniCard({ c, w }: { c: VisualCard; w: number }) {
  const h = w * 1.45;
  const stripe = c.sym?.length === 1 ? SYMBOLS[c.sym[0]].color : '#a16207';
  const bg = c.sym?.length === 1 ? tint(stripe, 0.8) : CREAM; // carte d'une seule famille : fond à sa couleur
  return (
    <View style={[s.mini, { width: w, height: h, borderRadius: w * 0.14, backgroundColor: bg, borderWidth: Math.max(2, w * 0.08), borderColor: c.blank ? '#d6d3d1' : stripe }]}>
      {c.vals && (
        <View style={[s.vals, { width: w }]}>
          {c.vals.map((v) => (
            <Text key={v} style={{ fontSize: c.vals!.length > 1 ? w * 0.34 : w * 0.62, fontWeight: '700', color: INK, width: c.vals!.length > 1 ? '50%' : '100%', textAlign: 'center' }}>{v}</Text>
          ))}
        </View>
      )}
      {c.sym && (
        <View style={{ alignItems: 'center', gap: 1 }}>
          {c.sym.map((sy) => (
            <SymIcon key={sy} sym={sy} size={c.vals ? w * 0.42 : c.sym!.length > 1 ? w * 0.5 : w * 0.7} />
          ))}
        </View>
      )}
    </View>
  );
}

function Item({ it, w }: { it: VisualItem; w: number }) {
  if (it.t === 'card') return <MiniCard c={it} w={w} />;
  if (it.t === 'tear') return <View style={{ width: 3, height: w * 1.3, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: '#fb923c' }} />;
  return <Text style={{ color: CREAM, fontWeight: '800', fontSize: w * 0.5 }}>···</Text>;
}

function TermView({ t, size }: { t: Term; size: number }) {
  if ('sym' in t) return <SymIcon sym={t.sym} size={size} />;
  const txt = 'sigma' in t ? 'Σ' : String(t.num);
  return <Text style={{ color: CREAM, fontSize: size * 0.9, fontWeight: '700' }}>{txt}</Text>;
}

/** Jeton rond de mission, dessiné comme sur la carte du jeu. Touche pour lire le texte. */
export function MissionToken({ def, size, showText, badges = [], mark, onPress }: { def: MissionDef; size: number; showText: boolean; badges?: string[]; mark?: 'announced' | 'picked'; onPress: () => void }) {
  const v = def.visual;
  return (
    <Pressable onPress={onPress} accessibilityLabel={def.label} style={{ width: size, alignItems: 'center', gap: 3 }}>
      <View style={[s.token, { width: size, height: size, borderRadius: size / 2 }, mark === 'announced' && s.announced]}>
        <View style={[s.ring, { borderRadius: size / 2 }, mark === 'picked' && s.ringPicked]} />
        {v.kind === 'row' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            {v.items.map((it, i) => <Item key={i} it={it} w={size * (v.items.length > 4 ? 0.14 : 0.185)} />)}
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.03 }}>
            <TermView t={v.left} size={size * 0.24} />
            <Text style={{ color: CREAM, fontSize: size * 0.2, fontWeight: '700' }}>=</Text>
            <TermView t={v.right} size={size * 0.24} />
            {v.times && <Text style={{ color: CREAM, fontSize: size * 0.16, fontWeight: '700' }}>×2</Text>}
          </View>
        )}
      </View>
      <View style={s.badges}>
        {badges.map((b) => <Text key={b} style={s.badge}>{b}</Text>)}
      </View>
      {showText && <Text style={s.caption}>{def.label}</Text>}
    </Pressable>
  );
}

const s = StyleSheet.create({
  token: { backgroundColor: '#9a3412', alignItems: 'center', justifyContent: 'center' },
  announced: { shadowColor: '#fde047', shadowOpacity: 1, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 10 },
  ringPicked: { borderColor: '#22c55e', borderWidth: 5 },
  ring: { position: 'absolute', top: 5, left: 5, right: 5, bottom: 5, borderWidth: 3, borderColor: '#fbbf24' },
  mini: { backgroundColor: CREAM, borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  vals: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, justifyContent: 'center', minHeight: 18 },
  badge: { backgroundColor: '#f59e0b', color: '#111827', fontWeight: '800', fontSize: 11, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 9, overflow: 'hidden' },
  caption: { color: '#e2e8f0', fontSize: 12, textAlign: 'center' },
});
