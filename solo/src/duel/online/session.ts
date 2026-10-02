import { DEFAULT_CATEGORIES, MAX_PLAYERS, newDuel } from '../engine';
import { publicFlow, reduce, startFlow, type Action, type Flow } from '../flow';
import type { Backend } from './backend';

export { MAX_PLAYERS };

export type Seat = { uid: string; name: string };
/** Ce que tout le monde voit : les places et l'état de la partie (sans la bonne réponse avant la fin de la question). */
export type View = { seats: Seat[]; flow: Flow };
export type LobbyPlayer = { uid: string; name: string; joinedAt: number };

type Meta = { hostUid: string; createdAt: number; phase: 'lobby' | 'playing' };

export type Snapshot = {
  phase: 'connecting' | 'lobby' | 'playing' | 'error';
  code: string; uid: string; isHost: boolean; name: string;
  players: LobbyPlayer[];
  view: View | null;
  /** Ta place autour de la table (-1 : tu regardes sans jouer). */
  mySeat: number;
  error: string | null;
};

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sans I ni O, faciles à confondre avec 1 et 0
const randomCode = () => Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
export const normalizeCode = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);

const parse = <T,>(raw: unknown): T | null => {
  const j = (raw as { json?: string } | null)?.json;
  try { return j ? (JSON.parse(j) as T) : null; } catch { return null; }
};

/** L'hôte toujours en premier, puis par ordre d'arrivée. */
const ordered = (players: LobbyPlayer[], hostUid?: string) =>
  [...players].sort((a, b) => Number(b.uid === hostUid) - Number(a.uid === hostUid) || a.joinedAt - b.joinedAt || a.uid.localeCompare(b.uid));

/**
 * Un joueur connecté à un salon. L'hôte (celui qui a créé le salon) fait tourner la partie : les autres lui envoient
 * leurs actions, il les vérifie (c'est bien leur tour ?) et publie le nouvel état.
 */
export class DuelSession {
  private snap: Snapshot;
  private subs = new Set<(s: Snapshot) => void>();
  private offs: (() => void)[] = [];
  private meta: Meta | null = null;
  private flow: Flow | null = null; // état complet, chez l'hôte seulement
  private seats: Seat[] = [];
  private closed = false;

  private constructor(private be: Backend, code: string, uid: string, name: string) {
    this.snap = { phase: 'connecting', code, uid, isHost: false, name, players: [], view: null, mySeat: -1, error: null };
  }

  get snapshot() { return this.snap; }
  onChange(cb: (s: Snapshot) => void) { this.subs.add(cb); return () => { this.subs.delete(cb); }; }
  private update(patch: Partial<Snapshot>) {
    if (this.closed) return;
    this.snap = { ...this.snap, ...patch };
    for (const cb of [...this.subs]) cb(this.snap);
  }
  private fail(e: unknown) { this.update({ phase: 'error', error: e instanceof Error ? e.message : String(e) }); }
  private path = (p: string) => `duel/rooms/${this.snap.code}/${p}`;

  static async create(be: Backend, name: string): Promise<DuelSession> {
    const uid = await be.uid();
    for (let i = 0; i < 8; i++) {
      const code = randomCode();
      if ((await be.get(`duel/rooms/${code}/meta`)) !== null) continue;
      const s = new DuelSession(be, code, uid, name.trim() || 'Joueur');
      const meta: Meta = { hostUid: uid, createdAt: Date.now(), phase: 'lobby' };
      await be.set(`duel/rooms/${code}/meta`, meta);
      await be.set(`duel/rooms/${code}/players/${uid}`, { name: s.snap.name, joinedAt: Date.now() });
      s.attach();
      return s;
    }
    throw new Error('Impossible de créer un salon, réessaie.');
  }

