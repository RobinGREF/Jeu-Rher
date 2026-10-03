import type { Ev, Track, TrackSpec } from './musicCore';

/** « Marin » : la mélodie écrite à la main (ré dorien, 6/8), reprise telle quelle. */
function marin(): Track {
  const MELODY = [
    [62, 0, 65, 69, 0, 65], [67, 0, 69, 74, 0, 69], [64, 0, 67, 72, 0, 67], [62, 65, 69, 74, 0, 0],
    [69, 0, 72, 74, 0, 72], [74, 0, 71, 67, 0, 71], [69, 0, 65, 64, 0, 65], [62, 0, 0, 57, 0, 62],
  ];
  const BASS = [38, 38, 36, 38, 38, 43, 45, 38];
  const events: Ev[] = [];
  MELODY.forEach((bar, b) => bar.forEach((m, slot) => {
    const s = b * 6 + slot;
    if (m) events.push({ s, d: 2, m, v: 'lead' });
    if (slot === 0 || slot === 3) { events.push({ s, d: 3, m: BASS[b], v: 'bass' }, { s, d: 1, m: 0, v: 'kick' }); }
    else if (slot % 3 === 1) events.push({ s, d: 1, m: 0, v: 'hat' });
  }));
  return { stepSec: 0.2, steps: 48, events };
}

/** Morceaux de 50 Missions : un esprit d'aventure coopérative, du plus entraînant au plus calme. */
export const TRACKS_50M: TrackSpec[] = [
  { id: 'marin', name: 'Marin', emoji: '⚓', bpm: 150, root: 62, mode: 'dorian', prog: [0], lead: 'triangle', bass: 'sine', drums: 'march', density: 0.5, seed: 1, fixed: marin() },
  { id: 'horizon', name: "Cap sur l'horizon", emoji: '⛵', bpm: 118, root: 60, mode: 'major', prog: [0, 4, 5, 3], lead: 'square', bass: 'triangle', drums: 'march', density: 0.6, seed: 11 },
  { id: 'mystere', name: 'Mystère des cartes', emoji: '🔮', bpm: 92, root: 57, mode: 'minor', prog: [0, 5, 3, 4], lead: 'triangle', bass: 'sine', pad: true, drums: 'soft', density: 0.45, seed: 22 },
  { id: 'soir', name: 'Détente du soir', emoji: '🌙', bpm: 74, root: 62, mode: 'pentatonic', prog: [0, 2, 3, 1], lead: 'box', bass: 'sine', pad: true, drums: 'none', density: 0.4, seed: 33 },
  { id: 'theatre', name: 'Coup de théâtre', emoji: '🎭', bpm: 134, root: 62, mode: 'dorian', prog: [0, 3, 6, 4], lead: 'sawtooth', bass: 'triangle', drums: 'dance', density: 0.7, seed: 44 },
];
export const DEFAULT_TRACK_50M = 'marin';
