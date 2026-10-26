import { describe, expect, it } from "vitest";
import { newWishProperties, num, patchProperties, toTrip, toWish, type Page } from "./notion";

const rt = (s: string) => [{ plain_text: s }];

const wishPage: Page = {
  id: "abc",
  url: "https://app.notion.com/p/abc",
  properties: {
    "Nom": { type: "title", title: rt("Safari en Namibie") },
    "Pays": { type: "rich_text", rich_text: rt("Namibie") },
    "Envies": { type: "multi_select", multi_select: [{ name: "Faune sauvage" }, { name: "Désert" }] },
    "Meilleurs mois": { type: "multi_select", multi_select: [{ name: "Septembre" }, { name: "Août" }] },
    "Durée idéale (jours)": { type: "number", number: 15 },
    "Budget estimé / pers": { type: "number", number: 4500 },
    "Avec qui": { type: "select", select: { name: "Julien" } },
    "Enfants": { type: "select", select: { name: "Sans enfants" } },
    "Priorité": { type: "select", select: { name: "Très envie" } },
    "Statut": { type: "select", select: null },
    "Notes": { type: "rich_text", rich_text: rt("Plutôt en 4x4") },
  },
};

const tripPage: Page = {
  id: "t1",
  url: "https://app.notion.com/p/t1",
  properties: {
    "Nom": { type: "title", title: rt("Kenya") },
    "Statut": { type: "status", status: { name: "Visité" } },
    "Date": { type: "date", date: { start: "2024-08-02", end: "2024-08-16" } },
    "Budget": { type: "number", number: 9000 },
    "Durée": { type: "formula", formula: { type: "string", string: "15 jours" } },
    "Prix par personne": { type: "formula", formula: { type: "number", number: 4500 } },
    "Budget / jour / pers": { type: "formula", formula: { type: "string", string: "300 €" } },
  },
};

describe("lecture Notion", () => {
  it("convertit une envie", () => {
    expect(toWish(wishPage)).toEqual({
      id: "abc", url: "https://app.notion.com/p/abc", name: "Safari en Namibie", country: "Namibie",
      wants: ["Faune sauvage", "Désert"], bestMonths: [7, 8], idealDays: 15, budget: 4500,
      kids: "Sans enfants", priority: "Très envie", status: null, notes: "Plutôt en 4x4",
    });
  });

  it("convertit un voyage, formules comprises", () => {
    expect(toTrip(tripPage)).toMatchObject({
      name: "Kenya", status: "Visité", start: "2024-08-02", end: "2024-08-16",
      budget: 9000, days: 15, pricePerPerson: 4500, dailyPerPerson: 300,
    });
  });

  it("calcule la durée depuis les dates si la formule manque", () => {
    const p = { ...tripPage, properties: { ...tripPage.properties, "Durée": { type: "formula", formula: { type: "string", string: null } } } } as Page;
    expect(toTrip(p).days).toBe(15);
  });

  it("lit les nombres écrits à la française", () => {
    const p = { id: "", url: "", properties: { x: { type: "formula", formula: { type: "string", string: "1 250,5 €" } } } } as Page;
    expect(num(p, "x")).toBe(1250.5);
  });
});

describe("écriture Notion", () => {
  it("prépare une nouvelle envie avec les valeurs par défaut", () => {
    const props = newWishProperties({ name: " Namibie ", wants: ["Faune sauvage"], bestMonths: [8], budget: 3950.4 });
    expect(props["Nom"]).toEqual({ title: [{ type: "text", text: { content: "Namibie" } }] });
    expect(props["Priorité"]).toEqual({ select: { name: "Envie" } });
    expect(props["Statut"]).toEqual({ select: { name: "Idée" } });
    expect(props["Meilleurs mois"]).toEqual({ multi_select: [{ name: "Septembre" }] });
    expect(props["Budget estimé / pers"]).toEqual({ number: 3950 });
  });

  it("refuse les options qui n'existent pas dans Notion", () => {
    expect(() => newWishProperties({ name: "" })).toThrow("Nom manquant");
    expect(() => newWishProperties({ name: "X", wants: ["Shopping"] })).toThrow("Envies invalide");
    expect(() => newWishProperties({ name: "X", bestMonths: [12] })).toThrow("Mois invalide");
    expect(() => patchProperties({ priority: "Urgent" as never })).toThrow("Priorité invalide");
    expect(() => patchProperties({})).toThrow("Rien à modifier");
  });

  it("modifie priorité et statut", () => {
    expect(patchProperties({ priority: "Un jour", status: "Planifié" })).toEqual({
      "Priorité": { select: { name: "Un jour" } },
      "Statut": { select: { name: "Planifié" } },
    });
  });
});
