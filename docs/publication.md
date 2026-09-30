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

## Activer le mode en ligne sur le site publié

Une fois le projet Firebase créé (voir [en-ligne.md](en-ligne.md)), ajouter ses 5 valeurs comme **variables** du dépôt
(**Settings → Secrets and variables → Actions → onglet Variables → New repository variable**) :

| Variable | Valeur Firebase |
|---|---|
| `FIREBASE_API_KEY` | `apiKey` |
| `FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `FIREBASE_DATABASE_URL` | `databaseURL` |
| `FIREBASE_PROJECT_ID` | `projectId` |
| `FIREBASE_APP_ID` | `appId` |

Puis relancer la publication. Ce ne sont pas des secrets (elles finissent dans le site) : ce sont les règles d'accès de la base qui protègent les données.
Sans ces variables, le site marche, l'option « En ligne » indique seulement « non configuré ».

## En local

`cd app && npm ci && npx expo start --web` : aucune adresse de base n'est appliquée. Pour reproduire le site publié :
`EXPO_BASE_URL=/Jeu-Rher npx expo export --platform web` (résultat dans `app/dist`).

## Et si GitHub Pages n'est pas possible (dépôt privé, offre gratuite)

Le dossier `app/dist` est un site statique : Netlify, Cloudflare Pages ou Vercel le publient gratuitement, même depuis un dépôt privé.
Réglages : dossier de départ `app`, commande `npm ci && npx expo export --platform web`, dossier publié `dist`, et les 5 variables `EXPO_PUBLIC_FIREBASE_*`
(sans `EXPO_BASE_URL`, l'adresse de base est la racine).
