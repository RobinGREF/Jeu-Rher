import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { reloadFresh } from '../reload';
import { clearRoomParam, roomFromUrl } from '../share';
import { ShareRoom } from '../ShareRoom';
import { MusicButton, useMusicChoice } from '../MusicButton';
import { TRACKS_BAC } from '../tracks';
import { loadJson, saveJson } from '../storage';
import { CATEGORIES, labelOf, MAX_CATEGORIES, MIN_CATEGORIES, ranking, startsWithLetter, type Cell, type Status } from './engine';
import { DEFAULT_SETTINGS, normalizeCode, type Settings } from './session';
import { useBacOnline } from './useBacOnline';

const KEY_NAME = 'bac-name';
const KEY_BEST = 'bac-best';
const ROUND_CHOICES = [3, 5, 8];
const SECONDS_CHOICES = [60, 90, 120];

type Best = { games: number; wins: number; record: number };

const STATUS_TXT: Record<Status, string> = {
  vide: 'vide', faux: 'mauvaise lettre', conteste: 'contesté', seul: 'seul : 15 pts', unique: 'unique : 10 pts', doublon: 'même mot : 5 pts',
};

export function BacGame({ onHome }: { onHome: () => void }) {
  const onl = useBacOnline();
  const music = useMusicChoice('bac', TRACKS_BAC);
  const invite = useMemo(() => roomFromUrl(), []);
  const [name, setName] = useState(() => loadJson<string>(KEY_NAME, ''));
  const [code, setCode] = useState(invite ?? '');
  const [pending, setPending] = useState(invite);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [now, setNow] = useState(Date.now());
  const [best, setBest] = useState<Best>(() => loadJson<Best>(KEY_BEST, { games: 0, wins: 0, record: 0 }));
  const sent = useRef<number>(0);
  const scroller = useRef<ScrollView>(null);
  const recorded = useRef(false);

  const snap = onl.snap;
  const view = snap?.view ?? null;
  const roundNo = view?.roundNo ?? 0;
  const phase = view?.phase;

  const remember = (v: string) => { setName(v); saveJson(KEY_NAME, v); };

  // Invitation : avec un prénom déjà enregistré on rejoint tout de suite, sinon le code est pré-rempli.
  useEffect(() => {
    if (!pending || !onl.kind || !name.trim()) return;
    setPending(null); clearRoomParam(); void onl.join(pending, name);
  }, [pending, onl.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  // À chaque changement d'étape, on remonte en haut de l'écran.
  useEffect(() => { scroller.current?.scrollTo({ y: 0, animated: false }); }, [phase, roundNo, snap?.phase]);

  // Nouvelle manche : on repart de réponses vides.
  useEffect(() => { setDraft({}); }, [roundNo]);

  // Compte à rebours de l'écriture.
  useEffect(() => {
    if (phase !== 'write') return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [phase, roundNo]);

  // Dès que l'écriture s'arrête (chrono ou « Bac ! » d'un joueur), on envoie ce qu'on a écrit.
  useEffect(() => {
    if (phase !== 'collect' || !snap || snap.mySeat < 0 || sent.current === roundNo) return;
    sent.current = roundNo;
    void onl.session.current?.act({ t: 'answers', answers: draft });
  }, [phase, roundNo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fin de partie : on retient le score sur cet appareil (une seule fois).
  useEffect(() => {
    if (phase !== 'final' || !view || !snap || recorded.current) return;
    recorded.current = true;
    const rank = ranking(view.totals);
    const mine = rank.find((r) => r.uid === snap.uid);
    if (!mine) return;
    const b = { games: best.games + 1, wins: best.wins + (mine.rank === 1 ? 1 : 0), record: Math.max(best.record, mine.pts) };
    setBest(b); saveJson(KEY_BEST, b);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (phase !== 'final') recorded.current = false; }, [phase]);

  const act = (i: Parameters<NonNullable<typeof onl.session.current>['act']>[0]) => { void onl.session.current?.act(i); };
  const leave = () => { onl.leave(); setDraft({}); sent.current = 0; };

  const top = (
    <View style={st.top}>
      <Pressable onPress={snap ? leave : onHome} style={st.topBtn} accessibilityLabel={snap ? 'Quitter le salon' : 'Retour à la liste des jeux'}>
        <Text style={st.topTxt}>{snap ? '← Quitter' : '← Jeux'}</Text>
      </Pressable>
      <Text style={st.topTitle}>{snap ? 'Petit bac' : ''}</Text>
      <Pressable onPress={reloadFresh} style={[st.topBtn, { alignItems: 'flex-end' }]} accessibilityLabel="Recharger la dernière version du jeu"><Text style={st.topTxt}>↻</Text></Pressable>
    </View>
  );
  const wrap = (children: React.ReactNode) => (
    <SafeAreaView style={st.root}>
      <StatusBar style="light" />
      {top}
      <MusicButton choice={music} tracks={TRACKS_BAC} />
      <ScrollView ref={scroller} contentContainerStyle={st.body} keyboardShouldPersistTaps="handled">{children}</ScrollView>
    </SafeAreaView>
  );

  // ———— Pas encore dans un salon ————
  if (!snap) {
    return wrap(
      <>
        <Text style={st.title}>✏️ Petit bac</Text>
        <Text style={st.sub}>Une lettre, des catégories : trouve un mot pour chacune avant les autres. Chacun sur son téléphone, en ligne.</Text>
        {!onl.kind ? (
          <Text style={st.err}>Le mode en ligne n'est pas configuré sur cette version (voir docs/en-ligne.md).</Text>
        ) : (
          <>
            {!!pending && <Text style={st.info}>👋 Invitation au salon {pending} : saisis ton prénom puis touche « Rejoindre ».</Text>}
            <Text style={st.label}>Ton prénom</Text>
            <TextInput value={name} onChangeText={remember} placeholder="Écris ton prénom" placeholderTextColor="#64748b" maxLength={14} style={st.input} accessibilityLabel="Ton prénom" />
            <Btn label="🌐 Créer une partie" disabled={onl.busy || !name.trim()} onPress={() => { void onl.create(name); }} />
            <View style={st.row}>
              <TextInput value={code} onChangeText={(v) => setCode(normalizeCode(v))} placeholder="CODE" placeholderTextColor="#64748b" autoCapitalize="characters"
                maxLength={4} style={[st.input, st.codeInput]} accessibilityLabel="Code du salon" />
              <Btn kind="ghost" label="Rejoindre" disabled={onl.busy || code.length !== 4 || !name.trim()} onPress={() => { setPending(null); clearRoomParam(); void onl.join(code, name); }} />
            </View>
            {!!onl.error && <Text style={st.err}>{onl.error}</Text>}
            {onl.kind === 'local' && <Text style={st.muted}>Test local : les autres joueurs sont les autres onglets de ce navigateur.</Text>}
            {best.games > 0 && <Text style={st.muted}>🏆 {best.games} partie{best.games > 1 ? 's' : ''} · {best.wins} victoire{best.wins > 1 ? 's' : ''} · record {best.record} pts</Text>}
          </>
        )}
      </>,
    );
  }

  if (snap.phase === 'error') {
    return wrap(<><Text style={st.title}>Petit bac</Text><Text style={st.err}>{snap.error}</Text><Btn label="← Retour" onPress={leave} /></>);
  }

  // ———— Salon d'attente ————
  if (snap.phase !== 'playing' || !view) {
    const toggleCat = (k: string) => {
      const on = settings.categories.includes(k);
      if (on && settings.categories.length <= MIN_CATEGORIES) return;
      if (!on && settings.categories.length >= MAX_CATEGORIES) return;
      setSettings({ ...settings, categories: on ? settings.categories.filter((x) => x !== k) : [...settings.categories, k] });
    };
    return wrap(
      <>
        <Text style={st.label}>Code du salon</Text>
        <Text style={st.code} accessibilityLabel={`Code du salon ${snap.code}`}>{snap.code}</Text>
        <Text style={st.muted}>Envoie l'invitation : le lien ouvre le jeu directement sur ce salon.</Text>
        <ShareRoom game="Petit bac" code={snap.code} />
        <View style={st.card}>
          <Text style={st.head}>Joueurs ({snap.players.length + snap.bots.length}/8)</Text>
          {snap.players.map((p, i) => <Text key={p.uid} style={st.text}>{i === 0 ? '👑 ' : '• '}{p.name}{p.uid === snap.uid ? ' (toi)' : ''}</Text>)}
          {snap.bots.map((n) => (
            <View key={n} style={st.botRow}>
              <Text style={[st.text, { flex: 1 }]}>🤖 {n} (machine)</Text>
              {snap.isHost && <Pressable onPress={() => { void onl.session.current?.removeBot(n); }} style={st.botX} accessibilityLabel={`Retirer la machine ${n}`}><Text style={st.botXTxt}>✕</Text></Pressable>}
            </View>
          ))}
          {snap.isHost && snap.players.length + snap.bots.length < 8 && (
            <Pressable onPress={() => { void onl.session.current?.addBot(); }} style={st.addBot} accessibilityLabel="Ajouter une machine"><Text style={st.addBotTxt}>🤖 Ajouter une machine</Text></Pressable>
          )}
        </View>
        {snap.isHost ? (
          <>
            <Text style={st.label}>Nombre de manches</Text>
            <View style={st.row}>{ROUND_CHOICES.map((n) => <Chip key={n} on={settings.rounds === n} label={`${n}`} onPress={() => setSettings({ ...settings, rounds: n })} />)}</View>
            <Text style={st.label}>Temps par manche</Text>
            <View style={st.row}>{SECONDS_CHOICES.map((n) => <Chip key={n} on={settings.seconds === n} label={`${n} s`} onPress={() => setSettings({ ...settings, seconds: n })} />)}</View>
            <Text style={st.label}>Catégories ({settings.categories.length})</Text>
            <View style={st.chips}>
              {CATEGORIES.map((c) => <Chip key={c.key} on={settings.categories.includes(c.key)} label={`${c.emoji} ${c.label}`} onPress={() => toggleCat(c.key)} />)}
            </View>
            <Btn label={snap.players.length + snap.bots.length > 1 ? `Lancer la partie (${snap.players.length + snap.bots.length} joueurs)` : 'Ajoute une machine ou attends un joueur'} disabled={snap.players.length + snap.bots.length < 2} onPress={() => { void onl.session.current?.start(settings); }} />
          </>
        ) : <Text style={st.muted}>En attente du lancement par l'hôte…</Text>}
      </>,
    );
  }

  // ———— En jeu ————
  const me = snap.uid;
  const seated = snap.mySeat >= 0;
  const nameOf = (uid: string) => { const x = view.seats.find((y) => y.uid === uid); return x ? (x.bot ? `🤖 ${x.name}` : x.name) : '?'; };
  const cats = view.settings.categories;
  const header = (
    <View style={st.roundBar}>
      <Text style={st.roundTxt}>Manche {view.roundNo}/{view.settings.rounds}</Text>
      <Text style={st.roundTxt}>{ranking(view.totals).find((r) => r.uid === me)?.pts ?? 0} pts</Text>
    </View>
  );

  if (view.phase === 'write' || view.phase === 'collect') {
    const left = view.phase === 'write' ? Math.max(0, view.remainingMs - (now - snap.recvAt)) : 0;
    const filled = cats.every((c) => startsWithLetter(draft[c] ?? '', view.letter));
    return wrap(
      <>
        {header}
        <View style={st.letterBox}>
          <Text style={st.letter} accessibilityLabel={`Lettre ${view.letter}`}>{view.letter}</Text>
          {view.phase === 'write'
            ? <Text style={[st.timer, left < 10000 && st.timerLow]}>{Math.ceil(left / 1000)} s</Text>
            : <Text style={st.timerLow}>{view.stoppedBy ? `✋ ${nameOf(view.stoppedBy)} a fini !` : '⏰ Temps écoulé !'}</Text>}
        </View>
        {seated ? cats.map((c) => {
          const v = draft[c] ?? '';
          const bad = !!v.trim() && !startsWithLetter(v, view.letter);
          const cat = labelOf(c);
          return (
            <View key={c} style={st.field}>
              <Text style={st.fieldLabel}>{cat?.emoji} {cat?.label}</Text>
              <TextInput value={v} onChangeText={(t) => setDraft({ ...draft, [c]: t })} editable={view.phase === 'write'} maxLength={40}
                autoCapitalize="words" autoCorrect={false} placeholder={`${view.letter}…`} placeholderTextColor="#475569"
                style={[st.input, bad && st.inputBad]} accessibilityLabel={`${cat?.label}, un mot qui commence par ${view.letter}`} />
              {bad && <Text style={st.badTxt}>Doit commencer par {view.letter}</Text>}
            </View>
          );
        }) : <Text style={st.muted}>👀 Tu regardes la partie.</Text>}
        {seated && view.phase === 'write' && (
          <Btn label={filled ? '✋ Bac ! J\'ai fini' : 'Remplis toutes les catégories pour finir'} disabled={!filled} onPress={() => act({ t: 'stop' })} />
        )}
        {view.phase === 'collect' && <Text style={st.muted}>Envoi des réponses…</Text>}
      </>,
    );
  }

  if (view.phase === 'vote') {
    const round = view.round!;
    const iReady = view.ready.includes(me);
    return wrap(
      <>
        {header}
        <Text style={st.title}>Vote · lettre {view.letter}</Text>
        <Text style={st.sub}>Touche ✗ sous un mot que tu trouves faux. Il saute si plus de la moitié des autres joueurs (les machines ne votent pas) le contestent.</Text>
        {cats.map((c) => {
          const cat = labelOf(c);
          return (
            <View key={c} style={st.card}>
              <Text style={st.head}>{cat?.emoji} {cat?.label}</Text>
              {view.seats.map((p) => {
                const word = (round.answers[p.uid]?.[c] ?? '').trim();
                const mineWord = p.uid === me;
                const auto = !word ? 'vide' : !startsWithLetter(word, view.letter) ? 'mauvaise lettre' : null;
                const contests = round.contests[c]?.[p.uid] ?? [];
                const iContest = contests.includes(me);
                return (
                  <View key={p.uid} style={st.voteRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={st.voteName}>{p.bot ? '🤖 ' : ''}{p.name}{mineWord ? ' (toi)' : ''}</Text>
                      <Text style={[st.voteWord, !!auto && st.voteBad, contests.length * 2 > view.seats.length - 1 && st.voteBad]}>{word || '—'}</Text>
                      {!!auto && word ? <Text style={st.badTxt}>{auto}</Text> : null}
                    </View>
                    {contests.length > 0 && <Text style={st.contestCount}>✗ {contests.length}</Text>}
                    {seated && !mineWord && !!word && !auto && (
                      <Pressable onPress={() => act({ t: 'contest', cat: c, target: p.uid, on: !iContest })} style={[st.contestBtn, iContest && st.contestOn]}
                        accessibilityLabel={iContest ? `Retirer ma contestation de ${word}` : `Contester ${word}`}>
                        <Text style={[st.contestTxt, iContest && st.contestTxtOn]}>✗</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })}
        {seated && <Btn label={iReady ? `✔ En attente des autres (${view.ready.length}/${view.seats.length})` : 'J\'ai fini de voter'} disabled={iReady} onPress={() => act({ t: 'ready' })} />}
        {snap.isHost && <Btn kind="ghost" label="Passer aux points" onPress={() => { void onl.session.current?.next(); }} />}
      </>,
    );
  }

  if (view.phase === 'scores') {
    const cells = view.cells ?? {};
    const rank = ranking(view.totals);
    const last = view.roundNo >= view.settings.rounds;
    return wrap(
      <>
        {header}
        <Text style={st.title}>Points · lettre {view.letter}</Text>
        {cats.map((c) => {
          const cat = labelOf(c);
          return (
            <View key={c} style={st.card}>
              <Text style={st.head}>{cat?.emoji} {cat?.label}</Text>
              {view.seats.map((p) => <ScoreLine key={p.uid} name={`${p.bot ? '🤖 ' : ''}${p.name}`} cell={cells[c]?.[p.uid]} me={p.uid === me} />)}
            </View>
          );
        })}
        <View style={st.card}>
          <Text style={st.head}>Classement</Text>
          {rank.map((r) => (
            <View key={r.uid} style={st.voteRow}>
              <Text style={[st.voteName, { flex: 1 }]}>{r.rank}. {nameOf(r.uid)}{r.uid === me ? ' (toi)' : ''}</Text>
              <Text style={st.roundPts}>+{view.roundPts?.[r.uid] ?? 0}</Text>
              <Text style={st.totalPts}>{r.pts}</Text>
            </View>
          ))}
        </View>
        {snap.isHost
          ? <Btn label={last ? '🏁 Voir le classement final' : '▶ Manche suivante'} onPress={() => { void onl.session.current?.next(); }} />
          : <Text style={st.muted}>{last ? 'L\'hôte affiche le classement final…' : 'L\'hôte lance la manche suivante…'}</Text>}
      </>,
    );
  }

  // final
  const rank = ranking(view.totals);
  const medals = ['🥇', '🥈', '🥉'];
  return wrap(
    <>
      <Text style={st.title}>🏁 Classement final</Text>
      {rank.map((r) => (
        <View key={r.uid} style={[st.card, r.rank === 1 && st.winner]}>
          <Text style={st.podium}>{medals[r.rank - 1] ?? `${r.rank}.`} {nameOf(r.uid)}{r.uid === me ? ' (toi)' : ''}</Text>
          <Text style={st.totalPts}>{r.pts} pts</Text>
        </View>
      ))}
      <Btn label="← Retour au menu" onPress={leave} />
    </>,
  );
}

function ScoreLine({ name, cell, me }: { name: string; cell?: Cell; me: boolean }) {
  if (!cell) return null;
  const bad = cell.pts === 0;
  return (
    <View style={st.voteRow}>
      <View style={{ flex: 1 }}>
        <Text style={st.voteName}>{name}{me ? ' (toi)' : ''}</Text>
        <Text style={[st.voteWord, bad && st.voteBad]}>{cell.word || '—'}</Text>
        <Text style={bad ? st.badTxt : st.okTxt}>{STATUS_TXT[cell.status]}</Text>
      </View>
      <Text style={[st.roundPts, bad && { color: '#64748b' }]}>+{cell.pts}</Text>
    </View>
  );
}

function Btn({ label, onPress, kind = 'main', disabled }: { label: string; onPress: () => void; kind?: 'main' | 'ghost'; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={[st.btn, kind === 'ghost' && st.btnGhost, disabled && { opacity: 0.45 }]}>
      <Text style={[st.btnTxt, kind === 'ghost' && st.btnGhostTxt]}>{label}</Text>
    </Pressable>
  );
}

function Chip({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[st.chip, on && st.chipOn]} accessibilityState={{ selected: on }}>
      <Text style={[st.chipTxt, on && st.chipTxtOn]}>{label}</Text>
    </Pressable>
  );
}

const GREEN = '#22c55e';
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  body: { padding: 16, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center', paddingBottom: 40 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  topBtn: { padding: 8, minWidth: 80 },
  topTxt: { color: GREEN, fontWeight: '800', fontSize: 15 },
  topTitle: { color: '#f8fafc', fontWeight: '800', fontSize: 16 },
  title: { color: GREEN, fontSize: 28, fontWeight: '900', textAlign: 'center' },
  sub: { color: '#94a3b8', fontSize: 15, textAlign: 'center' },
  muted: { color: '#94a3b8', fontSize: 14, textAlign: 'center' },
  info: { color: '#fde68a', fontSize: 15, textAlign: 'center', fontWeight: '700' },
  err: { color: '#fca5a5', fontSize: 15, textAlign: 'center', fontWeight: '700' },
  label: { color: '#94a3b8', fontSize: 13, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 4 },
  input: { backgroundColor: '#1e293b', color: '#f8fafc', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, fontSize: 18, fontWeight: '700', borderWidth: 2, borderColor: 'transparent' },
  inputBad: { borderColor: '#ef4444' },
  codeInput: { width: 130, textAlign: 'center', letterSpacing: 6 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  chip: { backgroundColor: '#1e293b', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 },
  chipOn: { backgroundColor: GREEN },
  chipTxt: { color: '#e2e8f0', fontWeight: '700', fontSize: 14 },
  chipTxtOn: { color: '#052e16' },
  btn: { backgroundColor: GREEN, borderRadius: 12, padding: 14, alignItems: 'center' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#94a3b8' },
  btnTxt: { color: '#052e16', fontWeight: '800', fontSize: 16, textAlign: 'center' },
  btnGhostTxt: { color: '#e2e8f0' },
  code: { color: '#fbbf24', fontSize: 56, fontWeight: '900', textAlign: 'center', letterSpacing: 10 },
  card: { backgroundColor: '#1e293b', borderRadius: 14, padding: 14, gap: 8 },
  head: { color: '#f8fafc', fontSize: 16, fontWeight: '800' },
  text: { color: '#e2e8f0', fontSize: 16 },
  roundBar: { flexDirection: 'row', justifyContent: 'space-between' },
  roundTxt: { color: '#94a3b8', fontSize: 14, fontWeight: '800' },
  letterBox: { alignItems: 'center', gap: 4, backgroundColor: '#14532d', borderRadius: 20, paddingVertical: 12 },
  letter: { color: '#f0fdf4', fontSize: 96, fontWeight: '900', lineHeight: 104 },
  timer: { color: '#fde68a', fontSize: 28, fontWeight: '900' },
  timerLow: { color: '#fca5a5', fontSize: 22, fontWeight: '900' },
  field: { gap: 4 },
  fieldLabel: { color: '#e2e8f0', fontSize: 15, fontWeight: '800' },
  okTxt: { color: '#86efac', fontSize: 13, fontWeight: '700' },
  badTxt: { color: '#fca5a5', fontSize: 13, fontWeight: '700' },
  botRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  botX: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#64748b', alignItems: 'center', justifyContent: 'center' },
  botXTxt: { color: '#e2e8f0', fontSize: 16, fontWeight: '800' },
  addBot: { borderWidth: 1, borderColor: '#22c55e', borderStyle: 'dashed', borderRadius: 12, padding: 10, alignItems: 'center', marginTop: 4 },
  addBotTxt: { color: '#22c55e', fontWeight: '800', fontSize: 15 },
  voteRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  voteName: { color: '#94a3b8', fontSize: 13, fontWeight: '700' },
  voteWord: { color: '#f8fafc', fontSize: 18, fontWeight: '800' },
  voteBad: { color: '#64748b', textDecorationLine: 'line-through' },
  contestCount: { color: '#fca5a5', fontSize: 15, fontWeight: '900' },
  contestBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#64748b', alignItems: 'center', justifyContent: 'center' },
  contestOn: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  contestTxt: { color: '#e2e8f0', fontSize: 20, fontWeight: '900' },
  contestTxtOn: { color: '#fff' },
  roundPts: { color: GREEN, fontSize: 18, fontWeight: '900', minWidth: 48, textAlign: 'right' },
  totalPts: { color: '#fbbf24', fontSize: 20, fontWeight: '900', minWidth: 48, textAlign: 'right' },
  winner: { borderWidth: 2, borderColor: '#fbbf24' },
  podium: { color: '#f8fafc', fontSize: 22, fontWeight: '900' },
});
