/**
 * Règles d'accès, identiques à `firebase.rules.json` : le test en mémoire vérifie ainsi les mêmes
 * garanties que la vraie base (les mains restent privées, seul l'hôte écrit l'état de la partie).
 */
export type Peek = (path: string) => unknown;

const seg = (path: string) => path.split('/').filter(Boolean);
const hostOf = (peek: Peek, code: string) => (peek(`rooms/${code}/meta/hostUid`) as string | undefined) ?? null;

export function canRead(path: string, uid: string | null, peek: Peek): boolean {
  const s = seg(path);
  if (!uid || s[0] !== 'rooms' || s.length < 3) return false; // jamais la liste des salons
  const [, code, section, key] = s;
  if (section === 'meta' || section === 'players' || section === 'public') return true;
  if (section === 'hands') return key === uid;
  if (section === 'intents' || section === 'hostState') return hostOf(peek, code) === uid;
  return false;
}

export function canWrite(path: string, uid: string | null, value: unknown, peek: Peek): boolean {
  const s = seg(path);
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
