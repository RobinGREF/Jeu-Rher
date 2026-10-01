import type { GameState, SignalKind } from '../engine';
import type { Card } from '../types';
import type { Backend } from './backend';
import { Host, type Intent } from './host';
import { botNames } from '../names';
import { buildView, type Options, type PublicState, type SeatInfo } from './wire';

export const MAX_PLAYERS = 4;
export const DEFAULT_OPTIONS: Options = { pauseMs: 5000, phrases: false, manual: true, ask: true };

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
type Meta = { hostUid: string; createdAt: number; phase: 'lobby' | 'playing'; options: Options };
export type LobbyPlayer = { uid: string; name: string; joinedAt: number; ask?: boolean };

/** Ce que l'écran a besoin de savoir. */
export type Snapshot = {
  phase: 'connecting' | 'lobby' | 'playing' | 'over' | 'error';
  code: string; uid: string; isHost: boolean; name: string;
  players: LobbyPlayer[]; options: Options;
  pub: PublicState | null; mySeat: number; view: GameState | null;
  /** Spectateurs qui demandent une place (pour l'hôte). */
  requests: { uid: string; name: string }[];
  /** Tu regardes la partie sans y jouer. */
  spectator: boolean;
  /** Spectateur : ta demande de place est envoyée / refusée. */
  asked: boolean; refused: boolean;
  error: string | null;
};

/** L'hôte toujours en premier (siège 0), puis par ordre d'arrivée. */
const ordered = (players: LobbyPlayer[], hostUid?: string) =>
  [...players].sort((a, b) => Number(b.uid === hostUid) - Number(a.uid === hostUid) || a.joinedAt - b.joinedAt || a.uid.localeCompare(b.uid));

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sans I ni O, faciles à confondre avec 1 et 0
const randomCode = () => Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
export const normalizeCode = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);

const parse = <T,>(raw: unknown): T | null => {
  const j = (raw as { json?: string } | null)?.json;
  return j ? (JSON.parse(j) as T) : null;
};

/**
 * Un joueur, connecté à un salon. L'hôte (celui qui a créé le salon) fait en plus tourner la partie.
 */
export class OnlineSession {
  private snap: Snapshot;
  private subs = new Set<(s: Snapshot) => void>();
  private offs: (() => void)[] = [];
  private host: Host | null = null;
  private meta: Meta | null = null;
  private hand: Card[] = [];
  private rawPlayers: LobbyPlayer[] = [];
  private closed = false;

  private constructor(private be: Backend, code: string, uid: string, name: string) {
    this.snap = {
      phase: 'connecting', code, uid, isHost: false, name, players: [], options: DEFAULT_OPTIONS,
      pub: null, mySeat: -1, view: null, error: null, requests: [], spectator: false, asked: false, refused: false,
    };
  }

  get snapshot() { return this.snap; }
  onChange(cb: (s: Snapshot) => void) { this.subs.add(cb); return () => { this.subs.delete(cb); }; }
  private update(patch: Partial<Snapshot>) {
    this.snap = { ...this.snap, ...patch };
    for (const cb of [...this.subs]) cb(this.snap);
  }
  private fail(e: unknown) { this.update({ phase: 'error', error: e instanceof Error ? e.message : String(e) }); }
  private path = (p: string) => `rooms/${this.snap.code}/${p}`;

  /** Crée un salon et t'en fait l'hôte. */
  static async create(be: Backend, name: string): Promise<OnlineSession> {
    const uid = await be.uid();
    for (let i = 0; i < 8; i++) {
      const code = randomCode();
      if ((await be.get(`rooms/${code}/meta`)) !== null) continue;
      const s = new OnlineSession(be, code, uid, name.trim() || 'Joueur');
      const meta: Meta = { hostUid: uid, createdAt: Date.now(), phase: 'lobby', options: DEFAULT_OPTIONS };
      await be.set(`rooms/${code}/meta`, meta);
      await be.set(`rooms/${code}/players/${uid}`, { name: s.snap.name, joinedAt: Date.now() });
      await s.attach();
      return s;
    }
    throw new Error('Impossible de créer un salon, réessaie.');
  }

