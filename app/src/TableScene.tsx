import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { CardView } from './CardView';
import type { GameState } from './engine';
import { SYMBOLS } from './symbols';
import { sumsOf } from './sums';
import type { Card } from './types';

/** Dernier coup joué : la carte vient se poser sur celle qu'elle recouvre. */
export type LastPlay = { key: number; seat: number; card: Card; covered: Card; pile: number; gained: number };

/** Fait glisser son contenu depuis `from` (décalage en px) jusqu'à sa place. */
function Flying({ from, children }: { from: { x: number; y: number }; children: React.ReactNode }) {
  const v = useRef(new Animated.ValueXY(from)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: { x: 0, y: 0 }, duration: 700, useNativeDriver: false }).start();
  }, []);
  return <Animated.View style={{ transform: v.getTranslateTransform(), zIndex: 5 }}>{children}</Animated.View>;
}

/** Barre qui se vide pendant la durée d'affichage. */
function Countdown({ ms }: { ms: number }) {
  const w = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(w, { toValue: 0, duration: ms, useNativeDriver: false }).start();
  }, []);
  return (
    <View style={s.countTrack}>
      <Animated.View style={[s.countBar, { width: w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
    </View>
  );
}

/** Petit logo Σ : les sommes de chaque famille sur les 4 tas, et la somme totale. */
function SumBadge({ cards, grid }: { cards: Card[]; grid?: boolean }) {
  const { per, total } = sumsOf(cards);
  // Repliable : on touche le Σ pour déplier / replier (choix retenu sur l'appareil).
  const [open, setOpen] = useState(() => { try { return localStorage.getItem('50m-sum-open') !== '0'; } catch { return true; } });
  const toggle = () => { const v = !open; setOpen(v); try { localStorage.setItem('50m-sum-open', v ? '1' : '0'); } catch { /* sans stockage */ } };
  if (!open) {
    return (
      <Pressable onPress={toggle} style={[s.sum, s.sumClosed]} accessibilityLabel={`Sommes repliées, total ${total}. Toucher pour déplier`}>
        <Text style={s.sumTitle}>Σ {total}</Text>
        <Text style={s.sumChevron}>▾</Text>
      </Pressable>
    );
  }
  return (
    <View style={s.sum} accessibilityLabel={`Sommes : ${SYMBOLS.map((sy, i) => `${sy.name} ${per[i]}`).join(', ')}, total ${total}`}>
      <Pressable onPress={toggle} accessibilityLabel="Replier les sommes" style={s.sumHead}>
        <Text style={s.sumTitle}>Σ</Text>
        <Text style={s.sumChevron}>▴</Text>
      </Pressable>
      <View style={grid ? s.sumGrid : undefined}>
        {SYMBOLS.map((sy, i) => (
          <View key={sy.name} style={[s.sumRow, { opacity: per[i] ? 1 : 0.45 }]}>
            <View style={[s.sumDot, { borderColor: sy.color }]}><Text style={s.sumEmoji}>{sy.emoji}</Text></View>
            <Text style={s.sumVal}>{per[i]}</Text>
          </View>
        ))}
      </View>
      <Text style={s.sumTotal}>={total}</Text>
    </View>
  );
}

/** `glowColor` : couleur de la famille de la carte choisie, quand on peut la jouer sur ce tas. */
export type PileView = { card: Card; dim: boolean; glowColor?: string; tags: { text: string; stop?: boolean }[] };

export function Back({ w }: { w: number }) {
  return (
    <View style={[s.back, { width: w, height: w * 1.4, borderRadius: w * 0.16 }]}>
      <View style={[s.backInner, { borderRadius: w * 0.1 }]} />
    </View>
  );
}

/** Main d'un autre joueur : dos de cartes (ou faces en mode test), chevauchés. */
function Hand({ cards, vertical, reveal }: { cards: Card[]; vertical?: boolean; reveal?: boolean }) {
  const w = reveal ? 30 : 22;
  return (
    <View style={{ flexDirection: vertical ? 'column' : 'row', alignItems: 'center' }}>
      {cards.map((c, i) => (
        <View key={c.id} style={vertical ? { marginTop: i ? -w * (reveal ? 0.9 : 0.85) : 0 } : { marginLeft: i ? -w * (reveal ? 0.15 : 0.5) : 0 }}>
          {reveal ? <CardView card={c} w={w} /> : <Back w={w} />}
        </View>
      ))}
    </View>
  );
}

function Seat({ game, i, name, avatar, vertical, reveal }: { game: GameState; i: number; name: string; avatar: string; vertical?: boolean; reveal?: boolean }) {
  const current = i === game.current;
  const next = i === (game.current + 1) % game.players;
  const info = (
    <View style={{ alignItems: vertical ? 'center' : 'flex-start' }}>
      <Text style={[s.name, current && s.nameOn]}>{name}{current ? ' ▶' : next ? ' ›' : ''}</Text>
      <Hand cards={game.hands[i]} vertical={vertical} reveal={reveal} />
    </View>
  );
  return (
    <View style={[s.seat, vertical ? { flexDirection: 'column', width: 58 } : { flexDirection: 'row' }]}>
      <View style={[s.avatar, current && s.avatarOn]}>
        <Text style={{ fontSize: 18 }}>{avatar}</Text>
        {game.canDo.some((a) => a.player === i) ? <Text style={s.can}>🙋</Text> : game.passed.includes(i) ? <Text style={s.can}>🚫</Text> : null}
      </View>
      {info}
    </View>
  );
}

type Props = {
  game: GameState; solo: boolean; piles: PileView[]; onPile: (i: number) => void;
  /** Joueur dont la main est affichée en bas (toi en solo, le joueur courant sinon). */
  meIndex: number; hand: Card[]; handShown: boolean; selectedId: number | null;
  onSelect: (id: number) => void; onReveal: () => void; revealAll: boolean; scale: number;
  lastPlay: LastPlay | null; pauseMs: number; onSkip: () => void; who: (i: number) => string;
  /** Nom et avatar de chaque siège (sinon : Toi / J2… selon `solo`). */
  labels?: { name: string; avatar: string }[];
  /** Titre du panneau de ta main (défaut : TON JEU). */
  mineLabel?: string;
};

/**
 * La table vue de dessus, comme une belote en ligne, sur un seul écran : les joueurs autour
 * (dans le sens des aiguilles d'une montre), les 4 tas au centre, ta main en bas.
 */
export function TableScene(p: Props) {
  const { game, solo, piles } = p;
  const { width } = useWindowDimensions();
  const n = game.players;
  const at = (rel: number) => (p.meIndex + rel) % n;
  const topRel = n === 2 ? [1] : n === 3 ? [1, 2] : n === 4 ? [2] : [];
  const leftRel = n === 4 ? [1] : [];
  const rightRel = n === 4 ? [3] : [];
  const inner = width - 32 - 20;
  // À 4 joueurs, le logo Σ se met en haut à droite (les côtés sont pris par les joueurs) ; sinon, à droite des tas.
  const sumSide = n !== 4;
  const pileW = Math.min(64 * p.scale, (inner - (n === 4 ? 2 * 62 : 0) - (sumSide ? 44 : 0) - 3 * 6) / 4);
  const handW = Math.min(66 * p.scale, (inner - 52 - 3 * 6) / 4);
  const label = (i: number) => p.labels?.[i]?.name ?? (solo && i === 0 ? 'Toi' : `J${i + 1}`);
  const avatar = (i: number) => p.labels?.[i]?.avatar ?? (solo ? (i === 0 ? '🙂' : '🤖') : '👤');
  const seat = (rel: number, vertical = false) => {
    const i = at(rel);
    return <Seat key={i} game={game} i={i} name={label(i)} avatar={avatar(i)} vertical={vertical} reveal={p.revealAll} />;
  };
  const me = p.meIndex;
  const meCurrent = me === game.current;
  const lp = p.lastPlay;
  // D'où vient la carte : du siège du joueur, vu depuis la table.
  const fromSeat = (seat: number) => {
    const rel = (seat - me + n) % n;
    if (rel === 0) return { x: 0, y: 190 };
    if (n === 4) return rel === 1 ? { x: -150, y: 0 } : rel === 2 ? { x: 0, y: -150 } : { x: 150, y: 0 };
    return n === 2 ? { x: 0, y: -150 } : { x: rel === 1 ? -70 : 70, y: -150 };
  };
  const cardTxt = (c: Card) => `${c.value}${SYMBOLS[c.symbol].emoji}`;

  return (
    <View style={s.felt}>
      {topRel.length > 0 && <View style={s.topRow}>{topRel.map((r) => seat(r))}</View>}
      {!sumSide && <View style={s.sumCorner}><SumBadge cards={piles.map((pv) => pv.card)} grid /></View>}

      <View style={s.mid}>
        {leftRel.map((r) => seat(r, true))}
        <View style={s.center}>
          {piles.map((pv, i) => (
            <View key={i} style={s.pile}>
              {lp && lp.pile === i ? (
                <View style={{ width: pileW, height: pileW * 1.43 }}>
                  <View style={{ position: 'absolute', left: -pileW * 0.16, top: pileW * 0.08, opacity: 0.85 }}>
                    <CardView card={lp.covered} w={pileW} />
                  </View>
                  <Flying key={lp.key} from={fromSeat(lp.seat)}>
                    <CardView card={pv.card} w={pileW} glow onPress={() => p.onPile(i)} />
                  </Flying>
                </View>
              ) : (
                <CardView card={pv.card} w={pileW} dim={pv.dim} glow={pv.glowColor} onPress={() => p.onPile(i)} />
              )}
              <Text style={s.pileNo}>{i + 1}</Text>
              <View style={s.tags}>
                {pv.tags.map((t) => <Text key={t.text} style={[s.tag, t.stop && s.tagStop]}>{t.text}</Text>)}
              </View>
            </View>
          ))}
        </View>
        {sumSide && <SumBadge cards={piles.map((pv) => pv.card)} />}
        {rightRel.map((r) => seat(r, true))}
      </View>

      {lp && (
        <Pressable key={lp.key} onPress={p.onSkip} style={s.caption}>
          <Text style={s.captionTxt}>
            {p.who(lp.seat) === 'Toi' ? 'Tu poses' : `${p.who(lp.seat)} pose`} {cardTxt(lp.card)} sur {cardTxt(lp.covered)} · tas {lp.pile + 1}{lp.gained ? ` · 🎯 +${lp.gained}` : ''}
          </Text>
          <Countdown ms={p.pauseMs} />
        </Pressable>
      )}

      <View style={[s.me, s.mine, meCurrent && s.mineOn]}>
        <Text style={[s.mineTag, meCurrent && s.mineTagOn]}>{p.mineLabel ?? 'TON JEU'}{meCurrent ? ' · à toi' : ''}</Text>
        <View style={s.meSeat}>
          <View style={[s.avatar, meCurrent && s.avatarOn]}>
            <Text style={{ fontSize: 18 }}>{avatar(me)}</Text>
            {game.canDo.some((a) => a.player === me) && <Text style={s.can}>🙋</Text>}
          </View>
          <Text style={[s.name, { color: '#422006' }]}>{label(me)}</Text>
          <Text style={[s.sub, { color: '#92400e' }]}>{meCurrent ? '▶ joue' : ' '}</Text>
        </View>
        <View style={s.meHand}>
          {p.handShown ? (
            <View style={s.handRow}>
              {p.hand.map((c) => (
                <CardView key={c.id} card={c} w={handW} selected={c.id === p.selectedId} onPress={() => p.onSelect(c.id)} />
              ))}
            </View>
          ) : (
            <Pressable onPress={p.onReveal} style={s.cover}>
              <Text style={s.coverTxt}>Passe le téléphone au joueur {game.current + 1}{'\n'}Touche pour voir ta main</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  felt: { flex: 1, backgroundColor: '#14532d', borderColor: '#166534', borderWidth: 3, borderRadius: 24, padding: 10, justifyContent: 'space-between' },
  topRow: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'flex-start' },
  mid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  center: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  pile: { alignItems: 'center', gap: 2 },
  pileNo: { color: '#bbf7d0', fontSize: 11, fontWeight: '700' },
  tags: { alignItems: 'center', gap: 2, minHeight: 16, maxWidth: 60 },
  tag: { backgroundColor: '#22c55e', color: '#052e16', fontWeight: '800', fontSize: 10, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 8, overflow: 'hidden' },
  tagStop: { backgroundColor: '#ef4444', color: '#450a0a' },
  seat: { alignItems: 'center', gap: 6 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#052e16', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'transparent' },
  avatarOn: { borderColor: '#f59e0b', backgroundColor: '#78350f' },
  can: { position: 'absolute', top: -12, right: -12, fontSize: 16 },
  name: { color: '#f0fdf4', fontWeight: '800', fontSize: 13 },
  nameOn: { color: '#fbbf24' },
  sub: { color: '#bbf7d0', fontSize: 11, fontWeight: '700' },
  caption: { position: 'absolute', bottom: 112, alignSelf: 'center', backgroundColor: 'rgba(15,23,42,0.92)', borderRadius: 12, paddingVertical: 6, paddingHorizontal: 12, gap: 4, zIndex: 8, borderWidth: 1, borderColor: '#f59e0b' },
  captionTxt: { color: '#fde68a', fontWeight: '800', fontSize: 13, textAlign: 'center' },
  countTrack: { height: 3, backgroundColor: '#334155', borderRadius: 2, overflow: 'hidden' },
  countBar: { height: 3, backgroundColor: '#f59e0b' },
  me: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sum: { backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 10, paddingVertical: 4, paddingHorizontal: 4, alignItems: 'center', gap: 2, marginLeft: 4 },
  sumHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sumClosed: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 6, gap: 4 },
  sumChevron: { color: '#fde68a', fontSize: 11, fontWeight: '900' },
  sumTitle: { color: '#fde68a', fontSize: 14, fontWeight: '900', lineHeight: 15 },
  sumGrid: { flexDirection: 'row', flexWrap: 'wrap', width: 74, justifyContent: 'center', gap: 2 },
  sumRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  sumDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  sumEmoji: { fontSize: 10 },
  sumVal: { color: '#fff', fontSize: 13, fontWeight: '800', minWidth: 14 },
  sumTotal: { color: '#fde68a', fontSize: 13, fontWeight: '900' },
  sumCorner: { position: 'absolute', top: 6, right: 6, zIndex: 3 },
  mine: { backgroundColor: '#fef9c3', borderRadius: 16, borderWidth: 3, borderColor: '#ca8a04', paddingHorizontal: 6, paddingTop: 16, paddingBottom: 6, marginTop: 6 },
  mineOn: { backgroundColor: '#fde68a', borderColor: '#f59e0b' },
  mineTag: { position: 'absolute', top: -2, left: 12, color: '#713f12', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  mineTagOn: { color: '#92400e' },
  meSeat: { width: 46, alignItems: 'center', gap: 1 },
  meHand: { flex: 1, alignItems: 'center', gap: 4 },
  handRow: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  hint: { color: '#fde047', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  cover: { backgroundColor: '#052e16', borderRadius: 12, padding: 14, alignSelf: 'stretch' },
  coverTxt: { color: '#f0fdf4', textAlign: 'center', fontWeight: '700', fontSize: 13 },
  back: { backgroundColor: '#1e3a8a', borderWidth: 1.5, borderColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' },
  backInner: { width: '70%', height: '75%', borderWidth: 1, borderColor: '#93c5fd', backgroundColor: '#1d4ed8' },
});
