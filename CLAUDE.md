# Dépôt Jeu-Rher — organisation (décision du 2026-10-01, à respecter par toutes les sessions)

Ce dépôt contient **tous les jeux de Robin**. Chaque jeu a **son propre dossier** et **sa propre adresse** sur GitHub Pages ; une **page d'accueil « Jeu Robin »** (`hub/`) liste les jeux avec leur lien.

| Jeu | Dossier | Adresse (après `https://robingref.github.io/Jeu-Rher/`) |
|---|---|---|
| Page d'accueil | `hub/` (`hub/games.json` = la liste) | `/` |
| 50 Missions | `app/` | `/50-missions/` |
| Famille Fight (Rumble Fighter) | `combat/` | `/famille-fight/` |
| Duel de savoir | `solo/src/duel/` | `/duel-de-savoir/` |
| Mémo des paires | `solo/src/memo/` | `/memo/` |

## Règles
1. **Ne pas intégrer un jeu dans l'appli d'un autre** et ne pas créer de seconde « liste de jeux » dans une appli (une première tentative de ce genre — `GameHub`/`Root` dans `app/` — a été retirée). La liste est **uniquement** `hub/games.json`.
2. **Un jeu = un dossier.** Nouveau jeu : son dossier, une étape d'assemblage dans `.github/workflows/pages.yml` (copie vers `site/<nom>/`), et un bloc dans `hub/games.json` (titre, description, emoji, couleur, `url` relative ; `url` vide = « Bientôt »).
3. Les jeux solo en React Native / Expo (Duel, Mémo) vivent dans `solo/` : un projet, construit une fois par jeu avec `EXPO_PUBLIC_GAME=duel|memo`. Nouveau jeu solo : dossier dans `solo/src/`, un cas dans `solo/App.tsx`, une entrée dans la boucle du workflow.
4. Un jeu a un bouton de retour vers l'accueil : `window.location.href = '../'`.
5. **Ne pas toucher** à `app/` (50 Missions : en ligne, Firebase, machines) ni aux autres jeux sans demande de Robin.
6. Les tests de chaque projet doivent passer (`npm test` dans `app/` et dans `solo/`) : ils bloquent le déploiement.
7. Branche de publication : `ccr-6c52d89d-ni35lw` (et `main`) déclenche le déploiement. Une autre branche de travail doit être fusionnée là, en gardant cette organisation.

Détails : `docs/publication.md`.
