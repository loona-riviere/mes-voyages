import { MONTHS, RULES, WANT_FROM_LABEL, WANT_LABEL, WANTS, type Destination, type Level, type Rule, type Want } from "../../src/data/catalogue";
import {
  PRIORITIES, WISH_STATUSES,
  LODGING_TYPES, TRANSPORT_TYPES,
  type Lodging, type LodgingInput, type LodgingType, type Project, type ProjectInput, type ProjectStatus,
  type Transport, type TransportInput, type TransportType, type TripInput,
  type Kids, type NewWish, type Priority, type Trip, type TripStatus, type Wish, type WishPatch, type WishStatus,
} from "../../src/shared/types";

export const NOTION_VERSION = "2026-03-11";
export const TRIPS_DATA_SOURCE = "8195c0cd-68d2-408e-afce-409b3f113982";
export const WISHES_DATA_SOURCE = "f84d6097-98c1-4b04-8fa9-bb7bcd36b7a4";
export const CATALOGUE_DATA_SOURCE = "9a6e6864-ed0d-44b8-8846-663a6b5b8dca";
export const PROJECTS_DATA_SOURCE = "11a1b63f-f92b-4607-aa33-d9781e11ff1f";
export const TRANSPORTS_DATA_SOURCE = "0a7f2ce5-f223-4b18-bd4a-485c566acfc0";
export const LODGINGS_DATA_SOURCE = "56ca372e-a9f0-401c-badd-48358712e582";

const WANT_LABELS: readonly string[] = WANTS.map((w) => w.label);
const KIDS: readonly Kids[] = ["Sans enfants", "Avec enfants"];
const TRIP_STATUSES: readonly TripStatus[] = ["À visiter", "À planifier", "En cours", "Visité"];

// ---------- Appels HTTP ----------

export class NotionError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function notion<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new NotionError(500, "NOTION_TOKEN manquant");
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      message = ((await res.json()) as { message?: string }).message ?? message;
    } catch {
      // réponse sans JSON
    }
    throw new NotionError(res.status, message);
  }
  return (await res.json()) as T;
}

export interface Page {
  id: string;
  url: string;
  in_trash?: boolean;
  properties: Record<string, Prop>;
}

interface QueryResponse {
  results: Page[];
  has_more: boolean;
  next_cursor: string | null;
}

/** Toutes les pages d'une data source, en suivant la pagination. */
export async function queryAll(dataSourceId: string, sorts?: unknown[]): Promise<Page[]> {
  const pages: Page[] = [];
  let cursor: string | undefined;
  do {
    const r = await notion<QueryResponse>(`/data_sources/${dataSourceId}/query`, {
      method: "POST",
      body: { page_size: 100, start_cursor: cursor, sorts },
    });
    pages.push(...r.results.filter((p) => !p.in_trash));
    cursor = r.has_more && r.next_cursor ? r.next_cursor : undefined;
  } while (cursor);
  return pages;
}

// ---------- Lecture des propriétés ----------

type RichText = { plain_text: string }[];
type Formula =
  | { type: "number"; number: number | null }
  | { type: "string"; string: string | null }
  | { type: "boolean"; boolean: boolean | null }
  | { type: "date"; date: { start: string } | null };
export type Prop =
  | { type: "title"; title: RichText }
  | { type: "rich_text"; rich_text: RichText }
  | { type: "number"; number: number | null }
  | { type: "select"; select: { name: string } | null }
  | { type: "status"; status: { name: string } | null }
  | { type: "multi_select"; multi_select: { name: string }[] }
  | { type: "date"; date: { start: string; end: string | null } | null }
  | { type: "formula"; formula: Formula }
  | { type: string; [k: string]: unknown };

const get = (p: Page, name: string): Prop | undefined => p.properties[name];

export function text(p: Page, name: string): string {
  const v = get(p, name);
  if (v?.type === "title") return (v.title as RichText).map((t) => t.plain_text).join("");
  if (v?.type === "rich_text") return (v.rich_text as RichText).map((t) => t.plain_text).join("");
  return "";
}

