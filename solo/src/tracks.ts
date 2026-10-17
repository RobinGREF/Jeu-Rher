import type { TrackSpec } from './musicCore';

/** Duel de savoir : ambiance de jeu télévisé, du suspense à la détente. */
export const TRACKS_DUEL: TrackSpec[] = [
  { id: 'plateau', name: 'Plateau télé', emoji: '📺', bpm: 112, root: 60, mode: 'major', prog: [0, 5, 3, 4], lead: 'triangle', bass: 'triangle', drums: 'march', density: 0.55, seed: 101 },
  { id: 'suspense', name: 'Suspense', emoji: '⏳', bpm: 84, root: 55, mode: 'minor', prog: [0, 0, 5, 4], lead: 'triangle', bass: 'sine', pad: true, drums: 'pulse', density: 0.4, seed: 102 },
  { id: 'biblio', name: 'Bibliothèque', emoji: '📚', bpm: 70, root: 65, mode: 'pentatonic', prog: [0, 2, 3, 1], lead: 'box', bass: 'sine', pad: true, drums: 'none', density: 0.35, seed: 103 },
  { id: 'grand', name: 'Grand duel', emoji: '⚔️', bpm: 128, root: 59, mode: 'harmonicMinor', prog: [0, 5, 3, 4], lead: 'square', bass: 'sawtooth', drums: 'dance', density: 0.65, seed: 104 },
];

/** Mémo des paires : doux et joueur, à la boîte à musique. */
export const TRACKS_MEMO: TrackSpec[] = [
  { id: 'comptine', name: 'Comptine', emoji: '🧸', bpm: 100, root: 67, mode: 'major', meter: 6, prog: [0, 3, 4, 0], lead: 'box', bass: 'sine', drums: 'waltz', density: 0.6, seed: 201 },
  { id: 'nuage', name: 'Nuage', emoji: '☁️', bpm: 66, root: 64, mode: 'pentatonic', prog: [0, 2, 3, 1], lead: 'box', bass: 'sine', pad: true, drums: 'none', density: 0.3, seed: 202 },
  { id: 'jardin', name: 'Jardin', emoji: '🌼', bpm: 92, root: 60, mode: 'lydian', prog: [0, 1, 3, 0], lead: 'triangle', bass: 'sine', pad: true, drums: 'soft', density: 0.5, seed: 203 },
  { id: 'petits', name: 'Petits pas', emoji: '👣', bpm: 108, root: 65, mode: 'major', prog: [0, 4, 5, 3], lead: 'triangle', bass: 'triangle', drums: 'march', density: 0.55, seed: 204 },
];

/** Petit bac : de l'urgence du chrono à l'ambiance de salon. */
export const TRACKS_BAC: TrackSpec[] = [
  { id: 'chrono', name: 'Le chrono tourne', emoji: '⏱️', bpm: 132, root: 62, mode: 'dorian', prog: [0, 3, 0, 4], lead: 'square', bass: 'triangle', drums: 'dance', density: 0.65, seed: 301 },
  { id: 'cerveau', name: 'Cerveau en marche', emoji: '🧠', bpm: 104, root: 57, mode: 'minor', prog: [0, 5, 3, 4], lead: 'triangle', bass: 'sine', pad: true, drums: 'pulse', density: 0.45, seed: 302 },
  { id: 'salon', name: 'Ambiance de salon', emoji: '🛋️', bpm: 84, root: 60, mode: 'mixolydian', prog: [0, 3, 4, 3], lead: 'box', bass: 'sine', pad: true, drums: 'soft', density: 0.4, seed: 303 },
];