  /** Rejoint un salon (ou s'y reconnecte). */
  static async join(be: Backend, rawCode: string, name: string): Promise<OnlineSession> {
    const code = normalizeCode(rawCode);
    if (code.length !== 4) throw new Error('Le code a 4 lettres.');
    const uid = await be.uid();
    const meta = (await be.get(`rooms/${code}/meta`)) as Meta | null;
    if (!meta) throw new Error('Aucun salon avec ce code.');
    const mine = (await be.get(`rooms/${code}/players/${uid}`)) as LobbyPlayer | null;
    if (!mine) {
      // Partie déjà commencée : on rejoint en spectateur (et on pourra demander la place d'une machine).
      if (meta.phase === 'playing') await be.set(`rooms/${code}/players/${uid}`, { name: name.trim() || 'Joueur', joinedAt: Date.now() });
      else {
      const players = (await be.get(`rooms/${code}/players`)) as Record<string, unknown> | null;
      if (players && Object.keys(players).length >= MAX_PLAYERS) throw new Error('Le salon est complet (4 joueurs).');
      await be.set(`rooms/${code}/players/${uid}`, { name: name.trim() || 'Joueur', joinedAt: Date.now() });
      }
    }
    const s = new OnlineSession(be, code, uid, (mine as { name?: string } | null)?.name ?? (name.trim() || 'Joueur'));
    await s.attach();
    return s;
  }

  private async attach() {
    const { code, uid } = this.snap;
    const err = (e: Error) => this.fail(e);
    this.offs.push(
      this.be.onValue(this.path('meta'), (raw) => {
        this.meta = raw as Meta | null;
        if (!this.meta) return;
        const isHost = this.meta.hostUid === uid;
        this.update({
          isHost, options: this.meta.options, players: ordered(this.rawPlayers, this.meta.hostUid),
          phase: this.snap.phase === 'connecting' ? 'lobby' : this.snap.phase,
        });
        if (isHost && this.meta.phase === 'playing' && !this.host) this.resumeHost();
      }, err),
      this.be.onValue(this.path('players'), (raw) => {
        const players = Object.entries((raw ?? {}) as Record<string, { name: string; joinedAt: number; ask?: boolean }>)
          .map(([u, p]) => ({ uid: u, name: p.name, joinedAt: p.joinedAt, ask: p.ask === true }));
        this.rawPlayers = players;
        this.update({ players: ordered(players, this.meta?.hostUid), ...this.seatState() });
      }, err),
      this.be.onValue(this.path('public'), (raw) => {
        const pub = parse<PublicState>(raw);
        if (!pub) return;
        this.pub(pub);
      }, err),
      this.be.onValue(this.path(`hands/${uid}`), (raw) => {
        this.hand = parse<Card[]>(raw) ?? [];
        if (this.snap.pub) this.pub(this.snap.pub);
      }, err),
    );
    void code;
  }

  private pub(pub: PublicState) {
    const mySeat = pub.seats.findIndex((s) => s.uid === this.snap.uid);
    // Ta main et l'état public sont publiés séparément : on n'affiche que quand ils concordent.
    const consistent = mySeat < 0 || this.hand.length === pub.handCounts[mySeat];
    this.update({
      pub, mySeat, phase: pub.over ? 'over' : 'playing',
      view: consistent ? buildView(pub, mySeat < 0 ? [] : this.hand, mySeat) : this.snap.view,
      ...this.seatState(pub, mySeat),
    });
  }

  /** Spectateur ? demandes de place en attente (pour l'hôte) ? ma demande envoyée ou refusée ? */
  private seatState(pub: PublicState | null = this.snap.pub, mySeat = this.snap.mySeat) {
    const uid = this.snap.uid;
    const seated = (u: string) => !!pub?.seats.some((s) => s.uid === u);
    const refused = (u: string) => !!pub?.refused?.includes(u);
    return {
      spectator: !!pub && mySeat < 0,
      asked: !!pub && mySeat < 0 && this.rawPlayers.some((p) => p.uid === uid && p.ask) && !refused(uid),
      refused: !!pub && mySeat < 0 && refused(uid),
      requests: pub ? this.rawPlayers.filter((p) => p.ask && !seated(p.uid) && !refused(p.uid)).map((p) => ({ uid: p.uid, name: p.name })) : [],
    };
  }

