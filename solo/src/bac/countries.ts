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
