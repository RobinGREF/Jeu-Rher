/**
 * Petit bac : règles pures (aucun réseau, aucun temps) — tirage des lettres, normalisation des mots,
 * validité et calcul des points d'une manche. Le salon en ligne (session.ts) ne fait qu'orchestrer.
 */

export type Category = { key: string; label: string; emoji: string };

export const CATEGORIES: Category[] = [
  { key: 'prenom', label: 'Prénom', emoji: '🧑' },
  { key: 'pays', label: 'Pays', emoji: '🌍' },
  { key: 'ville', label: 'Ville', emoji: '🏙️' },
  { key: 'animal', label: 'Animal', emoji: '🐾' },
  { key: 'metier', label: 'Métier', emoji: '🧑‍🔧' },
  { key: 'fruitleg', label: 'Fruit ou légume', emoji: '🍎' },
  { key: 'objet', label: 'Objet', emoji: '🔧' },
  { key: 'marque', label: 'Marque', emoji: '🏷️' },
  { key: 'celebrite', label: 'Célébrité', emoji: '⭐' },
  { key: 'film', label: 'Film ou série', emoji: '🎬' },
  { key: 'sport', label: 'Sport', emoji: '⚽' },
  { key: 'vetement', label: 'Vêtement', emoji: '👕' },
  { key: 'plat', label: 'Plat ou boisson', emoji: '🍽️' },
  { key: 'matiere', label: 'Matière scolaire', emoji: '📚' },
];

/** Catégories d'une partie « classique ». */
export const DEFAULT_CATEGORIES = ['prenom', 'pays', 'animal', 'metier', 'fruitleg', 'objet'];
export const MIN_CATEGORIES = 3;
export const MAX_CATEGORIES = 10;
export const MAX_PLAYERS = 8;

/** Lettres tirées : on évite celles où presque rien n'existe (K, Q, U, W, X, Y, Z). */
export const LETTERS = 'ABCDEFGHIJLMNOPRSTV'.split('');

export type Rng = () => number;

/** Tire une lettre qui n'a pas encore servi dans la partie (quand toutes ont servi, on recommence). */
export function drawLetter(used: string[], rng: Rng = Math.random): string {
  const free = LETTERS.filter((l) => !used.includes(l));
  const pool = free.length ? free : LETTERS;
  return pool[Math.floor(rng() * pool.length)];
}

const ARTICLES = ['le', 'la', 'les', 'l', 'un', 'une', 'des', 'du', 'de', 'd'];

/** Minuscules, sans accents ni ponctuation, espaces simples. « L'Éléphant » → « l elephant ». */
export function fold(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Le mot sans article d'ouverture : « le chat » → « chat », « l'éléphant » → « elephant ». */
export function core(s: string): string {
  const words = fold(s).split(' ').filter(Boolean);
  while (words.length > 1 && ARTICLES.includes(words[0])) words.shift();
  return words.join(' ');
}

/** Le mot commence-t-il par la lettre (article d'ouverture ignoré) ? */
export function startsWithLetter(word: string, letter: string): boolean {
  const c = core(word);
  return c.length >= 2 && c[0] === fold(letter);
}

export type Status = 'vide' | 'faux' | 'conteste' | 'seul' | 'unique' | 'doublon';

export type Cell = { word: string; status: Status; pts: number };

export type Round = {
  letter: string;
  /** Réponses de chaque joueur (uid → catégorie → mot), publiées au moment du vote. */
  answers: Record<string, Record<string, string>>;
  /** Contestations : catégorie → uid de l'auteur → uids de ceux qui contestent le mot. */
  contests: Record<string, Record<string, string[]>>;
};

export const POINTS = { seul: 15, unique: 10, doublon: 5 } as const;

/** Une contestation l'emporte quand plus de la moitié des AUTRES joueurs humains (les machines ne votent pas) la portent. */
export function isContested(round: Round, cat: string, author: string, voters: string[]): boolean {
  const others = voters.filter((u) => u !== author);
  const n = (round.contests[cat]?.[author] ?? []).filter((u) => others.includes(u)).length;
  return others.length > 0 && n * 2 > others.length;
}

/**
 * Points de la manche. Pour chaque catégorie : un mot invalide (vide, mauvaise lettre, contesté) vaut 0 ;
 * parmi les mots valides, le même mot chez plusieurs joueurs vaut 5 chacun, un mot différent des autres 10,
 * et le seul mot valide de la catégorie 15. `humans` : les joueurs qui peuvent contester (par défaut tous).
 */
export function scoreRound(round: Round, uids: string[], categories: string[], humans: string[] = uids): { cells: Record<string, Record<string, Cell>>; totals: Record<string, number> } {
  const cells: Record<string, Record<string, Cell>> = {};
  const totals: Record<string, number> = Object.fromEntries(uids.map((u) => [u, 0]));
  for (const cat of categories) {
    const row: Record<string, Cell> = {};
    const valid: { uid: string; key: string }[] = [];
    for (const uid of uids) {
      const word = (round.answers[uid]?.[cat] ?? '').trim();
      if (!word) row[uid] = { word, status: 'vide', pts: 0 };
      else if (!startsWithLetter(word, round.letter)) row[uid] = { word, status: 'faux', pts: 0 };
      else if (isContested(round, cat, uid, humans)) row[uid] = { word, status: 'conteste', pts: 0 };
      else { row[uid] = { word, status: 'unique', pts: 0 }; valid.push({ uid, key: core(word) }); }
    }
    for (const v of valid) {
      const same = valid.filter((x) => x.key === v.key).length;
      const status: Status = same > 1 ? 'doublon' : valid.length === 1 ? 'seul' : 'unique';
      const pts = POINTS[status];
      row[v.uid] = { ...row[v.uid], status, pts };
      totals[v.uid] += pts;
    }
    cells[cat] = row;
  }
  return { cells, totals };
}

/** Classement : points décroissants, égalités partageant le même rang (1, 1, 3…). */
export function ranking(totals: Record<string, number>): { uid: string; pts: number; rank: number }[] {
  const list = Object.entries(totals).map(([uid, pts]) => ({ uid, pts })).sort((a, b) => b.pts - a.pts || a.uid.localeCompare(b.uid));
  const out: { uid: string; pts: number; rank: number }[] = [];
  list.forEach((x, i) => out.push({ ...x, rank: i > 0 && out[i - 1].pts === x.pts ? out[i - 1].rank : i + 1 }));
  return out;
}

export const labelOf = (key: string) => CATEGORIES.find((c) => c.key === key);
