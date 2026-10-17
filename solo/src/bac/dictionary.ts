import { COUNTRIES } from './countries';
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

let cached: Promise<Known | null> | null = null;

/** Charge (une seule fois) la liste de ~320 000 mots français ; sans réseau, seuls les pays restent contrôlés. */
export function loadKnown(url = dictionaryUrl()): Promise<Known | null> {
  cached ??= fetch(url)
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
    .then((t) => {
      const set = new Set(t.split('\n'));
      return makeKnown(set.size > 1000 ? (w) => set.has(w) : () => true, bank, COUNTRIES);
    })
    .catch(() => makeKnown(() => true, bank, COUNTRIES));
  return cached;
}
