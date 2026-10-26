import { describe, expect, it } from "vitest";
import { CATALOGUE, type Destination } from "../data/catalogue";
import type { Trip, Wish } from "../shared/types";
import {
  explain, isDirect, minDaysFor, prosCons, rank, scoreCore, scoreDestination, scoreWish, tripCost, type Criteria,
} from "./score";

const dest = (name: string): Destination => {
  const d = CATALOGUE.find((x) => x.name === name);
  if (!d) throw new Error(name);
  return d;
};

const safari: Criteria = { months: [8], days: 15, budget: 5000, wants: ["faune", "nature"], rules: ["noBeach", "calm"] };
const neutral: Criteria = { months: [4], days: 10, budget: 3000, wants: [], rules: [] };

const wish = (over: Partial<Wish>): Wish => ({
  id: "w1", url: "https://notion.so/w1", name: "Idée", country: "", wants: [], bestMonths: [],
  idealDays: null, budget: null, kids: null, priority: null, status: null, notes: "", ...over,
});
const trip = (over: Partial<Trip>): Trip => ({
  id: "t1", url: "https://notion.so/t1", name: "Voyage", status: "Visité", start: "2024-08-01", end: "2024-08-15",
  budget: null, days: null, pricePerPerson: null, dailyPerPerson: null, ...over,
});

describe("catalogue", () => {
  it("contient des destinations complètes", () => {
    expect(CATALOGUE.length).toBeGreaterThanOrEqual(35);
    for (const d of CATALOGUE) {
      expect(d.season).toHaveLength(12);
      expect(d.wants.length).toBeGreaterThan(0);
      expect(d.airport).toMatch(/^[A-Z]{3}$/);
    }
  });
});

describe("scoreCore", () => {
  const base = { season: 2, wants: ["faune"], cost: 1000, minDays: 3, crowd: 0, beachFirst: false } as const;

  it("donne 100 quand tout colle", () => {
    expect(scoreCore(base, { ...neutral, wants: ["faune"] }).points).toBe(100);
  });

  it("pondère la saison 32 / 18 / 0", () => {
    const c = { ...neutral, wants: ["faune"] } as Criteria;
    expect(scoreCore({ ...base, season: 1 }, c).points).toBe(100 - 32 + 18);
    expect(scoreCore({ ...base, season: 0 }, c).points).toBe(100 - 32);
  });

  it("donne les points d'envies au prorata, et retire 10 si aucune ne colle", () => {
    const half = scoreCore(base, { ...neutral, wants: ["faune", "plage"] });
    expect(half.points).toBeCloseTo(100 - 16.5);
    expect(half.hits).toEqual(["faune"]);
    expect(scoreCore(base, { ...neutral, wants: ["ville"] }).points).toBe(100 - 33 - 10);
  });

  it("retire 2 points de budget par tranche de 10 % de dépassement", () => {
    const r = scoreCore({ ...base, cost: 3300 }, neutral);
    expect(r.over).toBeCloseTo(0.1);
    expect(r.points).toBeCloseTo(100 - 4);
    expect(scoreCore({ ...base, cost: 6000 }, neutral).points).toBe(80);
  });

  it("retire 3 points par jour manquant", () => {
    expect(scoreCore({ ...base, minDays: 12 }, neutral).points).toBe(100 - 6);
    expect(scoreCore({ ...base, minDays: 30 }, neutral).points).toBe(90);
  });

  it("ne compte l'affluence que si « peu de monde » est coché", () => {
    expect(scoreCore({ ...base, crowd: 2 }, neutral).points).toBe(100);
    expect(scoreCore({ ...base, crowd: 1 }, { ...neutral, rules: ["calm"] }).points).toBe(97);
    expect(scoreCore({ ...base, crowd: 2 }, { ...neutral, rules: ["calm"] }).points).toBe(95);
  });

  it("pénalise une plage en point fort quand on n'en veut pas", () => {
    expect(scoreCore({ ...base, beachFirst: true }, { ...neutral, rules: ["noBeach"] }).points).toBe(80);
  });
});

describe("scoreDestination", () => {
  it("met la Namibie à 100 pour le safari de septembre", () => {
    const r = scoreDestination(dest("Namibie"), safari);
    expect(r.cost).toBe(3950);
    expect(r.minDays).toBe(12);
    expect(r.score).toBe(100);
  });

  it("calcule le coût et la durée conseillée selon le trajet", () => {
    expect(tripCost(dest("Kenya"), 15)).toBe(5000);
    expect(minDaysFor(dest("Écosse"))).toBe(3);
    expect(minDaysFor(dest("Lofoten"))).toBe(9);
    expect(minDaysFor(dest("Patagonie"))).toBe(12);
  });

  it("retire 15 points à un voyage déjà fait et ajoute le bonus de priorité", () => {
    const kenya = dest("Kenya");
    expect(scoreDestination(kenya, safari).score).toBe(97);
    expect(scoreDestination(kenya, safari, { trip: trip({ name: "Kenya" }) }).score).toBe(82);
    expect(scoreDestination(dest("Botswana"), safari, { wish: wish({ priority: "Un jour" }) }).score).toBe(83);
    expect(scoreDestination(dest("Botswana"), safari, { wish: wish({ priority: "Un jour", kids: "Sans enfants" }) }).score).toBe(87);
    const sicile = scoreDestination(dest("Sicile"), neutral).score;
    expect(scoreDestination(dest("Sicile"), neutral, { wish: wish({ priority: "Envie" }) }).score).toBe(Math.min(100, sicile + 6));
  });
});

