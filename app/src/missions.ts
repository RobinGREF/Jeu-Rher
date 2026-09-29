import { SYMBOLS } from './symbols';
import type { Card } from './types';

export type MissionDef = {
  id: string;
  /** Texte imprimé sur le bord de la carte Mission. */
  label: string;
  /** Reçoit les 4 cartes du dessus des tas, dans l'ordre d'affichage (gauche → droite). */
  check: (tops: Card[]) => boolean;
  placeholder?: boolean;
};

const JUM = 0, BOU = 1, BRI = 2, COU = 3;
const N = (s: number) => SYMBOLS[s].name;

const count = (t: Card[], s: number) => t.filter((c) => c.symbol === s).length;
const sumOf = (t: Card[], s: number) => t.filter((c) => c.symbol === s).reduce((a, c) => a + c.value, 0);
const total = (t: Card[]) => t.reduce((a, c) => a + c.value, 0);
const positions = (t: Card[], s: number) => t.flatMap((c, i) => (c.symbol === s ? [i] : []));
const distinct = (xs: number[]) => new Set(xs).size === xs.length;

/** Exactement 2 cartes du symbole, dont l'écart de position (1 = se touchent) satisfait `gap`. */
const twoWithGap = (s: number, gap: (d: number) => boolean) => (t: Card[]) => {
  const p = positions(t, s);
  return p.length === 2 && gap(p[1] - p[0]);
};

/** Les 50 cartes Mission, transcrites depuis le jeu. */
export function buildMissionDefs(): MissionDef[] {
  const defs: MissionDef[] = [];
  const add = (label: string, check: MissionDef['check']) => defs.push({ id: `m${defs.length + 1}`, label, check });

  for (const s of [JUM, BOU, BRI, COU]) {
    add(`Exactement 2 cartes sont des ${N(s)} et elles se touchent`, twoWithGap(s, (d) => d === 1));
    add(`Exactement 2 cartes sont des ${N(s)} et elles ne se touchent pas`, twoWithGap(s, (d) => d > 1));
    add(`Exactement 2 cartes sont des ${N(s)} et elles sont espacées d'une seule carte`, twoWithGap(s, (d) => d === 2));
    add(`Exactement 3 des 4 cartes sont des ${N(s)}`, (t) => count(t, s) === 3);
  }

  for (const [s, n] of [[BOU, 11], [BOU, 2], [JUM, 7], [JUM, 6], [BRI, 3], [BRI, 9], [COU, 4], [COU, 10]] as const)
    add(`La somme des ${N(s)} est égale à ${n}`, (t) => sumOf(t, s) === n);

  for (const n of [10, 15, 18, 20]) add(`La somme des 4 cartes est égale à ${n}`, (t) => total(t) === n);

  for (const [a, b] of [[BOU, JUM], [BRI, COU], [JUM, BRI], [COU, BOU]] as const)
    add(`La somme des ${N(a)} est égale à celle des ${N(b)} (au moins une carte de chaque)`, (t) =>
      count(t, a) > 0 && count(t, b) > 0 && sumOf(t, a) === sumOf(t, b));

  for (const [a, b] of [[COU, BOU], [BOU, JUM], [JUM, BRI], [BRI, COU]] as const)
    add(`La somme des ${N(a)} est le double de celle des ${N(b)} (au moins une carte de chaque)`, (t) =>
      count(t, a) > 0 && count(t, b) > 0 && sumOf(t, a) === 2 * sumOf(t, b));

  for (const [a, b] of [[COU, BRI], [JUM, BOU], [BRI, BOU], [JUM, COU]] as const)
    add(`Il n'y a que des cartes ${N(a)} et/ou ${N(b)}`, (t) => t.every((c) => c.symbol === a || c.symbol === b));

  add('Les valeurs des 3 cartes qui se touchent se suivent, forcément dans l\'ordre (ex: 3 4 5 ou 5 4 3)', (t) =>
    [0, 1].some((i) => {
      const [a, b, c] = [t[i].value, t[i + 1].value, t[i + 2].value];
      return (b === a + 1 && c === b + 1) || (b === a - 1 && c === b - 1);
    }));
  add('Les valeurs des 4 cartes se suivent, pas forcément dans l\'ordre (ex: 6 3 5 4)', (t) => {
    const v = t.map((c) => c.value);
    return distinct(v) && Math.max(...v) - Math.min(...v) === 3;
  });
  add('Chaque carte a une valeur différente (ex: 4, 7, 1 et 2)', (t) => distinct(t.map((c) => c.value)));
  add('Chaque carte a un symbole différent', (t) => distinct(t.map((c) => c.symbol)));
  add('Chaque carte a une valeur et un symbole différent', (t) => distinct(t.map((c) => c.value)) && distinct(t.map((c) => c.symbol)));
  add('Chaque carte a une valeur inférieure à 4', (t) => t.every((c) => c.value < 4));
  add('Chaque carte a une valeur supérieure à 4', (t) => t.every((c) => c.value > 4));
  add('Chaque carte a une valeur impaire', (t) => t.every((c) => c.value % 2 === 1));
  add('Chaque carte a une valeur paire', (t) => t.every((c) => c.value % 2 === 0));
  add('Exactement 2 cartes sont impaires et elles sont espacées d\'une seule carte', (t) => {
    const p = t.flatMap((c, i) => (c.value % 2 === 1 ? [i] : []));
    return p.length === 2 && p[1] - p[0] === 2;
  });

  return defs;
}
