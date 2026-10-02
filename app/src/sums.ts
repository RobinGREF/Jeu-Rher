import type { Card } from './types';

/** Somme des valeurs des 4 cartes du dessus, par famille (et au total) : les missions parlent souvent de sommes. */
export function sumsOf(cards: Card[]) {
  const per = [0, 1, 2, 3].map((i) => cards.filter((c) => c.symbol === i).reduce((a, c) => a + c.value, 0));
  return { per, total: per.reduce((a, b) => a + b, 0) };
}

