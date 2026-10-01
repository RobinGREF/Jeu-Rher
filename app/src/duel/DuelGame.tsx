import { useEffect, useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { loadJson, removeKey, saveJson } from '../storage';
import { CATEGORIES, QUESTIONS } from './questions';
import {
  applyAnswer, catInfo, CATEGORY_TARGET, CLASSIC_CATEGORIES, DEFAULT_CATEGORIES, diffInfo, DIFFICULTIES, drawQuestion, eliminate,
  isBlindCorrect, isCatDone, MAX_PLAYERS, MIN_CATEGORIES, newDuel, progressOf, randomCategories, stepGain, TURN_COLORS, wonCount,
} from './engine';
import type { Category, DiffKey, DuelGame as Game, HintKind, Question } from './types';

const QUESTION_COUNT = Object.values(QUESTIONS).reduce((n, l) => n + l.length, 0);
const KEY_SAVE = 'duel-save';
const KEY_SEEN = 'duel-seen';
const KEY_BEST = 'duel-best';
const KEY_NAMES = 'duel-names';

type Best = { score: number; name: string };
type Step = 'setup' | 'cats' | 'category' | 'difficulty' | 'preq' | 'blind' | 'question' | 'result' | 'victory';
type Current = {
  cat: string; diff: DiffKey; question: Question;
  hint: HintKind | null; eliminated: number[];
  blind: boolean; chosen: number | null; correct: boolean; input: string;
};
type Saved = { game: Game };

function Pill({ cat, diff }: { cat: Category; diff: DiffKey }) {
  const d = diffInfo(diff);
  return (
    <View style={s.pills}>
      <Text style={[s.pill, { backgroundColor: cat.color }]}>{cat.emoji} {cat.label}</Text>
      <Text style={[s.pill, { backgroundColor: d.color }]}>{d.label}</Text>
    </View>
  );
}

function Btn({ label, onPress, kind = 'main', disabled }: { label: string; onPress: () => void; kind?: 'main' | 'ghost'; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={[s.btn, kind === 'ghost' && s.btnGhost, disabled && s.off]}>
      <Text style={[s.btnTxt, kind === 'ghost' && s.btnGhostTxt]}>{label}</Text>
    </Pressable>
  );
}

/** Une pastille par catégorie, remplie selon la progression du joueur. */
function Progress({ game, player }: { game: Game; player: number }) {
  const p = game.players[player];
  return (
    <View style={s.dots}>
      {game.categories.map((k) => {
        const c = catInfo(k);
        const n = progressOf(p, k);
        return (
          <View key={k} style={[s.dot, { borderColor: c.color, backgroundColor: n >= CATEGORY_TARGET ? c.color : n > 0 ? c.color + '55' : 'transparent' }]}
            accessibilityLabel={`${c.label} ${n}/${CATEGORY_TARGET}`}>
            <Text style={s.dotTxt}>{c.emoji}</Text>
          </View>
        );
      })}
    </View>
  );
}

const RULES: [string, string[]][] = [
  ['🎯 Le principe', ['Chaque catégorie a une jauge à remplir. Le premier joueur qui a rempli toutes les catégories de la partie gagne.']],
  ['🥧 Remplir une catégorie', [
    'Facile : il faut 2 bonnes réponses.',
    'Difficile : 1 seule bonne réponse suffit, mais c\'est plus risqué.',
    'Une mauvaise réponse fait perdre les points de la difficulté (jamais sous 0) et le tour passe au joueur suivant.',
  ]],
  ['🗂️ Choisir les catégories', [
    'Format classique : exactement 8 catégories, choisies à tour de rôle (ou au hasard).',
    'Format libre : de 4 à 20 catégories, pour une partie plus courte ou plus longue.',
  ]],
  ['⚡ Répondre à l\'aveugle', [
    'Avant de voir les 4 propositions, tente une réponse libre.',
    'Juste : la catégorie progresse, tes points sont doublés et tu rejoues. Faux : le tour passe.',
  ]],
  ['🔎 Les indices', ['Indice simple (gratuit) : élimine 1 mauvaise réponse.', '50/50 (coûte 1 barre de progression) : élimine 2 mauvaises réponses.']],
];

export function DuelGame({ onHome }: { onHome: () => void }) {
  const saved = useMemo(() => loadJson<Saved | null>(KEY_SAVE, null), []);
  const [step, setStep] = useState<Step>('setup');
  const [game, setGame] = useState<Game | null>(null);
  const [cur, setCur] = useState<Current | null>(null);
  const [cat, setCat] = useState(''); // catégorie choisie, avant le choix de la difficulté
  const [count, setCount] = useState(2);
  const [names, setNames] = useState<string[]>(() => {
    const n = loadJson<string[]>(KEY_NAMES, []);
    return Array.from({ length: MAX_PLAYERS }, (_, i) => n[i] || `Joueur ${i + 1}`);
  });
  const [mode, setMode] = useState<'fixed' | 'flexible'>('fixed');
  const [flexCount, setFlexCount] = useState(CLASSIC_CATEGORIES);
  const [picked, setPicked] = useState<string[]>([]);
  const [draft, setDraft] = useState(0); // joueur qui choisit une catégorie (format classique)
  const [rules, setRules] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [best, setBest] = useState<Best | null>(() => loadJson<Best | null>(KEY_BEST, null));
  const [newRecord, setNewRecord] = useState(false);

  useEffect(() => { if (game && step !== 'victory') saveJson(KEY_SAVE, { game } satisfies Saved); }, [game, step]);

  const total = mode === 'fixed' ? CLASSIC_CATEGORIES : flexCount;
  const player = game ? game.players[game.current] : null;

  const goSetup = () => {
    saveJson(KEY_NAMES, names.slice(0, count));
    setPicked([]); setDraft(0); setStep('cats');
  };
  const startGame = (cats: string[]) => {
    const g = newDuel(names.slice(0, count), cats, loadJson<Record<string, number[]>>(KEY_SEEN, {}));
    setGame(g); setStep('category');
  };
  const toggleCat = (k: string) => {
    if (picked.includes(k)) setPicked(picked.filter((x) => x !== k));
    else if (picked.length < total) setPicked([...picked, k]);
  };
  const chooseDraft = () => {
    // Format classique : le choix passe au joueur suivant après chaque catégorie ajoutée.
    setDraft((d) => (d + 1) % count);
  };

  const pickCategory = (cat: string) => { setCat(cat); setStep('difficulty'); };
  const pickDifficulty = (diff: DiffKey) => {
    if (!game) return;
    const d = drawQuestion(cat, diff, game.seen);
    saveJson(KEY_SEEN, d.seen);
    setGame({ ...game, seen: d.seen });
    setCur({ cat, diff, question: d.question, hint: null, eliminated: [], blind: false, chosen: null, correct: false, input: '' });
    setShowInfo(false);
    setStep('preq');
  };
  const useHint = (kind: HintKind) => {
    if (!cur || cur.hint) return;
    setCur({ ...cur, hint: kind, eliminated: eliminate(cur.question, kind) });
  };
  const answer = (i: number) => {
    if (!cur) return;
    setCur({ ...cur, chosen: i, correct: i === cur.question.correct });
    setStep('result');
  };
  const submitBlind = () => {
    if (!cur) return;
    setCur({ ...cur, correct: isBlindCorrect(cur.input, cur.question), blind: true, chosen: null });
    setStep('result');
  };
  const next = () => {
    if (!game || !cur) return;
    const out = applyAnswer(game, { correct: cur.correct, cat: cur.cat, diff: cur.diff, hint: cur.hint, blind: cur.blind });
    setGame(out.game);
    setCur(null);
    if (out.won) {
      const winner = out.game.players[game.current];
      const isNew = !best || winner.score > best.score;
      if (isNew) { const b = { score: winner.score, name: winner.name }; setBest(b); saveJson(KEY_BEST, b); }
      setNewRecord(isNew);
      removeKey(KEY_SAVE);
      setGame({ ...out.game, current: game.current });
      setStep('victory');
    } else setStep('category');
  };
  const restart = () => { removeKey(KEY_SAVE); setGame(null); setCur(null); setStep('setup'); };

  const header = (
    <View style={s.top}>
      <Pressable onPress={onHome} style={s.topBtn} accessibilityLabel="Retour à la liste des jeux"><Text style={s.topTxt}>← Jeux</Text></Pressable>
      <Text style={s.topTitle}>Duel de Savoir</Text>
      <Pressable onPress={() => setRules(true)} style={s.topBtn} accessibilityLabel="Règles"><Text style={s.topTxt}>📖</Text></Pressable>
    </View>
  );

  if (rules) {
    return (
      <SafeAreaView style={s.root}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={s.body}>
          <Text style={s.title}>Règles</Text>
          {RULES.map(([t, items]) => (
            <View key={t} style={s.card}>
              <Text style={s.heading}>{t}</Text>
              {items.map((x) => <Text key={x} style={s.text}>{x}</Text>)}
            </View>
          ))}
          <Text style={s.muted}>Duel de Savoir — {CATEGORIES.length} catégories, {QUESTION_COUNT} questions.</Text>
          <Btn label="Fermer" onPress={() => setRules(false)} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  let content: React.ReactNode = null;

  if (step === 'setup') {
    content = (
      <>
        <Text style={s.title}>Duel de Savoir</Text>
        <Text style={s.muted}>Quiz à choix multiples, de 1 à 6 joueurs, sur un seul appareil.</Text>
        {saved && (
          <Btn label={`▶ Reprendre la partie (${saved.game.players.map((p) => p.name).join(', ')})`}
            onPress={() => { setGame(saved.game); setCount(saved.game.players.length); setStep('category'); }} />
        )}
        {best && <Text style={s.record}>🏆 Record : {best.score} pts ({best.name})</Text>}
        <Text style={s.label}>Nombre de joueurs</Text>
        <View style={s.row}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <Pressable key={n} onPress={() => setCount(n)} style={[s.chip, count === n && s.chipOn]}><Text style={[s.chipTxt, count === n && s.chipTxtOn]}>{n}</Text></Pressable>
          ))}
        </View>
        {Array.from({ length: count }, (_, i) => (
          <View key={i} style={s.nameRow}>
            <View style={[s.swatch, { backgroundColor: TURN_COLORS[i] }]} />
            <TextInput value={names[i]} maxLength={14} style={s.input} placeholderTextColor="#8b93a7" accessibilityLabel={`Nom du joueur ${i + 1}`}
              onChangeText={(v) => setNames(names.map((x, j) => (j === i ? v : x)))} />
          </View>
        ))}
        <Btn label="Choisir les catégories" onPress={goSetup} />
      </>
    );
  } else if (step === 'cats') {
    const done = picked.length === total;
    content = (
      <>
        <Text style={s.title}>Catégories</Text>
        <View style={s.row}>
          <Pressable onPress={() => { setMode('fixed'); setPicked(picked.slice(0, CLASSIC_CATEGORIES)); }} style={[s.chip, s.chipWide, mode === 'fixed' && s.chipOn]}><Text style={[s.chipTxt, mode === 'fixed' && s.chipTxtOn]}>Classique (8)</Text></Pressable>
          <Pressable onPress={() => { setMode('flexible'); setPicked(picked.slice(0, flexCount)); }} style={[s.chip, s.chipWide, mode === 'flexible' && s.chipOn]}><Text style={[s.chipTxt, mode === 'flexible' && s.chipTxtOn]}>Libre ({MIN_CATEGORIES}–20)</Text></Pressable>
        </View>
        {mode === 'flexible' && (
          <View style={s.row}>
            <Pressable style={s.chip} onPress={() => { const n = Math.max(MIN_CATEGORIES, flexCount - 1); setFlexCount(n); setPicked(picked.slice(0, n)); }}><Text style={s.chipTxt}>−</Text></Pressable>
            <Text style={s.count}>{flexCount} catégories</Text>
            <Pressable style={s.chip} onPress={() => setFlexCount(Math.min(CATEGORIES.length, flexCount + 1))}><Text style={s.chipTxt}>+</Text></Pressable>
          </View>
        )}
        <Text style={s.muted}>
          {mode === 'fixed' && count > 1 ? `${names[draft]} choisit · ` : ''}{picked.length}/{total} choisies
        </Text>
        <View style={s.grid}>
          {CATEGORIES.map((c) => {
            const on = picked.includes(c.key);
            return (
              <Pressable key={c.key} onPress={() => { toggleCat(c.key); if (mode === 'fixed' && !on && picked.length < total) chooseDraft(); }}
                style={[s.cat, { borderColor: c.color }, on && { backgroundColor: c.color }]} accessibilityState={{ selected: on }}>
                <Text style={s.catTxt}>{c.emoji} {c.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Btn kind="ghost" label="🎲 Compléter au hasard" onPress={() => setPicked(randomCategories(total, picked))} />
        <Btn label="Commencer" disabled={!done} onPress={() => startGame(picked)} />
        <Btn kind="ghost" label="Catégories par défaut" onPress={() => startGame(DEFAULT_CATEGORIES.slice(0, total))} />
      </>
    );
  } else if (game && player && step === 'category') {
    const open = game.categories.filter((k) => !isCatDone(player, k));
    content = (
      <>
        <Text style={[s.turn, { color: TURN_COLORS[game.current % TURN_COLORS.length] }]}>Au tour de {player.name}</Text>
        <Text style={s.muted}>{player.score} pts · {wonCount(game, player)}/{game.categories.length} catégories</Text>
        <Progress game={game} player={game.current} />
        <Text style={s.label}>Choisis une catégorie</Text>
        <View style={s.grid}>
          {open.map((k) => {
            const c = catInfo(k);
            return (
              <Pressable key={k} onPress={() => pickCategory(k)} style={[s.cat, s.catBig, { borderColor: c.color }]}>
                <Text style={s.catTxt}>{c.emoji} {c.label}</Text>
                <Text style={s.catSub}>{progressOf(player, k)}/{CATEGORY_TARGET}</Text>
              </Pressable>
            );
          })}
        </View>
        {game.players.length > 1 && (
          <View style={s.card}>
            {game.players.map((p, i) => <Text key={i} style={[s.text, i === game.current && s.bold]}>{p.name} — {p.score} pts · {wonCount(game, p)}/{game.categories.length}</Text>)}
          </View>
        )}
        <Btn kind="ghost" label="Abandonner la partie" onPress={restart} />
      </>
    );
  } else if (step === 'difficulty') {
    const c = catInfo(cat);
    content = (
      <>
        <Text style={[s.pill, { backgroundColor: c.color, alignSelf: 'center' }]}>{c.emoji} {c.label}</Text>
        <Text style={s.label}>Quelle difficulté ?</Text>
        {DIFFICULTIES.map((d) => (
          <Pressable key={d.key} onPress={() => pickDifficulty(d.key)} style={[s.diff, { borderColor: d.color }]}>
            <Text style={[s.diffTitle, { color: d.color }]}>{d.label} · {d.pts} pt{d.pts > 1 ? 's' : ''}</Text>
            <Text style={s.muted}>{d.desc}</Text>
          </Pressable>
        ))}
        <Btn kind="ghost" label="← Changer de catégorie" onPress={() => setStep('category')} />
      </>
    );
  } else if (cur && step === 'preq') {
    content = (
      <View style={s.card}>
        <Pill cat={catInfo(cur.cat)} diff={cur.diff} />
        <Text style={s.q}>{cur.question.q}</Text>
        <Btn label="⚡ Répondre à l'aveugle — juste = points doublés (+ tu rejoues) !" onPress={() => setStep('blind')} />
        <Btn kind="ghost" label="👁️ Voir les 4 propositions" onPress={() => setStep('question')} />
      </View>
    );
  } else if (cur && step === 'blind') {
    content = (
      <View style={s.card}>
        <Pill cat={catInfo(cur.cat)} diff={cur.diff} />
        <Text style={s.q}>{cur.question.q}</Text>
        <Text style={s.label}>Ta réponse</Text>
        <TextInput value={cur.input} onChangeText={(v) => setCur({ ...cur, input: v })} placeholder="Tape ta réponse…" placeholderTextColor="#8b93a7"
          style={s.input} autoFocus autoCorrect={false} onSubmitEditing={submitBlind} accessibilityLabel="Ta réponse" />
        <Btn label="Valider" disabled={!cur.input.trim()} onPress={submitBlind} />
        <Btn kind="ghost" label="Finalement, voir les propositions" onPress={() => setStep('question')} />
      </View>
    );
  } else if (cur && (step === 'question' || step === 'result')) {
    const q = cur.question;
    const result = step === 'result';
    const d = diffInfo(cur.diff);
    const gain = cur.blind ? d.pts * 2 : d.pts;
    const bar = cur.blind ? d.step : stepGain(cur.diff, cur.hint);
    content = (
      <View style={s.card}>
        <Pill cat={catInfo(cur.cat)} diff={cur.diff} />
        <Text style={s.q}>{q.q}</Text>
        {cur.blind ? (
          result && <Text style={s.muted}>Ta réponse : {cur.input}</Text>
        ) : (
          q.choices.map((choice, i) => {
            const out = cur.eliminated.includes(i);
            const right = result && i === q.correct;
            const wrong = result && i === cur.chosen && !cur.correct;
            return (
              <Pressable key={i} accessibilityRole="button" disabled={result || out} onPress={() => answer(i)}
                style={[s.choice, right && s.right, wrong && s.wrong, out && s.out]}>
                <Text style={[s.choiceTxt, out && s.outTxt]}>{choice}{out ? ' ❌' : ''}</Text>
              </Pressable>
            );
          })
        )}
        {!result && !cur.hint && (
          <View style={s.hints}>
            <Btn kind="ghost" label="🔎 Indice (−1 réponse · gratuit)" onPress={() => useHint('one')} />
            <Btn kind="ghost" label="🎯 50/50 (−2 réponses · −1 barre)" onPress={() => useHint('5050')} />
          </View>
        )}
        {!result && !!cur.hint && <Text style={s.muted}>{cur.hint === 'one' ? '🔎 Indice utilisé' : `🎯 50/50 utilisé — cette question ne rapportera que ${bar}/${CATEGORY_TARGET}`}</Text>}
        {result && (
          <>
            <Text style={[s.verdict, cur.correct ? s.ok : s.ko]}>{cur.correct ? (cur.blind ? "✓ Bonne réponse à l'aveugle !" : '✓ Bonne réponse !') : '✗ Mauvaise réponse'}</Text>
            {(cur.blind || !cur.correct) && <Text style={s.text}>La bonne réponse était : {q.choices[q.correct]}</Text>}
            <Text style={cur.correct ? s.text : s.ko}>
              {cur.correct ? `+${bar}/${CATEGORY_TARGET} sur la catégorie · +${gain} pt${gain > 1 ? 's' : ''}${cur.blind ? ' (doublés) · tu rejoues !' : ''}` : `−${d.pts} pt${d.pts > 1 ? 's' : ''}`}
            </Text>
            {!!q.info && (showInfo
              ? <Text style={s.info}>💡 {q.info}</Text>
              : <Pressable onPress={() => setShowInfo(true)}><Text style={s.link}>ℹ️ En savoir plus</Text></Pressable>)}
            <Btn label="Continuer" onPress={next} />
          </>
        )}
      </View>
    );
  } else if (game && player && step === 'victory') {
    const solo = game.players.length === 1;
    content = (
      <View style={[s.card, { alignItems: 'center' }]}>
        <Text style={s.title}>{solo ? `🎉 Défi terminé, ${player.name} !` : `🏆 ${player.name} gagne !`}</Text>
        <Text style={s.muted}>{solo ? 'Toutes les catégories ont été complétées' : 'Toutes les catégories ont été remportées'}</Text>
        <Text style={s.big}>{player.score} <Text style={s.muted}>points</Text></Text>
        <Progress game={game} player={game.current} />
        {best && <Text style={s.record}>{newRecord ? `🥇 Nouveau record ! ${best.score} pts` : `🏆 Record actuel : ${best.score} pts (${best.name})`}</Text>}
        <Btn label="Rejouer" onPress={restart} />
        <Btn kind="ghost" label="← Liste des jeux" onPress={onHome} />
      </View>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <StatusBar style="light" />
      {header}
      <ScrollView contentContainerStyle={s.body}>{content}</ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#12141c' },
  body: { padding: 16, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  topBtn: { padding: 8 },
  topTxt: { color: '#d4af37', fontWeight: '800', fontSize: 15 },
  topTitle: { color: '#ece7db', fontWeight: '800', fontSize: 16 },
  title: { color: '#d4af37', fontSize: 28, fontWeight: '900', textAlign: 'center' },
  heading: { color: '#d4af37', fontSize: 16, fontWeight: '800' },
  muted: { color: '#8b93a7', fontSize: 14, textAlign: 'center' },
  text: { color: '#ece7db', fontSize: 15 },
  bold: { fontWeight: '900', color: '#d4af37' },
  label: { color: '#ece7db', fontSize: 15, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  record: { color: '#d4af37', fontWeight: '800', textAlign: 'center' },
  card: { backgroundColor: '#1a1e2a', borderRadius: 14, padding: 16, gap: 10 },
  row: { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' },
  chip: { minWidth: 44, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#21273a', alignItems: 'center' },
  chipWide: { paddingHorizontal: 18 },
  chipOn: { backgroundColor: '#d4af37' },
  chipTxt: { color: '#ece7db', fontWeight: '800', fontSize: 16 },
  chipTxtOn: { color: '#12141c' },
  count: { color: '#ece7db', fontWeight: '800', fontSize: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  swatch: { width: 14, height: 36, borderRadius: 7 },
  input: { flex: 1, backgroundColor: '#21273a', color: '#ece7db', borderRadius: 10, padding: 12, fontSize: 16, fontWeight: '600' },
  btn: { backgroundColor: '#d4af37', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#8b93a7' },
  btnTxt: { color: '#12141c', fontWeight: '800', fontSize: 15, textAlign: 'center' },
  btnGhostTxt: { color: '#ece7db' },
  off: { opacity: 0.4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  cat: { borderWidth: 2, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 },
  catBig: { paddingVertical: 14, paddingHorizontal: 14, alignItems: 'center' },
  catTxt: { color: '#ece7db', fontWeight: '700', fontSize: 14 },
  catSub: { color: '#8b93a7', fontSize: 12, fontWeight: '700' },
  turn: { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  dots: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  dot: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dotTxt: { fontSize: 15 },
  pills: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: { color: '#fff', fontWeight: '800', fontSize: 13, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, overflow: 'hidden' },
  q: { color: '#ece7db', fontSize: 19, fontWeight: '700', lineHeight: 26 },
  diff: { borderWidth: 2, borderRadius: 12, padding: 16, gap: 4, backgroundColor: '#1a1e2a' },
  diffTitle: { fontSize: 18, fontWeight: '900' },
  choice: { backgroundColor: '#21273a', borderRadius: 10, padding: 14, borderWidth: 2, borderColor: 'transparent' },
  choiceTxt: { color: '#ece7db', fontSize: 16, fontWeight: '600' },
  right: { borderColor: '#5aab63', backgroundColor: '#1d3a26' },
  wrong: { borderColor: '#d9534f', backgroundColor: '#3a1e1e' },
  out: { opacity: 0.4 },
  outTxt: { textDecorationLine: 'line-through' },
  hints: { gap: 8 },
  verdict: { fontSize: 18, fontWeight: '900' },
  ok: { color: '#5aab63' },
  ko: { color: '#d9534f', fontWeight: '700' },
  info: { color: '#ece7db', backgroundColor: '#21273a', borderRadius: 10, padding: 12, lineHeight: 21 },
  link: { color: '#d4af37', textDecorationLine: 'underline', fontWeight: '700' },
  big: { color: '#ece7db', fontSize: 48, fontWeight: '900' },
});
