import type { NewWish, Trip, Wish, WishPatch } from "../shared/types";

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
  addWish: async (w: NewWish) => (await call<{ wish: Wish }>("envies", { method: "POST", body: w })).wish,
  patchWish: async (id: string, patch: WishPatch) =>
    (await call<{ wish: Wish }>("envies", { method: "PATCH", body: { id, ...patch } })).wish,
};

// ---------- Cache local : l'app s'ouvre tout de suite avec les dernières données ----------

const CACHE_KEY = "mv-cache-v1";

export interface Cached {
  wishes: Wish[];
  trips: Trip[];
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
