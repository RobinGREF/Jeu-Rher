/** Noms des machines (tirés dans l'ordre), pour qu'on reconnaisse chacune d'un coup d'œil. */
export const BOT_NAMES = ['Jack', 'Anne', 'Morgan', 'Mary', 'Barbe', 'Drake', 'Flint', 'Bonny'];

/** `count` noms de machines, sans reprendre le prénom d'un joueur de la table. */
export function botNames(count: number, taken: string[] = []): string[] {
  const used = new Set(taken.map((n) => n.trim().toLowerCase()));
  return BOT_NAMES.filter((n) => !used.has(n.toLowerCase())).slice(0, count);
}

/** Début du nom, pour les pastilles posées sur les missions (le nom entier ne tiendrait pas). */
export const shortName = (name: string, max = 6) => {
  const n = name.replace(' (machine)', '').trim();
  return n.length > max ? `${n.slice(0, max - 1)}…` : n;
};
