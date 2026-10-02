/** Adresse de la même page, avec un paramètre qui change à chaque fois : le navigateur doit alors aller chercher la dernière version. */
export function freshUrl(href: string, now: number = Date.now()): string {
  const u = new URL(href);
  u.searchParams.set('v', String(now));
  return u.toString();
}

/** Recharge le jeu en forçant la dernière version publiée (et non celle gardée en mémoire par le navigateur). */
export function reloadFresh(): void {
  try { window.location.replace(freshUrl(window.location.href)); } catch { /* hors navigateur */ }
}
