// L'adresse de base (ex. « /Jeu-Rher » sur GitHub Pages) est donnée à la construction ; en local, aucune.
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...config.experiments, baseUrl: process.env.EXPO_BASE_URL || undefined },
});
