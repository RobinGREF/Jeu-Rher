import { SYMBOLS } from './symbols';
import type { Card } from './types';

export type MissionDef = {
  id: string;
  label: string;
  /** Reçoit les 4 cartes du dessus des tas, dans l'ordre d'affichage. */
  check: (tops: Card[]) => boolean;
  /** true tant que la mission n'a pas été vérifiée sur la vraie carte. */
  placeholder?: boolean;
};

const N = (i: number) => SYMBOLS[i].name;
const count = (t: Card[], s: number) => t.filter((c) => c.symbol === s).length;
const sum = (t: Card[]) => t.reduce((a, c) => a + c.value, 0);
const pairs = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]] as const;
const idx = [0, 1, 2, 3];

/**
 * Missions construites à partir des 4 catégories décrites (valeurs/sommes, symboles,
 * alignement, quantités). Les seuils exacts et la liste réelle des 50 cartes restent
 * à confirmer avec les cartes Mission d'origine.
 */
export function buildMissionDefs(): MissionDef[] {
  const defs: Omit<MissionDef, 'placeholder'>[] = [];
  const add = (label: string, check: MissionDef['check']) => defs.push({ id: `m${defs.length + 1}`, label, check });

  // 1. Valeurs et sommes
  for (const n of [8, 10, 12, 14, 15, 16, 17, 18, 20, 22, 24]) add(`Somme des 4 cartes = ${n}`, (t) => sum(t) === n);
  add('Toutes les cartes ≤ 3', (t) => t.every((c) => c.value <= 3));
  add('Toutes les cartes > 4', (t) => t.every((c) => c.value > 4));
  add('Toutes les cartes impaires', (t) => t.every((c) => c.value % 2 === 1));
  add('Toutes les cartes paires', (t) => t.every((c) => c.value % 2 === 0));

  // 2. Symboles / couleurs
  for (const s of idx) add(`4 ${N(s)}`, (t) => count(t, s) === 4);
  for (const [a, b] of pairs) add(`Uniquement ${N(a)} et ${N(b)}`, (t) => t.every((c) => c.symbol === a || c.symbol === b));
  for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0]] as const)
    add(`Plus de ${N(a)} que de ${N(b)}`, (t) => count(t, a) > count(t, b));

  // 3. Alignement et position
  add('Deux cartes côte à côte de même symbole', (t) => t.some((c, i) => i > 0 && c.symbol === t[i - 1].symbol));
  add('Deux cartes côte à côte de même valeur', (t) => t.some((c, i) => i > 0 && c.value === t[i - 1].value));
  add('Symboles en alternance (A-B-A-B)', (t) => t[0].symbol === t[2].symbol && t[1].symbol === t[3].symbol && t[0].symbol !== t[1].symbol);
  add('Parité en alternance (pair-impair-pair-impair)', (t) => t.every((c, i) => i === 0 || c.value % 2 !== t[i - 1].value % 2));

  // 4. Quantités précises
  for (const s of idx) add(`Exactement 3 ${N(s)}`, (t) => count(t, s) === 3);
  for (const s of idx) add(`Exactement 2 ${N(s)}`, (t) => count(t, s) === 2);
  for (const s of idx) add(`Aucun ${N(s).replace(/s$/, '')} visible`, (t) => count(t, s) === 0);
  add('4 symboles différents', (t) => new Set(t.map((c) => c.symbol)).size === 4);
  add('4 valeurs différentes', (t) => new Set(t.map((c) => c.value)).size === 4);
  for (const [a, b] of [[0, 1], [2, 3], [0, 3]] as const)
    add(`Autant de ${N(a)} que de ${N(b)} (au moins 1)`, (t) => count(t, a) === count(t, b) && count(t, a) > 0);

  return defs.map((d) => ({ ...d, placeholder: true }));
}
