import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { CardView } from './CardView';
import type { GameState } from './engine';
import type { Card } from './types';

export type PileView = { card: Card; dim: boolean; glow: boolean; tags: { text: string; stop?: boolean }[] };

/** Dos de carte. */
function Back({ w }: { w: number }) {
  return (
    <View style={[s.back, { width: w, height: w * 1.4, borderRadius: w * 0.16 }]}>
      <View style={[s.backInner, { borderRadius: w * 0.1 }]} />
    </View>
  );
}

/** Main masquée : autant de dos que de cartes, chevauchés. */
function Hidden({ n, vertical }: { n: number; vertical?: boolean }) {
  const w = 24;
  return (
    <View style={{ flexDirection: vertical ? 'column' : 'row', alignItems: 'center' }}>
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={vertical ? { marginTop: i ? -w * 0.85 : 0 } : { marginLeft: i ? -w * 0.55 : 0 }}>
          <Back w={w} />
        </View>
      ))}
    </View>
  );
}

function Seat({ game, i, name, avatar, vertical }: { game: GameState; i: number; name: string; avatar: string; vertical?: boolean }) {
  const current = i === game.current;
  const next = i === (game.current + 1) % game.players;
  return (
    <View style={s.seat}>
      <View style={[s.avatar, current && s.avatarOn]}>
        <Text style={{ fontSize: 22 }}>{avatar}</Text>
        {game.canDo.includes(i) && <Text style={s.can}>🙋</Text>}
      </View>
      <Text style={[s.name, current && s.nameOn]}>{name}</Text>
      <Text style={s.sub}>{current ? '▶ joue' : next ? 'suivant' : ' '}</Text>
      {i !== 0 && <Hidden n={game.hands[i].length} vertical={vertical} />}
    </View>
  );
}

/**
 * La table vue de dessus, comme une belote en ligne : les joueurs autour, leurs cartes
 * masquées, le tapis au centre. Le siège 0 est en bas ; on tourne dans le sens des aiguilles d'une montre.
 */
export function TableScene({ game, solo, piles, onPile }: { game: GameState; solo: boolean; piles: PileView[]; onPile: (i: number) => void }) {
  const { width } = useWindowDimensions();
  const n = game.players;
  const top = n === 2 ? [1] : n === 3 ? [1, 2] : n === 4 ? [2] : [];
  const left = n === 4 ? [1] : [];
  const right = n === 4 ? [3] : [];
  const sides = n === 4 ? 2 * 74 : 0;
  const pileW = Math.min(70, (width - 32 - 24 - sides - 3 * 6) / 4);
  const label = (i: number) => (solo && i === 0 ? 'Toi' : `J${i + 1}`);
  const avatar = (i: number) => (solo ? (i === 0 ? '🙂' : '🤖') : '👤');
  const seat = (i: number, vertical = false) => <Seat key={i} game={game} i={i} name={label(i)} avatar={avatar(i)} vertical={vertical} />;

  return (
    <View style={s.felt}>
      <Text style={s.title}>Table à {n} joueur{n > 1 ? 's' : ''} · sens des aiguilles d'une montre ↻</Text>
      {top.length > 0 && <View style={s.topRow}>{top.map((i) => seat(i))}</View>}
      <View style={s.mid}>
        {left.map((i) => seat(i, true))}
        <View style={s.center}>
          {piles.map((p, i) => (
            <View key={i} style={s.pile}>
              <CardView card={p.card} w={pileW} dim={p.dim} glow={p.glow} onPress={() => onPile(i)} />
              <Text style={s.pileNo}>tas {i + 1}</Text>
              <View style={s.tags}>
                {p.tags.map((t) => <Text key={t.text} style={[s.tag, t.stop && s.tagStop]}>{t.text}</Text>)}
              </View>
            </View>
          ))}
        </View>
        {right.map((i) => seat(i, true))}
      </View>
      <View style={s.bottom}>{seat(0)}</View>
    </View>
  );
}

const s = StyleSheet.create({
  felt: { backgroundColor: '#14532d', borderColor: '#166534', borderWidth: 3, borderRadius: 24, padding: 12, gap: 10 },
  title: { color: '#bbf7d0', fontSize: 12, textAlign: 'center' },
  topRow: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'flex-start' },
  mid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  center: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  pile: { alignItems: 'center', gap: 3 },
  pileNo: { color: '#bbf7d0', fontSize: 11 },
  tags: { alignItems: 'center', gap: 2, minHeight: 18, maxWidth: 64 },
  tag: { backgroundColor: '#22c55e', color: '#052e16', fontWeight: '800', fontSize: 11, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, overflow: 'hidden' },
  tagStop: { backgroundColor: '#ef4444', color: '#450a0a' },
  bottom: { alignItems: 'center' },
  seat: { alignItems: 'center', gap: 2, width: 74 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#052e16', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'transparent' },
  avatarOn: { borderColor: '#f59e0b', backgroundColor: '#78350f' },
  can: { position: 'absolute', top: -12, right: -10, fontSize: 18 },
  name: { color: '#f0fdf4', fontWeight: '800', fontSize: 14 },
  nameOn: { color: '#fbbf24' },
  sub: { color: '#bbf7d0', fontSize: 11, fontWeight: '700' },
  back: { backgroundColor: '#1e3a8a', borderWidth: 1.5, borderColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' },
  backInner: { width: '70%', height: '75%', borderWidth: 1, borderColor: '#93c5fd', backgroundColor: '#1d4ed8' },
});
