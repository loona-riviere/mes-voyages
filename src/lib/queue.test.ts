import { describe, expect, it, vi } from "vitest";
import { enqueue, loadQueue, localWish, type Pending } from "./queue";

describe("file hors ligne", () => {
  it("fusionne les modifications successives d'une même envie", () => {
    let q: Pending[] = [];
    q = enqueue(q, { kind: "wish-patch", id: "a", patch: { priority: "Envie" } });
    q = enqueue(q, { kind: "wish-patch", id: "a", patch: { status: "Planifié" } });
    q = enqueue(q, { kind: "wish-patch", id: "a", patch: { priority: "Un jour" } });
    expect(q).toEqual([{ kind: "wish-patch", id: "a", patch: { priority: "Un jour", status: "Planifié" } }]);
  });

  it("reporte la modification d'une envie pas encore créée dans sa création", () => {
    let q: Pending[] = [{ kind: "wish-add", localId: "local-1", input: { name: "Namibie", priority: "Envie" } }];
    q = enqueue(q, { kind: "wish-patch", id: "local-1", patch: { priority: "Très envie" } });
    expect(q).toEqual([{ kind: "wish-add", localId: "local-1", input: { name: "Namibie", priority: "Très envie" } }]);
  });

  it("affiche une envie locale avec des valeurs par défaut", () => {
    expect(localWish("local-1", { name: "Namibie" })).toMatchObject({ id: "local-1", priority: "Envie", status: "Idée", wants: [] });
  });

  it("fusionne aussi les modifications d'un projet créé hors ligne", () => {
    let q: Pending[] = [{ kind: "project-add", localId: "local-p", input: { name: "Safari", days: 15 } }];
    q = enqueue(q, { kind: "project-patch", id: "local-p", patch: { days: 12 } });
    expect(q).toEqual([{ kind: "project-add", localId: "local-p", input: { name: "Safari", days: 12 } }]);
  });

  it("garde chaque réservation ajoutée hors ligne", () => {
    let q: Pending[] = [];
    q = enqueue(q, { kind: "reservation", localId: "local-1", input: { kind: "lodging", tripId: "t", name: "Riad" } });
    q = enqueue(q, { kind: "reservation", localId: "local-2", input: { kind: "transport", tripId: "t", name: "Taxi" } });
    expect(q).toHaveLength(2);
  });

  it("relit une ancienne file d'envies", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    localStorage.setItem("mv-queue-v1", JSON.stringify([{ kind: "add", localId: "local-9", input: { name: "X" } }, { kind: "patch", id: "i", patch: {} }]));
    expect(loadQueue().map((p) => p.kind)).toEqual(["wish-add", "wish-patch"]);
  });
});
