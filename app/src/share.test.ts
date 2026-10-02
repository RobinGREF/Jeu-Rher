import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRoomLink, inviteText, parseRoom, smsHref, whatsappHref } from './share';

test('invitation : le code se lit dans ?salle=, 4 lettres sinon ignoré', () => {
  assert.equal(parseRoom('?salle=ABCD'), 'ABCD');
  assert.equal(parseRoom('?salle=abcd'), 'ABCD');
  assert.equal(parseRoom('?x=1&salle=WXYZ'), 'WXYZ');
  for (const bad of ['?salle=AB', '?salle=ABCDE', '?salle=', '', '?salle=1234']) assert.equal(parseRoom(bad), null, bad);
});

test('invitation : le lien pointe sur la page DU jeu avec le code', () => {
  const link = buildRoomLink('https://robingref.github.io', '/Jeu-Rher/50-missions/', 'ABCD');
  assert.equal(link, 'https://robingref.github.io/Jeu-Rher/50-missions/?salle=ABCD');
  assert.equal(parseRoom(new URL(link).search), 'ABCD');
  const duel = buildRoomLink('https://robingref.github.io', '/Jeu-Rher/duel-de-savoir/', 'WXYZ');
  assert.ok(duel.includes('/duel-de-savoir/?salle=WXYZ'));
});

test('invitation : messages WhatsApp et SMS contiennent le jeu, le code et le lien', () => {
  const url = buildRoomLink('https://x.io', '/Jeu-Rher/50-missions/', 'ABCD');
  const text = inviteText('50 Missions', 'ABCD');
  assert.match(decodeURIComponent(whatsappHref(text, url).split('text=')[1]), /50 Missions.*ABCD[\s\S]*\?salle=ABCD/);
  assert.ok(whatsappHref(text, url).startsWith('https://wa.me/?text='));
  assert.ok(smsHref(text, url).startsWith('sms:?&body='));
  assert.match(decodeURIComponent(smsHref(text, url)), /ABCD.*salle=ABCD/);
});
