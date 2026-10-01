import { applyAnswer, drawQuestion, eliminate, isBlindCorrect, type Rng } from './engine';
import type { DiffKey, DuelGame, HintKind, Question } from './types';

/** Où en est le tour du joueur courant. */
export type Step = 'category' | 'difficulty' | 'preq' | 'blind' | 'question' | 'result' | 'victory';

export type Turn = {
  cat: string;
  diff: DiffKey | null;
  question: Question | null;
  hint: HintKind | null;
  eliminated: number[];
  blind: boolean;
  /** Proposition choisie (-1 : aucune, ou réponse à l'aveugle). */
  chosen: number;
  correct: boolean;
  input: string;
};

export type Flow = { game: DuelGame; step: Step; turn: Turn | null };

/** Tout ce que le joueur dont c'est le tour peut faire. */
export type Action =
  | { t: 'cat'; cat: string }
  | { t: 'diff'; diff: DiffKey }
  | { t: 'back' }
  | { t: 'reveal' }
  | { t: 'blindMode' }
  | { t: 'blindText'; text: string }
  | { t: 'blind' }
  | { t: 'hint'; kind: HintKind }
  | { t: 'answer'; i: number }
  | { t: 'next' };

export const startFlow = (game: DuelGame): Flow => ({ game, step: 'category', turn: null });

const blankTurn = (cat: string): Turn => ({ cat, diff: null, question: null, hint: null, eliminated: [], blind: false, chosen: -1, correct: false, input: '' });

/** Applique une action. Une action qui n'a pas de sens à cet endroit est ignorée (l'état revient tel quel). */
export function reduce(f: Flow, a: Action, rng: Rng = Math.random): Flow {
  const t = f.turn;
  switch (a.t) {
    case 'cat':
      if (f.step !== 'category' && f.step !== 'difficulty') return f;
      if (!f.game.categories.includes(a.cat)) return f;
      return { ...f, step: 'difficulty', turn: blankTurn(a.cat) };
    case 'back':
      return f.step === 'difficulty' ? { ...f, step: 'category', turn: null } : f;
    case 'diff': {
      if (f.step !== 'difficulty' || !t) return f;
      const d = drawQuestion(t.cat, a.diff, f.game.seen, rng);
      return { game: { ...f.game, seen: d.seen }, step: 'preq', turn: { ...t, diff: a.diff, question: d.question } };
    }
    case 'blindMode':
      return f.step === 'preq' && t ? { ...f, step: 'blind' } : f;
    case 'reveal':
      return (f.step === 'preq' || f.step === 'blind') && t ? { ...f, step: 'question' } : f;
    case 'blindText':
      return f.step === 'blind' && t ? { ...f, turn: { ...t, input: a.text.slice(0, 80) } } : f;
    case 'blind':
      if (f.step !== 'blind' || !t?.question || !t.input.trim()) return f;
      return { ...f, step: 'result', turn: { ...t, blind: true, chosen: -1, correct: isBlindCorrect(t.input, t.question) } };
    case 'hint':
      if (f.step !== 'question' || !t?.question || t.hint) return f;
      return { ...f, turn: { ...t, hint: a.kind, eliminated: eliminate(t.question, a.kind, rng) } };
    case 'answer':
      if (f.step !== 'question' || !t?.question || a.i < 0 || a.i >= t.question.choices.length || t.eliminated.includes(a.i)) return f;
      return { ...f, step: 'result', turn: { ...t, chosen: a.i, correct: a.i === t.question.correct } };
    case 'next': {
      if (f.step !== 'result' || !t?.question || !t.diff) return f;
      const out = applyAnswer(f.game, { correct: t.correct, cat: t.cat, diff: t.diff, hint: t.hint, blind: t.blind });
      if (out.won) return { game: { ...out.game, current: f.game.current }, step: 'victory', turn: null };
      return { game: out.game, step: 'category', turn: null };
    }
  }
}

/**
 * Ce que les autres joueurs ont le droit de voir : la bonne réponse et l'anecdote ne partent
 * qu'une fois la question jouée.
 */
export function publicFlow(f: Flow): Flow {
  const t = f.turn;
  if (!t?.question || f.step === 'result') return f;
  const { alt: _alt, info: _info, ...rest } = t.question;
  return { ...f, turn: { ...t, question: { ...rest, correct: -1 } } };
}
