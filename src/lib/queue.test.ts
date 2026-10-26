import { describe, expect, it } from "vitest";
import { enqueue, localWish, type Pending } from "./queue";

describe("file hors ligne", () => {
  it("fusionne les modifications successives d'une même envie", () => {
    let q: Pending[] = [];
    q = enqueue(q, { kind: "patch", id: "a", patch: { priority: "Envie" } });
    q = enqueue(q, { kind: "patch", id: "a", patch: { status: "Planifié" } });
    q = enqueue(q, { kind: "patch", id: "a", patch: { priority: "Un jour" } });
    expect(q).toEqual([{ kind: "patch", id: "a", patch: { priority: "Un jour", status: "Planifié" } }]);
  });

  it("reporte la modification d'une envie pas encore créée dans sa création", () => {
    let q: Pending[] = [{ kind: "add", localId: "local-1", input: { name: "Namibie", priority: "Envie" } }];
    q = enqueue(q, { kind: "patch", id: "local-1", patch: { priority: "Très envie" } });
    expect(q).toEqual([{ kind: "add", localId: "local-1", input: { name: "Namibie", priority: "Très envie" } }]);
  });

  it("affiche une envie locale avec des valeurs par défaut", () => {
    expect(localWish("local-1", { name: "Namibie" })).toMatchObject({ id: "local-1", priority: "Envie", status: "Idée", wants: [] });
  });
});
