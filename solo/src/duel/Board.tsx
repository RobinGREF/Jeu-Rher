import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { catInfo, CATEGORY_TARGET, diffInfo, DIFFICULTIES, isCatDone, progressOf, stepGain, TURN_COLORS, wonCount } from './engine';
import type { Action, Flow } from './flow';
import { Btn, Pill, s } from './ui';
import { Wheel } from './Wheel';

/**
 * Le jeu lui-même : affiche l'état du tour et envoie les actions du joueur.
 * `canAct` est faux pour qui regarde jouer un autre (en ligne) : mêmes écrans, sans les boutons.
 */
/**
 * Une rosace par joueur, avec son nom, son score et ses catégories gagnées : le joueur courant est entouré à sa couleur.
 * À partir de trois joueurs, deux cartes restent visibles côte à côte et les autres défilent sur le côté
 * (la liste se cale d'elle-même sur le joueur dont c'est le tour).
 */
function Scores({ game }: { game: Flow['game'] }) {
  const n = game.players.length;
  const scrolls = n > 2;
  const gap = 8;
  const [width, setWidth] = useState(0);
  const ref = useRef<ScrollView>(null);
  const cardW = width > 0 ? (width - gap) / 2 : 150;
  useEffect(() => {
    if (scrolls && width > 0) ref.current?.scrollTo({ x: game.current * (cardW + gap), animated: true });
  }, [scrolls, game.current, width, cardW]);

  const card = (i: number) => {
    const p = game.players[i];
    const color = TURN_COLORS[i % TURN_COLORS.length];
    const now = i === game.current;
    return (
      <View key={i} style={[s.pcard, n === 2 && s.pcardHalf, scrolls && { width: cardW }, now && { borderColor: color }]}
        accessibilityLabel={`${p.name} : ${p.score} points, ${wonCount(game, p)} catégories sur ${game.categories.length}`}>
        <Text style={[s.pname, { color }]} numberOfLines={1}>{now ? '▶ ' : ''}{p.name}</Text>
        <Wheel game={game} player={i} size={n > 1 ? 120 : 150} />
        <Text style={s.pscore}>{p.score} pts · {wonCount(game, p)}/{game.categories.length}</Text>
      </View>
    );
  };

  if (!scrolls) return <View style={s.players}>{game.players.map((_, i) => card(i))}</View>;
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator snapToInterval={cardW + gap} decelerationRate="fast" contentContainerStyle={{ gap }}>
        {game.players.map((_, i) => card(i))}
      </ScrollView>
      <Text style={[s.muted, { marginTop: 6 }]}>◀ {n} joueurs : fais glisser pour voir les autres ▶</Text>
    </View>
  );
}

