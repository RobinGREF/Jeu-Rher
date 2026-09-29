/*
 * ============================================================
 *  RUMBLE FIGHTER — données personnalisables
 * ============================================================
 *  Tout ce qui est "contenu" est ici : ajoute / modifie des
 *  personnages et des décors sans toucher au moteur (game.js).
 *
 *  PERSONNAGE
 *    name, title     : nom et sous-titre affichés
 *    hp              : points de vie
 *    speed           : vitesse de marche (px/frame, ~3 = normal)
 *    jump            : force de saut (~15 = normal)
 *    power           : multiplicateur de dégâts (1 = normal)
 *    skin/outfit/outfit2/accent/hair : couleurs
 *    hairStyle       : 'spiky' | 'long' | 'band' | 'bald' | 'mask'
 *    special         : { type, name, desc, color }
 *                      type = 'fireball' (projectile)
 *                           | 'dash'     (charge fulgurante)
 *                           | 'uppercut' (coup montant)
 *
 *  DÉCOR
 *    sky             : dégradé de ciel (liste de couleurs, haut → bas)
 *    sun             : { x, y, r, color, glow } ou null (soleil / lune)
 *    stars, clouds, embers : effets d'ambiance (true/false)
 *    layers          : plans de fond, du plus loin au plus proche
 *                      { type:'mountains'|'buildings'|'trees'|'pillars',
 *                        color, h (hauteur), windows:[couleurs] }
 *    ground          : { colors:[haut,bas], line }  (sol)
 *    image           : (optionnel) chemin d'une image 960x540 qui
 *                      remplace tout le fond, ex: 'img/mon-decor.png'
 *    seed            : change la génération aléatoire du décor
 * ============================================================
 */
