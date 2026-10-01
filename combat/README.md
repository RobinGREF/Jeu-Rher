# Rumble Fighter

Jeu de combat 2D façon « Street Fighter », en HTML5 canvas (aucune dépendance).

**Lancer** : ouvrir `index.html` dans un navigateur (ou `npx serve combat`).

## Commandes
| | Joueur 1 | Joueur 2 |
|---|---|---|
| Déplacement | ← → | Q D |
| Saut / accroupi | ↑ / ↓ | Z / S |
| Poing | J | F |
| Pied | K | G |
| Spécial (jauge pleine) | L | H |

Difficulté de l'ordinateur (Facile / Normal / Difficile) : ligne « DIFFICULTÉ » du menu, réglable dans `data.js` (`difficulties`).

Sur mobile, des boutons tactiles (croix, POING, PIED, SPÉCIAL, pause) apparaissent en combat ; toucher l'écran pour valider dans les menus.

Reculer = parer (accroupi pour les coups bas). `P`/Échap = pause. En mode 1 joueur, les deux jeux de touches marchent.

## Personnaliser
Tout est dans `js/data.js` : ajouter/modifier des personnages (stats, couleurs, coiffure, type de spécial : `fireball`, `dash`, `uppercut`) et des décors (couleurs, plans, ambiance, ou une image `image: 'img/x.png'`).
