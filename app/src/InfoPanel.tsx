import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { missionsLeft, nextMedal, type GameState } from './engine';
import { SYMBOLS } from './symbols';

const MEDAL = { bronze: '🥉 Bronze', argent: '🥈 Argent', or: '🥇 Or' } as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const Line = ({ k, v }: { k: string; v: string }) => (
  <View style={s.line}>
    <Text style={s.k}>{k}</Text>
    <Text style={s.v}>{v}</Text>
  </View>
);

/** Infos sur la partie : avancement, joueurs, missions en cours, symboles, rappel des règles. */
export function InfoPanel({ game, solo, options, onClose, nameOf }: {
  game: GameState; solo: boolean; onClose: () => void; nameOf?: (i: number) => string;
  options: { help: boolean; targets: boolean; phrases: boolean };
}) {
  const nm = nextMedal(game);
  const name = (i: number) => nameOf?.(i) ?? (solo ? (i === 0 ? 'Toi' : `Joueur ${i + 1} (machine)`) : `Joueur ${i + 1}`);
  const next = (game.current + 1) % game.players;
  const buried = game.piles.reduce((a, p) => a + p.length - 1, 0);

  return (
    <View style={s.overlay}>
      <View style={s.head}>
        <Text style={s.title}>ℹ️ Infos sur la partie</Text>
        <Pressable onPress={onClose} style={s.close}><Text style={s.closeTxt}>✕</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 12 }}>
        <Section title="Avancement">
          <Line k="Missions réussies" v={`${game.completed} / 50 (encore ${missionsLeft(game)})`} />
          <Line k="Médaille" v={game.medal ? MEDAL[game.medal] : 'aucune pour l\'instant'} />
          <Line k="Prochaine médaille" v={nm ? `${MEDAL[nm.medal]} · encore ${nm.missionsNeeded} mission${nm.missionsNeeded > 1 ? 's' : ''}` : 'toutes gagnées'} />
          <Line k="Pioche" v={`${game.symbolDeck.length} carte${game.symbolDeck.length > 1 ? 's' : ''}`} />
          <Line k="Cartes sous les tas" v={`${buried}`} />
        </Section>

        <Section title={`Table à ${game.players} joueur${game.players > 1 ? 's' : ''}`}>
          {game.hands.map((h, i) => (
            <Line key={i} k={`${name(i)}${i === game.current ? ' ▶ joue' : i === next ? ' · suivant' : ''}`}
              v={`${h.length} carte${h.length > 1 ? 's' : ''}${game.canDo.includes(i) ? ' · 🙋 peut réussir une mission' : ''}`} />
          ))}
          <Text style={s.note}>On joue dans le sens des aiguilles d'une montre.</Text>
        </Section>

        <Section title="Missions en cours">
          {game.missions.map((m) => <Text key={m.id} style={s.mission}>• {m.label}</Text>)}
        </Section>

        <Section title="Symboles">
          {SYMBOLS.map((y) => (
            <Line key={y.name} k={`${y.emoji} ${y.name}`} v={y.colorName} />
          ))}
        </Section>

        <Section title="Rappel des règles">
          <Text style={s.rule}>• On pose une carte sur un tas : même symbole ou même valeur que la carte du dessus.</Text>
          <Text style={s.rule}>• Après chaque coup, on repioche pour revenir à 4 cartes.</Text>
          <Text style={s.rule}>• Une mission réussie est remplacée tout de suite.</Text>
          <Text style={s.rule}>• La partie s'arrête dès qu'un joueur ne peut plus jouer.</Text>
          <Text style={s.rule}>• On ne dit jamais les valeurs ni les symboles de sa main : on peut seulement dire « je peux réussir une mission ».</Text>
          {options.phrases && <Text style={s.rule}>• Phrases du livret actives : « je peux aider » (mission), « bonne carte ici » et « ne jouez pas ici » (tas).</Text>}
        </Section>

        <Section title="Options">
          <Line k="💡 Coup de pouce" v={options.help ? 'oui' : 'non'} />
          {solo && <Line k="🎯 Missions visées" v={options.targets ? 'oui' : 'non'} />}
          <Line k="💬 Phrases du livret" v={options.phrases ? 'oui' : 'non'} />
        </Section>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0f172a', padding: 16, zIndex: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  close: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#1e293b', borderRadius: 10 },
  closeTxt: { color: '#f8fafc', fontSize: 18, fontWeight: '700' },
  section: { backgroundColor: '#111c33', borderRadius: 12, padding: 12, gap: 6 },
  sectionTitle: { color: '#f59e0b', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  k: { color: '#94a3b8', fontSize: 14, flexShrink: 1 },
  v: { color: '#f8fafc', fontSize: 14, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  note: { color: '#64748b', fontSize: 12 },
  mission: { color: '#e2e8f0', fontSize: 14 },
  rule: { color: '#cbd5e1', fontSize: 13 },
});
