import type { Backend } from '../duel/online/backend';
import { DEFAULT_CATEGORIES, drawLetter, MAX_CATEGORIES, MAX_PLAYERS, MIN_CATEGORIES, scoreRound, type Cell, type Round } from './engine';
import { botAnswers, BOT_NAMES } from './bots';

export { MAX_PLAYERS };

export type Seat = { uid: string; name: string; bot?: boolean };
export type Settings = { rounds: number; seconds: number; categories: string[] };
export const DEFAULT_SETTINGS: Settings = { rounds: 5, seconds: 90, categories: DEFAULT_CATEGORIES };
export type Phase = 'write' | 'collect' | 'vote' | 'scores' | 'final';

/** Ce que tout le monde voit. Les réponses n'apparaissent qu'à partir du vote (jamais pendant l'écriture). */
export type View = {
  v: number;
  seats: Seat[]; settings: Settings;
  roundNo: number; phase: Phase; letter: string;
  /** Temps restant pour écrire au moment de la publication (chaque appareil compte à partir de sa réception). */
  remainingMs: number;
  /** Durée du tirage de la lettre au début de la manche (comprise dans `remainingMs`). */
  spinMs: number;
  stoppedBy: string | null;
  submitted: string[]; ready: string[];
  round?: Round;
  cells?: Record<string, Record<string, Cell>>;
  roundPts?: Record<string, number>;
  totals: Record<string, number>;
};

export type Intent =
  | { t: 'stop' }
  | { t: 'answers'; answers: Record<string, string> }
  | { t: 'contest'; cat: string; target: string; on: boolean }
  | { t: 'ready' };

export type LobbyPlayer = { uid: string; name: string; joinedAt: number };
type Meta = { hostUid: string; createdAt: number; phase: 'lobby' | 'playing'; bots?: string[] };

export type Snapshot = {
  phase: 'connecting' | 'lobby' | 'playing' | 'error';
  code: string; uid: string; isHost: boolean; name: string;
  players: LobbyPlayer[];
  /** Machines inscrites au salon (prénoms), avant le début de la partie. */
  bots: string[];
  view: View | null;
  /** Heure locale de réception de la vue : sert au compte à rebours. */
  recvAt: number;
  mySeat: number;
  error: string | null;
};

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const randomCode = () => Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
export const normalizeCode = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);

const parse = <T,>(raw: unknown): T | null => {
  const j = (raw as { json?: string } | null)?.json;
  try { return j ? (JSON.parse(j) as T) : null; } catch { return null; }
};

const ordered = (players: LobbyPlayer[], hostUid?: string) =>
  [...players].sort((a, b) => Number(b.uid === hostUid) - Number(a.uid === hostUid) || a.joinedAt - b.joinedAt || a.uid.localeCompare(b.uid));

/** `collectMs` : attente des réponses après l'arrêt ; `spinMs` : durée du tirage de la lettre (la roue tourne, le chrono n'a pas commencé). */
export type Timing = { collectMs: number; spinMs: number };
const DEFAULT_TIMING: Timing = { collectMs: 4000, spinMs: 3600 };

/** Réglages valides (bornes), même si un appareil envoie n'importe quoi. */
export function cleanSettings(s: Partial<Settings>): Settings {
  const cats = [...new Set(s.categories ?? DEFAULT_SETTINGS.categories)].slice(0, MAX_CATEGORIES);
  return {
    rounds: Math.min(10, Math.max(1, Math.round(s.rounds ?? DEFAULT_SETTINGS.rounds))),
    seconds: Math.min(300, Math.max(1, Math.round(s.seconds ?? DEFAULT_SETTINGS.seconds))),
    categories: cats.length >= MIN_CATEGORIES ? cats : DEFAULT_SETTINGS.categories,
  };
}

/**
 * Un joueur connecté à un salon de Petit bac. L'hôte fait tourner la partie (chrono, collecte des réponses, points) :
 * les autres lui envoient leurs actions, il les vérifie et publie la nouvelle vue.
 */
