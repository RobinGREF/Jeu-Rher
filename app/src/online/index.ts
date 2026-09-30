import type { Backend } from './backend';
import { ENV } from './env';
import { FirebaseBackend, firebaseConfig } from './firebaseBackend';
import { LocalStorageStore, StoreBackend } from './localBackend';

export type OnlineKind = 'firebase' | 'local';

/**
 * Quel « serveur » utiliser :
 *  - Firebase si la configuration est fournie (vraie partie en ligne) ;
 *  - sinon, si EXPO_PUBLIC_ONLINE_BACKEND=local, un faux serveur partagé entre les onglets du même navigateur (pour essayer) ;
 *  - sinon rien : le mode en ligne est indisponible.
 */
export function onlineKind(env: Record<string, string | undefined> = ENV): OnlineKind | null {
  if (firebaseConfig(env)) return 'firebase';
  if (env.EXPO_PUBLIC_ONLINE_BACKEND === 'local' && typeof localStorage !== 'undefined') return 'local';
  return null;
}

let firebase: FirebaseBackend | null = null;
let localId: string | null = null;

export function getBackend(): Backend | null {
  const kind = onlineKind();
  if (kind === 'firebase') return (firebase ??= new FirebaseBackend(firebaseConfig()!));
  if (kind === 'local') {
    // Un identifiant par onglet (sessionStorage), pour que deux onglets soient deux joueurs différents.
    localId ??= sessionStorage.getItem('50m-id') ?? `p${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem('50m-id', localId);
    return new StoreBackend(new LocalStorageStore(), localId);
  }
  return null;
}
