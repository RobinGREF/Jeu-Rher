import { useEffect, useState } from 'react';
import App from '../App';
import { DuelGame } from './duel/DuelGame';
import { GameHub, type GameId } from './GameHub';
import { MemoGame } from './memo/MemoGame';
import { loadJson, saveJson } from './storage';

const KEY_GAME = 'hub-game';

/** Liste des jeux, puis le jeu choisi. Le jeu en cours est retenu pour rouvrir au même endroit. */
export default function Root() {
  const [game, setGame] = useState<GameId | null>(() => loadJson<GameId | null>(KEY_GAME, null));
  useEffect(() => { saveJson(KEY_GAME, game); }, [game]);
  const home = () => setGame(null);

  if (game === 'missions') return <App onHome={home} />;
  if (game === 'duel') return <DuelGame onHome={home} />;
  if (game === 'memo') return <MemoGame onHome={home} />;
  return <GameHub onPick={setGame} />;
}