export class BacSession {
  private snap: Snapshot;
  private subs = new Set<(s: Snapshot) => void>();
  private offs: (() => void)[] = [];
  private meta: Meta | null = null;
  private closed = false;
  // — état complet, chez l'hôte seulement —
  private seats: Seat[] = [];
  private settings: Settings = DEFAULT_SETTINGS;
  private roundNo = 0;
  private phase: Phase = 'write';
  private letter = '';
  private used: string[] = [];
  private round: Round = { letter: '', answers: {}, contests: {} };
  private submitted: string[] = [];
  private ready: string[] = [];
  private stoppedBy: string | null = null;
  private totals: Record<string, number> = {};
  private cells: Record<string, Record<string, Cell>> | undefined;
  private roundPts: Record<string, number> | undefined;
  private endsAt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private v = 0;

  private constructor(private be: Backend, code: string, uid: string, name: string, private timing: Timing) {
    this.snap = { phase: 'connecting', code, uid, isHost: false, name, players: [], bots: [], view: null, recvAt: 0, mySeat: -1, error: null };
  }

  get snapshot() { return this.snap; }
  onChange(cb: (s: Snapshot) => void) { this.subs.add(cb); return () => { this.subs.delete(cb); }; }
  private update(patch: Partial<Snapshot>) {
    if (this.closed) return;
    this.snap = { ...this.snap, ...patch };
    for (const cb of [...this.subs]) cb(this.snap);
  }
  private fail(e: unknown) { this.update({ phase: 'error', error: e instanceof Error ? e.message : String(e) }); }
  private path = (p: string) => `bac/rooms/${this.snap.code}/${p}`;

  static async create(be: Backend, name: string, timing: Timing = DEFAULT_TIMING): Promise<BacSession> {
    const uid = await be.uid();
    for (let i = 0; i < 8; i++) {
      const code = randomCode();
      if ((await be.get(`bac/rooms/${code}/meta`)) !== null) continue;
      const s = new BacSession(be, code, uid, name.trim() || 'Joueur', timing);
      await be.set(`bac/rooms/${code}/meta`, { hostUid: uid, createdAt: Date.now(), phase: 'lobby' } satisfies Meta);
      await be.set(`bac/rooms/${code}/players/${uid}`, { name: s.snap.name, joinedAt: Date.now() });
      s.attach();
      return s;
    }
    throw new Error('Impossible de créer un salon, réessaie.');
  }

  static async join(be: Backend, rawCode: string, name: string, timing: Timing = DEFAULT_TIMING): Promise<BacSession> {
    const code = normalizeCode(rawCode);
    if (code.length !== 4) throw new Error('Le code a 4 lettres.');
    const uid = await be.uid();
    const meta = (await be.get(`bac/rooms/${code}/meta`)) as Meta | null;
    if (!meta) throw new Error('Aucun salon avec ce code.');
    const mine = (await be.get(`bac/rooms/${code}/players/${uid}`)) as LobbyPlayer | null;
    if (!mine) {
      const players = (await be.get(`bac/rooms/${code}/players`)) as Record<string, unknown> | null;
      if (meta.phase === 'lobby' && players && Object.keys(players).length >= MAX_PLAYERS) throw new Error(`Le salon est complet (${MAX_PLAYERS} joueurs).`);
      await be.set(`bac/rooms/${code}/players/${uid}`, { name: name.trim() || 'Joueur', joinedAt: Date.now() });
    }
    const s = new BacSession(be, code, uid, mine?.name ?? (name.trim() || 'Joueur'), timing);
    s.attach();
    return s;
  }

  private attach() {
    const onErr = (e: Error) => this.fail(e);
    this.offs.push(this.be.onValue(this.path('meta'), (v) => {
      if (v === null) { if (this.meta) this.update({ phase: 'error', error: 'Le salon a été fermé par son hôte.' }); return; }
      this.meta = v as Meta;
      this.update({ bots: this.meta.bots ?? [], isHost: this.meta.hostUid === this.snap.uid, phase: this.snap.view ? 'playing' : this.meta.phase === 'playing' ? 'connecting' : 'lobby' });
    }, onErr));
    this.offs.push(this.be.onValue(this.path('players'), (v) => {
      const raw = (v ?? {}) as Record<string, { name: string; joinedAt: number }>;
      this.update({ players: ordered(Object.entries(raw).map(([uid, p]) => ({ uid, name: p.name, joinedAt: p.joinedAt })), this.meta?.hostUid) });
    }, onErr));
    this.offs.push(this.be.onValue(this.path('state'), (v) => {
      const view = parse<View>(v);
      if (!view) return;
      this.update({ view, recvAt: Date.now(), phase: 'playing', mySeat: view.seats.findIndex((x) => x.uid === this.snap.uid) });
    }, onErr));
    this.offs.push(this.be.onChildAdded(this.path('intents'), (key, v) => {
      if (!this.snap.isHost) return;
      this.be.remove(this.path(`intents/${key}`)).catch(() => {});
      const raw = v as { uid?: string; json?: string } | null;
      const it = parse<Intent>(raw);
      if (raw?.uid && it) void this.apply(raw.uid, it);
    }, onErr));
  }

