import type { Card } from './types';

export type MissionDef = {
  id: string;
  label: string;
  /** Reçoit les 4 cartes du dessus des tas, dans l'ordre d'affichage. */
  check: (tops: Card[]) => boolean;
  /** true tant que la carte ne vient pas du vrai jeu. */
  placeholder?: boolean;
};

const allSame = (xs: number[]) => xs.every((x) => x === xs[0]);
const allDifferent = (xs: number[]) => new Set(xs).size === xs.length;

// TODO: remplacer par les 50 vraies missions (le PDF de règles ne les contient pas).
const SAMPLES: MissionDef[] = [
  { id: 's1', label: '4 symboles identiques', check: (t) => allSame(t.map((c) => c.symbol)) },
  { id: 's2', label: '4 symboles différents', check: (t) => allDifferent(t.map((c) => c.symbol)) },
  { id: 's3', label: '4 valeurs identiques', check: (t) => allSame(t.map((c) => c.value)) },
  { id: 's4', label: '4 valeurs différentes', check: (t) => allDifferent(t.map((c) => c.value)) },
  { id: 's5', label: 'Somme des valeurs = 16', check: (t) => t.reduce((s, c) => s + c.value, 0) === 16 },
  { id: 's6', label: 'Valeurs croissantes (gauche → droite)', check: (t) => t.every((c, i) => i === 0 || c.value > t[i - 1].value) },
  { id: 's7', label: '2 paires de valeurs', check: (t) => {
      const counts = Object.values(t.reduce<Record<number, number>>((m, c) => ((m[c.value] = (m[c.value] ?? 0) + 1), m), {}));
      return counts.length === 2 && counts.every((n) => n === 2);
    } },
  { id: 's8', label: '4 valeurs paires', check: (t) => t.every((c) => c.value % 2 === 0) },
  { id: 's9', label: '4 valeurs impaires', check: (t) => t.every((c) => c.value % 2 === 1) },
  { id: 's10', label: 'Au moins un 7 et un 1', check: (t) => t.some((c) => c.value === 7) && t.some((c) => c.value === 1) },
];

/** Renvoie 50 définitions de mission (les exemples sont répétés en attendant les vraies). */
export function buildMissionDefs(): MissionDef[] {
  return Array.from({ length: 50 }, (_, i) => {
    const s = SAMPLES[i % SAMPLES.length];
    return { ...s, id: `${s.id}-${i}`, placeholder: true };
  });
}
