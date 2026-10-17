import type { Rng } from './engine';
import { wordsFor } from './words';

/** Prénoms des machines (les mêmes que dans 50 Missions). */
export const BOT_NAMES = ['Jack', 'Anne', 'Morgan', 'Mary', 'Bonny', 'Rackham', 'Teach'];

/** Probabilité qu'une machine trouve un mot pour une catégorie (quand la réserve en contient un pour la lettre). */
export const BOT_SUCCESS = 0.8;

/** Réponses d'une machine : pour chaque catégorie, un mot de sa réserve commençant par la lettre, parfois rien. */
export function botAnswers(letter: string, categories: string[], rng: Rng = Math.random): Record<string, string> {
  const out: Record<string, string> = {};
  for (const cat of categories) {
    const pool = wordsFor(cat, letter);
    out[cat] = pool.length && rng() < BOT_SUCCESS ? pool[Math.floor(rng() * pool.length)] : '';
  }
  return out;
}