  // ———————— hôte ————————

  /** Hôte : lance la partie avec les joueurs présents et les réglages choisis. */
  async start(settings: Partial<Settings> = {}) {
    if (!this.snap.isHost || this.snap.phase !== 'lobby') return;
    this.settings = cleanSettings(settings);
    const humans = this.snap.players.slice(0, MAX_PLAYERS).map((p): Seat => ({ uid: p.uid, name: p.name }));
    const bots = (this.meta?.bots ?? []).slice(0, MAX_PLAYERS - humans.length).map((n, i): Seat => ({ uid: `bot-${i + 1}`, name: n, bot: true }));
    this.seats = [...humans, ...bots];
    this.totals = Object.fromEntries(this.seats.map((s) => [s.uid, 0]));
    this.roundNo = 0; this.used = [];
    try {
      await this.be.set(this.path('meta'), { ...this.meta!, phase: 'playing' });
      await this.beginRound();
    } catch (e) { this.fail(e); }
  }

  /** Hôte : ajoute une machine au salon (avant le début), dans la limite des 8 places. */
  async addBot() {
    if (!this.snap.isHost || this.snap.phase !== 'lobby' || !this.meta) return;
    const bots = this.meta.bots ?? [];
    if (this.snap.players.length + bots.length >= MAX_PLAYERS) return;
    const name = BOT_NAMES.find((n) => !bots.includes(n)) ?? `Machine ${bots.length + 1}`;
    try { await this.be.set(this.path('meta'), { ...this.meta, bots: [...bots, name] }); } catch (e) { this.fail(e); }
  }

  async removeBot(name: string) {
    if (!this.snap.isHost || this.snap.phase !== 'lobby' || !this.meta) return;
    try { await this.be.set(this.path('meta'), { ...this.meta, bots: (this.meta.bots ?? []).filter((n) => n !== name) }); } catch (e) { this.fail(e); }
  }

  private humans() { return this.seats.filter((s) => !s.bot); }

  private clearTimer() { if (this.timer) clearTimeout(this.timer); this.timer = null; }

  private async beginRound() {
    this.clearTimer();
    this.roundNo += 1;
    this.letter = drawLetter(this.used);
    this.used.push(this.letter);
    this.round = { letter: this.letter, answers: {}, contests: {} };
    this.submitted = []; this.ready = []; this.stoppedBy = null; this.cells = undefined; this.roundPts = undefined;
    this.phase = 'write';
    const total = this.timing.spinMs + this.settings.seconds * 1000;
    this.endsAt = Date.now() + total;
    this.timer = setTimeout(() => { void this.toCollect(null); }, total);
    await this.publish();
  }

  private async toCollect(by: string | null) {
    if (this.phase !== 'write') return;
    this.clearTimer();
    this.phase = 'collect'; this.stoppedBy = by;
    this.timer = setTimeout(() => { void this.toVote(); }, this.timing.collectMs);
    await this.publish();
  }

  private async toVote() {
    if (this.phase !== 'collect') return;
    this.clearTimer();
    for (const b of this.seats.filter((x) => x.bot)) {
      this.round.answers[b.uid] = botAnswers(this.letter, this.settings.categories);
      if (!this.submitted.includes(b.uid)) this.submitted = [...this.submitted, b.uid];
    }
    this.phase = 'vote'; this.ready = this.seats.filter((x) => x.bot).map((x) => x.uid); // les machines ont déjà « fini de voter »
    if (this.ready.length >= this.seats.length) { await this.toScores(); return; }
    await this.publish();
  }

