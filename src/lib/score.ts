import {
  CATALOGUE, MONTHS, WANT_FROM_LABEL, WANT_LABEL,
  type Destination, type Level, type Rule, type Want,
} from "../data/catalogue";
import type { Priority, Trip, Wish } from "../shared/types";
import { matchCatalogue, tripFor, wishFits } from "./match";

export interface Criteria {
  /** Mois envisagés (0 = janvier), au moins un. Chaque destination est notée sur son meilleur. */
  months: readonly number[];
  /** 2 à 21 jours */
  days: number;
  /** € par personne, vols + sur place */
  budget: number;
  wants: readonly Want[];
  rules: readonly Rule[];
}

/**
 * Score sur 100, gradué pour que les destinations se départagent :
 * saison 25, envies 25, budget 20, trajet par rapport à la durée 10, calme 10, ta liste d'envies 10.
 * Les pénalités (déjà fait, plage non voulue, paludisme avec enfants…) se retirent ensuite.
 */
/** Critères au premier lancement : le mois prochain, 10 jours, 3 000 €, sans envie ni contrainte. */
export const DEFAULT_CRITERIA: Criteria = { months: [(new Date().getMonth() + 1) % 12], days: 10, budget: 3000, wants: [], rules: [] };

export const WEIGHTS = { season: 25, wants: 25, budget: 20, trip: 10, calm: 10, list: 10 } as const;
export const PENALTY = { beachFirst: 20, noWantHit: 5, visited: 15, malaria: 12, malariaPartial: 5, crowded: 5 } as const;
/** Points « liste » selon la priorité Notion. */
export const PRIORITY_POINTS: Record<Priority, number> = { "Très envie": 8, "Envie": 5, "Un jour": 2 };
const NO_PRIORITY_POINTS = 4;
/** Envie marquée « Sans enfants » dans Notion : à faire avant d'avoir des enfants, donc plutôt maintenant. */
export const BEFORE_KIDS_POINTS = 2;

interface CoreInput {
  season: Level;
  /** Envies du lieu, le point fort en premier */
  wants: readonly Want[];
  /** null quand le coût est inconnu */
  cost: number | null;
  /** Jours conseillés pour le trajet (destination du catalogue) */
  minDays: number | null;
  /** Durée idéale notée dans Notion (envie hors catalogue) */
  idealDays: number | null;
  crowd: Level | null;
  wish: Wish | undefined;
}

/** Détail des points, pour la fiche et « Comparer ». */
export interface ScoreParts {
  season: number;
  wants: number;
  budget: number;
  trip: number;
  calm: number;
  list: number;
  /** Pénalités, avec leur raison */
  adjustments: { label: string; points: number }[];
}

export interface CoreScore {
  points: number;
  hits: Want[];
  /** Dépassement du budget en fraction (0.2 = 20 % au-dessus) */
  over: number;
  parts: ScoreParts;
}

const sumParts = (p: ScoreParts) =>
  p.season + p.wants + p.budget + p.trip + p.calm + p.list + p.adjustments.reduce((s, a) => s + a.points, 0);

export function listPoints(w: Wish | undefined, c: Criteria): number {
  if (!w) return 0;
  const base = w.priority ? PRIORITY_POINTS[w.priority] : NO_PRIORITY_POINTS;
  const beforeKids = w.kids === "Sans enfants" && !c.rules.includes("kids") ? BEFORE_KIDS_POINTS : 0;
  return Math.min(WEIGHTS.list, base + beforeKids);
}

