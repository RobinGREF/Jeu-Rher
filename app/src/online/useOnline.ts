import { useEffect, useRef, useState } from 'react';
import { getBackend, onlineKind, type OnlineKind } from './index';
import { OnlineSession, type Snapshot } from './session';

/** Une session en ligne pour l'écran : créer, rejoindre, quitter, et l'état courant du salon ou de la partie. */
export function useOnline() {
  const ref = useRef<OnlineSession | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const kind: OnlineKind | null = onlineKind();

  const attach = (s: OnlineSession) => {
    ref.current?.leave();
    ref.current = s;
    setSnap(s.snapshot);
    s.onChange(setSnap);
  };
  const run = async (make: (be: NonNullable<ReturnType<typeof getBackend>>) => Promise<OnlineSession>) => {
    const be = getBackend();
    if (!be) return setError("Le mode en ligne n'est pas configuré.");
    setBusy(true); setError(null);
    try { attach(await make(be)); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  useEffect(() => () => { ref.current?.leave(); }, []);

  return {
    kind, snap, busy, error, session: ref,
    create: (name: string) => run((be) => OnlineSession.create(be, name)),
    join: (code: string, name: string) => run((be) => OnlineSession.join(be, code, name)),
    leave: () => { ref.current?.leave(); ref.current = null; setSnap(null); setError(null); },
  };
}
