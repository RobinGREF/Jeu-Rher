/** Alertes quand la page n'est pas sous les yeux : son discret, vibration, titre de l'onglet qui clignote. */

/** Noms des joueurs arrivés depuis la dernière liste (sans toi). */
export function joinedNames(prev: string[] | null, players: { uid: string; name: string }[], myUid: string): string[] {
  if (prev === null) return []; // première liste reçue : personne n'« arrive »
  return players.filter((p) => p.uid !== myUid && !prev.includes(p.uid)).map((p) => p.name);
}

let ctx: AudioContext | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let baseTitle: string | null = null;

function beep(kind: 'join' | 'turn') {
  try {
    const AC = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    const notes = kind === 'join' ? [660, 880] : [880, 1100];
    notes.forEach((f, i) => {
      const t0 = ctx!.currentTime + i * 0.16;
      const o = ctx!.createOscillator(); const g = ctx!.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
      o.connect(g); g.connect(ctx!.destination); o.start(t0); o.stop(t0 + 0.16);
    });
  } catch { /* pas de son */ }
}

function flashTitle(msg: string) {
  if (typeof document === 'undefined' || !document.hidden) return;
  baseTitle ??= document.title;
  if (timer) clearInterval(timer);
  let on = false;
  const tick = () => { on = !on; document.title = on ? `🔔 ${msg}` : baseTitle!; };
  tick();
  timer = setInterval(tick, 1000);
  const stop = () => {
    if (document.hidden) return;
    if (timer) clearInterval(timer);
    timer = null;
    if (baseTitle !== null) document.title = baseTitle;
    baseTitle = null;
    document.removeEventListener('visibilitychange', stop);
  };
  document.addEventListener('visibilitychange', stop);
}

/** Prévient le joueur : bip, vibration courte, et titre de l'onglet si la page est cachée. */
export function alertPlayer(msg: string, kind: 'join' | 'turn', enabled = true) {
  if (!enabled) return;
  beep(kind);
  try { globalThis.navigator?.vibrate?.(kind === 'join' ? [120, 80, 120] : [200]); } catch { /* pas de vibration */ }
  flashTitle(msg);
}
