import {
  blockRisk, botDelayMs, botMove, completedBetween, newGame, nextMedal, play, syncBotAnnouncements, syncBotSignals,
  setCanDo, setPass, toggleSignal, unanswered, type GameState, type SignalKind,
} from '../engine';
import { SYMBOLS } from '../symbols';
import type { Backend } from './backend';
import { publishScore } from './sharedScores';
import { fromWire, toWire, type LastWire, type Options, type PublicState, type SeatInfo } from './wire';

/** Demande d'un joueur à l'hôte. */
export type Intent =
  | { uid: string; type: 'play'; cardId: number; pile: number }
  | { uid: string; type: 'canDo'; missions: string[]; free?: boolean }
  | { uid: string; type: 'pass' }
  | { uid: string; type: 'go' }
  | { uid: string; type: 'signal'; kind: SignalKind; mission?: string; pile?: number };

const MEDAL_TXT = { bronze: 'de bronze', argent: "d'argent", or: "d'or" } as const;

/**
 * L'hôte fait tourner la vraie partie (avec le moteur de jeu), applique les demandes des joueurs,
 * joue pour les machines, puis publie : l'état public pour tous, et sa main à chacun en privé.
 */
export class Host {
  private g!: GameState;
  private seats!: SeatInfo[];
  private history: string[] = [];
  private last: LastWire | null = null;
  private n = 0;
  private v = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private off: (() => void) | null = null;
  private queue: Promise<void> = Promise.resolve();
  private stopped = false;
  private scoreSaved = false;
  private refused = new Set<string>();
  private rng: () => number = Math.random;

  private constructor(private be: Backend, private code: string, private options: Options) {}

  private path = (p: string) => `rooms/${this.code}/${p}`;

  /** Nouvelle partie. `seats` : les joueurs humains d'abord, puis les machines. */
  static async launch(be: Backend, code: string, seats: SeatInfo[], options: Options, rng?: () => number): Promise<Host> {
    const h = new Host(be, code, options);
    if (rng) h.rng = rng;
    h.seats = seats;
    h.g = h.sync(newGame(seats.length, rng));
    await h.start();
    return h;
  }

  /** Reprise après un rechargement de l'hôte. */
  static async resume(be: Backend, code: string, options: Options): Promise<Host | null> {
    const raw = (await be.get(`rooms/${code}/hostState`)) as { json?: string } | null;
    if (!raw?.json) return null;
    const s = JSON.parse(raw.json);
    const h = new Host(be, code, options);
    h.g = fromWire(s.game);
    h.seats = s.seats; h.history = s.history; h.last = s.last; h.n = s.n; h.v = s.v;
    await h.start();
    return h;
  }

  private async start() {
    this.off = this.be.onChildAdded(this.path('intents'), (id, raw) => this.handle(id, raw as Intent));
    await this.enqueuePublish();
    this.scheduleBots();
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.off?.();
  }

  /** Tour de table obligatoire et quelqu'un n'a pas encore répondu : personne ne peut jouer. */
  private gated = () => this.options.ask === true && unanswered(this.g).length > 0;

  /** « À mon clic » ne sert que sans tour de table : avec lui, la machine joue seule dès que tout le monde a répondu. */
  private clickMode = () => this.options.manual && this.options.ask !== true;

  private botSeats = () => this.seats.flatMap((s, i) => (s.bot ? [i] : []));
  private sync(g: GameState): GameState {
    const bots = this.botSeats();
    const a = syncBotAnnouncements(g, bots);
    return this.options.phrases ? syncBotSignals(a, bots) : a;
  }

  /** Applique un coup ; renvoie false s'il est refusé (mauvais tour, carte absente, coup illégal). */
  private apply(seat: number, cardId: number, pile: number): boolean {
    const before = this.g;
    if (before.over || seat !== before.current) return false;
    const card = before.hands[seat].find((c) => c.id === cardId);
    const covered = before.piles[pile]?.[before.piles[pile].length - 1];
    if (!card || !covered) return false;
    const r = play(before, cardId, pile);
    if (!r.ok) return false;
    const { done, gained } = completedBetween(before, r.state);
    const medal = r.state.medal && r.state.medal !== before.medal ? MEDAL_TXT[r.state.medal] : null;
    this.last = { n: ++this.n, seat, card, covered, pile, gained, done: done.map((d) => ({ id: d.def.id, idx: d.idx })), medal };
    this.history.unshift(`${this.seats[seat].name} : ${card.value}${SYMBOLS[card.symbol].emoji} sur le tas ${pile + 1}${gained ? ` · 🎯 +${gained} mission${gained > 1 ? 's' : ''}` : ''}`);
    if (this.history.length > 300) this.history.length = 300;
    this.g = this.sync(r.state);
    return true;
  }

