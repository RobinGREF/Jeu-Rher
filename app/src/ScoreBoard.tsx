import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { ScoreEntry } from './scores';

const MEDAL = { bronze: '🥉', argent: '🥈', or: '🥇' } as const;
const MODE = { solo: '🤖 Avec des machines', together: '📱 Un téléphone', online: '🌐 En ligne' } as const;
const RANK = ['🥇', '🥈', '🥉'];

/** Tableau partagé entre les joueurs en ligne : chargement, erreur éventuelle, liste. */
export type SharedScores = { status: 'off' | 'loading' | 'ready' | 'error'; list: ScoreEntry[]; error?: string };

const dateFr = (at: number) => {
  try { return new Date(at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); } catch { return ''; }
};

function Rows({ list, highlightIds }: { list: ScoreEntry[]; highlightIds: string[] }) {
  return (
    <>
      {list.slice(0, 20).map((e, i) => (
        <View key={e.id} style={[s.row, highlightIds.includes(e.id) && s.rowNew]}>
          <Text style={s.rank}>{RANK[i] ?? `${i + 1}.`}</Text>
          <View style={s.body}>
            <Text style={s.score}>{e.completed}<Text style={s.of}>/50</Text> {e.medal ? MEDAL[e.medal] : ''}</Text>
            <Text style={s.names}>{e.players.map((p) => (p.bot ? `🤖 ${p.name}` : p.name)).join(' · ')}</Text>
            <Text style={s.meta}>{dateFr(e.at)} · {MODE[e.mode]} · {e.plays} coups</Text>
          </View>
        </View>
      ))}
    </>
  );
}

/** Les meilleures parties : celles de tous les joueurs en ligne, et celles de cet appareil, avec les noms des participants. */
export function ScoreBoard({ local, shared, highlightIds, onBack, onClear, onRefresh }: {
  local: ScoreEntry[]; shared: SharedScores; highlightIds: string[]; onBack: () => void; onClear: () => void; onRefresh: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const hasShared = shared.status !== 'off';
  const [tab, setTab] = useState<'shared' | 'local'>(hasShared ? 'shared' : 'local');
  const current = hasShared ? tab : 'local';
  const denied = shared.error?.includes('permission_denied');

  return (
    <SafeAreaView style={s.root}>
      <StatusBar style="light" />
      <Text style={s.title}>🏆 Meilleurs scores</Text>
      {hasShared && (
        <View style={s.tabs}>
          <Pressable onPress={() => setTab('shared')} style={[s.tab, current === 'shared' && s.tabOn]}><Text style={[s.tabTxt, current === 'shared' && s.tabTxtOn]}>🌐 Tous les joueurs</Text></Pressable>
          <Pressable onPress={() => setTab('local')} style={[s.tab, current === 'local' && s.tabOn]}><Text style={[s.tabTxt, current === 'local' && s.tabTxtOn]}>📱 Cet appareil</Text></Pressable>
        </View>
      )}
      <ScrollView contentContainerStyle={s.list}>
        {current === 'shared' ? (
          <>
            {shared.status === 'loading' && shared.list.length === 0 && <Text style={s.empty}>Chargement du tableau…</Text>}
            {shared.status === 'error' && (
              <Text style={s.error}>
                {denied ? "Le tableau partagé n'est pas encore autorisé : les règles de la base doivent être mises à jour (voir docs/en-ligne.md)." : `Impossible de charger le tableau : ${shared.error}`}
              </Text>
            )}
            {shared.status === 'ready' && shared.list.length === 0 && <Text style={s.empty}>Aucune partie en ligne terminée pour l'instant.{'\n'}Le résultat s'inscrit ici à la fin de chaque partie en ligne.</Text>}
            <Rows list={shared.list} highlightIds={highlightIds} />
          </>
        ) : (
          <>
            {local.length === 0 && <Text style={s.empty}>Aucune partie terminée sur cet appareil.{'\n'}Les scores apparaissent ici à la fin de chaque partie.</Text>}
            <Rows list={local} highlightIds={highlightIds} />
          </>
        )}
      </ScrollView>
      <View style={s.foot}>
        <Pressable style={s.btn} onPress={onBack}><Text style={s.btnTxt}>← Retour</Text></Pressable>
        {current === 'shared' ? (
          <Pressable onPress={onRefresh} style={s.link}><Text style={s.linkTxt}>🔄 Actualiser</Text></Pressable>
        ) : local.length > 0 && (
          <Pressable onPress={() => { if (confirm) { onClear(); setConfirm(false); } else setConfirm(true); }} style={s.link}>
            <Text style={[s.linkTxt, confirm && s.danger]}>{confirm ? 'Touche encore pour tout effacer' : 'Effacer les scores de cet appareil'}</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a', paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 8, gap: 10 },
  title: { color: '#fff', fontSize: 26, fontWeight: '800', textAlign: 'center' },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#1e293b', alignItems: 'center' },
  tabOn: { backgroundColor: '#f59e0b' },
  tabTxt: { color: '#e2e8f0', fontWeight: '700', fontSize: 14 },
  tabTxtOn: { color: '#111827' },
  list: { gap: 8, paddingBottom: 8 },
  empty: { color: '#94a3b8', textAlign: 'center', fontSize: 15, paddingVertical: 30 },
  error: { color: '#fca5a5', textAlign: 'center', fontSize: 14, paddingVertical: 16 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 14, padding: 12, borderWidth: 2, borderColor: 'transparent' },
  rowNew: { borderColor: '#f59e0b' },
  rank: { color: '#f8fafc', fontSize: 22, fontWeight: '800', width: 38, textAlign: 'center' },
  body: { flex: 1, gap: 2 },
  score: { color: '#fbbf24', fontSize: 22, fontWeight: '900' },
  of: { color: '#94a3b8', fontSize: 14, fontWeight: '700' },
  names: { color: '#f8fafc', fontSize: 15, fontWeight: '700' },
  meta: { color: '#94a3b8', fontSize: 12 },
  foot: { gap: 4 },
  btn: { backgroundColor: '#f59e0b', padding: 14, borderRadius: 12, alignItems: 'center' },
  btnTxt: { color: '#111827', fontSize: 17, fontWeight: '800' },
  link: { alignSelf: 'center', padding: 8 },
  linkTxt: { color: '#94a3b8', fontSize: 14, textDecorationLine: 'underline' },
  danger: { color: '#fca5a5', fontWeight: '800' },
});
