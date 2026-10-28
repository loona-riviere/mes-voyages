import type { Trip, TripStatus } from "../shared/types";

/**
 * Statut que le voyage devrait avoir d'après ses dates, ou null s'il n'y a rien à changer.
 * On avance seulement (À planifier → En cours → Visité), jamais en arrière : un statut mis à la main reste.
 */
export function nextStatus(t: Pick<Trip, "status" | "start" | "end">, today: string): TripStatus | null {
  if (!t.start || t.status === "Visité") return null;
  const end = (t.end ?? t.start).slice(0, 10);
  if (end < today) return "Visité";
  if (t.start.slice(0, 10) <= today && t.status !== "En cours") return "En cours";
  return null;
}

/** Date du jour au format AAAA-MM-JJ, heure locale. */
export const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
