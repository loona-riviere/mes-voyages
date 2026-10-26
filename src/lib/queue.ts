import type { NewWish, Wish, WishPatch } from "../shared/types";

// Changements faits hors ligne, envoyés à Notion au retour du réseau.
export type Pending =
  | { kind: "add"; localId: string; input: NewWish }
  | { kind: "patch"; id: string; patch: WishPatch };

const KEY = "mv-queue-v1";

export function loadQueue(): Pending[] {
  try {
    const q = JSON.parse(localStorage.getItem(KEY) ?? "[]") as Pending[];
    return Array.isArray(q) ? q : [];
  } catch {
    return [];
  }
}

export function saveQueue(q: Pending[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(q));
  } catch {
    // stockage indisponible
  }
}

export const isLocalId = (id: string) => id.startsWith("local-");

/** Envie affichée en attendant que Notion la crée. */
export function localWish(localId: string, w: NewWish): Wish {
  return {
    id: localId, url: "", name: w.name, country: w.country ?? "", wants: w.wants ?? [], bestMonths: w.bestMonths ?? [],
    idealDays: w.idealDays ?? null, budget: w.budget ?? null, withWhom: w.withWhom ?? null, kids: w.kids ?? null,
    priority: w.priority ?? "Envie", status: w.status ?? "Idée", notes: w.notes ?? "",
  };
}

/** Ajoute un changement ; une modification d'une envie pas encore créée est fusionnée dans sa création. */
export function enqueue(q: Pending[], item: Pending): Pending[] {
  if (item.kind === "patch" && isLocalId(item.id)) {
    return q.map((p) => (p.kind === "add" && p.localId === item.id ? { ...p, input: { ...p.input, ...item.patch } } : p));
  }
  if (item.kind === "patch") {
    const i = q.findIndex((p) => p.kind === "patch" && p.id === item.id);
    if (i >= 0) {
      const prev = q[i] as Extract<Pending, { kind: "patch" }>;
      return q.map((p, j) => (j === i ? { ...prev, patch: { ...prev.patch, ...item.patch } } : p));
    }
  }
  return [...q, item];
}

/** Une erreur réseau (pas une réponse d'erreur du serveur). */
export const isNetworkError = (e: unknown) => e instanceof TypeError || (typeof navigator !== "undefined" && !navigator.onLine);
