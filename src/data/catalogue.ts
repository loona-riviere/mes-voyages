export const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
] as const;
export type MonthName = (typeof MONTHS)[number];
export const MONTH_LETTERS = "JFMAMJJASOND";

export const WANTS = [
  { key: "plage", label: "Plage" },
  { key: "nature", label: "Nature & paysages" },
  { key: "faune", label: "Faune sauvage" },
  { key: "rando", label: "Randonnée" },
  { key: "plongee", label: "Plongée" },
  { key: "culture", label: "Culture & histoire" },
  { key: "ville", label: "Ville" },
  { key: "gastro", label: "Gastronomie" },
  { key: "desert", label: "Désert" },
  { key: "neige", label: "Neige" },
] as const;
export type Want = (typeof WANTS)[number]["key"];
export type WantLabel = (typeof WANTS)[number]["label"];
export const WANT_LABEL = Object.fromEntries(WANTS.map((w) => [w.key, w.label])) as Record<Want, WantLabel>;
export const WANT_FROM_LABEL = Object.fromEntries(WANTS.map((w) => [w.label, w.key])) as Record<string, Want | undefined>;

export const RULES = [
  { key: "noBeach", label: "Pas de plage" },
  { key: "direct", label: "Vol direct uniquement" },
  { key: "calm", label: "Peu de monde" },
  { key: "kids", label: "Avec enfants" },
] as const;
export type Rule = (typeof RULES)[number]["key"];

/** 0 = mauvaise saison, 1 = correcte, 2 = idéale */
export type Level = 0 | 1 | 2;
export type Season = readonly [Level, Level, Level, Level, Level, Level, Level, Level, Level, Level, Level, Level];

export interface Destination {
  name: string;
  country: string;
  /** Code de l'aéroport d'arrivée, départ Paris CDG */
  airport: string;
  /** Heures de vol depuis Paris */
  flightHours: number;
  direct: boolean;
  /** Vol aller-retour en éco, € par personne */
  flightPrice: number;
  /** Budget sur place, € par jour et par personne */
  dailyBudget: number;
  /** Envies, le point fort en premier */
  wants: readonly Want[];
  /** Saisonnalité de janvier à décembre */
  season: Season;
  /** 0 = peu fréquenté, 2 = très fréquenté */
  crowd: Level;
  pitch: string;
}

type Row = [string, string, string, number, 0 | 1, number, number, Want[], Season, Level, string];

