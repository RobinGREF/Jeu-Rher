import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, Pressable, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { loadJson, removeKey, saveJson } from '../storage';
import { Board } from './Board';
import { CatPicker } from './CatPicker';
import { MAX_PLAYERS, newDuel, TURN_COLORS } from './engine';
import { reduce, startFlow, type Action, type Flow } from './flow';
import { CATEGORIES, QUESTIONS } from './questions';
import { useDuelOnline } from './online/useDuelOnline';
import { normalizeCode } from './online/session';
import { Btn, s } from './ui';
import type { DuelGame as Game } from './types';

const QUESTION_COUNT = Object.values(QUESTIONS).reduce((n, l) => n + l.length, 0);
const KEY_SAVE = 'duel-save';
const KEY_SEEN = 'duel-seen';
const KEY_BEST = 'duel-best';
const KEY_NAMES = 'duel-names';
const KEY_NAME = 'duel-name';

type Best = { score: number; name: string };
type Screen = 'menu' | 'cats' | 'local' | 'online';

const RULES: [string, string[]][] = [
  ['🎯 Le principe', ['Chaque catégorie a une jauge à remplir (la rosace). Le premier joueur qui a rempli toutes les catégories de la partie gagne.']],
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
  ['🌐 En ligne', ['Un joueur crée un salon et donne son code à 4 lettres : chacun joue sur son téléphone, à son tour. Les autres voient la question et la rosace en direct.']],
];

/** Record du meilleur score, mis à jour une seule fois à la fin d'une partie. */
function useRecord(flow: Flow | null) {
  const [best, setBest] = useState<Best | null>(() => loadJson<Best | null>(KEY_BEST, null));
  const [isNew, setIsNew] = useState(false);
  const victory = flow?.step === 'victory';
  const winner = victory ? flow!.game.players[flow!.game.current] : null;
  useEffect(() => {
    if (!winner) { setIsNew(false); return; }
    const prev = loadJson<Best | null>(KEY_BEST, null);
    if (!prev || winner.score > prev.score) {
      const b = { score: winner.score, name: winner.name };
      saveJson(KEY_BEST, b); setBest(b); setIsNew(true);
    } else { setBest(prev); setIsNew(false); }
  }, [winner?.name, winner?.score, victory]); // eslint-disable-line react-hooks/exhaustive-deps
  const text = best ? (isNew ? `${best.score} pts` : `Record actuel : ${best.score} pts (${best.name})`) : null;
  return { best, text, isNew };
}

function Shell({ onHome, onRules, children }: { onHome: () => void; onRules: () => void; children: React.ReactNode }) {
  return (
    <SafeAreaView style={s.root}>
      <StatusBar style="light" />
      <View style={s.top}>
        <Pressable onPress={onHome} style={s.topBtn} accessibilityLabel="Retour à la liste des jeux"><Text style={s.topTxt}>← Jeux</Text></Pressable>
        <Text style={s.topTitle}>Duel de Savoir</Text>
        <Pressable onPress={onRules} style={s.topBtn} accessibilityLabel="Règles"><Text style={[s.topTxt, { textAlign: 'right' }]}>📖</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={s.body}>{children}</ScrollView>
    </SafeAreaView>
  );
}

export function DuelGame({ onHome }: { onHome: () => void }) {
  const saved = useMemo(() => loadJson<{ game: Game } | null>(KEY_SAVE, null), []);
  const [screen, setScreen] = useState<Screen>('menu');
  const [flow, setFlow] = useState<Flow | null>(null);
  const [count, setCount] = useState(2);
  const [names, setNames] = useState<string[]>(() => {
    const n = loadJson<string[]>(KEY_NAMES, []);
    return Array.from({ length: MAX_PLAYERS }, (_, i) => n[i] || `Joueur ${i + 1}`);
  });
  const [rules, setRules] = useState(false);
  const rec = useRecord(flow);
  const onl = useDuelOnline();

  // Partie sur cet appareil : sauvegardée après chaque tour, et les questions déjà vues sont retenues.
  useEffect(() => {
    if (screen !== 'local' || !flow) return;
    saveJson(KEY_SEEN, flow.game.seen);
    if (flow.step === 'victory') removeKey(KEY_SAVE);
    else if (flow.step === 'category') saveJson(KEY_SAVE, { game: flow.game });
  }, [screen, flow]);

  const act = (a: Action) => setFlow((f) => (f ? reduce(f, a) : f));
  const seen = () => loadJson<Record<string, number[]>>(KEY_SEEN, {});
  const quitLocal = () => { removeKey(KEY_SAVE); setFlow(null); setScreen('menu'); };

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

  const shell = (children: React.ReactNode) => <Shell onHome={onHome} onRules={() => setRules(true)}>{children}</Shell>;

  if (screen === 'cats') {
    return shell(<CatPicker names={names.slice(0, count)} onDone={(cats) => {
      saveJson(KEY_NAMES, names.slice(0, count));
      setFlow(startFlow(newDuel(names.slice(0, count), cats, seen())));
      setScreen('local');
    }} />);
  }

  if (screen === 'local' && flow) {
    return shell(<Board flow={flow} canAct act={act} record={rec.text} newRecord={rec.isNew} onAgain={quitLocal} onHome={onHome} />);
  }

  if (screen === 'online') {
    return shell(<Online onl={onl} onBack={() => { onl.leave(); setScreen('menu'); }} onHome={onHome} />);
  }

  return shell(
    <>
      <Text style={s.title}>Duel de Savoir</Text>
      <Text style={s.muted}>Quiz à choix multiples, de 1 à 6 joueurs : sur un seul appareil, ou chacun sur son téléphone.</Text>
      {saved && (
        <Btn label={`▶ Reprendre la partie (${saved.game.players.map((p) => p.name).join(', ')})`}
          onPress={() => { setFlow(startFlow(saved.game)); setCount(saved.game.players.length); setScreen('local'); }} />
      )}
      {rec.best && <Text style={s.record}>🏆 Record : {rec.best.score} pts ({rec.best.name})</Text>}
      <Btn label="🌐 Jouer en ligne avec des amis" onPress={() => setScreen('online')} />
      <Text style={s.label}>Ou sur cet appareil : nombre de joueurs</Text>
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
      <Btn kind="ghost" label="Choisir les catégories" onPress={() => setScreen('cats')} />
    </>,
  );
}