  private async toScores() {
    if (this.phase !== 'vote') return;
    const { cells, totals } = scoreRound(this.round, this.seats.map((s) => s.uid), this.settings.categories, this.humans().map((s) => s.uid));
    this.cells = cells; this.roundPts = totals;
    for (const [u, p] of Object.entries(totals)) this.totals[u] = (this.totals[u] ?? 0) + p;
    this.phase = 'scores';
    await this.publish();
  }

  /** Hôte : manche suivante, ou classement final après la dernière. */
  async next() {
    if (!this.snap.isHost) return;
    try {
      if (this.phase === 'vote') return await this.toScores();
      if (this.phase !== 'scores') return;
      if (this.roundNo >= this.settings.rounds) { this.phase = 'final'; await this.publish(); return; }
      await this.beginRound();
    } catch (e) { this.fail(e); }
  }

  private async publish() {
    this.v += 1;
    const showAnswers = this.phase === 'vote' || this.phase === 'scores' || this.phase === 'final';
    const view: View = {
      v: this.v, seats: this.seats, settings: this.settings, roundNo: this.roundNo, phase: this.phase, letter: this.letter,
      remainingMs: this.phase === 'write' ? Math.max(0, this.endsAt - Date.now()) : 0, spinMs: this.timing.spinMs,
      stoppedBy: this.stoppedBy, submitted: this.submitted, ready: this.ready,
      ...(showAnswers ? { round: this.round } : {}),
      ...(this.phase === 'scores' || this.phase === 'final' ? { cells: this.cells, roundPts: this.roundPts } : {}),
      totals: this.totals,
    };
    await this.be.set(this.path('state'), { json: JSON.stringify(view) });
  }

  /** Hôte : n'accepte que les actions des joueurs assis, au bon moment. */
  private async apply(uid: string, it: Intent) {
    if (!this.seats.some((s) => s.uid === uid)) return;
    try {
      if (it.t === 'stop') {
        if (this.phase === 'write') await this.toCollect(uid);
      } else if (it.t === 'answers') {
        if ((this.phase !== 'collect' && this.phase !== 'write') || this.submitted.includes(uid)) return;
        const clean: Record<string, string> = {};
        for (const cat of this.settings.categories) clean[cat] = String(it.answers?.[cat] ?? '').slice(0, 40);
        this.round.answers[uid] = clean;
        this.submitted = [...this.submitted, uid];
        if (this.phase === 'collect' && this.humans().every((h) => this.submitted.includes(h.uid))) await this.toVote();
        else await this.publish();
      } else if (it.t === 'contest') {
        if (this.phase !== 'vote' || uid === it.target || !this.settings.categories.includes(it.cat) || !this.seats.some((s) => s.uid === it.target)) return;
        const byAuthor = (this.round.contests[it.cat] ??= {});
        const list = (byAuthor[it.target] ?? []).filter((u) => u !== uid);
        byAuthor[it.target] = it.on ? [...list, uid] : list;
        await this.publish();
      } else if (it.t === 'ready') {
        if (this.phase !== 'vote' || this.ready.includes(uid)) return;
        this.ready = [...this.ready, uid];
        if (this.ready.length >= this.seats.length) await this.toScores();
        else await this.publish();
      }
    } catch (e) { this.fail(e); }
  }

  /** Envoie une action (si tu es assis). Chez l'hôte elle s'applique tout de suite ; sinon elle lui est envoyée. */
  async act(it: Intent) {
    if (this.snap.mySeat < 0) return;
    try {
      if (this.snap.isHost) await this.apply(this.snap.uid, it);
      else await this.be.push(this.path('intents'), { uid: this.snap.uid, json: JSON.stringify(it) });
    } catch (e) { this.fail(e); }
  }

  leave() {
    this.closed = true;
    this.clearTimer();
    for (const off of this.offs) off();
    this.offs = [];
    if (this.snap.isHost) void this.be.remove(this.path('meta')).catch(() => {});
    void this.be.remove(this.path(`players/${this.snap.uid}`)).catch(() => {});
  }
}
