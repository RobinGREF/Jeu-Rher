/**
 * Invitation à un salon : un lien qui ouvre le BON jeu directement sur le salon (?salle=CODE).
 * (Même fichier dans app/src et solo/src : les deux projets sont construits séparément.)
 */

/** Code de salon (4 lettres) lu dans une chaîne de requête, sinon null. */
export function parseRoom(search: string): string | null {
  const c = new URLSearchParams(search).get('salle')?.toUpperCase().replace(/[^A-Z]/g, '') ?? '';
  return c.length === 4 ? c : null;
}

export function roomFromUrl(): string | null {
  try { return parseRoom(window.location.search); } catch { return null; }
}

/** Adresse d'invitation à partir de l'adresse de la page du jeu. */
export function buildRoomLink(origin: string, pathname: string, code: string): string {
  return `${origin}${pathname}?salle=${code}`;
}

export function roomLink(code: string): string {
  try { return buildRoomLink(window.location.origin, window.location.pathname, code); } catch { return `?salle=${code}`; }
}

export const inviteText = (game: string, code: string) => `Rejoins ma partie de ${game} ! Code du salon : ${code}`;

export const whatsappHref = (text: string, url: string) => `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;
export const smsHref = (text: string, url: string) => `sms:?&body=${encodeURIComponent(`${text} ${url}`)}`;

/** Retire ?salle= de la barre d'adresse (pour ne pas rejoindre à nouveau après avoir quitté). */
export function clearRoomParam() {
  try {
    const u = new URL(window.location.href);
    u.searchParams.delete('salle');
    window.history.replaceState(null, '', u.pathname + u.search + u.hash);
  } catch { /* hors navigateur */ }
}
