import type { Destination } from "../data/catalogue";
import type { Trip, Wish } from "../shared/types";

/** Minuscules, sans accents, pour comparer des noms saisis à la main. */
export function norm(s: string | null | undefined): string {
  return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Destination du catalogue dont le nom apparaît dans le nom d'une envie (« Safari en Namibie » → Namibie). */
export function matchCatalogue(name: string, catalogue: readonly Destination[]): Destination | undefined {
  const t = norm(name);
  if (!t) return undefined;
  return catalogue.find((d) => t.includes(norm(d.name).replace(/^la /, "")));
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