export function option(p: Page, name: string): string | null {
  const v = get(p, name);
  if (v?.type === "select") return (v.select as { name: string } | null)?.name ?? null;
  if (v?.type === "status") return (v.status as { name: string } | null)?.name ?? null;
  return null;
}

export function options(p: Page, name: string): string[] {
  const v = get(p, name);
  return v?.type === "multi_select" ? (v.multi_select as { name: string }[]).map((o) => o.name) : [];
}

/** Nombre, y compris depuis une formule numérique ou texte (« 15 jours », « 1 250 € »). */
export function num(p: Page, name: string): number | null {
  const v = get(p, name);
  if (v?.type === "number") return (v.number as number | null) ?? null;
  if (v?.type === "formula") {
    const f = v.formula as Formula;
    if (f.type === "number") return f.number;
    if (f.type === "string" && f.string) {
      const m = f.string.replace(/[\s  ]/g, "").replace(",", ".").match(/-?\d+(\.\d+)?/);
      return m ? Number(m[0]) : null;
    }
  }
  return null;
}

export function relationIds(p: Page, name: string): string[] {
  const v = get(p, name);
  return v?.type === "relation" ? (v.relation as { id: string }[]).map((r) => r.id) : [];
}

export function checkbox(p: Page, name: string): boolean {
  const v = get(p, name);
  return v?.type === "checkbox" ? Boolean(v.checkbox) : false;
}

const monthIndexes = (names: string[]) =>
  names.map((m) => (MONTHS as readonly string[]).indexOf(m)).filter((i) => i >= 0).sort((a, b) => a - b);

export function dateRange(p: Page, name: string): { start: string | null; end: string | null } {
  const v = get(p, name);
  const d = v?.type === "date" ? (v.date as { start: string; end: string | null } | null) : null;
  return { start: d?.start?.slice(0, 10) ?? null, end: d?.end?.slice(0, 10) ?? null };
}

const oneOf = <T extends string>(list: readonly T[], v: string | null): T | null =>
  v !== null && (list as readonly string[]).includes(v) ? (v as T) : null;

export function toWish(p: Page): Wish {
  return {
    id: p.id,
    url: p.url,
    name: text(p, "Nom"),
    country: text(p, "Pays"),
    wants: options(p, "Envies"),
    bestMonths: monthIndexes(options(p, "Meilleurs mois")),
    idealDays: num(p, "Durée idéale (jours)"),
    budget: num(p, "Budget estimé / pers"),
    kids: oneOf(KIDS, option(p, "Enfants")),
    priority: oneOf(PRIORITIES, option(p, "Priorité")),
    status: oneOf(WISH_STATUSES, option(p, "Statut")),
    notes: text(p, "Notes"),
    destinationId: relationIds(p, "Destination")[0] ?? null,
  };
}

const CROWD: Record<string, Level> = { "Peu fréquenté": 0, "Moyenne": 1, "Très fréquenté": 2 };

/** « Septembre : grande migration » sur chaque ligne → { 8: "grande migration" } */
export function parseHighlights(raw: string): Record<number, string> | undefined {
  const out: Record<number, string> = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([^:]+?)\s*:\s*(.+)$/);
    const i = m ? (MONTHS as readonly string[]).indexOf(m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase()) : -1;
    if (m && i >= 0) out[i] = m[2].trim();
  }
  return Object.keys(out).length ? out : undefined;
}

