import { describe, expect, it } from "vitest";
import { parseChecklist, serializeChecklist } from "./checklist";

describe("checklist", () => {
  it("relit et réécrit la liste sans perte", () => {
    const text = "[x] Passeport\n[ ] Assurance";
    expect(parseChecklist(text)).toEqual([{ done: true, label: "Passeport" }, { done: false, label: "Assurance" }]);
    expect(serializeChecklist(parseChecklist(text))).toBe(text);
  });
  it("accepte des lignes libres et ignore les vides", () => {
    expect(parseChecklist("Visa\n\n  \n[X] Valise")).toEqual([{ done: false, label: "Visa" }, { done: true, label: "Valise" }]);
  });
});
