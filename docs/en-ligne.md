# Mode en ligne : mise en place (Firebase)

Chaque joueur joue sur son téléphone ; un joueur crée un salon et donne son **code à 4 lettres** aux autres.
Il faut une base en temps réel : on utilise **Firebase Realtime Database** (offre gratuite « Spark »).

## Comment ça marche

- **L'hôte** (celui qui crée le salon) fait tourner la vraie partie dans son navigateur ou son appli, avec le moteur de jeu.
- **Les autres joueurs** envoient leurs demandes (« je pose cette carte sur ce tas », « je peux ») dans `rooms/CODE/intents`.
- L'hôte publie l'état de la table dans `rooms/CODE/public` (visible par tous : tas, missions, nombre de cartes de chacun, jamais les mains).
- La main de chaque joueur est publiée dans `rooms/CODE/hands/SON_ID`, lisible **uniquement par lui** (règles d'accès de Firebase).
- Si l'hôte recharge la page, la partie reprend : l'hôte garde une copie complète dans `rooms/CODE/hostState`, que lui seul peut lire.
- Une place peut être tenue par une **machine** (jouée par l'hôte). Par défaut, chaque machine **attend qu'un joueur touche « Laisser jouer »** (réglage « Machines : attendre un clic » du salon) ; sans ce réglage, elle joue seule après la pause. Si un joueur disparaît, l'hôte peut le remplacer par une machine (menu ☰).

## Mise en place (5 à 10 minutes)

1. Va sur <https://console.firebase.google.com> et **crée un projet** (Google Analytics n'est pas nécessaire).
2. **Authentication → Méthode de connexion → Anonyme → Activer.** (Les joueurs n'ont pas de compte à créer.)
3. **Realtime Database → Créer une base de données.** Choisis une région proche (par exemple `europe-west1`) et le **mode verrouillé**.
   Vérifie à ce moment qu'elle est proposée dans l'offre gratuite.
4. Onglet **Règles** de la base : remplace tout par le contenu de [`app/firebase.rules.json`](../app/firebase.rules.json), puis **Publier**.
5. **Paramètres du projet → Vos applications → `</>` (Web)** : enregistre une application web et note la configuration affichée.
6. Mets les 5 valeurs dans **`app/.env`** (fichier versionné, voir `app/.env.example` pour le modèle) :

   ```
   EXPO_PUBLIC_FIREBASE_API_KEY=...
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   EXPO_PUBLIC_FIREBASE_DATABASE_URL=https://...firebasedatabase.app
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
   EXPO_PUBLIC_FIREBASE_APP_ID=...
   ```

7. Lance l'appli (`cd app && npx expo start --web`) ou construis-la (`npx expo export --platform web`) : l'option **En ligne** apparaît sur l'écran de départ.
   Sans ces variables, elle affiche « non configuré ».

Les valeurs de la configuration web ne sont pas des secrets : ce sont les règles d'accès (étape 4) qui protègent les données.

## Essayer sans Firebase

En construisant avec `EXPO_PUBLIC_ONLINE_BACKEND=local`, le « serveur » est simulé dans le navigateur : ouvre **deux onglets** du même navigateur,
l'un crée un salon, l'autre le rejoint avec le code. Mêmes écrans, mêmes règles d'accès. Utile pour essayer, pas pour jouer à distance.

## Prix

Offre gratuite Spark de Firebase : 100 connexions simultanées (un téléphone = une connexion), 1 Go de stockage, 10 Go de téléchargement par mois.
Une partie pèse quelques Ko. Au-delà des limites, il faudrait passer à l'offre payante à l'usage (carte bancaire requise) : rien n'y oblige.
Ces conditions sont celles de Google et peuvent changer : vérifie-les à la création de la base.

## Limites connues

- **Un hôte** par partie : s'il quitte pour de bon, la partie s'arrête (ou l'hôte remplace les absents par des machines). Il voit toutes les mains dans son navigateur : on lui fait confiance, comme à celui qui distribue les cartes.
- **4 joueurs maximum** ; le code (4 lettres) n'est pas un secret fort : il donne accès à l'état public de la table, pas aux mains.
- **Application mobile native (Expo Go, iOS, Android) :** pour retrouver son identité après avoir fermé l'application, il faudra ajouter le stockage persistant de Firebase (`AsyncStorage`). Sur le web, l'identité est conservée par le navigateur.
- Les coups sont validés par l'hôte : un joueur ne peut ni jouer hors de son tour, ni jouer une carte qu'il n'a pas, ni écrire l'état de la partie.

## Tableau des scores partagé

À la fin de chaque partie en ligne, l'hôte inscrit le résultat (missions, médaille, coups, noms des participants) dans le nœud `scores/<code du salon>` de la base. Une entrée ne s'écrit qu'une fois (pas de modification ni de suppression) et seul l'hôte du salon peut l'écrire. Tous les joueurs voient ce tableau dans **🏆 Meilleurs scores → 🌐 Tous les joueurs**.

⚠️ Après cette mise à jour, il faut **republier les règles** : Firebase → Realtime Database → Règles → coller le contenu de `app/firebase.rules.json` → Publier. Sans cela, le tableau partagé reste vide (l'écran l'indique).

## Arriver après le début de la partie
Quelqu'un qui tape le code d'une partie déjà lancée rejoint **en spectateur** : il voit la table (jamais les mains) et ne peut pas jouer. S'il reste une machine à la table, il peut toucher « 🙋 Demander une place ». L'hôte voit alors « 👋 Léo veut jouer à la place d'une machine » avec **Accepter** / **Refuser**. Accepté, le spectateur prend la place d'une machine, reçoit une vraie main et joue ; refusé, il continue à regarder. Sans machine à remplacer, l'hôte peut d'abord remplacer un joueur absent par une machine (menu ☰). Aucune règle Firebase à changer.

## Mode télé
Sur une télé (ou n'importe quel grand écran), ouvrir le jeu → **📺 Écran télé** → taper le code du salon → **Afficher la table**. La télé suit la partie sans jouer et sans prendre de place : missions en grand avec leur texte, les 4 tas, les joueurs (prénoms, qui joue, qui se positionne sur quelle mission), le dernier coup et les missions réussies. Les mains restent cachées jusqu'à la fin de la partie, où elles sont dévoilées avec la raison de l'arrêt. On peut la lancer avant le début de la partie : elle attend. Aucune règle Firebase à changer.


## Duel de savoir en ligne

Duel de savoir (dossier `solo/`) utilise le même projet Firebase, dans son propre nœud `duel/rooms/<code>` (les salons de 50 Missions ne sont pas touchés).
Un joueur crée un salon et donne son code à 4 lettres ; chacun joue à son tour sur son téléphone, les autres voient la question et la rosace en direct.
La bonne réponse n'est publiée qu'une fois la question jouée. L'hôte fait tourner la partie ; il choisit les catégories et lance quand tout le monde est là ; on peut arriver après le début en spectateur.

⚠️ **Il faut republier les règles** : Firebase → Realtime Database → Règles → coller le contenu de `app/firebase.rules.json` → Publier. Sans cela, créer ou rejoindre un salon de Duel échoue (accès refusé).

La configuration Firebase vient de `solo/.env` (mêmes valeurs publiques que `app/.env`). Pour essayer sans Firebase, deux onglets d'un même navigateur : construire avec `EXPO_PUBLIC_ONLINE_BACKEND=local`.

Limites : si l'hôte recharge la page ou la ferme, la partie s'arrête (pas de reprise comme dans 50 Missions) ; un joueur qui part en cours de route bloque son tour tant qu'il n'est pas revenu.


## Famille Fight en ligne (jeu de combat)

Famille Fight (dossier `combat/`) utilise le même projet Firebase, dans son propre nœud `combat/rooms/<code>` (les salons des autres jeux ne sont pas touchés). Page : **EN LIGNE** dans le menu → *Créer un salon* (on choisit son combattant puis le décor, et on reçoit un code à 4 lettres) ou *Rejoindre un salon* (on tape le code, puis on choisit son combattant). L'hôte lance le combat quand l'adversaire est là ; ensuite revanche (ENTRÉE) ou retour au salon (ÉCHAP). Deux joueurs par salon.

**Principe : les deux appareils calculent le même combat.** Ils n'échangent que leurs touches, image par image, avec un petit retard d'entrée (5 à 16 images, calculé d'après la latence mesurée dans le salon) pour laisser le temps au réseau. Aucun joueur n'est « l'hôte du calcul » : personne n'a l'avantage. Si les touches de l'adversaire n'arrivent pas, le jeu attend (« Connexion lente… ») ; après 10 secondes sans nouvelles, le combat s'arrête.

Données écrites : `meta` (créateur, personnage, décor), `guest` (l'adversaire et son personnage), `start` (lancement du combat), `net/ping` et `net/pong` (mesure de latence), `in/h` et `in/g` (les dernières touches de chaque joueur, une petite chaîne qui se remplace). Le salon est supprimé quand l'hôte part.

⚠️ **Il faut republier les règles** : Firebase → Realtime Database → Règles → coller le contenu de `app/firebase.rules.json` → Publier. Sans cela, créer ou rejoindre un salon de Famille Fight échoue (accès refusé).

La configuration Firebase vient de `combat/js/firebase-config.js` (mêmes valeurs publiques que `app/.env`). Le SDK Firebase est chargé à la demande, seulement quand on choisit EN LIGNE.

Pour essayer sans Firebase : ouvrir le jeu avec `?online=local` à la fin de l'adresse dans **deux onglets** du même navigateur (l'un crée, l'autre rejoint avec le code).

Limites : 2 joueurs ; le code (4 lettres) n'est pas un secret fort (il donne accès au salon) ; les deux joueurs doivent avoir le même navigateur « moteur » pour que les calculs soient identiques (Chrome, Safari et Firefox récents conviennent) ; pas de reprise si quelqu'un recharge la page en plein combat.
