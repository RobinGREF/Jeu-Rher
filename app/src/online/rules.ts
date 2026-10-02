/**
 * Règles d'accès, identiques à `firebase.rules.json` : le test en mémoire vérifie ainsi les mêmes
 * garanties que la vraie base (les mains restent privées, seul l'hôte écrit l'état de la partie).
 */
export type Peek = (path: string) => unknown;

const seg = (path: string) => path.split('/').filter(Boolean);
const hostOf = (peek: Peek, code: string) => (peek(`rooms/${code}/meta/hostUid`) as string | undefined) ?? null;

export function canRead(path: string, uid: string | null, peek: Peek): boolean {
  const s = seg(path);
  if (uid && s[0] === 'scores') return true; // le tableau des scores est lisible par tous les joueurs connectés
  if (!uid || s[0] !== 'rooms' || s.length < 3) return false; // jamais la liste des salons
  const [, code, section, key] = s;
  if (section === 'meta' || section === 'players' || section === 'public') return true;
  if (section === 'hands') return key === uid;
  if (section === 'intents' || section === 'hostState') return hostOf(peek, code) === uid;
  return false;
}

/** Un score publié : mêmes contrôles que les `.validate` de firebase.rules.json. */
export function validScore(v: unknown): boolean {
  const s = v as Record<string, unknown> | null;
  if (!s || typeof s !== 'object') return false;
  if (Object.keys(s).some((k) => !['at', 'completed', 'plays', 'medal', 'players'].includes(k))) return false;
  if (typeof s.at !== 'number' || typeof s.completed !== 'number' || s.completed < 0 || s.completed > 50) return false;
  if (typeof s.plays !== 'number' || s.plays < 0 || s.plays >= 2000) return false;
  if (s.medal !== undefined && (typeof s.medal !== 'string' || s.medal.length >= 8)) return false;
  const pl = s.players && typeof s.players === 'object' ? Object.values(s.players as object) : [];
  return pl.length > 0 && pl.every((p) => {
    const x = p as Record<string, unknown> | null;
    return !!x && typeof x === 'object' && Object.keys(x).every((k) => k === 'name' || k === 'bot')
      && typeof x.name === 'string' && x.name.length <= 14 && typeof x.bot === 'boolean';
  });
}

export function canWrite(path: string, uid: string | null, value: unknown, peek: Peek): boolean {
  const s = seg(path);
  // Un score par salon, écrit une seule fois, par l'hôte de ce salon.
  if (uid && s[0] === 'scores' && s.length === 2) return peek(path) === undefined && hostOf(peek, s[1]) === uid && validScore(value);
  if (!uid || s[0] !== 'rooms' || s.length < 3) return false;
  const [, code, section, key] = s;
  const host = hostOf(peek, code);
  if (section === 'meta') {
    if (host === null) return s.length === 3 ? (value as { hostUid?: string } | null)?.hostUid === uid : false; // création du salon
    return host === uid;
  }
  if (section === 'players') return key === uid;
  if (section === 'public' || section === 'hands' || section === 'hostState') return host === uid;
  if (section === 'intents') {
    if (s.length < 4) return false;
    if (value === null || value === undefined) return host === uid; // l'hôte range les demandes traitées
    return (value as { uid?: string }).uid === uid;
  }
  return false;
}