// [nom, pays, code, heures de vol, direct, vol A/R €, €/jour/pers, envies (1re = point fort), saison J→D, affluence, accroche]
const ROWS: Row[] = [
  ["Marrakech", "Maroc", "RAK", 3.3, 1, 180, 95, ["culture", "ville", "gastro", "desert"], [1, 2, 2, 2, 2, 1, 0, 0, 1, 2, 2, 1], 2, "Riads, souks et désert d'Agafay à une heure de route."],
  ["Lisbonne", "Portugal", "LIS", 2.7, 1, 160, 110, ["ville", "culture", "gastro", "plage"], [0, 1, 1, 2, 2, 2, 1, 1, 2, 2, 1, 0], 2, "Ville lumineuse, cuisine simple et plages de Cascais juste à côté."],
  ["Tenerife", "Canaries, Espagne", "TFS", 4.3, 1, 220, 100, ["plage", "nature", "rando", "plongee"], [2, 2, 2, 2, 2, 1, 1, 1, 2, 2, 2, 2], 2, "Le soleil d'hiver le plus proche, avec le Teide à gravir."],
  ["Madère", "Portugal", "FNC", 3.8, 1, 240, 110, ["nature", "rando", "gastro"], [1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1], 1, "Levadas en falaise et forêts de lauriers, climat doux toute l'année."],
  ["Açores", "Portugal", "PDL", 3.5, 1, 320, 105, ["nature", "rando", "faune", "plongee"], [0, 0, 1, 2, 2, 2, 2, 2, 2, 1, 0, 0], 0, "Volcans, lacs de cratère et observation des baleines."],
  ["Sicile", "Italie", "CTA", 2.7, 1, 170, 100, ["culture", "gastro", "plage", "nature"], [0, 0, 1, 2, 2, 2, 1, 1, 2, 2, 1, 0], 2, "Etna, temples grecs et cuisine de rue."],
  ["Crète", "Grèce", "HER", 3.5, 1, 220, 90, ["plage", "rando", "culture", "plongee"], [0, 0, 1, 2, 2, 2, 1, 1, 2, 2, 1, 0], 2, "Gorges à randonner et criques turquoise."],
  ["Écosse", "Royaume-Uni", "EDI", 1.7, 1, 150, 140, ["nature", "rando", "culture"], [0, 0, 1, 1, 2, 2, 2, 2, 2, 1, 0, 0], 1, "Highlands, îles et distilleries, à moins de deux heures de vol."],
  ["Islande", "Islande", "KEF", 3.3, 1, 320, 220, ["nature", "rando", "neige"], [1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 0, 1], 1, "Glaciers, cascades et aurores boréales l'hiver."],
  ["Lofoten", "Norvège", "BOO", 4.5, 0, 380, 190, ["nature", "rando", "neige"], [1, 1, 1, 0, 1, 2, 2, 2, 1, 0, 0, 1], 1, "Pics plongeant dans la mer, randonnées sous le soleil de minuit."],
  ["Laponie", "Finlande", "RVN", 3.8, 0, 450, 210, ["neige", "nature", "faune"], [2, 2, 2, 0, 0, 1, 1, 0, 1, 0, 0, 2], 1, "Chiens de traîneau, rennes et aurores."],
  ["Géorgie", "Géorgie", "TBS", 4.8, 1, 320, 70, ["rando", "gastro", "culture", "nature"], [0, 0, 1, 1, 2, 2, 2, 2, 2, 2, 1, 0], 0, "Caucase sauvage, vin en amphore et monastères perchés."],
  ["Jordanie", "Jordanie", "AMM", 4.8, 1, 400, 130, ["desert", "culture", "rando", "plongee"], [0, 1, 2, 2, 2, 1, 0, 0, 1, 2, 2, 1], 1, "Pétra, Wadi Rum et la mer Rouge à Aqaba."],
  ["Égypte", "Égypte", "HRG", 4.8, 1, 380, 80, ["culture", "plongee", "desert", "plage"], [2, 2, 2, 2, 1, 0, 0, 0, 1, 2, 2, 2], 2, "Temples du Nil et récifs parmi les plus beaux de la mer Rouge."],
  ["Oman", "Oman", "MCT", 8.5, 0, 650, 160, ["desert", "nature", "plongee", "plage"], [2, 2, 2, 1, 0, 0, 0, 0, 1, 2, 2, 2], 0, "Fjords de Musandam, wadis et dunes de Wahiba."],
  ["Ouzbékistan", "Ouzbékistan", "TAS", 6.5, 1, 560, 70, ["culture", "ville", "gastro"], [0, 0, 1, 2, 2, 1, 0, 0, 1, 2, 1, 0], 0, "Samarcande et Boukhara, la route de la soie en mosaïques bleues."],
  ["Sénégal", "Sénégal", "DSS", 5.5, 1, 480, 85, ["culture", "plage", "nature", "faune"], [2, 2, 2, 2, 1, 0, 0, 0, 0, 1, 2, 2], 0, "Sine Saloum, île de Gorée et lumière douce de l'hiver."],
  ["Cap-Vert", "Cap-Vert", "SID", 6, 1, 450, 90, ["plage", "rando", "nature"], [2, 2, 2, 2, 2, 1, 1, 1, 1, 2, 2, 2], 1, "Randonnées volcaniques à Santo Antão et plages de Sal."],
  ["Kenya", "Kenya", "NBO", 8.5, 1, 800, 280, ["faune", "nature"], [2, 2, 1, 0, 0, 1, 2, 2, 2, 2, 1, 2], 1, "Masai Mara et la grande migration de juillet à octobre."],
  ["Tanzanie", "Tanzanie", "JRO", 11, 0, 900, 300, ["faune", "nature", "plage"], [2, 2, 1, 0, 0, 2, 2, 2, 2, 2, 1, 2], 1, "Serengeti, cratère du Ngorongoro et Kilimandjaro."],
  ["Namibie", "Namibie", "WDH", 13, 0, 950, 200, ["faune", "desert", "nature"], [1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 1, 1], 0, "Dunes de Sossusvlei, Etosha et grands espaces vides : road trip en autonomie."],
  ["Botswana", "Botswana", "MUB", 14, 0, 1150, 450, ["faune", "nature"], [0, 0, 0, 1, 1, 2, 2, 2, 2, 2, 1, 0], 0, "Delta de l'Okavango en mokoro, safari très peu fréquenté."],
  ["Afrique du Sud", "Afrique du Sud", "CPT", 11.5, 1, 900, 160, ["faune", "nature", "gastro", "rando"], [2, 2, 2, 2, 1, 1, 1, 1, 2, 2, 2, 2], 1, "Le Cap, les vignobles et un safari dans le Kruger."],
  ["Madagascar", "Madagascar", "TNR", 11, 1, 950, 110, ["nature", "faune", "plongee", "plage"], [0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 1], 0, "Lémuriens, baobabs et tsingy, une faune qu'on ne voit nulle part ailleurs."],
  ["La Réunion", "France", "RUN", 11, 1, 850, 130, ["rando", "nature", "plongee"], [1, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 1], 1, "Cirques, Piton de la Fournaise et lagon."],
  ["Guadeloupe", "France", "PTP", 8.5, 1, 600, 130, ["plage", "plongee", "nature"], [2, 2, 2, 2, 1, 1, 1, 0, 0, 1, 1, 2], 1, "Réserve Cousteau, Soufrière et plages de Grande-Terre."],
  ["Costa Rica", "Costa Rica", "SJO", 11, 1, 800, 140, ["nature", "faune", "rando", "plage"], [2, 2, 2, 2, 1, 0, 1, 1, 0, 0, 1, 2], 1, "Forêts de nuages, volcans et paresseux."],
  ["Yucatán", "Mexique", "CUN", 11, 1, 750, 120, ["plage", "culture", "plongee"], [2, 2, 2, 2, 1, 0, 0, 0, 0, 1, 2, 2], 2, "Cénotes, cités mayas et mer des Caraïbes."],
  ["Pérou", "Pérou", "LIM", 12, 1, 950, 110, ["culture", "rando", "nature"], [1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 1, 1], 1, "Machu Picchu, Vallée sacrée et lac Titicaca."],
  ["Patagonie", "Argentine & Chili", "FTE", 17, 0, 1200, 160, ["nature", "rando", "faune"], [2, 2, 2, 1, 0, 0, 0, 0, 0, 1, 2, 2], 0, "Fitz Roy, glacier Perito Moreno et Torres del Paine."],
  ["Japon", "Japon", "HND", 14, 1, 950, 170, ["culture", "ville", "gastro", "nature"], [1, 1, 2, 2, 2, 0, 0, 0, 1, 2, 2, 1], 2, "Kyoto, Alpes japonaises et onsen, idéal au printemps et à l'automne."],
  ["Vietnam", "Vietnam", "HAN", 12, 1, 750, 70, ["culture", "gastro", "nature", "plage"], [1, 2, 2, 2, 1, 1, 1, 1, 1, 2, 2, 1], 2, "Baie d'Halong, rizières du Nord et cuisine de rue."],
  ["Sri Lanka", "Sri Lanka", "CMB", 13, 0, 700, 80, ["culture", "nature", "faune", "plage"], [2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2], 1, "Temples, plantations de thé et éléphants de Minneriya."],
  ["Thaïlande", "Thaïlande", "BKK", 11.5, 1, 700, 80, ["plage", "culture", "gastro", "plongee"], [2, 2, 2, 1, 1, 0, 0, 0, 0, 1, 2, 2], 2, "Îles d'Andaman, temples de Chiang Mai et street food."],
  ["Indonésie", "Bali & Komodo", "DPS", 17, 0, 950, 90, ["plongee", "plage", "nature", "culture"], [1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 1, 1], 2, "Rizières de Bali et plongée avec les raies manta à Komodo."],
];

export const CATALOGUE: readonly Destination[] = ROWS.map(
  ([name, country, airport, flightHours, direct, flightPrice, dailyBudget, wants, season, crowd, pitch]) => ({
    name, country, airport, flightHours, direct: direct === 1, flightPrice, dailyBudget, wants, season, crowd, pitch,
  }),
);
