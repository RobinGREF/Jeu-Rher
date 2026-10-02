import type { Backend } from './backend';

type Tree = { [k: string]: unknown };

/** Stockage d'un arbre de données partagé par plusieurs « joueurs » simulés. */
export interface Store {
  read(): Tree;
  write(tree: Tree): void;
  subscribe(fn: () => void): () => void;
}

const parts = (p: string) => p.split('/').filter(Boolean);
const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

function getAt(tree: Tree, path: string): unknown {
  let cur: unknown = tree;
  for (const k of parts(path)) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Tree)[k];
  }
  return cur;
}

/** Écrit (ou supprime avec `null`) comme Firebase : un nœud vide disparaît. */
function setAt(tree: Tree, path: string, value: unknown) {
  const ks = parts(path);
  const stack: Tree[] = [tree];
  for (const k of ks.slice(0, -1)) {
    let next = stack[stack.length - 1][k] as Tree | undefined;
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
    for (let i = stack.length - 1; i > 0; i--) if (Object.keys(stack[i]).length === 0) delete stack[i - 1][ks[i - 1]];
  } else stack[stack.length - 1][last] = clone(value);
}

export class MemoryStore implements Store {
  private tree: Tree = {};
  private subs = new Set<() => void>();
  read() { return this.tree; }
  write(tree: Tree) { this.tree = tree; for (const fn of [...this.subs]) queueMicrotask(fn); }
  subscribe(fn: () => void) { this.subs.add(fn); return () => this.subs.delete(fn); }
}

/** Partage entre les onglets d'un même navigateur (pour essayer sans Firebase). */
export class LocalStorageStore implements Store {
  private subs = new Set<() => void>();
  constructor(private key = 'duel-local-tree') {
    if (typeof window !== 'undefined') window.addEventListener('storage', (e) => { if (e.key === this.key) this.notify(); });
  }
  private notify() { for (const fn of [...this.subs]) queueMicrotask(fn); }
  read(): Tree { try { return JSON.parse(localStorage.getItem(this.key) ?? '{}') as Tree; } catch { return {}; } }
  write(tree: Tree) { localStorage.setItem(this.key, JSON.stringify(tree)); this.notify(); }
  subscribe(fn: () => void) { this.subs.add(fn); return () => this.subs.delete(fn); }
}

let seq = 0;

/** Faux serveur, sans règles d'accès : sert aux tests et à essayer le mode en ligne dans deux onglets. */
export class StoreBackend implements Backend {
  constructor(private store: Store, private id: string) {}
  async uid() { return this.id; }
  private val = (path: string) => clone(getAt(this.store.read(), path) ?? null);
  private put(path: string, value: unknown) {
    const tree = clone(this.store.read());
    setAt(tree, path, value);
    this.store.write(tree);
  }
  async get(path: string) { return this.val(path); }
  async set(path: string, value: unknown) { this.put(path, value); }
  async remove(path: string) { this.put(path, null); }
  async push(path: string, value: unknown) {
    const key = `${Date.now().toString(36)}${String(seq++ % 10000).padStart(4, '0')}${this.id.slice(0, 3)}`;
    this.put(`${path}/${key}`, value);
    return key;
  }
  onValue(path: string, cb: (value: unknown) => void) {
    let last = '';
    const fire = (force = false) => {
      const v = this.val(path);
      const s = JSON.stringify(v);
      if (force || s !== last) { last = s; cb(v); }
    };
    queueMicrotask(() => fire(true));
    return this.store.subscribe(() => fire());
  }
  onChildAdded(path: string, cb: (key: string, value: unknown) => void) {
    const seen = new Set<string>();
    const fire = () => {
      const kids = (this.val(path) ?? {}) as Tree;
      for (const k of Object.keys(kids).sort()) if (!seen.has(k)) { seen.add(k); cb(k, kids[k]); }
    };
    queueMicrotask(fire);
    return this.store.subscribe(fire);
  }
}