export function scoreCore(input: CoreInput, c: Criteria): CoreScore {
  const hits = c.wants.filter((w) => input.wants.includes(w));
  const parts: ScoreParts = { season: 0, wants: 0, budget: 0, trip: 0, calm: 0, list: 0, adjustments: [] };

  parts.season = input.season === 2 ? WEIGHTS.season : input.season === 1 ? 12 : 0;

  // Envies : 20 points au prorata de ce qui colle, 5 si le point fort du lieu fait partie de vos envies.
  if (!c.wants.length) parts.wants = 20;
  else {
    parts.wants = (20 * hits.length) / c.wants.length;
    if (input.wants[0] && c.wants.includes(input.wants[0])) parts.wants += 5;
  }

  let over = 0;
  if (input.cost == null) parts.budget = 12;
  else {
    over = input.cost > c.budget ? (input.cost - c.budget) / Math.max(c.budget, 1) : 0;
    parts.budget = Math.max(0, WEIGHTS.budget * (1 - over * 2));
  }

  // Trajet : plein quand on reste au moins 1,5 fois les jours conseillés, moins quand c'est juste.
  if (input.minDays != null) {
    const ratio = c.days / input.minDays;
    parts.trip = ratio >= 1.5 ? 10 : ratio >= 1 ? 7 : Math.max(0, 7 - (input.minDays - c.days) * 2);
  } else if (input.idealDays != null) {
    const gap = Math.abs(input.idealDays - c.days);
    parts.trip = gap <= 2 ? 10 : gap <= 5 ? 7 : 4;
  } else parts.trip = 6;

  parts.calm = input.crowd == null ? 5 : ([10, 5, 0] as const)[input.crowd];
  if (c.rules.includes("calm") && input.crowd === 2) parts.adjustments.push({ label: "Très fréquenté", points: -PENALTY.crowded });

  parts.list = listPoints(input.wish, c);

  if (c.rules.includes("noBeach") && input.wants[0] === "plage") parts.adjustments.push({ label: "Plage en point fort", points: -PENALTY.beachFirst });
  if (c.wants.length && !hits.length) parts.adjustments.push({ label: "Aucune envie ne colle", points: -PENALTY.noWantHit });

  return { points: sumParts(parts), hits, over, parts };
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Meilleur mois parmi ceux envisagés, et son niveau. */
export function bestMonth(season: readonly Level[], months: readonly number[]): { month: number; level: Level } {
  let best = { month: months[0] ?? 0, level: season[months[0] ?? 0] };
  for (const m of months) if (season[m] > best.level) best = { month: m, level: season[m] };
  return best;
}

/** Vol direct possible sur l'un des mois envisagés. */
export function isDirect(d: Destination, months: readonly number[]): boolean {
  if (!d.direct) return false;
  return !d.directMonths?.length || months.some((m) => d.directMonths!.includes(m));
}

/** Temps de trajet porte à porte : 3 h de plus avec une escale. */
export function travelHours(d: Destination, months: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]): number {
  return isDirect(d, months) ? d.flightHours : d.flightHours + 3;
}

/** Nombre de jours conseillé pour que le trajet vaille le coup. */
export function minDaysFor(d: Destination, months?: readonly number[]): number {
  const t = travelHours(d, months);
  return t < 4 ? 3 : t < 7 ? 6 : t < 11 ? 9 : 12;
}

export function tripCost(d: Destination, days: number): number {
  return d.flightPrice + d.dailyBudget * days;
}

export interface DestinationResult extends CoreScore {
  kind: "destination";
  destination: Destination;
  score: number;
  season: Level;
  /** Mois retenu pour la note de saison */
  month: number;
  direct: boolean;
  cost: number;
  minDays: number;
  wish?: Wish;
  trip?: Trip;
}

export interface WishResult extends CoreScore {
  kind: "wish";
  wish: Wish;
  wants: Want[];
  season: Level;
  month: number;
  cost: number | null;
  idealDays: number | null;
  score: number;
}

export type Result = DestinationResult | WishResult;

