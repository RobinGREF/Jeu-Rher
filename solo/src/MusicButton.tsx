import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { setMusic } from './music';
import type { TrackSpec } from './musicCore';
import { loadJson, saveJson } from './storage';

/**
 * Bouton de musique : un toucher passe au morceau suivant de la liste du jeu, puis au silence, puis revient au premier.
 * Le choix est retenu sur l'appareil, par jeu.
 */
export function useMusicChoice(game: string, tracks: TrackSpec[]) {
  const [id, setId] = useState<string>(() => { const v = loadJson<string>(`music-${game}`, tracks[0].id); return v === 'off' || tracks.some((t) => t.id === v) ? v : tracks[0].id; });
  const track = tracks.find((t) => t.id === id) ?? null;
  useEffect(() => { setMusic(track); saveJson(`music-${game}`, id); return () => setMusic(null); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const next = () => {
    if (!track) return setId(tracks[0].id);
    const i = tracks.indexOf(track);
    setId(i + 1 < tracks.length ? tracks[i + 1].id : 'off');
  };
  return { track, next };
}

export function MusicButton({ choice, tracks }: { choice: { track: TrackSpec | null; next: () => void }; tracks: TrackSpec[] }) {
  const { track, next } = choice;
  void tracks;
  return (
    <View style={st.wrap}>
      <Pressable onPress={next} style={st.btn} accessibilityLabel={track ? `Musique : ${track.name}. Toucher pour changer` : 'Musique coupée. Toucher pour la remettre'}>
        <Text style={st.txt} numberOfLines={1}>{track ? `${track.emoji} ${track.name}` : '🔇 Musique coupée'}<Text style={st.hint}>  ·  toucher pour changer</Text></Text>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { alignItems: 'center', paddingBottom: 4 },
  btn: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, paddingVertical: 6, paddingHorizontal: 12 },
  txt: { color: '#e5e7eb', fontSize: 14, fontWeight: '700' },
  hint: { color: '#9ca3af', fontSize: 12, fontWeight: '500' },
});
