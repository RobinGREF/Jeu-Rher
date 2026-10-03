/* Musique de Familly Fight : un morceau identifié par décor (data.js : champ `music` de chaque décor) + un thème de menu.
 * Tout est synthétisé par le navigateur (moteur musiccore.js), aucune œuvre existante. */
(() => {
  const TRACKS = [
    { id: 'menu',    name: 'Arène des familles',    emoji: '🥊', bpm: 128, root: 57, mode: 'minor',         prog: [0, 5, 3, 4], lead: 'square',   bass: 'triangle', drums: 'rock',  density: 0.6,  seed: 101 },
    { id: 'dojo',    name: 'Dojo du crépuscule',    emoji: '🏯', bpm: 100, root: 62, mode: 'pentatonic',    prog: [0, 3, 4, 3], lead: 'triangle', bass: 'sine',     drums: 'march', density: 0.5,  seed: 102, pad: true },
    { id: 'neon',    name: 'Néon à minuit',         emoji: '🌃', bpm: 140, root: 57, mode: 'dorian',        prog: [0, 0, 3, 4], lead: 'sawtooth', bass: 'square',   drums: 'dance', density: 0.7,  seed: 103 },
    { id: 'temple',  name: 'Pierres éternelles',    emoji: '🏛️', bpm: 90,  root: 55, mode: 'harmonicMinor', prog: [0, 5, 4, 0], lead: 'triangle', bass: 'sine',     drums: 'march', density: 0.45, seed: 104, pad: true },
    { id: 'volcan',  name: 'Fureur du volcan',      emoji: '🌋', bpm: 156, root: 52, mode: 'phrygian',      prog: [0, 1, 0, 4], lead: 'sawtooth', bass: 'square',   drums: 'rock',  density: 0.75, seed: 105 },
    { id: 'soleil',  name: 'Dernier rayon',         emoji: '🌅', bpm: 112, root: 60, mode: 'mixolydian',    prog: [0, 3, 4, 0], lead: 'box',      bass: 'triangle', drums: 'soft',  density: 0.55, seed: 106, pad: true }
  ];
  const byId = Object.fromEntries(TRACKS.map(t => [t.id, t]));
  let on = true;
  try { on = localStorage.getItem('rf_music') !== '0'; } catch (e) {}
  let ctxGetter = () => null, player = null, wantedId = null, playingId = null;

  window.FFMusic = {
    on: () => on,
    track: id => byId[id] || byId.menu,
    /** À appeler au démarrage avec une fonction qui renvoie l'AudioContext du jeu (ou null). */
    init(getCtx) { ctxGetter = getCtx; player = new MusicCore.MusicPlayer(() => ctxGetter()); },
    /** Morceau voulu pour l'écran courant (id) ; appelé à chaque image, ne fait rien si rien ne change. */
    sync(id) {
      if (!player) return;
      wantedId = on ? id : null;
      if (wantedId === playingId && (wantedId === null || player.running)) return;
      if (wantedId === null) { player.stop(); playingId = null; return; }
      if (player.play(byId[wantedId])) playingId = wantedId; // renvoie false tant que le son n'est pas autorisé : on réessaie à l'image suivante
    },
    toggle() {
      on = !on;
      try { localStorage.setItem('rf_music', on ? '1' : '0'); } catch (e) {}
      if (!on && player) { player.stop(); playingId = null; }
      return on;
    }
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden && player) { player.stop(); playingId = null; } });
})();
