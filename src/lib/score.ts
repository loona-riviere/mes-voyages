import {
  CATALOGUE, MONTHS, WANT_FROM_LABEL,
  type Destination, type Level, type Rule, type Want,
} from "../data/catalogue";
import type { Priority, Trip, Wish } from "../shared/types";
import { matchCatalogue, tripFor, wishFits } from "./match";

export interface Criteria {
  /** 0 = janvier */
  month: number;
  /** 2 à 21 jours */
  days: number;
  /** € par personne, vols + sur place */
  budget: number;
  wants: readonly Want[];
  rules: readonly Rule[];
}

export const WEIGHTS = { season: 32, wants: 33, budget: 20, duration: 10, crowd: 5 } as const;
export const PENALTY = { beachFirst: 20, noWantHit: 10, visited: 15 } as const;
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

export interface CoreScore {
  points: number;
  hits: Want[];
  /** Dépassement du budget en fraction (0.2 = 20 % au-dessus) */
  over: number;
}

export function scoreCore(input: CoreInput, c: Criteria): CoreScore {
  const hits = c.wants.filter((w) => input.wants.includes(w));
  let pts = 0;

  pts += input.season === 2 ? WEIGHTS.season : input.season === 1 ? 18 : 0;
  pts += c.wants.length ? (WEIGHTS.wants * hits.length) / c.wants.length : WEIGHTS.wants;

  let over = 0;
  if (input.cost == null) pts += 12;
  else {
    over = input.cost > c.budget ? (input.cost - c.budget) / Math.max(c.budget, 1) : 0;
    pts += Math.max(0, WEIGHTS.budget * (1 - over * 2));
  }

  if (input.minDays == null) pts += 7;
  else pts += c.days >= input.minDays ? WEIGHTS.duration : Math.max(0, WEIGHTS.duration - (input.minDays - c.days) * 3);

  if (c.rules.includes("calm")) pts += input.crowd == null ? 3 : ([5, 2, 0] as const)[input.crowd];
  else pts += WEIGHTS.crowd;

  if (c.rules.includes("noBeach") && input.beachFirst) pts -= PENALTY.beachFirst;
  if (c.wants.length && !hits.length) pts -= PENALTY.noWantHit;

  return { points: pts, hits, over };
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const priorityBonus = (p: Priority | null) => (p ? PRIORITY_BONUS[p] : DEFAULT_PRIORITY_BONUS);

/** Temps de trajet porte à porte : 3 h de plus avec une escale. */
export function travelHours(d: Destination): number {
  return d.direct ? d.flightHours : d.flightHours + 3;
}

/** Nombre de jours conseillé pour que le trajet vaille le coup. */
export function minDaysFor(d: Destination): number {
  const t = travelHours(d);
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
  cost: number | null;
  idealDays: number | null;
  score: number;
}

export type Result = DestinationResult | WishResult;

export function scoreDestination(d: Destination, c: Criteria, ctx: { wish?: Wish; trip?: Trip } = {}): DestinationResult {
  const season = d.season[c.month];
  const cost = tripCost(d, c.days);
  const minDays = minDaysFor(d);
  const core = scoreCore({ season, wants: d.wants, cost, minDays, crowd: d.crowd, beachFirst: d.wants[0] === "plage" }, c);
  let pts = core.points;
  if (ctx.wish) pts += priorityBonus(ctx.wish.priority);
  if (ctx.trip) pts -= PENALTY.visited;
  return { kind: "destination", destination: d, season, cost, minDays, ...ctx, ...core, score: clamp(pts) };
}

/** Saison d'une envie Notion : idéale si le mois est coché, mauvaise sinon, correcte si aucun mois n'est renseigné. */
export function wishSeason(w: Wish, month: number): Level {
  if (!w.bestMonths.length) return 1;
  return w.bestMonths.includes(month) ? 2 : 0;
}

export function wishWants(w: Wish): Want[] {
  return w.wants.map((l) => WANT_FROM_LABEL[l]).filter((k): k is Want => k !== undefined);
}

export function scoreWish(w: Wish, c: Criteria): WishResult {
  const season = wishSeason(w, c.month);
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
  return {
    kind: "wish", wish: w, wants, season, cost: w.budget, idealDays: w.idealDays,
    ...core, score: clamp(core.points + priorityBonus(w.priority)),
  };
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

  const kept = catalogue.filter((d) => !(c.rules.includes("direct") && !d.direct));
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

/** Phrase courte qui explique le score. */
export function explain(r: Result, c: Criteria): string {
  const out: string[] = [];
  const month = MONTHS[c.month].toLowerCase();
  if (r.kind === "wish" && !r.wish.bestMonths.length) out.push("pas de période indiquée dans Notion");
  else out.push(r.season === 2 ? `très bonne saison en ${month}` : r.season === 1 ? `saison correcte en ${month}` : `mauvaise saison en ${month}`);
  if (r.over > 0 && r.cost != null) out.push(`dépasse le budget d'environ ${formatEuros(r.cost - c.budget)}`);
  if (r.kind === "destination" && c.days < r.minDays) out.push(`un peu loin pour ${c.days} jours (${r.minDays} conseillés)`);
  if (r.kind === "wish" && r.idealDays && Math.abs(r.idealDays - c.days) >= 4) out.push(`durée idéale notée : ${r.idealDays} jours`);
  const s = out.join(", ");
  return s.charAt(0).toUpperCase() + s.slice(1) + ".";
}
