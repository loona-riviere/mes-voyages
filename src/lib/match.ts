import type { Destination } from "../data/catalogue";
import type { Trip, Wish } from "../shared/types";

/** Minuscules, sans accents, pour comparer des noms saisis à la main. */
export function norm(s: string | null | undefined): string {
  return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * Destination du catalogue d'une envie : d'abord par le nom (« Safari en Namibie » → Namibie),
 * sinon par le pays quand une seule destination du catalogue s'y trouve (« Mexique » → Yucatán).
 */
export function matchCatalogue(name: string, catalogue: readonly Destination[], country?: string): Destination | undefined {
  const t = norm(name);
  const byName = t ? catalogue.find((d) => t.includes(norm(d.name).replace(/^la /, ""))) : undefined;
  if (byName) return byName;
  const c = norm(country) || t;
  if (!c) return undefined;
  const sameCountry = catalogue.filter((d) => norm(d.country) === c);
  return sameCountry.length === 1 ? sameCountry[0] : undefined;
}

/** Voyage déjà fait correspondant à une destination, le plus récent d'abord. */
export function tripFor(dest: Destination, trips: readonly Trip[]): Trip | undefined {
  const hay = norm(`${dest.name} ${dest.country}`);
  const name = norm(dest.name);
  return visitedTrips(trips).find((t) => {
    const n = norm(t.name);
    return n !== "" && (hay.includes(n) || n.includes(name));
  });
}

export function visitedTrips(trips: readonly Trip[]): Trip[] {
  return trips
    .filter((t) => t.status === "Visité")
    .sort((a, b) => String(b.start ?? "").localeCompare(String(a.start ?? "")));
}

export function wishFits(w: Wish, withKids: boolean): boolean {
  return !(withKids && w.kids === "Sans enfants");
}
