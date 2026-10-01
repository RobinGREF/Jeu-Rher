import { useEffect, useRef, useState } from 'react';
import { getBackend, onlineKind, type OnlineKind } from './index';
import { DuelSession, type Snapshot } from './session';

/** Une session en ligne pour l'écran : créer, rejoindre, quitter, et l'état courant du salon ou de la partie. */
export function useDuelOnline() {
  const ref = useRef<DuelSession | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const kind: OnlineKind | null = onlineKind();

  const run = async (make: (be: NonNullable<ReturnType<typeof getBackend>>) => Promise<DuelSession>) => {
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
    kind, snap, busy, error, session: ref,
    create: (name: string) => run((be) => DuelSession.create(be, name)),
    join: (code: string, name: string) => run((be) => DuelSession.join(be, code, name)),
    leave: () => { ref.current?.leave(); ref.current = null; setSnap(null); setError(null); },
  };
}
