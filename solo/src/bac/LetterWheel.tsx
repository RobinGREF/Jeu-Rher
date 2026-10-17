import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import { sectorPath } from '../duel/wheelPath';
import { LETTERS } from './engine';

/** Une couleur franche par part, en faisant le tour du cercle des teintes. */
const hue = (i: number) => `hsl(${Math.round((i * 360) / LETTERS.length)}, 80%, 52%)`;

/**
 * Roue des lettres : elle tourne plusieurs tours puis s'arrête avec la lettre tirée sous la flèche (en haut).
 * Le tirage est déjà fait (par l'hôte) : la roue ne fait que l'annoncer.
 */
export function LetterWheel({ letter, ms, size = 280 }: { letter: string; ms: number; size?: number }) {
  const spin = useRef(new Animated.Value(0)).current;
  const n = LETTERS.length;
  const step = 360 / n;
  const idx = Math.max(0, LETTERS.indexOf(letter));
  // Le centre de la part doit finir sous la flèche, avec un petit décalage pour que l'arrêt ait l'air naturel.
  const target = useRef(360 * 5 - ((idx + 0.5) * step + (Math.random() - 0.5) * step * 0.5)).current;

  useEffect(() => {
    if (ms <= 0) { spin.setValue(1); return; }
    Animated.timing(spin, { toValue: 1, duration: ms, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cx = size / 2, ro = size / 2 - 6, ri = ro * 0.22;
  const rot = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${target}deg`] });
  return (
    <View style={{ width: size, height: size + 26, alignItems: 'center' }} accessibilityLabel="Roue des lettres">
      <Text style={st.pointer}>▼</Text>
      <Animated.View style={{ width: size, height: size, transform: [{ rotate: rot }] }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {LETTERS.map((l, i) => (
            <Path key={l} d={sectorPath(cx, cx, ri, ro, i * step, (i + 1) * step)} fill={hue(i)} stroke="#0f172a" strokeWidth={2} />
          ))}
          {LETTERS.map((l, i) => {
            const a = (((i + 0.5) * step - 90) * Math.PI) / 180, r = ro * 0.72;
            const x = cx + r * Math.cos(a), y = cx + r * Math.sin(a);
            return (
              <G key={`t${l}`} rotation={(i + 0.5) * step} originX={x} originY={y}>
                <SvgText x={x} y={y + size * 0.045} fontSize={size * 0.12} fontWeight="900" fill="#fff" stroke="#0f172a" strokeWidth={1.2} textAnchor="middle">{l}</SvgText>
              </G>
            );
          })}
          <Circle cx={cx} cy={cx} r={ri} fill="#0f172a" stroke="#fde68a" strokeWidth={3} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  pointer: { color: '#fde68a', fontSize: 26, lineHeight: 26, fontWeight: '900', zIndex: 2, marginBottom: -4 },
});
