import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export type GameId = 'missions' | 'duel' | 'memo';

export const GAMES: { id: GameId; emoji: string; title: string; sub: string; color: string }[] = [
  { id: 'missions', emoji: '🃏', title: '50 Missions', sub: 'Jeu de cartes coopératif, en ligne avec tes amis ou contre des machines · 2 à 4 joueurs', color: '#f59e0b' },
  { id: 'duel', emoji: '🧠', title: 'Duel de Savoir', sub: 'Quiz façon Trivial Pursuit : 20 catégories, 744 questions · 1 à 6 joueurs sur un appareil', color: '#d4af37' },
  { id: 'memo', emoji: '🎴', title: 'Mémo des paires', sub: 'Retrouve toutes les paires en un minimum de coups · solo, 3 niveaux', color: '#38bdf8' },
];

export function GameHub({ onPick }: { onPick: (id: GameId) => void }) {
  return (
    <SafeAreaView style={s.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.title}>Mes jeux</Text>
        <Text style={s.sub}>Choisis un jeu</Text>
        {GAMES.map((g) => (
          <Pressable key={g.id} onPress={() => onPick(g.id)} accessibilityRole="button" style={[s.game, { borderColor: g.color }]}>
            <Text style={s.emoji}>{g.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.gameTitle, { color: g.color }]}>{g.title}</Text>
              <Text style={s.gameSub}>{g.sub}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  body: { padding: 20, gap: 14, maxWidth: 560, width: '100%', alignSelf: 'center' },
  title: { color: '#f8fafc', fontSize: 34, fontWeight: '900', textAlign: 'center', marginTop: 12 },
  sub: { color: '#94a3b8', fontSize: 15, textAlign: 'center' },
  game: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#1e293b', borderRadius: 16, borderWidth: 2, padding: 16 },
  emoji: { fontSize: 40 },
  gameTitle: { fontSize: 20, fontWeight: '900' },
  gameSub: { color: '#cbd5e1', fontSize: 13, marginTop: 2 },
});
