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

export const WEIGHTS = { season: 32, wants: 33, budget: 20, duration: 10, crowd: 5 } as const;
export const PENALTY = { beachFirst: 20, noWantHit: 10, visited: 15, malaria: 12, malariaPartial: 5 } as const;
/** Envie marquée « Sans enfants » dans Notion : à faire avant d'avoir des enfants, donc plutôt maintenant. */
export const BEFORE_KIDS_BONUS = 4;
export const PRIORITY_BONUS: Record<Priority, number> = { "Très envie": 10, "Envie": 6, "Un jour": 3 };
const DEFAULT_PRIORITY_BONUS = 5;

interface CoreInput {
  season: Level;
  wants: readonly Want[];
  /** null quand le coût est inconnu */
  cost: number | null;
  minDays: number | null;
  crowd: Level | null;
  beachFirst: boolean;
}

/** Détail des points, pour l'affichage « Comparer ». */
export interface ScoreParts {
  season: number;
  wants: number;
  budget: number;
  duration: number;
  crowd: number;
  /** Bonus et pénalités, avec leur raison */
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
  p.season + p.wants + p.budget + p.duration + p.crowd + p.adjustments.reduce((s, a) => s + a.points, 0);

export function scoreCore(input: CoreInput, c: Criteria): CoreScore {
  const hits = c.wants.filter((w) => input.wants.includes(w));
  const parts: ScoreParts = { season: 0, wants: 0, budget: 0, duration: 0, crowd: 0, adjustments: [] };

  parts.season = input.season === 2 ? WEIGHTS.season : input.season === 1 ? 18 : 0;
  parts.wants = c.wants.length ? (WEIGHTS.wants * hits.length) / c.wants.length : WEIGHTS.wants;

  let over = 0;
  if (input.cost == null) parts.budget = 12;
  else {
    over = input.cost > c.budget ? (input.cost - c.budget) / Math.max(c.budget, 1) : 0;
    parts.budget = Math.max(0, WEIGHTS.budget * (1 - over * 2));
  }

  if (input.minDays == null) parts.duration = 7;
  else parts.duration = c.days >= input.minDays ? WEIGHTS.duration : Math.max(0, WEIGHTS.duration - (input.minDays - c.days) * 3);

  if (c.rules.includes("calm")) parts.crowd = input.crowd == null ? 3 : ([5, 2, 0] as const)[input.crowd];
  else parts.crowd = WEIGHTS.crowd;

  if (c.rules.includes("noBeach") && input.beachFirst) parts.adjustments.push({ label: "Plage en point fort", points: -PENALTY.beachFirst });
  if (c.wants.length && !hits.length) parts.adjustments.push({ label: "Aucune envie ne colle", points: -PENALTY.noWantHit });

  return { points: sumParts(parts), hits, over, parts };
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const priorityBonus = (p: Priority | null) => (p ? PRIORITY_BONUS[p] : DEFAULT_PRIORITY_BONUS);

/** Meilleur mois parmi ceux envisagés, et son niveau. */
export function bestMonth(season: readonly Level[], months: readonly number[]): { month: number; level: Level } {
  let best = { month: months[0] ?? 0, level: season[months[0] ?? 0] };
  for (const m of months) if (season[m] > best.level) best = { month: m, level: season[m] };
  return best;
}

/** Vol direct possible sur l'un des mois envisagés. */
export function isDirect(d: Destination, months: readonly number[]): boolean {
  if (!d.direct) return false;
  return !d.directMonths || months.some((m) => d.directMonths!.includes(m));
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
  const core = scoreCore({ season, wants: d.wants, cost, minDays, crowd: d.crowd, beachFirst: d.wants[0] === "plage" }, c);
  const adj = core.parts.adjustments;
  if (ctx.wish) adj.push(...wishAdjustments(ctx.wish, c));
  if (ctx.trip) adj.push({ label: `Déjà fait en ${ctx.trip.start?.slice(0, 4) ?? "?"}`, points: -PENALTY.visited });
  if (c.rules.includes("kids") && d.malaria) {
    adj.push(d.malaria === true
      ? { label: "Zone de paludisme", points: -PENALTY.malaria }
      : { label: "Paludisme dans une partie du pays", points: -PENALTY.malariaPartial });
  }
  return {
    kind: "destination", destination: d, season, month, direct: isDirect(d, c.months), cost, minDays, ...ctx, ...core,
    points: sumParts(core.parts), score: clamp(sumParts(core.parts)),
  };
}

function wishAdjustments(w: Wish, c: Criteria): { label: string; points: number }[] {
  const out = [{ label: `Sur ta liste (${w.priority ?? "sans priorité"})`, points: priorityBonus(w.priority) }];
  if (w.kids === "Sans enfants" && !c.rules.includes("kids")) out.push({ label: "À faire avant les enfants", points: BEFORE_KIDS_BONUS });
  return out;
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
  const core = scoreCore(
    {
      season,
      wants,
      cost: w.budget,
      minDays: w.idealDays != null ? Math.max(2, w.idealDays - 3) : null,
      crowd: null,
      beachFirst: false,
    },
    c,
  );
  core.parts.adjustments.push(...wishAdjustments(w, c));
  const points = sumParts(core.parts);
  return { kind: "wish", wish: w, wants, season, month, cost: w.budget, idealDays: w.idealDays, ...core, points, score: clamp(points) };
}

export interface Ranking {
  results: Result[];
  /** Destinations écartées par la contrainte « vol direct » */
  hiddenNotDirect: number;
}

export function rank(
  c: Criteria,
  notion: { wishes: readonly Wish[]; trips: readonly Trip[] } = { wishes: [], trips: [] },
  catalogue: readonly Destination[] = CATALOGUE,
): Ranking {
  const withKids = c.rules.includes("kids");
  const wishes = notion.wishes
    .filter((w) => wishFits(w, withKids))
    .map((w) => ({ w, dest: matchCatalogue(w.name, catalogue) }));

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
    if (r.direct) pros.push("Vol direct");
    if (c.rules.includes("calm")) {
      if (r.destination.crowd === 0) pros.push("Peu fréquenté");
      else cons.push(r.destination.crowd === 2 ? "Très fréquenté" : "Affluence moyenne");
    }
  }
  for (const a of r.parts.adjustments) {
    if (a.label.startsWith("Sur ta liste")) continue;
    (a.points > 0 ? pros : cons).push(a.label);
  }
  return { pros, cons };
}
