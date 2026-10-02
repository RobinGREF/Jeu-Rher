# Publier le jeu sur GitHub Pages

Le fichier [`.github/workflows/pages.yml`](../.github/workflows/pages.yml) construit le site web à chaque mise à jour de la branche
principale (après avoir vérifié les types et lancé les tests), puis le publie sur GitHub Pages.
Adresse du site : `https://<compte>.github.io/<dépôt>/`, soit ici <https://robingref.github.io/Jeu-Rher/>.

## À faire une seule fois

1. **Le dépôt doit permettre GitHub Pages.**
   - Un dépôt **public** : gratuit.
   - Un dépôt **privé** : il faut un abonnement GitHub payant (Pro, Team ou Enterprise). Sur l'offre gratuite, l'option n'existe pas.
   - Attention : même avec un dépôt privé, le **site publié est public** (n'importe qui avec l'adresse peut l'ouvrir).
2. Dans le dépôt : **Settings → Pages → Build and deployment → Source : GitHub Actions.**
3. Lancer une première fois : **Actions → « Publier sur GitHub Pages » → Run workflow** (ensuite, chaque mise à jour de la branche principale publie automatiquement).

## Le mode en ligne sur le site publié

La configuration Firebase (5 valeurs publiques) est dans [`app/.env`](../app/.env) : elle est lue à la construction, sur GitHub comme en local.
Rien à régler dans GitHub. Pour changer de projet Firebase, modifier ce fichier et pousser : le site se republie tout seul.
Voir [en-ligne.md](en-ligne.md) pour créer le projet Firebase.

## En local

`cd app && npm ci && npx expo start --web` : aucune adresse de base n'est appliquée. Pour reproduire le site publié :
`EXPO_BASE_URL=/Jeu-Rher npx expo export --platform web` (résultat dans `app/dist`).

## Et si GitHub Pages n'est pas possible (dépôt privé, offre gratuite)

Le dossier `app/dist` est un site statique : Netlify, Cloudflare Pages ou Vercel le publient gratuitement, même depuis un dépôt privé.
Réglages : dossier de départ `app`, commande `npm ci && npx expo export --platform web`, dossier publié `dist`, (sans `EXPO_BASE_URL`, l'adresse de base est la racine ; la configuration Firebase vient de `app/.env`).

## Page d'accueil « Jeu des vacances »
`https://robingref.github.io/Jeu-Rher/` affiche la liste de mes jeux (dossier `hub/`). 50 Missions est servi sous `/50-missions/`. Pour ajouter un jeu : ajouter un bloc dans `hub/games.json` (titre, description, emoji, couleur, `url` ; `url` vide = « Bientôt »). Un autre jeu hébergé ailleurs se met avec son adresse complète ; un jeu de ce dépôt va dans un nouveau sous-dossier assemblé par `.github/workflows/pages.yml`.
Tous les jeux vivent dans ce dépôt : `app/` (50 Missions, → `/50-missions/`) et `combat/` (Familly Fight, site statique, → `/famille-fight/`). Duel de savoir : à ajouter quand son code sera dans le dépôt (dossier + ligne d'assemblage dans le workflow + `url` dans `hub/games.json`).

Les petits jeux solo (Duel de savoir, Mémo des paires) vivent dans `solo/` : un seul projet Expo, construit une fois par jeu (`EXPO_PUBLIC_GAME=duel|memo`) et servi sous `/duel-de-savoir/` et `/memo/`. Pour un nouveau jeu solo : ajouter son dossier dans `solo/src/`, un cas dans `solo/App.tsx`, une entrée dans la boucle du workflow, et une ligne dans `hub/games.json`.

## Installation (raccourci)
Seule la **page d'accueil « Jeu des vacances »** est installable (« Ajouter à l'écran d'accueil » / « Installer l'application »), avec son manifeste `hub/manifest.webmanifest` et ses icônes `hub/icons/hub-*.png`. Son périmètre (`scope`) couvre tout le site : les jeux s'ouvrent dans la même fenêtre d'application, et le bouton « ← Jeux » de chaque jeu ramène à l'accueil. Les jeux n'ont pas de manifeste propre : on n'installe qu'un seul raccourci. La page d'accueil affiche les jeux en grille de logos carrés (2 par ligne).