/** Destination du catalogue Notion. Les valeurs manquantes prennent une valeur neutre plutôt que de faire planter l'app. */
export function toDestination(p: Page): Destination | null {
  const name = text(p, "Nom").trim();
  if (!name) return null;
  const ideal = monthIndexes(options(p, "Mois idéaux"));
  const ok = monthIndexes(options(p, "Mois corrects"));
  const season = MONTHS.map((_, i) => (ideal.includes(i) ? 2 : ok.includes(i) ? 1 : 0)) as unknown as Destination["season"];
  const strong = WANT_FROM_LABEL[option(p, "Point fort") ?? ""];
  const others = options(p, "Envies").map((l) => WANT_FROM_LABEL[l]).filter((w): w is Want => !!w && w !== strong);
  const directMonths = monthIndexes(options(p, "Mois du vol direct"));
  const malaria = option(p, "Paludisme");
  return {
    id: p.id,
    url: p.url,
    name,
    country: text(p, "Pays"),
    airport: text(p, "Aéroport").toUpperCase(),
    flightHours: num(p, "Heures de vol") ?? 8,
    direct: checkbox(p, "Vol direct"),
    directMonths: directMonths.length ? directMonths : undefined,
    flightPrice: num(p, "Vol A/R") ?? 800,
    dailyBudget: num(p, "Budget / jour / pers") ?? 120,
    wants: strong ? [strong, ...others] : others,
    season,
    crowd: CROWD[option(p, "Affluence") ?? ""] ?? 1,
    pitch: text(p, "Accroche"),
    malaria: malaria === "Oui" ? true : malaria === "En partie" ? "partiel" : false,
    highlights: parseHighlights(text(p, "Moments forts")),
    sources: text(p, "Sources") || undefined,
  };
}

export function daysBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  return Math.round((Date.parse(end) - Date.parse(start)) / 864e5) + 1;
}

export function toTrip(p: Page): Trip {
  const { start, end } = dateRange(p, "Date");
  return {
    id: p.id,
    url: p.url,
    name: text(p, "Nom"),
    status: oneOf(TRIP_STATUSES, option(p, "Statut")),
    start,
    end,
    budget: num(p, "Budget"),
    days: num(p, "Durée") ?? daysBetween(start, end),
    pricePerPerson: num(p, "Prix par personne"),
    dailyPerPerson: num(p, "Budget / jour / pers"),
    rating: num(p, "Note"),
    memories: text(p, "Souvenirs"),
  };
}

// ---------- Écriture ----------

const rich = (s: string) => [{ type: "text", text: { content: s.slice(0, 2000) } }];
const sel = (name: string | null | undefined) => ({ select: name ? { name } : null });

export class InvalidInput extends Error {}

function check<T extends string>(list: readonly T[], v: unknown, field: string): T {
  if (typeof v !== "string" || !(list as readonly string[]).includes(v)) throw new InvalidInput(`${field} invalide`);
  return v as T;
}

function positive(v: unknown, field: string): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) throw new InvalidInput(`${field} invalide`);
  return Math.round(v);
}

/** Propriétés Notion d'une nouvelle envie. Refuse les valeurs hors des options existantes. */
export function newWishProperties(input: NewWish): Record<string, unknown> {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) throw new InvalidInput("Nom manquant");
  const props: Record<string, unknown> = {
    "Nom": { title: rich(name) },
    "Priorité": sel(check(PRIORITIES, input.priority ?? "Envie", "Priorité")),
    "Statut": sel(check(WISH_STATUSES, input.status ?? "Idée", "Statut")),
  };
  if (input.country) props["Pays"] = { rich_text: rich(String(input.country)) };
  if (input.notes) props["Notes"] = { rich_text: rich(String(input.notes)) };
  if (input.wants?.length) props["Envies"] = { multi_select: input.wants.map((w) => ({ name: check(WANT_LABELS, w, "Envies") })) };
  if (input.bestMonths?.length) {
    props["Meilleurs mois"] = {
      multi_select: input.bestMonths.map((i) => {
        if (!Number.isInteger(i) || i < 0 || i > 11) throw new InvalidInput("Mois invalide");
        return { name: MONTHS[i] };
      }),
    };
  }
  const days = positive(input.idealDays, "Durée");
  if (days !== null) props["Durée idéale (jours)"] = { number: days };
  const budget = positive(input.budget, "Budget");
  if (budget !== null) props["Budget estimé / pers"] = { number: budget };
  if (input.kids) props["Enfants"] = sel(check(KIDS, input.kids, "Enfants"));
  if (input.destinationId) {
    if (!/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(input.destinationId)) throw new InvalidInput("Destination invalide");
    props["Destination"] = { relation: [{ id: input.destinationId }] };
  }
  return props;
}

