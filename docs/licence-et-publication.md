# Licence de « 50 Missions » et publication sur les plateformes

## Point de départ
L'appli reprend fidèlement le jeu : règles, 50 missions (textes et visuels), médailles, nom. Ce sont des éléments protégés (droit d'auteur, marque, éventuellement droits des auteurs/illustrateurs). **Pour vendre l'appli, ou la mettre sur l'App Store / Google Play, une licence écrite de l'éditeur est indispensable.** Sans elle, les stores peuvent aussi retirer l'appli sur simple signalement.

⚠️ Le site GitHub Pages actuel est public. Tant qu'aucun accord n'est obtenu, le garder en usage de test privé (ne pas diffuser le lien largement), ou le passer en dépôt privé.

## Étapes
1. **Identifier qui détient les droits** : éditeur (nom sur la boîte / le livret), auteurs, illustrateur. Les droits numériques sont souvent séparés des droits du jeu physique.
2. **Envoyer la demande** (modèle ci-dessous) à l'éditeur, de préférence par le formulaire de contact ou l'adresse « contact / licences » de son site, puis relancer à 2 semaines.
3. **Négocier** : exclusivité ou non, durée, territoires, rémunération (royalties en % du chiffre d'affaires net, ou forfait), droit de garder les visuels d'origine ou obligation de refaire les illustrations, droit de modifier les règles (ex. règle d'annonce), crédits, date limite de lancement.
4. **Faire rédiger un contrat de licence** (un juriste du jeu / de la propriété intellectuelle relit avant signature).
5. **Préparer la publication** (une fois la licence signée) — voir ci-dessous.

## Modèle de demande
> Objet : Demande de licence – adaptation numérique de « 50 Missions »
>
> Bonjour,
>
> Je suis [NOM, statut : particulier / société] et j'ai développé une application mobile et web de « 50 Missions » : parties en ligne jusqu'à 4 joueurs (téléphone par joueur), joueurs virtuels, tableau des meilleurs scores, règles et missions fidèles au jeu physique.
>
> Je souhaite vous proposer une collaboration pour l'édition officielle de cette application (iOS, Android, web). Pouvez-vous m'indiquer :
> – si les droits d'adaptation numérique sont disponibles, et auprès de qui ;
> – vos conditions (licence, durée, territoires, rémunération) ;
> – si vous préférez fournir les visuels d'origine ou que je crée des visuels propres.
>
> Je peux vous présenter une démonstration jouable à votre convenance.
>
> Cordialement,
> [Prénom Nom – coordonnées]

## Publication sur les plateformes (après accord)
- **Comptes développeur** : Apple Developer Program ≈ 99 €/an ; Google Play ≈ 25 $ (une seule fois). Statut à choisir (particulier ou société ; une société est préférable si vente et TVA).
- **Builds** : Expo EAS Build (iOS/Android) ; identifiants de paquet, icône, écran de démarrage, captures d'écran, description.
- **Obligatoire** : politique de confidentialité (l'appli utilise la connexion anonyme Firebase et stocke des prénoms de joueurs), déclaration des données collectées, classification d'âge.
- **Modèle économique** : achat unique, gratuit avec achat intégré, ou gratuit avec publicité. Les stores prélèvent 15–30 %.
- **Backend** : Firebase gratuit au départ ; prévoir le passage en formule payante si beaucoup de joueurs simultanés, et des règles de sécurité revues.
- **Qualité** : tests sur vrais appareils, accessibilité, traductions si besoin.
