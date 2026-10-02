import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Les hooks React doivent tous être appelés à chaque rendu : aucun après un « return » anticipé du composant
// (c'était la cause d'un écran blanc en ouvrant « Meilleurs scores »).
test('App : aucun hook après le premier return anticipé', () => {
  const src = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8').split('\n');
  const first = src.findIndex((l) => /^  if \(scoresOpen\) \{/.test(l));
  assert.ok(first > 0, 'repère introuvable');
  const late = src.slice(first).map((l, i) => ({ l, n: first + i + 1 })).filter(({ l }) => /^  (const \[.*\] = )?(use(State|Effect|Ref|Memo|Callback|WindowDimensions)|useOnline)\(/.test(l) || /^  const \w+ = use[A-Z]\w*\(/.test(l) || /^  useEffect\(/.test(l));
  assert.deepEqual(late.map((x) => `ligne ${x.n}: ${x.l.trim().slice(0, 60)}`), []);
});
