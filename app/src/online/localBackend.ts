import type { Backend } from './backend';
import { canRead, canWrite } from './rules';

type Tree = { [k: string]: unknown };

/** Stockage brut d'un arbre de données, partagé par plusieurs « joueurs » simulés. */
export interface Store {
  read(): Tree;
  /** `null` supprime. */
  write(path: string, value: unknown): void;
  subscribe(fn: () => void): () => void;
}

const parts = (p: string) => p.split('/').filter(Boolean);
const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

export function getAt(tree: Tree, path: string): unknown {
  let cur: unknown = tree;
  for (const k of parts(path)) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Tree)[k];
  }
  return cur;
}

function setAt(tree: Tree, path: string, value: unknown) {
  const ks = parts(path);
  const stack: Tree[] = [tree];
  for (const k of ks.slice(0, -1)) {
    let next = (stack[stack.length - 1][k] ?? undefined) as Tree | undefined;
    if (next === undefined || typeof next !== 'object') {
      if (value === null) return;
      next = {};
      stack[stack.length - 1][k] = next;
    }
    stack.push(next);
  }
  const last = ks[ks.length - 1];
  if (value === null || value === undefined) {
    delete stack[stack.length - 1][last];
    // comme Firebase : un nœud vide disparaît
    for (let i = stack.length - 1; i > 0; i--) if (Object.keys(stack[i]).length === 0) delete stack[i - 1][ks[i - 1]];
  } else stack[stack.length - 1][last] = clone(value);
}

export class MemoryStore implements Store {
  private tree: Tree = {};
  private subs = new Set<() => void>();
  read() { return this.tree; }
  write(path: string, value: unknown) {
    setAt(this.tree, path, value);
    for (const fn of [...this.subs]) queueMicrotask(fn);
  }
  subscribe(fn: () => void) { this.subs.add(fn); return () => this.subs.delete(fn); }
}

/**
 * Partage entre onglets du même navigateur. Chaque écriture tient dans UNE clé (comme une vraie base,
 * un autre onglet ne voit jamais une écriture à moitié faite) ; une suppression est une clé « null ».
 */
export class LocalStorageStore implements Store {
  private subs = new Set<() => void>();
  constructor(private prefix = '50m:') {
    if (typeof window !== 'undefined') window.addEventListener('storage', (e) => { if (e.key === null || e.key.startsWith(this.prefix)) this.notify(); });
  }
  private notify() { for (const fn of [...this.subs]) queueMicrotask(fn); }
  private keys(): string[] {
    const out: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (k.startsWith(this.prefix)) out.push(k);
    }
    return out;
  }
  read(): Tree {
    const tree: Tree = {};
    // Les écritures les plus hautes d'abord : une écriture plus profonde vient les préciser ou les effacer.
    const entries = this.keys().map((k) => ({ path: k.slice(this.prefix.length), raw: localStorage.getItem(k) }))
      .sort((a, b) => parts(a.path).length - parts(b.path).length);
    for (const { path, raw } of entries) if (raw !== null) setAt(tree, path, JSON.parse(raw));
    return tree;
  }
  write(path: string, value: unknown) {
    const norm = parts(path).join('/');
    const base = this.prefix + norm;
    // Ce qui était écrit plus bas est remplacé par cette écriture.
    for (const k of this.keys()) if (k.startsWith(base + '/')) localStorage.removeItem(k);
    localStorage.setItem(base, JSON.stringify(value === undefined ? null : value));
    this.notify();
  }
  subscribe(fn: () => void) { this.subs.add(fn); return () => this.subs.delete(fn); }
}

let seq = 0;

/**
 * Faux serveur : applique les mêmes règles d'accès que Firebase. Sert aux tests, et à essayer le mode en
 * ligne sans compte, dans plusieurs onglets d'un même navigateur.
 */
export class StoreBackend implements Backend {
  constructor(private store: Store, private id: string, private enforce = true) {}
  private peek = (p: string) => getAt(this.store.read(), p);
  private deny(what: string): Error { return new Error(`permission_denied: ${what}`); }

  async uid() { return this.id; }

  async get(path: string) {
    if (this.enforce && !canRead(path, this.id, this.peek)) throw this.deny(`lecture ${path}`);
    return clone(this.peek(path) ?? null);
  }
  async set(path: string, value: unknown) {
    if (this.enforce && !canWrite(path, this.id, value, this.peek)) throw this.deny(`écriture ${path}`);
    this.store.write(path, value);
  }
  async remove(path: string) {
    if (this.enforce && !canWrite(path, this.id, null, this.peek)) throw this.deny(`suppression ${path}`);
    this.store.write(path, null);
  }
  async push(path: string, value: unknown) {
    const key = `${Date.now().toString(36)}${String(seq++ % 10000).padStart(4, '0')}${this.id.slice(0, 3)}`;
    await this.set(`${path}/${key}`, value);
    return key;
  }

  onValue(path: string, cb: (v: unknown) => void, onError?: (e: Error) => void) {
    if (this.enforce && !canRead(path, this.id, this.peek)) {
      queueMicrotask(() => onError?.(this.deny(`lecture ${path}`)));
      return () => {};
    }
    let alive = true;
    let last: string | undefined;
    const emit = () => {
      if (!alive) return;
      const v = this.peek(path);
      const j = JSON.stringify(v ?? null);
      if (j === last) return;
      last = j;
      cb(v === undefined ? null : clone(v));
    };
    const off = this.store.subscribe(emit);
    queueMicrotask(emit);
    return () => { alive = false; off(); };
  }

  onChildAdded(path: string, cb: (k: string, v: unknown) => void, onError?: (e: Error) => void) {
    if (this.enforce && !canRead(path, this.id, this.peek)) {
      queueMicrotask(() => onError?.(this.deny(`lecture ${path}`)));
      return () => {};
    }
    let alive = true;
    const known = new Set<string>();
    const emit = () => {
      if (!alive) return;
      const node = this.peek(path);
      if (node === null || typeof node !== 'object') return;
      for (const k of Object.keys(node as Tree).sort()) {
        if (known.has(k)) continue;
        known.add(k);
        cb(k, clone((node as Tree)[k]));
      }
    };
    const off = this.store.subscribe(emit);
    queueMicrotask(emit);
    return () => { alive = false; off(); };
  }
}
