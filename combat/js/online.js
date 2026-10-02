/* FAMILLY FIGHT — accès à la base en temps réel.
 * Deux « serveurs » interchangeables, même interface :
 *   - Firebase (vrai mode en ligne, via le SDK chargé à la demande) ;
 *   - local (deux onglets du même navigateur, pour essayer : ajouter ?online=local à l'adresse).
 * Interface : uid(), get(path), set(path, valeur), remove(path), onValue(path, cb, onErr) -> désabonnement,
 *             removeOnDisconnect(path). */
(() => {
'use strict';

const FB_SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';

/* ------------------------------------------------------------- local (onglets) */
function localBackend() {
  const KEY = 'rf_localdb';
  let uid = null;
  try { uid = sessionStorage.getItem('rf_uid'); } catch (e) { /* ignoré */ }
  if (!uid) {
    uid = 'u' + Math.random().toString(36).slice(2, 10);
    try { sessionStorage.setItem('rf_uid', uid); } catch (e) { /* ignoré */ }
  }
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
  const write = db => localStorage.setItem(KEY, JSON.stringify(db));
  const parts = p => p.split('/').filter(Boolean);
  const getAt = (db, p) => { let o = db; for (const k of parts(p)) { if (o == null || typeof o !== 'object') return null; o = o[k]; } return o === undefined ? null : o; };
  function setAt(db, p, v) {
    const ks = parts(p), chain = [db];
    for (let i = 0; i < ks.length - 1; i++) {
      if (typeof chain[i][ks[i]] !== 'object' || chain[i][ks[i]] === null) { if (v === null) return; chain[i][ks[i]] = {}; }
      chain.push(chain[i][ks[i]]);
    }
    const last = ks[ks.length - 1];
    if (v === null) delete chain[chain.length - 1][last]; else chain[chain.length - 1][last] = v;
    for (let i = chain.length - 1; i > 0; i--) if (!Object.keys(chain[i]).length) delete chain[i - 1][ks[i - 1]];
  }
  const listeners = new Set();
  function notify() {
    const db = read();
    for (const l of listeners) {
      const v = getAt(db, l.path), s = JSON.stringify(v);
      if (s !== l.last) { l.last = s; l.cb(v === null ? null : JSON.parse(s)); }
    }
  }
  window.addEventListener('storage', e => { if (e.key === KEY) notify(); });
  return {
    kind: 'local',
    async uid() { return uid; },
    async get(p) { return getAt(read(), p); },
    async set(p, v) { const db = read(); setAt(db, p, JSON.parse(JSON.stringify(v))); write(db); setTimeout(notify, 0); },
    async remove(p) { const db = read(); setAt(db, p, null); write(db); setTimeout(notify, 0); },
    onValue(p, cb) {
      const l = { path: p, cb, last: undefined };
      listeners.add(l);
      setTimeout(() => { if (listeners.has(l)) { const v = getAt(read(), p); l.last = JSON.stringify(v); cb(v); } }, 0);
      return () => listeners.delete(l);
    },
    removeOnDisconnect(p) {
      window.addEventListener('pagehide', () => { const db = read(); setAt(db, p, null); write(db); });
    }
  };
}

/* ------------------------------------------------------------- Firebase */
async function firebaseBackend(cfg) {
  const [appM, authM, dbM] = await Promise.all([
    import(FB_SDK + 'firebase-app.js'),
    import(FB_SDK + 'firebase-auth.js'),
    import(FB_SDK + 'firebase-database.js')
  ]);
  const app = appM.getApps()[0] || appM.initializeApp(cfg);
  const auth = authM.getAuth(app), db = dbM.getDatabase(app);
  const ready = new Promise((resolve, reject) => {
    const off = authM.onAuthStateChanged(auth, u => { if (u) { off(); resolve(u.uid); } }, reject);
    if (!auth.currentUser) authM.signInAnonymously(auth).catch(reject);
  });
  const ref = p => dbM.ref(db, p);
  return {
    kind: 'firebase',
    uid: () => ready,
    async get(p) { return (await dbM.get(ref(p))).val(); },
    async set(p, v) { await dbM.set(ref(p), v); },
    async remove(p) { await dbM.remove(ref(p)); },
    onValue(p, cb, onErr) { return dbM.onValue(ref(p), s => cb(s.val()), e => onErr && onErr(e)); },
    removeOnDisconnect(p) { dbM.onDisconnect(ref(p)).remove(); }
  };
}

/* ------------------------------------------------------------- choix */
let cached = null;
async function makeBackend() {
  if (cached) return cached;
  const local = /[?&]online=local\b/.test(location.search);
  if (local) { cached = localBackend(); return cached; }
  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey || !cfg.databaseURL) throw new Error('Mode en ligne non configuré.');
  try { cached = await Promise.race([firebaseBackend(cfg), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000))]); }
  catch (e) { throw new Error('Connexion impossible (mode en ligne indisponible ici).'); }
  return cached;
}

window.Online = { makeBackend };
})();
