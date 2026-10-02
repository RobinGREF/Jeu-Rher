const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
};

/** Part de couronne entre deux angles (degrés, 0 = en haut) et deux rayons. */
export function sectorPath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const so = polar(cx, cy, r1, a0), eo = polar(cx, cy, r1, a1);
  const si = polar(cx, cy, r0, a0), ei = polar(cx, cy, r0, a1);
  const large = a1 - a0 <= 180 ? 0 : 1;
  const f = (n: number) => n.toFixed(2);
  return `M ${f(so.x)} ${f(so.y)} A ${r1} ${r1} 0 ${large} 1 ${f(eo.x)} ${f(eo.y)} L ${f(ei.x)} ${f(ei.y)} A ${r0} ${r0} 0 ${large} 0 ${f(si.x)} ${f(si.y)} Z`;
}
