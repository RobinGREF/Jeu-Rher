import { initializeApp, getApps, type FirebaseOptions } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, type Auth } from 'firebase/auth';
import {
  get, getDatabase, onChildAdded, onValue, push, ref, remove, set, type Database,
} from 'firebase/database';
import type { Backend } from './backend';
import { ENV } from './env';

/** Configuration Firebase, lue dans les variables EXPO_PUBLIC_FIREBASE_* (voir docs/en-ligne.md). */
export function firebaseConfig(env: Record<string, string | undefined> = ENV): FirebaseOptions | null {
  const c = {
    apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    databaseURL: env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
    projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    appId: env.EXPO_PUBLIC_FIREBASE_APP_ID,
  };
  return c.apiKey && c.databaseURL && c.projectId && c.appId ? c : null;
}

/** Firebase Realtime Database + connexion anonyme (pas de compte à créer pour les joueurs). */
export class FirebaseBackend implements Backend {
  private db: Database;
  private auth: Auth;
  private ready: Promise<string>;

  constructor(config: FirebaseOptions) {
    const app = getApps()[0] ?? initializeApp(config);
    this.db = getDatabase(app);
    this.auth = getAuth(app);
    this.ready = new Promise((resolve, reject) => {
      const off = onAuthStateChanged(this.auth, (u) => {
        if (u) { off(); resolve(u.uid); }
      }, reject);
      if (!this.auth.currentUser) signInAnonymously(this.auth).catch(reject);
    });
  }

  private ref = (path: string) => ref(this.db, path);

  uid() { return this.ready; }

  async get(path: string) {
    await this.ready;
    const snap = await get(this.ref(path));
    return snap.exists() ? snap.val() : null;
  }
  async set(path: string, value: unknown) { await this.ready; await set(this.ref(path), value); }
  async remove(path: string) { await this.ready; await remove(this.ref(path)); }
  async push(path: string, value: unknown) {
    await this.ready;
    const r = push(this.ref(path));
    await set(r, value);
    return r.key as string;
  }

  onValue(path: string, cb: (v: unknown) => void, onError?: (e: Error) => void) {
    let off: (() => void) | null = null;
    let dead = false;
    this.ready.then(() => {
      if (dead) return;
      off = onValue(this.ref(path), (s) => cb(s.exists() ? s.val() : null), (e) => onError?.(e));
    }, (e) => onError?.(e));
    return () => { dead = true; off?.(); };
  }

  onChildAdded(path: string, cb: (k: string, v: unknown) => void, onError?: (e: Error) => void) {
    let off: (() => void) | null = null;
    let dead = false;
    this.ready.then(() => {
      if (dead) return;
      off = onChildAdded(this.ref(path), (s) => cb(s.key as string, s.val()), (e) => onError?.(e));
    }, (e) => onError?.(e));
    return () => { dead = true; off?.(); };
  }
}