describe("scoreWish", () => {
  it("utilise les mois, le budget et la durée notés dans Notion", () => {
    const w = wish({ wants: ["Faune sauvage"], bestMonths: [8], budget: 4000, idealDays: 14, priority: "Très envie" });
    const r = scoreWish(w, safari);
    expect(r.season).toBe(2);
    expect(r.wants).toEqual(["faune"]);
    // 32 + 16.5 + 20 + 10 + 3 + 10
    expect(r.score).toBe(92);
  });

  it("considère la saison correcte sans mois renseigné", () => {
    expect(scoreWish(wish({}), neutral).season).toBe(1);
    expect(scoreWish(wish({ bestMonths: [0] }), neutral).season).toBe(0);
  });
});

describe("rank", () => {
  it("trie par score décroissant", () => {
    const { results } = rank(safari);
    const top = results.filter((r) => r.score === 100).map((r) => r.kind === "destination" && r.destination.name);
    expect(top).toContain("Namibie");
    for (let i = 1; i < results.length; i++) expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
  });

  it("écarte les vols avec escale si « vol direct » est coché", () => {
    const { results, hiddenNotDirect } = rank({ ...safari, rules: ["direct"] });
    expect(hiddenNotDirect).toBe(CATALOGUE.filter((d) => !isDirect(d, [8])).length);
    expect(results.every((r) => r.kind !== "destination" || r.direct)).toBe(true);
  });

  it("tient compte des vols directs saisonniers", () => {
    const laponie = CATALOGUE.find((d) => d.name === "Laponie")!;
    expect(isDirect(laponie, [0])).toBe(true);
    expect(isDirect(laponie, [6])).toBe(false);
    expect(isDirect(laponie, [6, 11])).toBe(true);
  });

  it("rattache une envie au catalogue, sinon l'ajoute comme carte à part", () => {
    const wishes = [wish({ id: "a", name: "Safari en Namibie" }), wish({ id: "b", name: "Mongolie" })];
    const { results } = rank(safari, { wishes, trips: [] });
    const namibie = results.find((r) => r.kind === "destination" && r.destination.name === "Namibie");
    expect(namibie?.kind === "destination" && namibie.wish?.id).toBe("a");
    expect(results.filter((r) => r.kind === "wish").map((r) => r.kind === "wish" && r.wish.id)).toEqual(["b"]);
  });

  it("masque les envies « Sans enfants » quand on part avec des enfants", () => {
    const wishes = [wish({ name: "Mongolie", kids: "Sans enfants" })];
    expect(rank({ ...neutral, rules: ["kids"] }, { wishes, trips: [] }).results.some((r) => r.kind === "wish")).toBe(false);
    expect(rank(neutral, { wishes, trips: [] }).results.some((r) => r.kind === "wish")).toBe(true);
  });

  it("marque les voyages faits, en ignorant ceux qui ne sont pas visités", () => {
    const trips = [trip({ name: "Kenya" }), trip({ id: "t2", name: "Japon", status: "À planifier" })];
    const { results } = rank(safari, { wishes: [], trips });
    const find = (n: string) => results.find((r) => r.kind === "destination" && r.destination.name === n);
    expect((find("Kenya") as { trip?: Trip }).trip?.id).toBe("t1");
    expect((find("Japon") as { trip?: Trip }).trip).toBeUndefined();
  });
});

describe("plusieurs mois", () => {
  it("note chaque destination sur son meilleur mois", () => {
    const r = scoreDestination(dest("Jordanie"), { ...neutral, months: [6, 9] });
    expect(r.month).toBe(9);
    expect(r.season).toBe(2);
    expect(explain(r, { ...neutral, months: [6, 9] })).toMatch(/^Très bonne saison en octobre/);
  });

  it("annonce la mauvaise saison sur tous les mois envisagés", () => {
    const c = { ...neutral, months: [6, 7] };
    expect(explain(scoreDestination(dest("Égypte"), c), c)).toMatch(/^Mauvaise saison en juillet ou août/);
  });
});

describe("avec enfants", () => {
  it("pénalise les zones de paludisme", () => {
    const kids = { ...safari, rules: ["kids"] } as Criteria;
    const without = scoreDestination(dest("Kenya"), { ...safari, rules: [] }).points;
    expect(scoreDestination(dest("Kenya"), kids).points).toBe(without - 12);
    expect(scoreDestination(dest("Namibie"), kids).parts.adjustments).toContainEqual({ label: "Paludisme dans une partie du pays", points: -5 });
  });
});

describe("prosCons", () => {
  it("liste les points forts et faibles de la Tanzanie pour le safari", () => {
    const r = scoreDestination(dest("Tanzanie"), safari);
    const { pros, cons } = prosCons(r, safari);
    expect(pros).toEqual(["Idéal en septembre", "Faune sauvage, Nature & paysages", "Vol direct"]);
    expect(cons).toEqual([expect.stringMatching(/^400.€ au-dessus du budget$/), "Affluence moyenne"]);
  });
});

describe("explain", () => {
  it("résume saison, budget et durée", () => {
    const r = scoreDestination(dest("Patagonie"), { ...neutral, days: 8, budget: 1000 });
    expect(explain(r, { ...neutral, days: 8, budget: 1000 }).replace(/\s/g, " ")).toBe(
      "Mauvaise saison en mai, dépasse le budget d'environ 1 500 €, un peu loin pour 8 jours (12 conseillés).",
    );
  });
});
