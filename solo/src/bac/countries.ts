import { fold } from './engine';

/** Pays reconnus (noms français courants, variantes comprises) : sert à refuser « Ogwanda » dans la catégorie Pays. */
const RAW = `Afghanistan,Afrique du Sud,Albanie,Algérie,Allemagne,Andorre,Angola,Antigua-et-Barbuda,Arabie saoudite,Argentine,Arménie,Australie,Autriche,Azerbaïdjan,
Bahamas,Bahreïn,Bangladesh,Barbade,Belgique,Belize,Bénin,Bhoutan,Biélorussie,Birmanie,Myanmar,Bolivie,Bosnie-Herzégovine,Bosnie,Botswana,Brésil,Brunei,Bulgarie,Burkina Faso,Burundi,
Cambodge,Cameroun,Canada,Cap-Vert,Centrafrique,République centrafricaine,Chili,Chine,Chypre,Colombie,Comores,Congo,République démocratique du Congo,RD Congo,Corée du Nord,Corée du Sud,Corée,Costa Rica,Côte d'Ivoire,Croatie,Cuba,
Danemark,Djibouti,Dominique,République dominicaine,Égypte,Émirats arabes unis,Équateur,Érythrée,Espagne,Estonie,Eswatini,Swaziland,États-Unis,USA,Éthiopie,
Fidji,Finlande,France,Gabon,Gambie,Géorgie,Ghana,Grèce,Grenade,Guatemala,Guinée,Guinée-Bissau,Guinée équatoriale,Guyana,Guyane,Haïti,Honduras,Hongrie,
Inde,Indonésie,Irak,Iran,Irlande,Islande,Israël,Italie,Jamaïque,Japon,Jordanie,Kazakhstan,Kenya,Kirghizistan,Kiribati,Kosovo,Koweït,
Laos,Lesotho,Lettonie,Liban,Libéria,Libye,Liechtenstein,Lituanie,Luxembourg,Macédoine,Macédoine du Nord,Madagascar,Malaisie,Malawi,Maldives,Mali,Malte,Maroc,Îles Marshall,Maurice,Mauritanie,Mexique,Micronésie,Moldavie,Monaco,Mongolie,Monténégro,Mozambique,
Namibie,Nauru,Népal,Nicaragua,Niger,Nigeria,Norvège,Nouvelle-Zélande,Oman,Ouganda,Ouzbékistan,Pakistan,Palaos,Palestine,Panama,Papouasie-Nouvelle-Guinée,Paraguay,Pays-Bas,Hollande,Pérou,Philippines,Pologne,Portugal,Qatar,
Roumanie,Royaume-Uni,Angleterre,Écosse,Pays de Galles,Russie,Rwanda,Saint-Christophe-et-Niévès,Sainte-Lucie,Saint-Marin,Saint-Vincent-et-les-Grenadines,Îles Salomon,Salvador,Samoa,Sao Tomé-et-Principe,Sénégal,Serbie,Seychelles,Sierra Leone,Singapour,Slovaquie,Slovénie,Somalie,Soudan,Soudan du Sud,Sri Lanka,Suède,Suisse,Suriname,Syrie,
Tadjikistan,Tanzanie,Tchad,Tchéquie,République tchèque,Thaïlande,Timor oriental,Togo,Tonga,Trinité-et-Tobago,Tunisie,Turkménistan,Turquie,Tuvalu,Ukraine,Uruguay,Vanuatu,Vatican,Venezuela,Vietnam,Viêt Nam,Yémen,Zambie,Zimbabwe,Groenland,Porto Rico,Taïwan,Tibet,Kurdistan,Sahara occidental,Nouvelle-Calédonie,Polynésie`;

export const COUNTRIES = new Set(RAW.split(',').map((s) => fold(s)).filter(Boolean));

/** Villes sous leur nom français (la liste mondiale donne les noms locaux : Londres y est « London »). */
export const CITIES_FR = new Set(
  `Londres,New York,Venise,Athènes,Moscou,Le Caire,Bruxelles,Copenhague,Lisbonne,Varsovie,Prague,Vienne,Berne,Florence,Turin,Milan,Naples,Gênes,La Havane,Mexico,Pékin,Rio de Janeiro,Kiev,Saint-Pétersbourg,Édimbourg,Cologne,Munich,Francfort,Hambourg,La Mecque,Jérusalem,Tel Aviv,Bombay,New Delhi,Séville,Saragosse,Bâle,Anvers,Gand,Bruges,Liège,Montréal,Québec,Los Angeles,San Francisco,Las Vegas,Washington,Tokyo,Hanoï,Bangkok,Singapour,Shanghai,Hong Kong,Dublin,Oslo,Stockholm,Helsinki,Budapest,Bucarest,Sofia,Belgrade,Zagreb,Ljubljana,Rome,Madrid,Barcelone,Valence,Porto,Amsterdam,Rotterdam,La Haye,Genève,Zurich,Lausanne,Luxembourg,Monaco,Alger,Tunis,Casablanca,Marrakech,Dakar,Abidjan,Nairobi,Johannesbourg,Le Cap,Sydney,Melbourne,Auckland,Buenos Aires,Lima,Bogota,Santiago,Caracas,Istanbul,Ankara,Téhéran,Bagdad,Damas,Beyrouth,Riyad,Doha,Dubaï,Abou Dabi,Delhi,Calcutta,Séoul,Pyongyang,Manille,Jakarta,Saint-Étienne,Aix-en-Provence,La Rochelle,Le Havre,Le Mans,Saint-Malo,Les Sables-d'Olonne,Le Touquet`
    .split(',').map((s) => fold(s)),
);
