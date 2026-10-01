export type GameId = 'missions' | 'duel' | 'memo';

/** Jeu de l'appli demandé par l'adresse (`?jeu=duel`, `?jeu=memo`) ; 50 Missions par défaut. */
export function gameFromSearch(search: string): GameId {
  const g = new URLSearchParams(search).get('jeu');
  return g === 'duel' || g === 'memo' ? g : 'missions';
}

/** Adresse de la page d'accueil du site : le dossier au-dessus de celui de l'appli (/Jeu-Rher/50-missions/ → /Jeu-Rher/). */
export function hubUrl(href: string): string {
  const u = new URL(href);
  return new URL('../', `${u.origin}${u.pathname.replace(/[^/]*$/, '')}`).href;
}
