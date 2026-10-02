import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { inviteText, roomLink, smsHref, whatsappHref } from './share';

/** Boutons de partage du salon : menu du téléphone, WhatsApp, SMS. Le lien ouvre le bon jeu sur le bon salon. */
export function ShareRoom({ game, code }: { game: string; code: string }) {
  const url = roomLink(code);
  const text = inviteText(game, code);
  const native = async () => {
    try {
      const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> };
      if (nav.share) { await nav.share({ title: game, text, url }); return; }
      await navigator.clipboard.writeText(`${text} ${url}`);
    } catch { /* annulé */ }
  };
  return (
    <View style={st.row}>
      <Pressable onPress={native} style={st.btn} accessibilityLabel="Partager l'invitation"><Text style={st.txt}>📤 Partager</Text></Pressable>
      <Pressable onPress={() => { void Linking.openURL(whatsappHref(text, url)); }} style={[st.btn, st.wa]} accessibilityLabel="Envoyer par WhatsApp"><Text style={st.txt}>💬 WhatsApp</Text></Pressable>
      <Pressable onPress={() => { void Linking.openURL(smsHref(text, url)); }} style={st.btn} accessibilityLabel="Envoyer par SMS"><Text style={st.txt}>✉️ SMS</Text></Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  btn: { backgroundColor: '#334155', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  wa: { backgroundColor: '#15803d' },
  txt: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