  private async resumeHost() {
    if (!this.meta) return;
    try {
      this.host = await Host.resume(this.be, this.snap.code, this.meta.options);
    } catch (e) { this.fail(e); }
  }

  // ─── Actions de l'hôte ────────────────────────────────────────────────────────────
  /** Réglages du salon, avant le début. */
  async configure(options: Options) {
    if (!this.snap.isHost || !this.meta || this.meta.phase !== 'lobby') return;
    await this.be.set(this.path('meta'), { ...this.meta, options });
  }

  /** Lance la partie avec `total` sièges : les joueurs présents, complétés par des machines. */
  async startGame(total: number, rng?: () => number) {
    if (!this.snap.isHost || !this.meta || this.host) return;
    const humans = this.snap.players;
    const n = Math.max(2, Math.min(MAX_PLAYERS, Math.max(total, humans.length)));
    const seats: SeatInfo[] = [
      ...humans.map((p) => ({ name: p.name, bot: false, uid: p.uid })),
      ...botNames(n - humans.length, humans.map((p) => p.name)).map((name) => ({ name, bot: true })),
    ];
    this.host = await Host.launch(this.be, this.snap.code, seats, this.meta.options, rng);
    await this.be.set(this.path('meta'), { ...this.meta, phase: 'playing' });
  }

  /** Hôte : accepte qu'un spectateur prenne la place d'une machine. */
  acceptSeat(uid: string) {
    const p = this.rawPlayers.find((x) => x.uid === uid);
    if (!p || !this.host) return;
    if (!this.host.takeSeat(uid, p.name)) this.update({ error: null });
  }
  /** Hôte : refuse la demande d'un spectateur. */
  refuseSeat(uid: string) { this.host?.refuse(uid); }
  /** Spectateur : demande la place d'une machine (ou annule la demande). */
  async requestSeat(ask = true) {
    const mine = this.rawPlayers.find((p) => p.uid === this.snap.uid);
    await this.be.set(this.path(`players/${this.snap.uid}`), { name: mine?.name ?? this.snap.name, joinedAt: mine?.joinedAt ?? Date.now(), ask });
  }

  /** Remplace un joueur absent par une machine. */
  botify(seat: number) { this.host?.botify(seat); }

  // ─── Actions de tous les joueurs ──────────────────────────────────────────────────
  private send(it: DistributiveOmit<Intent, 'uid'>) {
    const intent = { ...it, uid: this.snap.uid } as Intent;
    if (this.host) this.host.submit(intent);
    else this.be.push(this.path('intents'), intent).catch((e) => this.fail(e));
  }
  play(cardId: number, pile: number) { this.send({ type: 'play', cardId, pile }); }
  /** Feu vert : la machine dont c'est le tour peut jouer. */
  go() { this.send({ type: 'go' }); }
  /** « Je peux réussir » ces missions (liste vide : retire l'annonce). */
  announce(missions: string[], free = false) { this.send({ type: 'canDo', missions, free }); }
  /** « Je ne peux pas réussir de mission » pour ce tour. */
  pass() { this.send({ type: 'pass' }); }
  toggleSignal(kind: SignalKind, target: { mission?: string; pile?: number }) {
    const t: { mission?: string; pile?: number } = {};
    if (target.mission !== undefined) t.mission = target.mission;
    if (target.pile !== undefined) t.pile = target.pile;
    this.send({ type: 'signal', kind, ...t });
  }

  leave() {
    if (this.closed) return;
    this.closed = true;
    this.offs.forEach((f) => f());
    this.host?.stop();
    if (this.snap.phase === 'lobby' || this.snap.spectator) this.be.remove(this.path(`players/${this.snap.uid}`)).catch(() => {});
    this.subs.clear();
  }
}
