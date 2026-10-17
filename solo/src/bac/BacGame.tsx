import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { reloadFresh } from '../reload';
import { clearRoomParam, roomFromUrl } from '../share';
import { ShareRoom } from '../ShareRoom';
import { MusicButton, useMusicChoice } from '../MusicButton';
import { TRACKS_BAC } from '../tracks';
import { loadJson, saveJson } from '../storage';
import { CATEGORIES, core, isRescued, labelOf, LETTERS, MAX_CATEGORIES, MIN_CATEGORIES, ranking, startsWithLetter, type Cell, type Status } from './engine';
import { DEFAULT_SETTINGS, normalizeCode, type Settings } from './session';
import { useBacOnline } from './useBacOnline';
import { LetterWheel } from './LetterWheel';
import { wordsFor } from './words';

const KEY_NAME = 'bac-name';
const KEY_BEST = 'bac-best';
const KEY_IDEAS = 'bac-ideas';
const ROUND_CHOICES = [3, 5, 8];
const SECONDS_CHOICES = [60, 90, 120];

type Best = { games: number; wins: number; record: number };

const STATUS_TXT: Record<Status, string> = {
  vide: 'vide', faux: 'mauvaise lettre', inconnu: 'mot inconnu', conteste: 'contesté', seul: 'seul : 15 pts', unique: 'unique : 10 pts', doublon: 'même mot : 5 pts',
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
  const [ideas, setIdeas] = useState(() => loadJson<boolean>(KEY_IDEAS, false));
  const toggleIdeas = () => { setIdeas(!ideas); saveJson(KEY_IDEAS, !ideas); };
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
        <RainbowTitle text="✏️ Petit bac" />
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
        <View style={st.card}>
          <Text style={st.head}>💡 Idées de mots en fin de manche</Text>
          <Text style={st.muted}>Ton réglage à toi : les autres joueurs gardent le leur.</Text>
          <View style={st.row}>
            <Chip on={ideas} label="Oui, les voir" onPress={() => { if (!ideas) toggleIdeas(); }} />
            <Chip on={!ideas} label="Non, je cherche seul" onPress={() => { if (ideas) toggleIdeas(); }} />
          </View>
        </View>
        {snap.isHost ? (
          <>
            <Text style={st.label}>Nombre de manches</Text>
            <View style={st.row}>{ROUND_CHOICES.map((n) => <Chip key={n} on={settings.rounds === n} label={`${n}`} onPress={() => setSettings({ ...settings, rounds: n })} />)}</View>
            <Text style={st.label}>Temps par manche</Text>
            <View style={st.row}>{SECONDS_CHOICES.map((n) => <Chip key={n} on={settings.seconds === n} label={`${n} s`} onPress={() => setSettings({ ...settings, seconds: n })} />)}</View>
            <Text style={st.label}>Catégories ({settings.categories.length})</Text>
            <View style={st.chips}>
              {CATEGORIES.map((c) => <Chip key={c.key} color={c.color} on={settings.categories.includes(c.key)} label={`${c.emoji} ${c.label}`} onPress={() => toggleCat(c.key)} />)}
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
    const writeMs = view.settings.seconds * 1000;
    const spinning = view.phase === 'write' && view.spinMs > 0 && left > writeMs + 50; // la roue tourne, le chrono n'a pas commencé
    const shown = Math.min(left, writeMs);
    const filled = cats.every((c) => startsWithLetter(draft[c] ?? '', view.letter));
    const lc = letterColor(view.letter);
    if (spinning) {
      return wrap(
        <>
          {header}
          <Text style={st.spinTitle}>🎡 Tirage de la lettre…</Text>
          <View style={{ alignItems: 'center', marginTop: 8 }}><LetterWheel key={view.roundNo} letter={view.letter} ms={view.spinMs} /></View>
          <Text style={st.muted}>Prépare-toi, le chrono démarre juste après !</Text>
        </>,
      );
    }
    return wrap(
      <>
        {header}
        <View style={[st.letterBox, { backgroundColor: lc }]}>
          <Text style={st.letter} accessibilityLabel={`Lettre ${view.letter}`}>{view.letter}</Text>
          {view.phase === 'write'
            ? <Text style={[st.timer, shown < 10000 && st.timerLow]}>⏱️ {Math.ceil(shown / 1000)} s</Text>
            : <Text style={st.timerStop}>{view.stoppedBy ? `✋ ${nameOf(view.stoppedBy)} a fini !` : '⏰ Temps écoulé !'}</Text>}
        </View>
        {seated ? cats.map((c) => {
          const v = draft[c] ?? '';
          const bad = !!v.trim() && !startsWithLetter(v, view.letter);
          const cat = labelOf(c);
          return (
            <View key={c} style={[st.field, { borderLeftColor: cat?.color ?? '#22c55e' }]}>
              <Text style={[st.fieldLabel, { color: cat?.color }]}>{cat?.emoji} {cat?.label}</Text>
              <TextInput value={v} onChangeText={(t) => setDraft({ ...draft, [c]: t })} editable={view.phase === 'write'} maxLength={40}
                autoCapitalize="words" autoCorrect={false} placeholder={`${view.letter}…`} placeholderTextColor="#475569"
                style={[st.input, { borderColor: bad ? '#ef4444' : v.trim() ? cat?.color : 'transparent' }]} accessibilityLabel={`${cat?.label}, un mot qui commence par ${view.letter}`} />
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
        <Text style={[st.title, { color: letterColor(view.letter, 65) }]}>🗳️ Vote · lettre {view.letter}</Text>
        <Text style={st.sub}>Touche ✗ sous un mot que tu trouves faux. Les mots que le dictionnaire ne connaît pas sont barrés : touche ✓ pour en défendre un. Il saute si plus de la moitié des autres joueurs (les machines ne votent pas) le contestent.</Text>
        <Pressable onPress={toggleIdeas} style={[st.btn, st.btnGhost]} accessibilityRole="button" accessibilityLabel="Afficher ou masquer les idées de mots">
          <Text style={[st.btnTxt, st.btnGhostTxt]}>{ideas ? '🙈 Masquer les idées de mots' : '💡 Voir des idées de mots'}</Text>
        </Pressable>
        {cats.map((c) => {
          const cat = labelOf(c);
          return (
            <View key={c} style={[st.card, { borderLeftWidth: 6, borderLeftColor: cat?.color }]}>
              <Text style={[st.head, { color: cat?.color }]}>{cat?.emoji} {cat?.label}</Text>
              {view.seats.map((p) => {
                const word = (round.answers[p.uid]?.[c] ?? '').trim();
                const mineWord = p.uid === me;
                const humans = view.seats.filter((x) => !x.bot).map((x) => x.uid);
                const unknown = !!word && !!onl.known && startsWithLetter(word, view.letter) && !onl.known(c, word) && !isRescued(round, c, p.uid, humans);
                const auto = !word ? 'vide' : !startsWithLetter(word, view.letter) ? 'mauvaise lettre' : unknown ? 'mot inconnu du dictionnaire' : null;
                const contests = round.contests[c]?.[p.uid] ?? [];
                const accepts = round.accepts?.[c]?.[p.uid] ?? [];
                const iContest = contests.includes(me);
                const iAccept = accepts.includes(me);
                return (
                  <View key={p.uid} style={st.voteRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={st.voteName}>{p.bot ? '🤖 ' : ''}{p.name}{mineWord ? ' (toi)' : ''}</Text>
                      <Text style={[st.voteWord, !!auto && st.voteBad, contests.length * 2 > view.seats.length - 1 && st.voteBad]}>{word || '—'}</Text>
                      {!!auto && word ? <Text style={st.badTxt}>{auto}</Text> : null}
                    </View>
                    {contests.length > 0 && <Text style={st.contestCount}>✗ {contests.length}</Text>}
                    {accepts.length > 0 && unknown && <Text style={st.acceptCount}>✓ {accepts.length}</Text>}
                    {seated && !mineWord && unknown && (
                      <Pressable onPress={() => act({ t: 'accept', cat: c, target: p.uid, on: !iAccept })} style={[st.acceptBtn, iAccept && st.acceptOn]}
                        accessibilityLabel={iAccept ? `Retirer mon accord pour ${word}` : `Accepter ${word} malgré le dictionnaire`}>
                        <Text style={[st.contestTxt, iAccept && st.contestTxtOn]}>✓</Text>
                      </Pressable>
                    )}
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
        <Text style={[st.title, { color: letterColor(view.letter, 65) }]}>🎯 Points · lettre {view.letter}</Text>
        {cats.map((c) => {
          const cat = labelOf(c);
          return (
            <View key={c} style={[st.card, { borderLeftWidth: 6, borderLeftColor: cat?.color }]}>
              <Text style={[st.head, { color: cat?.color }]}>{cat?.emoji} {cat?.label}</Text>
              {view.seats.map((p) => <ScoreLine key={p.uid} name={`${p.bot ? '🤖 ' : ''}${p.name}`} cell={cells[c]?.[p.uid]} me={p.uid === me} />)}
              {ideas && <Ideas cat={c} letter={view.letter} used={view.seats.map((p) => cells[c]?.[p.uid]?.word ?? '')} nobody={view.seats.every((p) => !(cells[c]?.[p.uid]?.pts))} />}
            </View>
          );
        })}
        <Pressable onPress={toggleIdeas} style={[st.btn, st.btnGhost]} accessibilityRole="button" accessibilityLabel="Afficher ou masquer les idées de mots">
          <Text style={[st.btnTxt, st.btnGhostTxt]}>{ideas ? '🙈 Masquer les idées de mots' : '💡 Voir des idées de mots'}</Text>
        </Pressable>
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
      <Confetti />
      <RainbowTitle text="🏁 Classement final" />
      {rank.map((r) => (
        <View key={r.uid} style={[st.card, { borderLeftWidth: 8, borderLeftColor: ['#fbbf24', '#cbd5e1', '#d97706'][r.rank - 1] ?? '#334155' }, r.rank === 1 && st.winner]}>
          <Text style={st.podium}>{medals[r.rank - 1] ?? `${r.rank}.`} {nameOf(r.uid)}{r.uid === me ? ' (toi)' : ''}</Text>
          <Text style={st.totalPts}>{r.pts} pts</Text>
        </View>
      ))}
      <Btn label="← Retour au menu" onPress={leave} />
    </>,
  );
}

const letterColor = (l: string, light = 38) => `hsl(${Math.round((Math.max(0, LETTERS.indexOf(l)) * 360) / LETTERS.length)}, 70%, ${light}%)`;
const RAINBOW = ['#f97316', '#eab308', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899'];

/** Titre dont chaque lettre a sa couleur. */
function RainbowTitle({ text }: { text: string }) {
  let k = 0;
  return (
    <Text style={st.title} accessibilityLabel={text}>
      {[...text].map((ch, i) => (ch === ' ' ? ' ' : <Text key={i} style={{ color: RAINBOW[k++ % RAINBOW.length] }}>{ch}</Text>))}
    </Text>
  );
}

/** Confettis qui tombent une fois, à l'arrivée du classement final. */
function Confetti() {
  const { width } = useWindowDimensions();
  const pieces = useRef(Array.from({ length: 30 }, (_, i) => ({
    x: Math.random() * Math.min(width, 560), color: RAINBOW[i % RAINBOW.length], delay: Math.random() * 900, dur: 2600 + Math.random() * 1600, size: 8 + Math.random() * 8, v: new Animated.Value(0),
  }))).current;
  useEffect(() => {
    pieces.forEach((p) => Animated.timing(p.v, { toValue: 1, duration: p.dur, delay: p.delay, easing: Easing.in(Easing.quad), useNativeDriver: false }).start());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View pointerEvents="none" style={st.confetti}>
      {pieces.map((p, i) => (
        <Animated.View key={i} style={{ position: 'absolute', left: p.x, width: p.size, height: p.size * 1.6, backgroundColor: p.color, borderRadius: 2,
          opacity: p.v.interpolate({ inputRange: [0, 0.05, 0.85, 1], outputRange: [0, 1, 1, 0] }),
          transform: [{ translateY: p.v.interpolate({ inputRange: [0, 1], outputRange: [-30, 760] }) }, { rotate: p.v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${360 + i * 40}deg`] }) }] }} />
      ))}
    </View>
  );
}

/** Fin de manche : quelques mots possibles pour la catégorie et la lettre, parmi ceux que personne n'a donnés. */
function Ideas({ cat, letter, used, nobody }: { cat: string; letter: string; used: string[]; nobody: boolean }) {
  const taken = used.map((w) => core(w));
  const ideas = wordsFor(cat, letter).filter((w) => !taken.includes(core(w))).slice(0, nobody ? 6 : 4);
  if (!ideas.length) return nobody ? <Text style={st.ideas}>😮 Personne n'a trouvé, et je n'ai pas d'idée non plus !</Text> : null;
  return <Text style={[st.ideas, nobody && st.ideasNobody]} accessibilityLabel={`Idées de mots : ${ideas.join(', ')}`}>{nobody ? '😮 Personne n\'a trouvé ! Par exemple : ' : '💡 Idées : '}{ideas.join(' · ')}</Text>;
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

function Chip({ on, label, onPress, color }: { on: boolean; label: string; onPress: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} style={[st.chip, color && { borderWidth: 2, borderColor: color }, on && st.chipOn, on && color && { backgroundColor: color }]} accessibilityState={{ selected: on }}>
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
  letterBox: { alignItems: 'center', gap: 4, backgroundColor: '#14532d', borderRadius: 24, paddingVertical: 12, borderWidth: 3, borderColor: 'rgba(255,255,255,0.35)' },
  spinTitle: { color: '#fde68a', fontSize: 24, fontWeight: '900', textAlign: 'center', marginTop: 8 },
  timerStop: { color: '#fff', fontSize: 22, fontWeight: '900' },
  confetti: { position: 'absolute', top: 0, left: 0, right: 0, height: 760, overflow: 'hidden', zIndex: 5 },
  letter: { color: '#f0fdf4', fontSize: 96, fontWeight: '900', lineHeight: 104 },
  timer: { color: '#fde68a', fontSize: 28, fontWeight: '900' },
  timerLow: { color: '#fca5a5', fontSize: 22, fontWeight: '900' },
  field: { gap: 4, borderLeftWidth: 6, borderLeftColor: '#22c55e', paddingLeft: 10, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, paddingVertical: 6, paddingRight: 6 },
  fieldLabel: { color: '#e2e8f0', fontSize: 15, fontWeight: '800' },
  ideas: { color: '#fde68a', fontSize: 14, fontWeight: '700', marginTop: 4, backgroundColor: 'rgba(253,230,138,0.08)', borderRadius: 8, padding: 8 },
  ideasNobody: { backgroundColor: 'rgba(251,146,60,0.18)', color: '#fed7aa' },
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
  acceptCount: { color: '#86efac', fontSize: 15, fontWeight: '900' },
  acceptBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#22c55e', alignItems: 'center', justifyContent: 'center' },
  acceptOn: { backgroundColor: '#22c55e' },
  contestCount: { color: '#fca5a5', fontSize: 15, fontWeight: '900' },
  contestBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#64748b', alignItems: 'center', justifyContent: 'center' },
  contestOn: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  contestTxt: { color: '#e2e8f0', fontSize: 20, fontWeight: '900' },
  contestTxtOn: { color: '#fff' },
  roundPts: { color: GREEN, fontSize: 18, fontWeight: '900', minWidth: 48, textAlign: 'right' },
  totalPts: { color: '#fbbf24', fontSize: 20, fontWeight: '900', minWidth: 48, textAlign: 'right' },
  winner: { borderWidth: 2, borderColor: '#fbbf24', backgroundColor: '#3b2f0b' },
  podium: { color: '#f8fafc', fontSize: 22, fontWeight: '900' },
});
