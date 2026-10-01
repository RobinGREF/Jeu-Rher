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
