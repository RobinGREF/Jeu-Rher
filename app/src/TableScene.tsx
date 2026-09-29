import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { CardView } from './CardView';
import type { GameState } from './engine';
import type { Card } from './types';

export type PileView = { card: Card; dim: boolean; glow: boolean; tags: { text: string; stop?: boolean }[] };

function Back({ w }: { w: number }) {
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
        {game.canDo.includes(i) && <Text style={s.can}>🙋</Text>}
      </View>
      {info}
    </View>
  );
}

type Props = {
  game: GameState; solo: boolean; piles: PileView[]; onPile: (i: number) => void;
  /** Joueur dont la main est affichée en bas (toi en solo, le joueur courant sinon). */
  meIndex: number; hand: Card[]; handShown: boolean; selectedId: number | null; hintCards: Set<number>; hintLine: string | null;
  onSelect: (id: number) => void; onReveal: () => void; revealAll: boolean; scale: number;
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
  const pileW = Math.min(64 * p.scale, (inner - (n === 4 ? 2 * 62 : 0) - 3 * 6) / 4);
  const handW = Math.min(66 * p.scale, (inner - 52 - 3 * 6) / 4);
  const label = (i: number) => (solo && i === 0 ? 'Toi' : `J${i + 1}`);
  const avatar = (i: number) => (solo ? (i === 0 ? '🙂' : '🤖') : '👤');
  const seat = (rel: number, vertical = false) => {
    const i = at(rel);
    return <Seat key={i} game={game} i={i} name={label(i)} avatar={avatar(i)} vertical={vertical} reveal={p.revealAll} />;
  };
  const me = p.meIndex;
  const meCurrent = me === game.current;

  return (
    <View style={s.felt}>
      {topRel.length > 0 && <View style={s.topRow}>{topRel.map((r) => seat(r))}</View>}

      <View style={s.mid}>
        {leftRel.map((r) => seat(r, true))}
        <View style={s.center}>
          {piles.map((pv, i) => (
            <View key={i} style={s.pile}>
              <CardView card={pv.card} w={pileW} dim={pv.dim} glow={pv.glow} onPress={() => p.onPile(i)} />
              <Text style={s.pileNo}>{i + 1}</Text>
              <View style={s.tags}>
                {pv.tags.map((t) => <Text key={t.text} style={[s.tag, t.stop && s.tagStop]}>{t.text}</Text>)}
              </View>
            </View>
          ))}
        </View>
        {rightRel.map((r) => seat(r, true))}
      </View>

      <View style={s.me}>
        <View style={s.meSeat}>
          <View style={[s.avatar, meCurrent && s.avatarOn]}>
            <Text style={{ fontSize: 18 }}>{avatar(me)}</Text>
            {game.canDo.includes(me) && <Text style={s.can}>🙋</Text>}
          </View>
          <Text style={[s.name, meCurrent && s.nameOn]}>{label(me)}</Text>
          <Text style={s.sub}>{meCurrent ? '▶ joue' : ' '}</Text>
        </View>
        <View style={s.meHand}>
          {p.hintLine && <Text style={s.hint}>{p.hintLine}</Text>}
          {p.handShown ? (
            <View style={s.handRow}>
              {p.hand.map((c) => (
                <CardView key={c.id} card={c} w={handW} glow={p.hintCards.has(c.id)} selected={c.id === p.selectedId} onPress={() => p.onSelect(c.id)} />
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
  me: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meSeat: { width: 46, alignItems: 'center', gap: 1 },
  meHand: { flex: 1, alignItems: 'center', gap: 4 },
  handRow: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  hint: { color: '#fde047', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  cover: { backgroundColor: '#052e16', borderRadius: 12, padding: 14, alignSelf: 'stretch' },
  coverTxt: { color: '#f0fdf4', textAlign: 'center', fontWeight: '700', fontSize: 13 },
  back: { backgroundColor: '#1e3a8a', borderWidth: 1.5, borderColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' },
  backInner: { width: '70%', height: '75%', borderWidth: 1, borderColor: '#93c5fd', backgroundColor: '#1d4ed8' },
});
