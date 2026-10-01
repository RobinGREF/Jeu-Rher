import { Pressable, SafeAreaView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Back } from './TableScene';
import { CardView } from './CardView';
import { MissionToken } from './MissionToken';
import { missionById } from './online/wire';
import type { Snapshot } from './online/session';
import { nextMedal } from './engine';
import { SYMBOLS } from './symbols';
import type { Card } from './types';

const MEDAL = { bronze: '🥉 Bronze', argent: '🥈 Argent', or: '🥇 Or' } as const;
const txt = (c: Card) => `${c.value}${SYMBOLS[c.symbol].emoji}`;

/**
 * Mode télé : suivre la table à plusieurs, sans jouer. Missions en grand (avec leur texte), les 4 tas, les joueurs
 * avec leur prénom, qui joue, qui se positionne sur quelle mission, et le dernier coup. Aucune main n'est visible
 * avant la fin de la partie.
 */
export function TvScreen({ snap, onQuit }: { snap: Snapshot; onQuit: () => void }) {
  const { width, height } = useWindowDimensions();
  const u = Math.max(0.5, Math.min(2.2, Math.min(width / 1280, height / 720)));
  const g = snap.view;
  const pub = snap.pub;
  const names = pub?.seats.map((x) => x.name) ?? [];

  if (!g || !pub) {
    return (
      <SafeAreaView style={s.root}>
        <StatusBar style="light" />
        <Pressable onPress={onQuit} style={s.quit}><Text style={s.quitTxt}>✕ Quitter</Text></Pressable>
        <View style={s.center}>
          <Text style={[s.big, { fontSize: 54 * u }]}>📺 50 Missions</Text>
          <Text style={[s.mid, { fontSize: 30 * u }]}>Salon {snap.code}</Text>
          <Text style={[s.mid, { fontSize: 26 * u }]}>{snap.phase === 'error' ? snap.error : 'En attente du début de la partie…'}</Text>
          {snap.players.length > 0 && <Text style={[s.dim, { fontSize: 24 * u }]}>À la table : {snap.players.map((p) => p.name).join(' · ')}</Text>}
        </View>
      </SafeAreaView>
    );
  }

  const token = Math.min(150 * u, (width - 40) / 4.6);
  const cardW = Math.min(112 * u, (width - 60) / 5);
  const nm = nextMedal(g);
  const last = pub.last;
  const who = (i: number) => names[i] ?? `Joueur ${i + 1}`;
  const over = g.over;
  const stuck = g.current;

  return (
    <SafeAreaView style={s.root}>
      <StatusBar style="light" />
      <View style={s.head}>
        <Text style={[s.title, { fontSize: 34 * u }]}>50 Missions</Text>
        <Text style={[s.chip, { fontSize: 22 * u }]}>Salon {snap.code}</Text>
        <Text style={[s.stat, { fontSize: 30 * u }]}>🎯 {g.completed}/50 {g.medal ? MEDAL[g.medal] : ''}{nm ? ` · prochaine médaille dans ${nm.missionsNeeded}` : ''} · 📚 {g.symbolDeck.length}</Text>
        <Pressable onPress={onQuit} style={s.quit}><Text style={s.quitTxt}>✕</Text></Pressable>
      </View>

      <View style={s.row}>
        {g.missions.map((m) => {
          const who2 = g.canDo.filter((a) => a.missions.includes(m.id)).map((a) => `🙋 ${who(a.player)}`);
          return (
            <View key={m.id} style={{ width: token * 1.35, alignItems: 'center', gap: 6 * u }}>
              <MissionToken def={m} size={token} showText={false} badges={who2} mark={who2.length ? 'announced' : undefined} onPress={() => {}} />
              <Text style={[s.label, { fontSize: 15 * u }]} numberOfLines={4}>{m.label}</Text>
            </View>
          );
        })}
      </View>

      <View style={[s.row, { marginVertical: 8 * u }]}>
        {g.piles.map((p, i) => (
          <View key={i} style={{ alignItems: 'center', gap: 4 }}>
            <CardView card={p[p.length - 1]} w={cardW} glow={!!last && last.pile === i} />
            <Text style={[s.dim, { fontSize: 18 * u }]}>Tas {i + 1}</Text>
          </View>
        ))}
      </View>

      <View style={[s.row, { alignItems: 'flex-start' }]}>
        {g.hands.map((h, i) => {
          const now = i === g.current && !over;
          const status = g.canDo.some((a) => a.player === i) ? '🙋' : g.passed.includes(i) ? '🚫' : '';
          return (
            <View key={i} style={[s.player, now && s.playerOn, { minWidth: 150 * u }]}>
              <Text style={{ fontSize: 34 * u }}>{pub.seats[i]?.bot ? '🤖' : '👤'} {status}</Text>
              <Text style={[s.pname, now && s.pnameOn, { fontSize: 26 * u }]} numberOfLines={1}>{now ? '▶ ' : ''}{who(i)}</Text>
              <View style={{ flexDirection: 'row', marginTop: 4 }}>
                {h.map((c, k) => (
                  <View key={c.id} style={{ marginLeft: k ? -cardW * 0.18 : 0 }}>
                    {over ? <CardView card={c} w={cardW * 0.5} /> : <Back w={cardW * 0.36} />}
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </View>

      <View style={s.foot}>
        {over ? (
          <>
            <Text style={[s.over, { fontSize: 34 * u }]}>{g.completed >= 50 ? '🎉 50 missions réussies !' : `🛑 Fin de partie : ${g.completed}/50`}</Text>
            {g.completed < 50 && (
              <Text style={[s.mid, { fontSize: 24 * u }]}>{who(stuck)} {g.hands[stuck].length ? `ne peut plus jouer : ${g.hands[stuck].map(txt).join(' ')} ne vont sur aucun tas (${g.piles.map((p) => txt(p[p.length - 1])).join(' ')})` : "n'a plus de cartes en main"}.</Text>
            )}
          </>
        ) : (
          <>
            {last && last.gained > 0 && (
              <Text style={[s.win, { fontSize: 26 * u }]}>🎉 {last.gained > 1 ? `${last.gained} missions réussies` : 'Mission réussie'} : {last.done.map((d) => missionById(d.id).label).join(' · ') || ''}</Text>
            )}
            <Text style={[s.mid, { fontSize: 26 * u }]}>
              {last ? `${who(last.seat)} pose ${txt(last.card)} sur ${txt(last.covered)} · tas ${last.pile + 1}` : 'La partie commence'}
              {`   —   ${who(g.current)} joue`}
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b1220', paddingLeft: 20, paddingRight: 20, paddingTop: 10, paddingBottom: 10, justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  title: { color: '#fff', fontWeight: '900' },
  chip: { color: '#fde68a', fontWeight: '800', backgroundColor: '#78350f', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  stat: { color: '#f8fafc', fontWeight: '800', flex: 1, textAlign: 'right' },
  quit: { padding: 8 },
  quitTxt: { color: '#94a3b8', fontSize: 18, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'flex-start' },
  label: { color: '#e2e8f0', textAlign: 'center', fontWeight: '600' },
  player: { alignItems: 'center', padding: 10, borderRadius: 16, borderWidth: 3, borderColor: 'transparent', backgroundColor: '#111c33' },
  playerOn: { borderColor: '#f59e0b', backgroundColor: '#3b2a0d' },
  pname: { color: '#e2e8f0', fontWeight: '800' },
  pnameOn: { color: '#fbbf24' },
  foot: { alignItems: 'center', gap: 6, minHeight: 80, justifyContent: 'center' },
  mid: { color: '#e2e8f0', fontWeight: '700', textAlign: 'center' },
  dim: { color: '#94a3b8', fontWeight: '700', textAlign: 'center' },
  big: { color: '#fff', fontWeight: '900' },
  over: { color: '#fca5a5', fontWeight: '900' },
  win: { color: '#fde047', fontWeight: '900', textAlign: 'center' },
});
