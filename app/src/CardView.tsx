import { Pressable, StyleSheet, Text } from 'react-native';
import { SYMBOLS } from './symbols';
import type { Card } from './types';

/**
 * Carte Symbole, face visible. `w` règle la taille (70 par défaut).
 * Les surbrillances suivent la couleur de la famille : `glow` = la carte brille de sa propre couleur ;
 * `glow` = une couleur : le tas brille de la couleur de la carte qu'on peut y poser ; une carte choisie brille de sa couleur.
 */
export function CardView({ card, w = 70, selected, dim, glow, onPress }: { card: Card; w?: number; selected?: boolean; dim?: boolean; glow?: boolean | string; onPress?: () => void }) {
  const sym = SYMBOLS[card.symbol];
  const halo = glow ? (typeof glow === 'string' ? glow : sym.color) : selected ? sym.color : undefined;
  return (
    <Pressable
      onPress={onPress}
      style={[s.card, { width: w, height: w * 1.43, borderRadius: w * 0.14, borderColor: sym.color }, selected && s.sel, !!halo && { ...s.halo, shadowColor: halo }, dim && { opacity: 0.35 }]}
    >
      <Text style={{ color: sym.color, fontSize: w * 0.46, fontWeight: '800' }}>{card.value}</Text>
      <Text style={{ color: sym.color, fontSize: w * 0.37 }}>{sym.emoji}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 3, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  sel: { transform: [{ translateY: -10 }], borderWidth: 5 },
  halo: { shadowOpacity: 1, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 10 },
});