export function patchProperties(patch: WishPatch): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  if (patch.priority !== undefined) props["Priorité"] = sel(check<Priority>(PRIORITIES, patch.priority, "Priorité"));
  if (patch.status !== undefined) props["Statut"] = sel(check<WishStatus>(WISH_STATUSES, patch.status, "Statut"));
  if (!Object.keys(props).length) throw new InvalidInput("Rien à modifier");
  return props;
}

// ---------- Projets ----------

const PROJECT_STATUSES: readonly ProjectStatus[] = ["À choisir", "Choisi", "Archivé"];
// Libellés Notion des contraintes (base « Projets »)
const RULE_LABEL: Record<Rule, string> = { noBeach: "Pas de plage", direct: "Vol direct uniquement", calm: "Peu de monde", kids: "Avec enfants" };
const RULE_FROM_LABEL = Object.fromEntries(Object.entries(RULE_LABEL).map(([k, l]) => [l, k])) as Record<string, Rule | undefined>;
const RULE_KEYS: readonly string[] = RULES.map((r) => r.key);
const WANT_KEYS: readonly string[] = WANTS.map((w) => w.key);

export function toProject(p: Page): Project {
  return {
    id: p.id,
    url: p.url,
    name: text(p, "Nom"),
    months: monthIndexes(options(p, "Mois")),
    days: num(p, "Durée (jours)"),
    budget: num(p, "Budget / pers"),
    wants: options(p, "Envies").map((l) => WANT_FROM_LABEL[l]).filter((w): w is Want => !!w),
    rules: options(p, "Contraintes").map((l) => RULE_FROM_LABEL[l]).filter((r): r is Rule => !!r),
    status: oneOf(PROJECT_STATUSES, option(p, "Statut")),
    notes: text(p, "Notes"),
  };
}

/** Propriétés Notion d'un projet, création ou mise à jour (seuls les champs fournis). */
export function projectProperties(input: ProjectInput, creating: boolean): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  if (input.name !== undefined || creating) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!name) throw new InvalidInput("Nom manquant");
    props["Nom"] = { title: rich(name) };
  }
  if (input.months !== undefined) {
    props["Mois"] = {
      multi_select: input.months.map((i) => {
        if (!Number.isInteger(i) || i < 0 || i > 11) throw new InvalidInput("Mois invalide");
        return { name: MONTHS[i] };
      }),
    };
  }
  if (input.days !== undefined) props["Durée (jours)"] = { number: positive(input.days, "Durée") };
  if (input.budget !== undefined) props["Budget / pers"] = { number: positive(input.budget, "Budget") };
  if (input.wants !== undefined) props["Envies"] = { multi_select: input.wants.map((w) => ({ name: WANT_LABEL[check(WANT_KEYS as readonly Want[], w, "Envies")] })) };
  if (input.rules !== undefined) props["Contraintes"] = { multi_select: input.rules.map((r) => ({ name: RULE_LABEL[check(RULE_KEYS as readonly Rule[], r, "Contraintes")] })) };
  if (input.notes !== undefined) props["Notes"] = { rich_text: rich(String(input.notes)) };
  if (input.status !== undefined || creating) props["Statut"] = sel(check(PROJECT_STATUSES, input.status ?? "À choisir", "Statut"));
  if (!Object.keys(props).length) throw new InvalidInput("Rien à modifier");
  return props;
}

// ---------- Réservations (transports, logements) et voyages ----------

/** Date avec heure éventuelle, telle que Notion la renvoie (AAAA-MM-JJ ou AAAA-MM-JJThh:mm). */
function dateTimes(p: Page, name: string): { start: string | null; end: string | null } {
  const v = get(p, name);
  const d = v?.type === "date" ? (v.date as { start: string; end: string | null } | null) : null;
  const cut = (s: string | null | undefined) => (s ? (s.length > 10 ? s.slice(0, 16) : s) : null);
  return { start: cut(d?.start), end: cut(d?.end) };
}

export function toTransport(p: Page): Transport {
  const { start, end } = dateTimes(p, "Date");
  return {
    id: p.id,
    url: p.url,
    tripId: relationIds(p, "Destination")[0] ?? null,
    name: text(p, "Nom"),
    type: oneOf(TRANSPORT_TYPES, option(p, "Type")),
    company: text(p, "Compagnie"),
    start,
    end,
    reference: text(p, "Référence"),
    cost: num(p, "Coût"),
  };
}