  static async join(be: Backend, rawCode: string, name: string): Promise<DuelSession> {
    const code = normalizeCode(rawCode);
    if (code.length !== 4) throw new Error('Le code a 4 lettres.');
    const uid = await be.uid();
    const meta = (await be.get(`duel/rooms/${code}/meta`)) as Meta | null;
    if (!meta) throw new Error('Aucun salon avec ce code.');
    const mine = (await be.get(`duel/rooms/${code}/players/${uid}`)) as LobbyPlayer | null;
    if (!mine) {
      const players = (await be.get(`duel/rooms/${code}/players`)) as Record<string, unknown> | null;
      // Partie commencée : on arrive en spectateur. Avant : il faut de la place.
      if (meta.phase === 'lobby' && players && Object.keys(players).length >= MAX_PLAYERS) throw new Error(`Le salon est complet (${MAX_PLAYERS} joueurs).`);
      await be.set(`duel/rooms/${code}/players/${uid}`, { name: name.trim() || 'Joueur', joinedAt: Date.now() });
    }
    const s = new DuelSession(be, code, uid, mine?.name ?? (name.trim() || 'Joueur'));
    s.attach();
    return s;
  }

  private attach() {
    const onErr = (e: Error) => this.fail(e);
    this.offs.push(this.be.onValue(this.path('meta'), (v) => {
      if (v === null) {
        if (this.meta) this.update({ phase: 'error', error: 'Le salon a été fermé par son hôte.' });
        return;
      }
      this.meta = v as Meta;
      const isHost = this.meta.hostUid === this.snap.uid;
      this.update({ isHost, phase: this.snap.view ? 'playing' : this.meta.phase === 'playing' ? 'connecting' : 'lobby' });
    }, onErr));
    this.offs.push(this.be.onValue(this.path('players'), (v) => {
      const raw = (v ?? {}) as Record<string, { name: string; joinedAt: number }>;
      const players = ordered(Object.entries(raw).map(([uid, p]) => ({ uid, name: p.name, joinedAt: p.joinedAt })), this.meta?.hostUid);
      this.update({ players });
    }, onErr));
    this.offs.push(this.be.onValue(this.path('state'), (v) => {
      const view = parse<View>(v);
      if (!view) return;
      this.update({ view, phase: 'playing', mySeat: view.seats.findIndex((x) => x.uid === this.snap.uid) });
    }, onErr));
    this.offs.push(this.be.onChildAdded(this.path('intents'), (key, v) => {
      if (!this.snap.isHost) return;
      this.be.remove(this.path(`intents/${key}`)).catch(() => {});
      const raw = v as { uid?: string; json?: string } | null;
      const action = parse<Action>(raw);
      if (raw?.uid && action) void this.apply(raw.uid, action);
    }, onErr));
  }

  /** Hôte : lance la partie avec les joueurs du salon (ceux déjà présents prennent une place). */
  async start(categories: string[] = DEFAULT_CATEGORIES, seen: Record<string, number[]> = {}) {
    if (!this.snap.isHost || this.snap.phase !== 'lobby') return;
    this.seats = this.snap.players.slice(0, MAX_PLAYERS).map((p) => ({ uid: p.uid, name: p.name }));
    this.flow = startFlow(newDuel(this.seats.map((p) => p.name), categories, seen));
    try {
      await this.be.set(this.path('meta'), { ...this.meta!, phase: 'playing' });
      await this.publish();
    } catch (e) { this.fail(e); }
  }

  private async publish() {
    if (!this.flow) return;
    const view: View = { seats: this.seats, flow: publicFlow(this.flow) };
    await this.be.set(this.path('state'), { json: JSON.stringify(view) });
  }

  /** Hôte : n'accepte que les actions du joueur dont c'est le tour. */
  private async apply(uid: string, a: Action) {
    if (!this.flow || this.seats.findIndex((x) => x.uid === uid) !== this.flow.game.current) return;
    const next = reduce(this.flow, a);
    if (next === this.flow) return;
    this.flow = next;
    try { await this.publish(); } catch (e) { this.fail(e); }
  }

  /** Joue une action (si c'est ton tour). Chez l'hôte elle s'applique tout de suite ; sinon elle lui est envoyée. */
  async act(a: Action) {
    if (this.snap.mySeat < 0) return;
    try {
      if (this.snap.isHost) await this.apply(this.snap.uid, a);
      else await this.be.push(this.path('intents'), { uid: this.snap.uid, json: JSON.stringify(a) });
    } catch (e) { this.fail(e); }
  }

  leave() {
    this.closed = true;
    for (const off of this.offs) off();
    this.offs = [];
    if (this.snap.isHost) void this.be.remove(this.path('meta')).catch(() => {});
    void this.be.remove(this.path(`players/${this.snap.uid}`)).catch(() => {});
  }
}
