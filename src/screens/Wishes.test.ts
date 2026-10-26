import { describe, expect, it } from "vitest";
import type { Wish } from "../shared/types";
import { isFiltered, matchesFilter, NO_FILTER } from "./Wishes";

const wish = (over: Partial<Wish>): Wish => ({
  id: "w", url: "", name: "W", country: "", wants: [], bestMonths: [4], idealDays: null, budget: null,
  kids: null, priority: null, status: null, notes: "", destinationId: null, ...over,
});

describe("filtres des envies", () => {
  it("laisse tout passer sans filtre", () => {
    expect(isFiltered(NO_FILTER)).toBe(false);
    expect(matchesFilter(wish({}), NO_FILTER)).toBe(true);
  });

  it("filtre par priorité, y compris sans priorité", () => {
    expect(matchesFilter(wish({ priority: "Envie" }), { ...NO_FILTER, priority: "Envie" })).toBe(true);
    expect(matchesFilter(wish({}), { ...NO_FILTER, priority: "Envie" })).toBe(false);
    expect(matchesFilter(wish({}), { ...NO_FILTER, priority: "none" })).toBe(true);
    expect(matchesFilter(wish({ priority: "Un jour" }), { ...NO_FILTER, priority: "none" })).toBe(false);
  });

  it("filtre par mois et par enfants", () => {
    expect(matchesFilter(wish({}), { ...NO_FILTER, month: 4 })).toBe(true);
    expect(matchesFilter(wish({}), { ...NO_FILTER, month: 8 })).toBe(false);
    expect(matchesFilter(wish({ kids: "Sans enfants" }), { ...NO_FILTER, kids: "Avec enfants" })).toBe(false);
  });
});