window.GAME_CONFIG = {
  roundTime: 60,      // secondes par round
  roundsToWin: 2,     // rounds pour gagner le match (2 = meilleur des 3)

  // Difficulté de l'ordinateur (index 1 = choix par défaut)
  //   react   : délai de réaction (×, plus petit = plus vif)
  //   block   : chance de parer une attaque qui arrive
  //   aggr    : agressivité (chance d'enchaîner les coups)
  //   special : chance d'utiliser le spécial quand la jauge est pleine
  //   speed   : vitesse de déplacement (×)
  difficulties: [
    { name: 'FACILE',    react: 2.2, block: 0.12, aggr: 0.5,  special: 0.2,  speed: 0.85 },
    { name: 'NORMAL',    react: 1.0, block: 0.5,  aggr: 0.85, special: 0.6,  speed: 1.0 },
    { name: 'DIFFICILE', react: 0.55, block: 0.85, aggr: 1.0, special: 0.95, speed: 1.1 }
  ],

  characters: [
    {
      name: 'KAITO', title: 'Le Poing Ardent',
      hp: 100, speed: 3.2, jump: 15, power: 1.0,
      skin: '#f1c27d', outfit: '#e8e8ee', outfit2: '#d63a2f', accent: '#b71c1c', hair: '#1b1b1b', hairStyle: 'band',
      special: { type: 'fireball', name: 'ONDE DE FEU', desc: 'Lance une boule d\'énergie', color: '#ff7a1a' }
    },
    {
      name: 'MIKA', title: 'L\'Éclair Rose',
      hp: 90, speed: 4.0, jump: 16, power: 0.92,
      skin: '#f6d2b0', outfit: '#ff6fa8', outfit2: '#3a3a6a', accent: '#ffd23f', hair: '#7b3fbf', hairStyle: 'long',
      special: { type: 'dash', name: 'ÉCLAIR FULGURANT', desc: 'Charge éclair qui projette', color: '#ffe14a' }
    },
    {
      name: 'BRUTUS', title: 'Le Titan',
      hp: 130, speed: 2.4, jump: 13.5, power: 1.25,
      skin: '#c98b5a', outfit: '#3d5a80', outfit2: '#293241', accent: '#ee6c4d', hair: '#000000', hairStyle: 'bald',
      special: { type: 'uppercut', name: 'POING DU TITAN', desc: 'Coup montant dévastateur', color: '#ff4d4d' }
    },
    {
      name: 'NOVA', title: 'Cyborg Ionique',
      hp: 100, speed: 3.3, jump: 17, power: 1.0,
      skin: '#9fb6c3', outfit: '#1d2b53', outfit2: '#0d1330', accent: '#25e6ff', hair: '#25e6ff', hairStyle: 'spiky',
      special: { type: 'fireball', name: 'RAYON ION', desc: 'Projectile d\'énergie bleue', color: '#25e6ff' }
    },
    {
      name: 'OMBRE', title: 'Le Ninja Silencieux',
      hp: 92, speed: 3.9, jump: 17.5, power: 0.95,
      skin: '#e0b48a', outfit: '#25222e', outfit2: '#161420', accent: '#8e44ff', hair: '#25222e', hairStyle: 'mask',
      special: { type: 'dash', name: 'FRAPPE SPECTRALE', desc: 'Traverse l\'ennemi en un éclair', color: '#b070ff' }
    },
    {
      name: 'LÉO', title: 'Le Dragon Vert',
      hp: 105, speed: 3.1, jump: 15.5, power: 1.05,
      skin: '#e8b98a', outfit: '#2e9e5b', outfit2: '#1b4d33', accent: '#ffd23f', hair: '#ffcc33', hairStyle: 'spiky',
      special: { type: 'uppercut', name: 'DRAGON MONTANT', desc: 'Saut-poing ascendant', color: '#5dff8a' }
    }
  ],

  stages: [
    {
      name: 'Dojo du Crépuscule', seed: 3,
      sky: ['#2b1055', '#d4507a', '#ffb36b'],
      sun: { x: 700, y: 250, r: 70, color: '#fff1c1', glow: 'rgba(255,190,110,0.55)' },
      clouds: true,
      layers: [
        { type: 'mountains', color: '#5a2d68', h: 200 },
        { type: 'mountains', color: '#3d1f52', h: 140 },
        { type: 'trees', color: '#1f1238', h: 150, count: 16 }
      ],
      ground: { colors: ['#7a4a2b', '#3c2213'], line: 'rgba(0,0,0,0.28)' }
    },
    {
      name: 'Néon City', seed: 11,
      sky: ['#05010f', '#1a0b3d', '#5b1a6e'],
      sun: { x: 250, y: 130, r: 46, color: '#f4f0ff', glow: 'rgba(170,140,255,0.4)' },
      stars: true,
      layers: [
        { type: 'buildings', color: '#150a2e', h: 300, windows: ['#25e6ff', '#ff4fd8', '#ffe14a'] },
        { type: 'buildings', color: '#0c0620', h: 210, windows: ['#25e6ff', '#ff4fd8'] }
      ],
      ground: { colors: ['#2a2a3a', '#0e0e18'], line: 'rgba(37,230,255,0.35)' }
    },
    {
      name: 'Temple Antique', seed: 7,
      sky: ['#4aa3df', '#a8d8f0', '#f1f7e8'],
      sun: { x: 180, y: 110, r: 48, color: '#fffbe0', glow: 'rgba(255,255,200,0.6)' },
      clouds: true,
      layers: [
        { type: 'mountains', color: '#8fb8c9', h: 170 },
        { type: 'pillars', color: '#e8e2d0', h: 300 }
      ],
      ground: { colors: ['#cfc7b0', '#8f8770'], line: 'rgba(60,50,30,0.3)' }
    },
    {
      name: 'Volcan', seed: 21,
      sky: ['#1a0505', '#5c1408', '#c4410f'],
      sun: { x: 480, y: 210, r: 90, color: '#ffb347', glow: 'rgba(255,90,20,0.5)' },
      embers: true,
      layers: [
        { type: 'mountains', color: '#3a0e08', h: 300 },
        { type: 'mountains', color: '#210805', h: 190 }
      ],
      ground: { colors: ['#3b2a2a', '#120a0a'], line: 'rgba(255,110,30,0.55)' }
    }
    /* Exemple avec une image perso :
    { name: 'Mon décor', image: 'img/mon-decor.png', ground: { colors: ['#333','#111'], line: 'rgba(255,255,255,.2)' }, sky: ['#000','#000'] }
    */
  ]
};