export function scoreDestination(d: Destination, c: Criteria, ctx: { wish?: Wish; trip?: Trip } = {}): DestinationResult {
  const { month, level: season } = bestMonth(d.season, c.months);
  const cost = tripCost(d, c.days);
  const minDays = minDaysFor(d, c.months);
  const core = scoreCore({ season, wants: d.wants, cost, minDays, idealDays: null, crowd: d.crowd, wish: ctx.wish }, c);
  const adj = core.parts.adjustments;
  if (ctx.trip) adj.push({ label: `Déjà fait en ${ctx.trip.start?.slice(0, 4) ?? "?"}`, points: -PENALTY.visited });
  if (c.rules.includes("kids") && d.malaria) {
    adj.push(d.malaria === true
      ? { label: "Zone de paludisme", points: -PENALTY.malaria }
      : { label: "Paludisme dans une partie du pays", points: -PENALTY.malariaPartial });
  }
  const points = sumParts(core.parts);
  return { kind: "destination", destination: d, season, month, direct: isDirect(d, c.months), cost, minDays, ...ctx, ...core, points, score: clamp(points) };
}

/** Saison d'une envie Notion : idéale si un des mois est coché, mauvaise sinon, correcte si aucun mois n'est renseigné. */
export function wishSeason(w: Wish, months: readonly number[]): { month: number; level: Level } {
  if (!w.bestMonths.length) return { month: months[0] ?? 0, level: 1 };
  const hit = months.find((m) => w.bestMonths.includes(m));
  return hit !== undefined ? { month: hit, level: 2 } : { month: months[0] ?? 0, level: 0 };
}

export function wishWants(w: Wish): Want[] {
  return w.wants.map((l) => WANT_FROM_LABEL[l]).filter((k): k is Want => k !== undefined);
}

export function scoreWish(w: Wish, c: Criteria): WishResult {
  const { month, level: season } = wishSeason(w, c.months);
  const wants = wishWants(w);
  const core = scoreCore({ season, wants, cost: w.budget, minDays: null, idealDays: w.idealDays, crowd: null, wish: w }, c);
  return { kind: "wish", wish: w, wants, season, month, cost: w.budget, idealDays: w.idealDays, ...core, score: clamp(core.points) };
}

export interface Ranking {
  results: Result[];
  /** Destinations écartées par la contrainte « vol direct » */
  hiddenNotDirect: number;
}

export function rank(
  c: Criteria,
  notion: { wishes: readonly Wish[]; trips: readonly Trip[]; catalogue?: readonly Destination[] } = { wishes: [], trips: [] },
  catalogue: readonly Destination[] = notion.catalogue?.length ? notion.catalogue : CATALOGUE,
): Ranking {
  const withKids = c.rules.includes("kids");
  const sameId = (a: string, b: string) => a.replace(/-/g, "") === b.replace(/-/g, "");
  const wishes = notion.wishes
    .filter((w) => wishFits(w, withKids))
    .map((w) => ({
      w,
      // Lien « Destination » dans Notion d'abord, sinon le nom ou le pays.
      dest: (w.destinationId ? catalogue.find((d) => sameId(d.id, w.destinationId!)) : undefined) ?? matchCatalogue(w.name, catalogue, w.country),
    }));

  const kept = catalogue.filter((d) => !(c.rules.includes("direct") && !isDirect(d, c.months)));
  const fromCatalogue = kept.map((d) =>
    scoreDestination(d, c, {
      wish: wishes.find((x) => x.dest === d)?.w,
      trip: tripFor(d, notion.trips),
    }),
  );
  const fromWishes = wishes.filter((x) => !x.dest).map((x) => scoreWish(x.w, c));

  const results: Result[] = [...fromCatalogue, ...fromWishes].sort((a, b) => b.score - a.score);
  return { results, hiddenNotDirect: catalogue.length - kept.length };
}

const roundTo50 = (n: number) => Math.round(n / 50) * 50;
export const formatEuros = (n: number) => `${roundTo50(n).toLocaleString("fr-FR")} €`;

