import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CATEGORIES } from './questions';
import { CLASSIC_CATEGORIES, DEFAULT_CATEGORIES, MIN_CATEGORIES, randomCategories } from './engine';
import { Btn, s } from './ui';

/** Choix des catégories de la partie : format classique (8) ou libre (4 à 20), à la main ou au hasard. */
export function CatPicker({ names = [], onDone }: { names?: string[]; onDone: (categories: string[]) => void }) {
  const [mode, setMode] = useState<'fixed' | 'flexible'>('fixed');
  const [flexCount, setFlexCount] = useState(CLASSIC_CATEGORIES);
  const [picked, setPicked] = useState<string[]>([]);
  const total = mode === 'fixed' ? CLASSIC_CATEGORIES : flexCount;
  const chooser = names.length > 1 && mode === 'fixed' ? names[picked.length % names.length] : null;

  const toggle = (k: string) => {
    if (picked.includes(k)) setPicked(picked.filter((x) => x !== k));
    else if (picked.length < total) setPicked([...picked, k]);
  };
  const resize = (n: number) => { setFlexCount(n); setPicked(picked.slice(0, n)); };

  return (
    <>
      <Text style={s.title}>Catégories</Text>
      <View style={s.row}>
        <Pressable onPress={() => { setMode('fixed'); setPicked(picked.slice(0, CLASSIC_CATEGORIES)); }} style={[s.chip, s.chipWide, mode === 'fixed' && s.chipOn]}><Text style={[s.chipTxt, mode === 'fixed' && s.chipTxtOn]}>Classique (8)</Text></Pressable>
        <Pressable onPress={() => { setMode('flexible'); setPicked(picked.slice(0, flexCount)); }} style={[s.chip, s.chipWide, mode === 'flexible' && s.chipOn]}><Text style={[s.chipTxt, mode === 'flexible' && s.chipTxtOn]}>Libre ({MIN_CATEGORIES}–{CATEGORIES.length})</Text></Pressable>
      </View>
      {mode === 'flexible' && (
        <View style={s.row}>
          <Pressable style={s.chip} onPress={() => resize(Math.max(MIN_CATEGORIES, flexCount - 1))}><Text style={s.chipTxt}>−</Text></Pressable>
          <Text style={s.count}>{flexCount} catégories</Text>
          <Pressable style={s.chip} onPress={() => resize(Math.min(CATEGORIES.length, flexCount + 1))}><Text style={s.chipTxt}>+</Text></Pressable>
        </View>
      )}
      <Text style={s.muted}>{chooser ? `${chooser} choisit · ` : ''}{picked.length}/{total} choisies</Text>
      <View style={s.grid}>
        {CATEGORIES.map((c) => {
          const on = picked.includes(c.key);
          return (
            <Pressable key={c.key} onPress={() => toggle(c.key)} style={[s.cat, { borderColor: c.color }, on && { backgroundColor: c.color }]} accessibilityState={{ selected: on }}>
              <Text style={s.catEmoji}>{c.emoji}</Text>
              <Text style={s.catTxt} numberOfLines={2}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Btn kind="ghost" label="🎲 Compléter au hasard" onPress={() => setPicked(randomCategories(total, picked))} />
      <Btn label="Commencer" disabled={picked.length !== total} onPress={() => onDone(picked)} />
      <Btn kind="ghost" label="Catégories par défaut" onPress={() => onDone(DEFAULT_CATEGORIES.slice(0, total))} />
    </>
  );
}
