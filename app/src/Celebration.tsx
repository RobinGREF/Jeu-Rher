import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
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
/** Chaque mission réussie est fêtée en plein écran, l'une après l'autre ; on avance au toucher (rien ne défile tout seul). */
const SPOT_START = 600;

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

/** Un écran par mission (puis un pour la médaille) ; chaque écran attend un toucher. */
function Spotlight({ defs, medal, width, height, onDone }: { defs: MissionDef[]; medal: string | null; width: number; height: number; onDone: () => void }) {
  const slides = defs.length + (medal ? 1 : 0);
  const [i, setI] = useState(-1);
  useEffect(() => {
    if (i === -1) { const id = setTimeout(() => setI(0), SPOT_START); return () => clearTimeout(id); }
    if (i >= slides) onDone();
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    pop.setValue(0);
    if (i >= 0) Animated.spring(pop, { toValue: 1, friction: 5, tension: 70, useNativeDriver: false }).start();
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  if (i < 0 || i >= slides) return null;
  const size = Math.min(width - 56, height * 0.4, 340);
  const isMedal = i >= defs.length;
  return (
    <Pressable onPress={() => setI(i + 1)} style={s.spot} accessibilityLabel="Mission réussie, toucher pour continuer">
      <Confetti key={`sc${i}`} width={width} height={height} />
      <Text style={s.spotTitle}>{isMedal ? `🏅 Médaille ${medal} !` : '🎉 Mission réussie !'}</Text>
      {defs.length > 1 && !isMedal && <Text style={s.spotCount}>{i + 1} sur {defs.length}</Text>}
      <Animated.View style={{ transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }], opacity: pop }}>
        {isMedal
          ? <Text style={{ fontSize: size * 0.7 }}>{medal === "d'or" ? '🥇' : medal === "d'argent" ? '🥈' : '🥉'}</Text>
          : <View style={s.glow} pointerEvents="none"><MissionToken def={defs[i]} size={size} showText={false} onPress={() => {}} /></View>}
      </Animated.View>
      {!isMedal && <Text style={s.spotLabel}>{defs[i].label}</Text>}
      <Text style={s.spotHint}>👆 Touche pour continuer</Text>
    </Pressable>
  );
}

/**
 * Fête d'une mission réussie : confettis, bandeau, puis le jeton de la mission s'envole
 * vers le compteur de missions réussies avec « +N ».
 */
export function Celebration({ c, width, height, tokenSize, rowY, target, onEnd }: {
  c: Celebrate; width: number; height: number; tokenSize: number; rowY: number; target: { x: number; y: number }; onEnd: () => void;
}) {
  const gap = 6;
  const [spotDone, setSpotDone] = useState(false); // d'abord chaque mission en plein écran, au toucher
  // Après le plein écran : le vol des jetons vers le compteur, puis la fête se termine.
  useEffect(() => {
    if (!spotDone) return;
    const id = setTimeout(onEnd, TOTAL);
    return () => clearTimeout(id);
  }, [spotDone]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!spotDone) {
    return (
      <View style={s.layer}>
        <Spotlight defs={c.done.map((d) => d.def)} medal={c.medal} width={width} height={height} onDone={() => setSpotDone(true)} />
      </View>
    );
  }
  return (
    <View pointerEvents="none" style={s.layer}>
      <Confetti key={`c${c.key}`} width={width} height={height} />
      {c.done.map(({ def, idx }) => (
        <FlyingToken key={`${c.key}-${def.id}`} def={def} size={tokenSize} tx={target.x} ty={target.y}
          x={16 + idx * (tokenSize + gap) + tokenSize / 2} y={rowY + tokenSize / 2} />
      ))}
      <Plus key={`p${c.key}`} n={c.gained} x={target.x} y={target.y + 6} />
    </View>
  );
}


const s = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, overflow: 'hidden' },
  spot: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(2,6,23,0.9)', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 20 },
  spotTitle: { color: '#fde047', fontSize: 30, fontWeight: '900', textAlign: 'center' },
  spotCount: { color: '#e2e8f0', fontSize: 18, fontWeight: '800' },
  spotHint: { color: '#fde68a', fontSize: 16, fontWeight: '800', marginTop: 6 },
  spotLabel: { color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center', paddingHorizontal: 8 },
  glow: { borderRadius: 999, shadowColor: '#fde047', shadowOpacity: 1, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 12 },
  plus: { position: 'absolute', width: 48, textAlign: 'center', color: '#fde047', fontSize: 22, fontWeight: '900', textShadowColor: '#000', textShadowRadius: 4 },
});