export function toLodging(p: Page): Lodging {
  const { start, end } = dateTimes(p, "Date");
  return {
    id: p.id,
    url: p.url,
    tripId: relationIds(p, "Destination")[0] ?? null,
    name: text(p, "Nom"),
    type: oneOf(LODGING_TYPES, option(p, "Type")),
    address: text(p, "Adresse"),
    start,
    end,
    cost: num(p, "Coût"),
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/;
const PAGE_ID_RE = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

function dateProp(start: string | null | undefined, end: string | null | undefined) {
  if (!start) return { date: null };
  for (const d of [start, end]) if (d && !DATE_RE.test(d)) throw new InvalidInput("Date invalide");
  // Sans fuseau, Notion garde l'heure telle qu'écrite (heure du lieu).
  return { date: { start, end: end || null } };
}

function tripRelation(tripId: string) {
  if (!PAGE_ID_RE.test(tripId)) throw new InvalidInput("Voyage invalide");
  return { relation: [{ id: tripId }] };
}

function requireName(name: unknown): string {
  const n = typeof name === "string" ? name.trim() : "";
  if (!n) throw new InvalidInput("Nom manquant");
  return n;
}

export function transportProperties(input: TransportInput, editing = false): Record<string, unknown> {
  const props: Record<string, unknown> = {
    "Nom": { title: rich(requireName(input.name)) },
    "Destination": tripRelation(input.tripId),
  };
  if (input.type) props["Type"] = sel(check<TransportType>(TRANSPORT_TYPES, input.type, "Type"));
  if (input.company || editing) props["Compagnie"] = { rich_text: input.company ? rich(String(input.company)) : [] };
  if (input.reference || editing) props["Référence"] = { rich_text: input.reference ? rich(String(input.reference)) : [] };
  if (input.start || editing) props["Date"] = dateProp(input.start, input.end);
  const cost = positive(input.cost, "Coût");
  if (cost !== null || editing) props["Coût"] = { number: cost };
  return props;
}

export function lodgingProperties(input: LodgingInput, editing = false): Record<string, unknown> {
  const props: Record<string, unknown> = {
    "Nom": { title: rich(requireName(input.name)) },
    "Destination": tripRelation(input.tripId),
  };
  if (input.type) props["Type"] = sel(check<LodgingType>(LODGING_TYPES, input.type, "Type"));
  if (input.address || editing) props["Adresse"] = { rich_text: input.address ? rich(String(input.address)) : [] };
  if (input.start || editing) props["Date"] = dateProp(input.start, input.end);
  const cost = positive(input.cost, "Coût");
  if (cost !== null || editing) props["Coût"] = { number: cost };
  return props;
}

/** Création ou mise à jour d'un voyage : nom, statut, dates. Le budget vient des réservations. */
export function tripProperties(input: TripInput, creating: boolean): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  if (input.name !== undefined || creating) props["Nom"] = { title: rich(requireName(input.name)) };
  if (input.status !== undefined) props["Statut"] = { status: { name: check(TRIP_STATUSES, input.status, "Statut") } };
  if (input.start !== undefined || input.end !== undefined) {
    for (const d of [input.start, input.end]) if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new InvalidInput("Date invalide");
    props["Date"] = input.start ? { date: { start: input.start, end: input.end || null } } : { date: null };
  }
  if (input.budget !== undefined) props["Budget"] = { number: positive(input.budget, "Budget") };
  if (input.rating !== undefined) {
    if (input.rating !== null && !(Number.isInteger(input.rating) && input.rating >= 1 && input.rating <= 5)) throw new InvalidInput("Note invalide");
    props["Note"] = { number: input.rating };
  }
  if (input.memories !== undefined) props["Souvenirs"] = { rich_text: input.memories ? rich(String(input.memories)) : [] };
  if (!Object.keys(props).length) throw new InvalidInput("Rien à modifier");
  return props;
}
