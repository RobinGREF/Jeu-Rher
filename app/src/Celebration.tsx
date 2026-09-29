import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { MissionToken } from './MissionToken';
import type { MissionDef } from './missions';

export type Celebrate = {
  key: number;
  /** Missions réussies, avec leur place dans la rangée. */
  done: { def: MissionDef; idx: number }[];
  gained: number;
  medal: string | null;
};

const COLORS = ['#f59e0b', '#22c55e', '#3b82f6', '#ef4444', '#eab308', '#a855f7', '#ec4899'];
const CONFETTI_AT = 700; // après l'arrivée de la carte sur le tas
const FLY_AT = 1500;
const TOTAL = 3700;

function Confetti({ width, height }: { width: number; height: number }) {
  const parts = useMemo(
    () => Array.from({ length: 46 }, (_, i) => ({
      x: Math.random() * width,
      drift: (Math.random() - 0.5) * 140,
      size: 6 + Math.random() * 6,
      color: COLORS[i % COLORS.length],
      delay: Math.random() * 500,
      dur: 1800 + Math.random() * 900,
      spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 540),
      round: i % 3 === 0,
    })),
    [width],
  );
  const t = useRef(parts.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.parallel(
      parts.map((p, i) => Animated.timing(t[i], { toValue: 1, duration: p.dur, delay: CONFETTI_AT + p.delay, easing: Easing.out(Easing.quad), useNativeDriver: false })),
    ).start();
  }, []);
  return (
    <>
      {parts.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute', left: p.x, top: 0, width: p.size, height: p.round ? p.size : p.size * 1.6,
            borderRadius: p.round ? p.size / 2 : 2, backgroundColor: p.color,
            opacity: t[i].interpolate({ inputRange: [0, 0.01, 0.8, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateY: t[i].interpolate({ inputRange: [0, 1], outputRange: [-20, height * 0.85] }) },
              { translateX: t[i].interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
              { rotate: t[i].interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
            ],
          }}
        />
      ))}
    </>
  );
}

/** Jeton de mission qui brille, puis s'envole vers le compteur de missions réussies. */
function FlyingToken({ def, x, y, tx, ty, size }: { def: MissionDef; x: number; y: number; tx: number; ty: number; size: number }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const fly = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 350, delay: CONFETTI_AT, useNativeDriver: false }),
      Animated.timing(pulse, { toValue: 0, duration: 350, useNativeDriver: false }),
      Animated.timing(fly, { toValue: 1, duration: 900, delay: FLY_AT - CONFETTI_AT - 700, easing: Easing.in(Easing.cubic), useNativeDriver: false }),
    ]).start();
  }, []);
  const scale = Animated.multiply(
    pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] }),
    fly.interpolate({ inputRange: [0, 1], outputRange: [1, 0.2] }),
  );
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', left: x - size / 2, top: y - size / 2,
        opacity: fly.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
        transform: [
          { translateX: fly.interpolate({ inputRange: [0, 1], outputRange: [0, tx - x] }) },
          { translateY: fly.interpolate({ inputRange: [0, 1], outputRange: [0, ty - y] }) },
          { scale },
        ],
      }}
    >
      <View style={s.glow}><MissionToken def={def} size={size} showText={false} onPress={() => {}} /></View>
    </Animated.View>
  );
}

/** « +N » qui jaillit du compteur quand le jeton arrive. */
function Plus({ n, x, y }: { n: number; x: number; y: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 1300, delay: FLY_AT + 800, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, []);
  return (
    <Animated.Text
      style={[s.plus, {
        left: x - 24, top: y,
        opacity: v.interpolate({ inputRange: [0, 0.05, 0.7, 1], outputRange: [0, 1, 1, 0] }),
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, 34] }) }, { scale: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.6, 1.4, 1] }) }],
      }]}
    >
      +{n}
    </Animated.Text>
  );
}

function Banner({ text, y }: { text: string; y: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 300, delay: CONFETTI_AT, easing: Easing.out(Easing.back(2)), useNativeDriver: false }),
      Animated.timing(v, { toValue: 0, duration: 400, delay: 1500, useNativeDriver: false }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[s.banner, { top: y, opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}>
      <Text style={s.bannerTxt}>{text}</Text>
    </Animated.View>
  );
}

/**
 * Fête d'une mission réussie : confettis, bandeau, puis le jeton de la mission s'envole
 * vers le compteur de missions réussies avec « +N ».
 */
export function Celebration({ c, width, height, tokenSize, rowY, target }: {
  c: Celebrate; width: number; height: number; tokenSize: number; rowY: number; target: { x: number; y: number };
}) {
  const gap = 6;
  const text = c.medal ? `🏅 Médaille ${c.medal} !` : c.gained > 1 ? `🎉 ${c.gained} missions réussies !` : '🎉 Mission réussie !';
  return (
    <View pointerEvents="none" style={s.layer}>
      <Confetti key={`c${c.key}`} width={width} height={height} />
      {c.done.map(({ def, idx }) => (
        <FlyingToken key={`${c.key}-${def.id}`} def={def} size={tokenSize} tx={target.x} ty={target.y}
          x={16 + idx * (tokenSize + gap) + tokenSize / 2} y={rowY + tokenSize / 2} />
      ))}
      <Banner key={`b${c.key}`} text={text} y={rowY + tokenSize + 34} />
      <Plus key={`p${c.key}`} n={c.gained} x={target.x} y={target.y + 6} />
    </View>
  );
}

export const CELEBRATION_MS = TOTAL;

const s = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, overflow: 'hidden' },
  glow: { borderRadius: 999, shadowColor: '#fde047', shadowOpacity: 1, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 12 },
  plus: { position: 'absolute', width: 48, textAlign: 'center', color: '#fde047', fontSize: 22, fontWeight: '900', textShadowColor: '#000', textShadowRadius: 4 },
  banner: { position: 'absolute', alignSelf: 'center', backgroundColor: '#f59e0b', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 20, borderWidth: 3, borderColor: '#fef3c7' },
  bannerTxt: { color: '#111827', fontSize: 20, fontWeight: '900' },
});
