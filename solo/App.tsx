import { DuelGame } from './src/duel/DuelGame';
import { MemoGame } from './src/memo/MemoGame';

/** Retour à la page d'accueil « Jeu Robin » (un niveau au-dessus de ce jeu). */
const goHome = () => { try { window.location.href = '../'; } catch { /* hors navigateur */ } };

// Un seul code pour les petits jeux solo ; chaque jeu est construit à part (EXPO_PUBLIC_GAME) et a son adresse.
export default function App() {
  const game = process.env.EXPO_PUBLIC_GAME;
  return game === 'memo' ? <MemoGame onHome={goHome} /> : <DuelGame onHome={goHome} />;
}
