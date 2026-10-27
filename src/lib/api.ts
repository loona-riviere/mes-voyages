import type { Destination } from "../data/catalogue";
import type { ReservationInput } from "./queue";
import type { Lodging, NewWish, Project, ProjectInput, Transport, Trip, TripInput, Wish, WishPatch } from "../shared/types";

const PASS_KEY = "mv-passphrase";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // stockage indisponible (navigation privée)
  }
}

export const getPassphrase = () => read(PASS_KEY);
export const setPassphrase = (p: string | null) => write(PASS_KEY, p);

export class LockedError extends Error {}

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const pass = getPassphrase();
  if (!pass) throw new LockedError("Phrase secrète manquante");
  const res = await fetch(`/api/${path}`, {
    method: init.method ?? "GET",
    headers: { "X-Passphrase": pass, ...(init.body ? { "Content-Type": "application/json" } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (res.status === 401) {
    setPassphrase(null);
    throw new LockedError("Phrase secrète incorrecte");
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
  return data;
}

export const api = {
  /** Vérifie une phrase secrète sans l'enregistrer si elle est fausse. */
  async unlock(pass: string): Promise<Wish[]> {
    setPassphrase(pass);
    return (await call<{ wishes: Wish[] }>("envies")).wishes;
  },
  wishes: async () => (await call<{ wishes: Wish[] }>("envies")).wishes,
  trips: async () => (await call<{ trips: Trip[] }>("voyages")).trips,
  catalogue: async () => (await call<{ destinations: Destination[] }>("catalogue")).destinations,
  reservations: async () => await call<{ transports: Transport[]; lodgings: Lodging[] }>("reservations"),
  addReservation: async (r: ReservationInput) => await call<{ transport?: Transport; lodging?: Lodging }>("reservations", { method: "POST", body: r }),
  deleteWish: async (id: string) => { await call("envies", { method: "DELETE", body: { id } }); },
  updateReservation: async (r: ReservationInput & { id: string }) => await call<{ transport?: Transport; lodging?: Lodging }>("reservations", { method: "PATCH", body: r }),
  deleteReservation: async (kind: "transport" | "lodging", id: string) => { await call("reservations", { method: "DELETE", body: { kind, id } }); },
  addTrip: async (t: TripInput) => (await call<{ trip: Trip }>("voyages", { method: "POST", body: t })).trip,
  patchTrip: async (id: string, t: TripInput) => (await call<{ trip: Trip }>("voyages", { method: "PATCH", body: { id, ...t } })).trip,
  projects: async () => (await call<{ projects: Project[] }>("projets")).projects,
  addProject: async (p: ProjectInput) => (await call<{ project: Project }>("projets", { method: "POST", body: p })).project,
  patchProject: async (id: string, p: ProjectInput) =>
    (await call<{ project: Project }>("projets", { method: "PATCH", body: { id, ...p } })).project,
  addWish: async (w: NewWish) => (await call<{ wish: Wish }>("envies", { method: "POST", body: w })).wish,
  patchWish: async (id: string, patch: WishPatch) =>
    (await call<{ wish: Wish }>("envies", { method: "PATCH", body: { id, ...patch } })).wish,
};

// ---------- Cache local : l'app s'ouvre tout de suite avec les dernières données ----------

const CACHE_KEY = "mv-cache-v1";

export interface Cached {
  wishes: Wish[];
  trips: Trip[];
  /** Absent dans les caches d'avant le catalogue Notion */
  catalogue?: Destination[];
  projects?: Project[];
  transports?: Transport[];
  lodgings?: Lodging[];
  at: number;
}

export function loadCache(): Cached | null {
  try {
    const c = JSON.parse(read(CACHE_KEY) ?? "null") as Cached | null;
    return c && Array.isArray(c.wishes) && Array.isArray(c.trips) ? c : null;
  } catch {
    return null;
  }
}

export const saveCache = (c: Cached) => write(CACHE_KEY, JSON.stringify(c));
