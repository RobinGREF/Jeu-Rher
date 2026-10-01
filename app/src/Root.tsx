import App from '../App';
import { DuelGame } from './duel/DuelGame';
import { MemoGame } from './memo/MemoGame';
import { gameFromSearch, hubUrl } from './route';

/** Les jeux de l'appli sont choisis par l'adresse ; la liste des jeux est la page d'accueil du site (dossier hub/). */
export default function Root() {
  const web = typeof window !== 'undefined';
  const game = web ? gameFromSearch(window.location.search) : 'missions';
  const goHub = () => { if (web) window.location.href = hubUrl(window.location.href); };
  if (game === 'duel') return <DuelGame onHome={goHub} />;
  if (game === 'memo') return <MemoGame onHome={goHub} />;
  return <App />;
}