function BoardInner({ flow, canAct, act, record, newRecord, onAgain, onHome }: {
  flow: Flow; canAct: boolean; act: (a: Action) => void;
  record?: string | null; newRecord?: boolean; onAgain?: () => void; onHome: () => void;
}) {
  const { game, step, turn } = flow;
  const player = game.players[game.current];
  const [showInfo, setShowInfo] = useState(false);
  const [input, setInput] = useState('');
  const qText = turn?.question?.q;
  useEffect(() => { setShowInfo(false); setInput(''); }, [qText]);

  const submitBlind = () => {
    if (!input.trim()) return;
    act({ t: 'blindText', text: input });
    act({ t: 'blind' });
    setInput('');
  };
  if (step === 'victory') {
    const solo = game.players.length === 1;
    return (
      <View style={[s.card, s.center]}>
        <Text style={s.title}>{solo ? `🎉 Défi terminé, ${player.name} !` : `🏆 ${player.name} gagne !`}</Text>
        <Text style={s.muted}>{solo ? 'Toutes les catégories ont été complétées' : 'Toutes les catégories ont été remportées'}</Text>
        <Text style={s.big}>{player.score} <Text style={s.muted}>points</Text></Text>
        <Wheel game={game} player={game.current} />
        {!!record && <Text style={s.record}>{newRecord ? `🥇 Nouveau record ! ${record}` : `🏆 ${record}`}</Text>}
        {game.players.length > 1 && game.players.map((p, i) => <Text key={i} style={s.text}>{p.name} — {p.score} pts · {wonCount(game, p)}/{game.categories.length}</Text>)}
        {onAgain && <Btn label="Rejouer" onPress={onAgain} />}
        <Btn kind="ghost" label="← Liste des jeux" onPress={onHome} />
      </View>
    );
  }

  if (step === 'category' || !turn) {
    const open = game.categories.filter((k) => !isCatDone(player, k));
    return (
      <>
        <Scores game={game} />
        <Text style={s.label}>{canAct ? 'Choisis une catégorie' : 'Catégories à remplir'}</Text>
        <View style={s.grid}>
          {open.map((k) => {
            const c = catInfo(k);
            return (
              <Pressable key={k} disabled={!canAct} onPress={() => act({ t: 'cat', cat: k })} style={[s.cat, s.catBig, { borderColor: c.color }, !canAct && s.off]}>
                <Text style={s.catTxt}>{c.emoji} {c.label}</Text>
                <Text style={s.catSub}>{progressOf(player, k)}/{CATEGORY_TARGET}</Text>
              </Pressable>
            );
          })}
        </View>
      </>
    );
  }

  if (step === 'difficulty') {
    const c = catInfo(turn.cat);
    return (
      <>
        <Text style={[s.pill, { backgroundColor: c.color, alignSelf: 'center' }]}>{c.emoji} {c.label}</Text>
        <Text style={s.label}>Quelle difficulté ?</Text>
        {DIFFICULTIES.map((d) => (
          <Pressable key={d.key} disabled={!canAct} onPress={() => act({ t: 'diff', diff: d.key })} style={[s.diff, { borderColor: d.color }, !canAct && s.off]}>
            <Text style={[s.diffTitle, { color: d.color }]}>{d.label} · {d.pts} pt{d.pts > 1 ? 's' : ''}</Text>
            <Text style={s.muted}>{d.desc}</Text>
          </Pressable>
        ))}
        {canAct && <Btn kind="ghost" label="← Changer de catégorie" onPress={() => act({ t: 'back' })} />}
      </>
    );
  }

  const q = turn.question!;
  const d = diffInfo(turn.diff!);
  const head = <><Pill cat={turn.cat} diff={turn.diff} /><Text style={s.q}>{q.q}</Text></>;

  if (step === 'preq') {
    return (
      <View style={s.card}>
        {head}
        {canAct && <>
          <Btn label="⚡ Répondre à l'aveugle — juste = points doublés (+ tu rejoues) !" onPress={() => act({ t: 'blindMode' })} />
          <Btn kind="ghost" label="👁️ Voir les 4 propositions" onPress={() => act({ t: 'reveal' })} />
        </>}
      </View>
    );
  }

  if (step === 'blind') {
    return (
      <View style={s.card}>
        {head}
        {canAct && <>
          <Text style={s.label}>Ta réponse</Text>
          <TextInput value={input} onChangeText={setInput} placeholder="Tape ta réponse…" placeholderTextColor="#8b93a7" style={s.input}
            autoFocus autoCorrect={false} onSubmitEditing={submitBlind} accessibilityLabel="Ta réponse" />
          <Btn label="Valider" disabled={!input.trim()} onPress={submitBlind} />
          <Btn kind="ghost" label="Finalement, voir les propositions" onPress={() => act({ t: 'reveal' })} />
        </>}
      </View>
    );
  }

  // question ou résultat
  const result = step === 'result';
  const gain = turn.blind ? d.pts * 2 : d.pts;
  const bar = turn.blind ? d.step : stepGain(turn.diff!, turn.hint);
  return (
    <View style={s.card}>
      {head}
      {turn.blind ? (
        result && <Text style={s.muted}>Réponse tapée : {turn.input}</Text>
      ) : (
        q.choices.map((choice, i) => {
          const out = turn.eliminated.includes(i);
          const right = result && i === q.correct;
          const wrong = result && i === turn.chosen && !turn.correct;
          return (
            <Pressable key={i} accessibilityRole="button" disabled={result || out || !canAct} onPress={() => act({ t: 'answer', i })}
              style={[s.choice, right && s.right, wrong && s.wrong, out && s.out]}>
              <Text style={[s.choiceTxt, out && s.outTxt]}>{choice}{out ? ' ❌' : ''}</Text>
            </Pressable>
          );
        })
      )}
      {!result && !turn.hint && canAct && (
        <View style={s.hints}>
          <Btn kind="ghost" label="🔎 Indice (−1 réponse · gratuit)" onPress={() => act({ t: 'hint', kind: 'one' })} />
          <Btn kind="ghost" label="🎯 50/50 (−2 réponses · −1 barre)" onPress={() => act({ t: 'hint', kind: '5050' })} />
        </View>
      )}
      {!result && !!turn.hint && <Text style={s.muted}>{turn.hint === 'one' ? '🔎 Indice utilisé' : `🎯 50/50 utilisé — cette question ne rapportera que ${bar}/${CATEGORY_TARGET}`}</Text>}
      {result && (
        <>
          <Text style={[s.verdict, turn.correct ? s.ok : s.ko]}>{turn.correct ? (turn.blind ? "✓ Bonne réponse à l'aveugle !" : '✓ Bonne réponse !') : '✗ Mauvaise réponse'}</Text>
          {(turn.blind || !turn.correct) && <Text style={s.text}>La bonne réponse était : {q.choices[q.correct]}</Text>}
          <Text style={turn.correct ? s.text : s.ko}>
            {turn.correct ? `+${bar}/${CATEGORY_TARGET} sur la catégorie · +${gain} pt${gain > 1 ? 's' : ''}${turn.blind ? ' (doublés) · ' + (canAct ? 'tu rejoues' : 'il rejoue') + ' !' : ''}` : `−${d.pts} pt${d.pts > 1 ? 's' : ''}`}
          </Text>
          {!!q.info && (showInfo
            ? <Text style={s.info}>💡 {q.info}</Text>
            : <Pressable onPress={() => setShowInfo(true)}><Text style={s.link}>ℹ️ En savoir plus</Text></Pressable>)}
          {canAct && <Btn label="Continuer" onPress={() => { setShowInfo(false); act({ t: 'next' }); }} />}
        </>
      )}
    </View>
  );
}

/**
 * Dit toujours à qui c'est de jouer : bandeau collé en haut de l'écran (même en faisant défiler), à la couleur du joueur.
 * Celui qui doit jouer le lit à la deuxième personne ; les autres voient qui joue.
 */
export function Board(props: Parameters<typeof BoardInner>[0]) {
  const { flow, canAct } = props;
  const { game, step } = flow;
  const player = game.players[game.current];
  const color = TURN_COLORS[game.current % TURN_COLORS.length];
  return (
    <>
      {step !== 'victory' && (
        <View style={[s.turnBar, { borderColor: color }]} accessibilityLiveRegion="polite">
          <View style={[s.turnDot, { backgroundColor: color }]} />
          <Text style={[s.turnBarTxt, { color }]}>
            {canAct ? `${player.name}, c'est à toi de jouer` : `👀 ${player.name} joue…`}
          </Text>
        </View>
      )}
      <BoardInner {...props} />
    </>
  );
}