/** Partie en ligne : créer ou rejoindre un salon, attendre les joueurs, jouer. */
function Online({ onl, onBack, onHome }: { onl: ReturnType<typeof useDuelOnline>; onBack: () => void; onHome: () => void }) {
  const [name, setName] = useState(() => loadJson<string>(KEY_NAME, ''));
  const [code, setCode] = useState('');
  const [pick, setPick] = useState(false); // l'hôte choisit les catégories
  const snap = onl.snap;
  const rec = useRecord(snap?.view?.flow ?? null);
  const hostSeen = snap?.isHost ? snap.view?.flow.game.seen : undefined;
  useEffect(() => { if (hostSeen) saveJson(KEY_SEEN, hostSeen); }, [hostSeen]);
  const remember = (v: string) => { setName(v); saveJson(KEY_NAME, v); };

  if (!onl.kind) {
    return (
      <>
        <Text style={s.title}>🌐 En ligne</Text>
        <Text style={s.err}>Le mode en ligne n'est pas configuré sur cette version (voir docs/en-ligne.md).</Text>
        <Btn kind="ghost" label="← Retour" onPress={onBack} />
      </>
    );
  }

  if (!snap) {
    return (
      <>
        <Text style={s.title}>🌐 En ligne</Text>
        <Text style={s.label}>Ton prénom</Text>
        <TextInput value={name} onChangeText={remember} placeholder="Robin" placeholderTextColor="#8b93a7" maxLength={14} style={s.input} accessibilityLabel="Ton prénom" />
        <Btn label="Créer une partie" disabled={onl.busy} onPress={() => onl.create(name)} />
        <View style={s.row}>
          <TextInput value={code} onChangeText={(v) => setCode(normalizeCode(v))} placeholder="CODE" placeholderTextColor="#8b93a7" autoCapitalize="characters"
            maxLength={4} style={[s.input, s.codeInput]} accessibilityLabel="Code du salon" />
          <Btn kind="ghost" label="Rejoindre" disabled={onl.busy || code.length !== 4} onPress={() => onl.join(code, name)} />
        </View>
        {!!onl.error && <Text style={s.err}>{onl.error}</Text>}
        {onl.kind === 'local' && <Text style={s.muted}>Test local : les autres joueurs sont les autres onglets de ce navigateur.</Text>}
        <Btn kind="ghost" label="← Retour" onPress={onBack} />
      </>
    );
  }

  if (snap.phase === 'error') {
    return (
      <>
        <Text style={s.title}>🌐 En ligne</Text>
        <Text style={s.err}>{snap.error}</Text>
        <Btn label="← Retour" onPress={onBack} />
      </>
    );
  }

  if (snap.phase === 'playing' && snap.view) {
    const { flow } = snap.view;
    const mine = snap.mySeat >= 0 && snap.mySeat === flow.game.current;
    const spectator = snap.mySeat < 0;
    return (
      <>
        {spectator && <View style={s.watch}><Text style={s.watchTxt}>👀 Tu regardes la partie</Text></View>}
        <Board flow={flow} canAct={mine} act={(a) => { void onl.session.current?.act(a); }} record={rec.text} newRecord={rec.isNew} onHome={onHome}
          onAgain={snap.isHost && flow.step === 'victory' ? onBack : undefined} />
        <Btn kind="ghost" label="Quitter la partie" onPress={onBack} />
      </>
    );
  }

  if (snap.phase === 'lobby' && snap.isHost && pick) {
    return <CatPicker names={snap.players.map((p) => p.name)} onDone={(cats) => { void onl.session.current?.start(cats, loadJson<Record<string, number[]>>(KEY_SEEN, {})); }} />;
  }

  // Salon : le code à donner, les joueurs présents
  return (
    <>
      <Text style={s.label}>Code du salon</Text>
      <Text style={s.code} accessibilityLabel={`Code du salon ${snap.code}`}>{snap.code}</Text>
      <Text style={s.muted}>Donne ce code aux autres : ils le tapent dans « Rejoindre ».</Text>
      <View style={s.card}>
        {snap.players.map((p, i) => <Text key={p.uid} style={s.text}>{i === 0 ? '👑 ' : '• '}{p.name}{p.uid === snap.uid ? ' (toi)' : ''}</Text>)}
      </View>
      {snap.isHost ? (
        <Btn label={snap.players.length > 1 ? `Choisir les catégories et lancer (${snap.players.length} joueurs)` : 'Choisir les catégories (seul pour le moment)'} onPress={() => setPick(true)} />
      ) : <Text style={s.muted}>En attente du lancement par l'hôte…</Text>}
      <Btn kind="ghost" label="Quitter le salon" onPress={onBack} />
    </>
  );
}