/** « mai », « mai ou septembre », « mai, juin ou septembre » */
export function monthList(months: readonly number[]): string {
  const names = [...months].sort((a, b) => a - b).map((m) => MONTHS[m].toLowerCase());
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} ou ${names[names.length - 1]}`;
}

/** Phrase courte qui explique le score. */
export function explain(r: Result, c: Criteria): string {
  const out: string[] = [];
  const month = MONTHS[r.month].toLowerCase();
  if (r.kind === "wish" && !r.wish.bestMonths.length) out.push("pas de période indiquée dans Notion");
  else if (r.season === 0) out.push(`mauvaise saison en ${monthList(c.months)}`);
  else out.push(`${r.season === 2 ? "très bonne saison" : "saison correcte"} en ${month}`);
  if (r.over > 0 && r.cost != null) out.push(`dépasse le budget d'environ ${formatEuros(r.cost - c.budget)}`);
  if (r.kind === "destination" && c.days < r.minDays) out.push(`un peu loin pour ${c.days} jours (${r.minDays} conseillés)`);
  if (r.kind === "wish" && r.idealDays && Math.abs(r.idealDays - c.days) >= 4) out.push(`durée idéale notée : ${r.idealDays} jours`);
  if (r.kind === "destination" && c.rules.includes("kids") && r.destination.malaria) {
    out.push(r.destination.malaria === true ? "zone de paludisme" : "paludisme dans une partie du pays");
  }
  const s = out.join(", ");
  return s.charAt(0).toUpperCase() + s.slice(1) + ".";
}

/** Moment fort du mois retenu, s'il y en a un. */
export function highlight(r: Result): string | undefined {
  return r.kind === "destination" ? r.destination.highlights?.[r.month] : undefined;
}

/** Points forts et points faibles, en clair, pour la carte. */
export function prosCons(r: Result, c: Criteria): { pros: string[]; cons: string[] } {
  const pros: string[] = [];
  const cons: string[] = [];
  const month = MONTHS[r.month].toLowerCase();
  const noMonths = r.kind === "wish" && !r.wish.bestMonths.length;

  if (!noMonths) {
    if (r.season === 2) pros.push(`Idéal en ${month}`);
    else if (r.season === 1) cons.push(`Saison moyenne en ${month}`);
    else cons.push(`Mauvaise saison en ${monthList(c.months)}`);
  }
  if (c.wants.length) {
    const missing = c.wants.filter((w) => !r.hits.includes(w));
    if (r.hits.length) pros.push(r.hits.map((h) => WANT_LABEL[h]).join(", "));
    if (missing.length) cons.push(`Pas de ${missing.map((m) => WANT_LABEL[m].toLowerCase()).join(", ")}`);
  }
  if (r.cost != null) {
    if (r.over > 0) cons.push(`${formatEuros(r.cost - c.budget)} au-dessus du budget`);
    else if (r.cost <= c.budget * 0.8) pros.push(`${formatEuros(c.budget - r.cost)} sous le budget`);
  }
  if (r.kind === "destination") {
    if (c.days < r.minDays) cons.push(`Trajet long pour ${c.days} j`);
    else if (c.days < r.minDays * 1.5) cons.push(`Trajet un peu long pour ${c.days} j`);
    if (r.direct) pros.push("Vol direct");
    if (r.destination.crowd === 0) pros.push("Peu fréquenté");
    else if (r.destination.crowd === 1) cons.push("Affluence moyenne");
    else if (!c.rules.includes("calm")) cons.push("Très fréquenté");
  }
  const wish = r.kind === "destination" ? r.wish : r.wish;
  if (wish) pros.push(`Sur ta liste${wish.priority ? ` (${wish.priority})` : ""}`);
  if (wish?.kids === "Sans enfants" && !c.rules.includes("kids")) pros.push("À faire avant les enfants");
  for (const a of r.parts.adjustments) (a.points > 0 ? pros : cons).push(a.label);
  return { pros, cons };
}
