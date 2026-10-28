import type { Lodging, LodgingInput, NewWish, Project, ProjectInput, Transport, TransportInput, Wish, WishPatch } from "../shared/types";

export type ReservationInput = ({ kind: "transport" } & TransportInput) | ({ kind: "lodging" } & LodgingInput);

// Changements faits hors ligne, envoyés à Notion au retour du réseau.
export type Pending =
  | { kind: "wish-add"; localId: string; input: NewWish }
  | { kind: "wish-patch"; id: string; patch: WishPatch }
  | { kind: "project-add"; localId: string; input: ProjectInput }
  | { kind: "project-patch"; id: string; patch: ProjectInput }
  | { kind: "reservation"; localId: string; input: ReservationInput };

const KEY = "mv-queue-v1";

export function loadQueue(): Pending[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]") as { kind: string }[];
    if (!Array.isArray(raw)) return [];
    // Anciennes files : « add » et « patch » ne concernaient que les envies.
    return raw.map((p) => (p.kind === "add" ? { ...p, kind: "wish-add" } : p.kind === "patch" ? { ...p, kind: "wish-patch" } : p)) as Pending[];
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
export const newLocalId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/** Envie affichée en attendant que Notion la crée. */
export function localWish(localId: string, w: NewWish): Wish {
  return {
    id: localId, url: "", name: w.name, country: w.country ?? "", wants: w.wants ?? [], bestMonths: w.bestMonths ?? [],
    idealDays: w.idealDays ?? null, budget: w.budget ?? null, kids: w.kids ?? null,
    priority: w.priority ?? "Envie", status: w.status ?? "Idée", notes: w.notes ?? "", destinationId: w.destinationId ?? null, tripId: null,
  };
}

export function localProject(localId: string, p: ProjectInput): Project {
  return {
    id: localId, url: "", name: p.name ?? "", months: p.months ?? [], days: p.days ?? null, budget: p.budget ?? null,
    wants: p.wants ?? [], rules: p.rules ?? [], status: p.status ?? "À choisir", notes: p.notes ?? "",
  };
}

export function localTransport(localId: string, t: TransportInput): Transport {
  return {
    id: localId, url: "", tripId: t.tripId, name: t.name, type: t.type ?? null, company: t.company ?? "",
    start: t.start ?? null, end: t.end ?? null, reference: t.reference ?? "", cost: t.cost ?? null,
  };
}

export function localLodging(localId: string, l: LodgingInput): Lodging {
  return {
    id: localId, url: "", tripId: l.tripId, name: l.name, type: l.type ?? null, address: l.address ?? "",
    start: l.start ?? null, end: l.end ?? null, cost: l.cost ?? null,
  };
}

/**
 * Ajoute un changement. Une modification d'un élément pas encore créé est fusionnée dans sa création,
 * et deux modifications successives du même élément n'en font plus qu'une.
 */
export function enqueue(q: Pending[], item: Pending): Pending[] {
  if (item.kind === "wish-patch" || item.kind === "project-patch") {
    const addKind = item.kind === "wish-patch" ? "wish-add" : "project-add";
    if (isLocalId(item.id)) {
      return q.map((p) => (p.kind === addKind && p.localId === item.id ? ({ ...p, input: { ...p.input, ...(item as { patch: object }).patch } } as Pending) : p));
    }
    const i = q.findIndex((p) => p.kind === item.kind && p.id === item.id);
    if (i >= 0) {
      const prev = q[i] as Extract<Pending, { kind: "wish-patch" | "project-patch" }>;
      return q.map((p, j) => (j === i ? ({ ...prev, patch: { ...prev.patch, ...item.patch } } as Pending) : p));
    }
  }
  return [...q, item];
}

/** Une erreur réseau (pas une réponse d'erreur du serveur). */
export const isNetworkError = (e: unknown) => e instanceof TypeError || (typeof navigator !== "undefined" && !navigator.onLine);
