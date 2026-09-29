// À VÉRIFIER sur le matériel : noms des 4 symboles (cités dans les descriptions du jeu)
// et couleurs associées (seul « bleu » et « vert » sont confirmés, sans savoir pour quels symboles).
export const SYMBOLS = [
  { name: 'Jumelles', emoji: '🔭', color: '#2563eb', colorName: 'bleu' },
  { name: 'Boussoles', emoji: '🧭', color: '#16a34a', colorName: 'vert' },
  { name: 'Briquets', emoji: '🔥', color: '#dc2626', colorName: 'rouge' },
  { name: 'Opinels', emoji: '🔪', color: '#ca8a04', colorName: 'jaune' },
] as const;
