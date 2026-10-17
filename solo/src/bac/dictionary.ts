import { CITIES_FR, COUNTRIES } from './countries';
import { makeKnown, type Known } from './engine';
import { core } from './engine';
import { WORDS } from './words';

/** Mots de la réserve des machines, sans accents : toujours acceptés, même s'ils manquent au dictionnaire. */
const bank = (cat: string, folded: string) => (WORDS[cat] ? Object.values(WORDS[cat]).some((l) => l.some((w) => core(w) === folded)) : false);

/** Adresse du dictionnaire : à côté de la page du jeu (…/petit-bac/mots-fr.txt). */
export function dictionaryUrl(): string {
  try {
    const base = window.location.pathname.match(/^(.*?\/petit-bac)(\/|$)/)?.[1] ?? '';
    return `${base}/mots-fr.txt`;
  } catch { return 'mots-fr.txt'; }
}

/** Adresse de la liste des villes (…/petit-bac/villes-fr.txt). */
const citiesUrl = (url: string) => url.replace(/mots-fr\.txt$/, 'villes-fr.txt');

const lines = (url: string) => fetch(url).then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status))))).then((t) => new Set(t.split('\n')));

let cached: Promise<Known | null> | null = null;

/** Charge (une seule fois) la liste de ~320 000 mots français et celle des villes ; ce qui manque n'est simplement pas contrôlé (les pays le sont toujours). */
export function loadKnown(url = dictionaryUrl()): Promise<Known | null> {
  cached ??= Promise.all([lines(url).catch(() => null), lines(citiesUrl(url)).catch(() => null)]).then(([words, cities]) => {
    const lists: Record<string, Set<string>> = { pays: COUNTRIES };
    if (cities && cities.size > 1000) lists.ville = new Set([...cities, ...CITIES_FR]);
    return makeKnown(words && words.size > 1000 ? (w) => words.has(w) : () => true, bank, lists);
  });
  return cached;
}
