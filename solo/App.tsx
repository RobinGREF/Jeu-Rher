import { BacGame } from './src/bac/BacGame';
import { DuelGame } from './src/duel/DuelGame';
import { MemoGame } from './src/memo/MemoGame';

/** Retour à la page d'accueil « Jeu des vacances » (un niveau au-dessus de ce jeu). */
const goHome = () => { try { window.location.href = '../'; } catch { /* hors navigateur */ } };

// Un seul code pour les petits jeux solo ; chaque jeu est construit à part (EXPO_PUBLIC_GAME) et a son adresse.
export default function App() {
  const game = process.env.EXPO_PUBLIC_GAME;
  if (game === 'memo') return <MemoGame onHome={goHome} />;
  if (game === 'bac') return <BacGame onHome={goHome} />;
  return <DuelGame onHome={goHome} />;
}
