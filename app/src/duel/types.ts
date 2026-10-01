export type DiffKey = 'facile' | 'difficile';

export type Category = { key: string; label: string; emoji: string; color: string };

export type Question = {
  diff: DiffKey;
  q: string;
  choices: string[];
  /** Index de la bonne réponse dans `choices`. */
  correct: number;
  info?: string;
  /** Autres formulations acceptées en réponse « à l'aveugle ». */
  alt?: string[];
};

export type DuelPlayer = { name: string; score: number; progress: Record<string, number> };

export type HintKind = 'one' | '5050';

export type DuelGame = {
  players: DuelPlayer[];
  current: number;
  categories: string[];
  /** Questions déjà vues, par « catégorie|difficulté » (anti-répétition, gardé d'une partie à l'autre). */
  seen: Record<string, number[]>;
};
