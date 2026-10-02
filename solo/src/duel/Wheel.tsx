import Svg, { Circle, Path } from 'react-native-svg';
import { catInfo, CATEGORY_TARGET, progressOf } from './engine';
import type { DuelGame } from './types';
import { sectorPath } from './wheelPath';

/** La rosace d'un joueur : une part par catégorie, qui grossit du centre vers l'extérieur à mesure qu'elle se remplit. */
export function Wheel({ game, player, size = 130 }: { game: DuelGame; player: number; size?: number }) {
  const p = game.players[player];
  const cx = size / 2, cy = size / 2, ro = size / 2 - 3, ri = ro * 0.32;
  const n = game.categories.length;
  const step = 360 / n;
  const half = ri + (ro - ri) * 0.5;
  // Une seule catégorie : la part est un cercle complet, que le tracé d'arc ne sait pas dessiner.
  const span = (i: number): [number, number] => [i * step, n === 1 ? 359.99 : (i + 1) * step];
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} accessibilityLabel={`Rosace de ${p.name}`}>
      {game.categories.map((k, i) => (
        <Path key={k} d={sectorPath(cx, cy, ri, ro, ...span(i))} fill="#252b3a" stroke="#12141c" strokeWidth={1.5} />
      ))}
      {game.categories.map((k, i) => {
        const frac = Math.min(1, progressOf(p, k) / CATEGORY_TARGET);
        return frac > 0 ? <Path key={`${k}-fill`} d={sectorPath(cx, cy, ri, ri + (ro - ri) * frac, ...span(i))} fill={catInfo(k).color} stroke="#12141c" strokeWidth={1} /> : null;
      })}
      <Circle cx={cx} cy={cy} r={half} fill="none" stroke="#12141c" strokeWidth={1} opacity={0.7} />
      <Circle cx={cx} cy={cy} r={ri * 0.7} fill="#12141c" stroke="#333c50" strokeWidth={1.5} />
    </Svg>
  );
}
