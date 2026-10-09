import { useEffect, useRef, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { reloadFresh } from '../reload';
import { loadJson, saveJson } from '../storage';
import { MusicButton, useMusicChoice } from '../MusicButton';
import { TRACKS_MEMO } from '../tracks';
import { StatsView } from '../StatsView';
import { addMemoGame, loadMemoStats, saveMemoStats, emptyMemoStats } from './stats';
import { flip, hide, isDone, LEVELS, mismatch, newMemo, stars, type Level, type Memo } from './engine';

const KEY_BEST = 'memo-best';
const HIDE_MS = 900;

export function MemoGame({ onHome }: { onHome: () => void }) {
  const musicChoice = useMusicChoice('memo', TRACKS_MEMO);
  const [level, setLevel] = useState<Level | null>(null);
  const [memo, setMemo] = useState<Memo | null>(null);
  const [best, setBest] = useState<Record<string, number>>(() => loadJson(KEY_BEST, {}));
  const [record, setRecord] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const { width } = useWindowDimensions();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Une paire ratée se recache toute seule après un court instant.
  useEffect(() => {
    if (!memo || !mismatch(memo)) return;
    timer.current = setTimeout(() => setMemo((m) => (m ? hide(m) : m)), HIDE_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [memo]);

  const start = (l: Level) => { setLevel(l); setMemo(newMemo(l.pairs)); setRecord(false); };

  const touch = (id: number) => {
    if (!memo || !level) return;
    const next = mismatch(memo) ? flip(hide(memo), id) : flip(memo, id);
    setMemo(next);
    if (isDone(next)) {
      saveMemoStats(addMemoGame(loadMemoStats(), level.key, next.moves, stars(level.pairs, next.moves)));
      const prev = best[level.key];
      if (prev === undefined || next.moves < prev) {
        const b = { ...best, [level.key]: next.moves };
        setBest(b); saveJson(KEY_BEST, b); setRecord(true);
      }
    }
  };

  const head = (
    <View style={s.top}>
      <Pressable onPress={memo ? () => setMemo(null) : onHome} style={s.topBtn} accessibilityLabel={memo ? 'Changer de niveau' : 'Retour à la liste des jeux'}>
        <Text style={s.topTxt}>{memo ? '← Niveaux' : '← Jeux'}</Text>
      </Pressable>
      <Text style={s.topTitle}>{memo ? 'Mémo des paires' : ''}</Text>
      <Pressable onPress={reloadFresh} style={[s.topBtn, { alignItems: 'flex-end' }]} accessibilityLabel="Recharger la dernière version du jeu"><Text style={s.topTxt}>↻</Text></Pressable>
    </View>
  );
  const music = <MusicButton choice={musicChoice} tracks={TRACKS_MEMO} />;

  if (showStats) {
    const st = loadMemoStats();
    const lv = LEVELS.filter((l) => st.levels[l.key]);
    const played = lv.reduce((n, l) => n + st.levels[l.key].played, 0);
    const moves = lv.reduce((n, l) => n + st.levels[l.key].moves, 0);
    const stars = lv.reduce((n, l) => n + st.levels[l.key].stars, 0);
    const day = (t: number | null) => (t ? new Date(t).toLocaleDateString('fr-FR') : '—');
    return (
      <SafeAreaView style={s.root}>
        <StatusBar style="light" />
        {head}
        <StatsView title="Mes stats — Mémo" intro={played ? undefined : 'Aucune partie terminée pour le moment : joue une partie pour voir tes stats.'}
          onBack={() => setShowStats(false)} onReset={() => { saveMemoStats(emptyMemoStats()); setShowStats(false); }}
          sections={[
            { title: 'En résumé', rows: [
              { label: 'Parties terminées', value: played }, { label: 'Coups joués au total', value: moves },
              { label: 'Coups par partie (moyenne)', value: played ? (moves / played).toFixed(1) : '—' },
              { label: 'Étoiles gagnées', value: stars }, { label: 'Première partie', value: day(st.first) }, { label: 'Dernière partie', value: day(st.last) },
            ] },
            ...lv.map((l) => ({ title: `${l.label} (${l.pairs} paires)`, rows: [
              { label: 'Parties', value: st.levels[l.key].played }, { label: 'Record', value: `${st.levels[l.key].best} coups` },
              { label: 'Moyenne', value: `${(st.levels[l.key].moves / st.levels[l.key].played).toFixed(1)} coups` },
            ] })),
          ]} />
      </SafeAreaView>
    );
  }

  if (!memo || !level) {
    return (
      <SafeAreaView style={s.root}>
        <StatusBar style="light" />
        {head}{music}
        <ScrollView contentContainerStyle={s.body}>
          <Text style={s.title}>🧠 Mémo des paires</Text>
          <Text style={s.sub}>Retourne deux cartes à la fois et retrouve toutes les paires, en un minimum de coups.</Text>
          {LEVELS.map((l) => (
            <Pressable key={l.key} onPress={() => start(l)} style={s.level} accessibilityRole="button">
              <Text style={s.levelTitle}>{l.label}</Text>
              <Text style={s.levelSub}>{l.pairs} paires · {best[l.key] !== undefined ? `🏅 record : ${best[l.key]} coups` : 'pas encore de record'}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setShowStats(true)} style={[s.level, s.statsBtn]} accessibilityRole="button"><Text style={s.levelTitle}>📊 Mes stats</Text><Text style={s.levelSub}>Parties, records, moyenne par niveau</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const size = Math.min(96, (Math.min(width, 520) - 32 - (level.cols - 1) * 8) / level.cols);
  const done = isDone(memo);
  return (
    <SafeAreaView style={s.root}>
      <StatusBar style="light" />
      {head}{music}
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.sub}>{memo.moves} coup{memo.moves > 1 ? 's' : ''} · {memo.cards.filter((c) => c.matched).length / 2}/{level.pairs} paires</Text>
        <View style={[s.grid, { width: level.cols * size + (level.cols - 1) * 8 }]}>
          {memo.cards.map((c) => {
            const up = c.matched || memo.flipped.includes(c.id);
            return (
              <Pressable key={c.id} onPress={() => touch(c.id)} disabled={done}
                accessibilityLabel={up ? c.symbol : 'Carte cachée'}
                style={[s.card, { width: size, height: size }, up && s.cardUp, c.matched && s.cardOk]}>
                <Text style={[s.sym, { fontSize: size * 0.5 }]}>{up ? c.symbol : '?'}</Text>
              </Pressable>
            );
          })}
        </View>
        {done && (
          <View style={s.win}>
            <Text style={s.title}>🎉 Bravo !</Text>
            <Text style={s.stars}>{'⭐'.repeat(stars(level.pairs, memo.moves))}</Text>
            <Text style={s.sub}>{memo.moves} coups{record ? ' — nouveau record !' : ''}</Text>
            <Pressable onPress={() => start(level)} style={s.btn}><Text style={s.btnTxt}>Rejouer</Text></Pressable>
            <Pressable onPress={() => setMemo(null)} style={[s.btn, s.ghost]}><Text style={s.ghostTxt}>Changer de niveau</Text></Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  body: { padding: 16, gap: 14, alignItems: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  topBtn: { padding: 8, minWidth: 80 },
  topTxt: { color: '#f59e0b', fontWeight: '800', fontSize: 15 },
  topTitle: { color: '#f8fafc', fontWeight: '800', fontSize: 16 },
  title: { color: '#f59e0b', fontSize: 28, fontWeight: '900', textAlign: 'center' },
  sub: { color: '#94a3b8', fontSize: 15, textAlign: 'center' },
  level: { alignSelf: 'stretch', maxWidth: 520, backgroundColor: '#1e293b', borderRadius: 14, padding: 18, gap: 2 },
  levelTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '900' },
  levelSub: { color: '#94a3b8', fontSize: 14 },
  statsBtn: { borderWidth: 1, borderColor: '#334155' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { borderRadius: 12, backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center' },
  cardUp: { backgroundColor: '#f8fafc' },
  cardOk: { backgroundColor: '#bbf7d0' },
  sym: { color: '#94a3b8', fontWeight: '900' },
  win: { alignItems: 'center', gap: 8, alignSelf: 'stretch' },
  stars: { fontSize: 36 },
  btn: { alignSelf: 'stretch', maxWidth: 520, backgroundColor: '#f59e0b', borderRadius: 12, padding: 14, alignItems: 'center' },
  btnTxt: { color: '#111827', fontWeight: '800', fontSize: 16 },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#94a3b8' },
  ghostTxt: { color: '#e2e8f0', fontWeight: '700', fontSize: 15 },
});
