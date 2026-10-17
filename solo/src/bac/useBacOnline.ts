import { useEffect, useRef, useState } from 'react';
import { getBackend, onlineKind, type OnlineKind } from '../duel/online';
import { BacSession, type Snapshot } from './session';
import type { Known } from './engine';
import { loadKnown } from './dictionary';

/** Une session en ligne pour l'écran : créer, rejoindre, quitter, et l'état courant du salon ou de la partie. */
export function useBacOnline() {
  const ref = useRef<BacSession | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const kind: OnlineKind | null = onlineKind();
  const [known, setKnown] = useState<Known | null>(null);
  const knownRef = useRef<Known | null>(null);
  // Le dictionnaire se charge en arrière-plan dès l'ouverture du jeu.
  useEffect(() => { void loadKnown().then((k) => { knownRef.current = k; setKnown(() => k); }); }, []);
  const timing = { collectMs: 4000, spinMs: 3600, known: () => knownRef.current };

  const run = async (make: (be: NonNullable<ReturnType<typeof getBackend>>) => Promise<BacSession>) => {
    const be = getBackend();
    if (!be) return setError("Le mode en ligne n'est pas configuré.");
    setBusy(true); setError(null);
    try {
      const s = await make(be);
      ref.current?.leave();
      ref.current = s;
      setSnap(s.snapshot);
      s.onChange(setSnap);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  useEffect(() => () => { ref.current?.leave(); }, []);

  return {
    kind, snap, busy, error, session: ref, known,
    create: (name: string) => run((be) => BacSession.create(be, name, timing)),
    join: (code: string, name: string) => run((be) => BacSession.join(be, code, name, timing)),
    leave: () => { ref.current?.leave(); ref.current = null; setSnap(null); setError(null); },
  };
}