  /** Demande d'un joueur (reçue du réseau, ou de l'hôte lui-même). */
  submit(it: Intent) {
    const seat = this.seats.findIndex((s) => s.uid === it.uid);
    if (seat < 0 || this.stopped) return;
    if ((it.type === 'play' || it.type === 'go') && this.gated()) return; // chacun doit d'abord répondre
    if (it.type === 'play') {
      if (!this.apply(seat, it.cardId, it.pile)) return;
    } else if (it.type === 'go') {
      // Feu vert d'un joueur : la machine dont c'est le tour joue maintenant.
      if (!this.waiting()) return;
      const s = this.g.current;
      const mv = botMove(this.g, s, this.rng);
      if (!mv || !this.apply(s, mv.cardId, mv.pile)) return;
    } else if (it.type === 'canDo') {
      this.g = setCanDo(this.g, seat, Array.isArray(it.missions) ? it.missions : [], it.free === true); // refusée si le joueur ne peut rien réussir (sauf s'il a coupé l'indice)
    } else if (it.type === 'pass') {
      this.g = setPass(this.g, seat);
    } else if (it.type === 'signal') {
      if (!this.options.phrases) return;
      this.g = toggleSignal(this.g, { player: seat, kind: it.kind, mission: it.mission, pile: it.pile });
    }
    this.enqueuePublish();
    this.scheduleBots();
  }

  private handle(id: string, it: Intent) {
    this.be.remove(this.path(`intents/${id}`)).catch(() => {});
    this.submit(it);
  }

  /** Un spectateur prend la place d'une machine (accepté par l'hôte). Renvoie false s'il n'y a plus de machine à remplacer. */
  takeSeat(uid: string, name: string): boolean {
    if (this.stopped || this.g.over) return false;
    if (this.seats.some((s) => s.uid === uid)) return true;
    // On remplace de préférence une machine dont ce n'est pas le tour.
    const bots = this.botSeats();
    const i = bots.find((b) => b !== this.g.current) ?? bots[0];
    if (i === undefined) return false;
    const old = this.seats[i].name;
    this.seats[i] = { name, bot: false, uid };
    this.refused.delete(uid);
    // La nouvelle personne répond elle-même : on retire les réponses de la machine qu'elle remplace.
    this.g = this.sync({ ...this.g, canDo: this.g.canDo.filter((a) => a.player !== i), passed: this.g.passed.filter((p) => p !== i) });
    this.history.unshift(`${name} rejoint la table à la place de ${old}`);
    this.enqueuePublish();
    this.scheduleBots();
    return true;
  }

  /** L'hôte refuse la demande d'un spectateur. */
  refuse(uid: string) {
    this.refused.add(uid);
    this.enqueuePublish();
  }

  /** Un joueur absent est remplacé par une machine pour que la partie continue. */
  botify(seat: number) {
    const s = this.seats[seat];
    if (!s || s.bot || this.stopped) return;
    this.seats[seat] = { name: `${s.name} (machine)`, bot: true };
    this.g = this.sync(this.g);
    this.enqueuePublish();
    this.scheduleBots();
  }

  /** Siège de la machine qui attend le feu vert d'un joueur (mode « à mon clic »), sinon null. */
  private waiting = (): number | null =>
    this.clickMode() && !this.stopped && !this.g.over && this.seats[this.g.current]?.bot ? this.g.current : null;

  private scheduleBots() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.stopped || this.g.over || !this.seats[this.g.current]?.bot || this.clickMode() || this.gated()) return;
    this.timer = setTimeout(() => {
      const seat = this.g.current;
      const mv = this.gated() ? null : botMove(this.g, seat, this.rng);
      if (mv && this.apply(seat, mv.cardId, mv.pile)) this.enqueuePublish();
      this.scheduleBots();
    }, botDelayMs(this.options.pauseMs, this.g.canDo.some((a) => this.seats[a.player]?.bot)));
  }

  private enqueuePublish() {
    this.queue = this.queue.then(() => this.publish()).catch(() => {});
    return this.queue;
  }

  private async publish() {
    const g = this.g;
    // Les mains privées d'abord, puis l'état public : un joueur ne voit jamais un état sans sa main à jour.
    await Promise.all(
      this.seats.flatMap((s, i) => (s.uid ? [this.be.set(this.path(`hands/${s.uid}`), { json: JSON.stringify(g.hands[i]) })] : [])),
    );
    const nm = nextMedal(g);
    const pub: PublicState = {
      v: ++this.v, seats: this.seats,
      current: g.current, completed: g.completed, medal: g.medal, goldReached: g.goldReached, over: g.over,
      missions: g.missions.map((m) => m.id),
      piles: g.piles.map((p) => ({ top: p[p.length - 1], depth: p.length - 1 })),
      deckCount: g.symbolDeck.length, handCounts: g.hands.map((h) => h.length), ...(g.over ? { finalHands: g.hands } : {}),
      canDo: g.canDo, passed: g.passed, signals: g.signals, risk: blockRisk(g),
      nextMedal: nm ? { medal: nm.medal, needed: nm.missionsNeeded } : null,
      awaitingGo: this.waiting(), refused: [...this.refused],
      last: this.last, history: this.history.slice(0, 30), options: this.options,
    };
    await this.be.set(this.path('public'), { json: JSON.stringify(pub) });
    // Fin de partie : le résultat va au tableau partagé (une seule fois ; sans effet si les règles ne l'autorisent pas encore).
    if (g.over && !this.scoreSaved) {
      this.scoreSaved = true;
      await publishScore(this.be, this.code, {
        id: this.code, at: Date.now(), completed: g.completed, medal: g.medal, plays: this.n, mode: 'online',
        players: this.seats.map((s) => ({ name: s.name, bot: s.bot })),
      }).catch(() => {});
    }
    await this.be.set(this.path('hostState'), {
      json: JSON.stringify({ game: toWire(g), seats: this.seats, history: this.history, last: this.last, n: this.n, v: this.v }),
    });
  }
}
