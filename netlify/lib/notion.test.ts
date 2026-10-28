import { describe, expect, it } from "vitest";
import { newWishProperties, num, parseHighlights, patchProperties, projectProperties, toDestination, toProject, toTrip, toWish, transportProperties, tripProperties, type Page } from "./notion";

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
    "Destination": { type: "relation", relation: [{ id: "dest-1" }] },
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
      kids: "Sans enfants", priority: "Très envie", status: null, notes: "Plutôt en 4x4", destinationId: "dest-1", tripId: null,
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
    expect(newWishProperties({ name: "X", destinationId: "405dac8e-ae8e-81d2-b610-c2fff44d7442" })["Destination"])
      .toEqual({ relation: [{ id: "405dac8e-ae8e-81d2-b610-c2fff44d7442" }] });
    expect(() => newWishProperties({ name: "X", destinationId: "pas-un-id" })).toThrow("Destination invalide");
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

describe("catalogue Notion", () => {
  const page: Page = {
    id: "c1",
    url: "https://app.notion.com/p/c1",
    properties: {
      "Nom": { type: "title", title: rt("Namibie") },
      "Pays": { type: "rich_text", rich_text: rt("Namibie") },
      "Aéroport": { type: "rich_text", rich_text: rt("wdh") },
      "Heures de vol": { type: "number", number: 13 },
      "Vol direct": { type: "checkbox", checkbox: false },
      "Mois du vol direct": { type: "multi_select", multi_select: [] },
      "Vol A/R": { type: "number", number: 950 },
      "Budget / jour / pers": { type: "number", number: 200 },
      "Point fort": { type: "select", select: { name: "Faune sauvage" } },
      "Envies": { type: "multi_select", multi_select: [{ name: "Désert" }, { name: "Faune sauvage" }] },
      "Mois idéaux": { type: "multi_select", multi_select: [{ name: "Août" }, { name: "Septembre" }] },
      "Mois corrects": { type: "multi_select", multi_select: [{ name: "Octobre" }] },
      "Affluence": { type: "select", select: { name: "Peu fréquenté" } },
      "Paludisme": { type: "select", select: { name: "En partie" } },
      "Accroche": { type: "rich_text", rich_text: rt("Dunes et Etosha.") },
      "Moments forts": { type: "rich_text", rich_text: rt("Septembre : animaux aux points d'eau\nnimporte quoi") },
      "Sources": { type: "rich_text", rich_text: rt("") },
    },
  };

  it("convertit une destination, point fort en premier", () => {
    const d = toDestination(page)!;
    expect(d).toMatchObject({
      id: "c1", name: "Namibie", airport: "WDH", direct: false, directMonths: undefined, flightPrice: 950,
      dailyBudget: 200, wants: ["faune", "desert"], crowd: 0, malaria: "partiel", highlights: { 8: "animaux aux points d'eau" },
    });
    expect(d.season).toEqual([0, 0, 0, 0, 0, 0, 0, 2, 2, 1, 0, 0]);
  });

  it("garde des valeurs neutres quand une colonne est vide, et ignore une ligne sans nom", () => {
    const d = toDestination({ id: "x", url: "", properties: { "Nom": { type: "title", title: rt("Ailleurs") } } })!;
    expect(d).toMatchObject({ flightPrice: 800, dailyBudget: 120, crowd: 1, malaria: false, wants: [] });
    expect(toDestination({ id: "y", url: "", properties: {} })).toBeNull();
    expect(parseHighlights("")).toBeUndefined();
  });
});

describe("projets", () => {
  it("lit un projet, colonnes vides comprises", () => {
    const p = toProject({
      id: "p1", url: "u",
      properties: {
        "Nom": { type: "title", title: rt("Safari") },
        "Mois": { type: "multi_select", multi_select: [{ name: "Octobre" }, { name: "Septembre" }] },
        "Durée (jours)": { type: "number", number: 15 },
        "Budget / pers": { type: "number", number: null },
        "Envies": { type: "multi_select", multi_select: [{ name: "Faune sauvage" }] },
        "Contraintes": { type: "multi_select", multi_select: [{ name: "Pas de plage" }, { name: "Peu de monde" }] },
        "Statut": { type: "select", select: { name: "À choisir" } },
      },
    });
    expect(p).toMatchObject({ name: "Safari", months: [8, 9], days: 15, budget: null, wants: ["faune"], rules: ["noBeach", "calm"], status: "À choisir" });
  });

  it("écrit les critères avec les libellés Notion", () => {
    const props = projectProperties({ name: "Mai", months: [4], days: 12, budget: null, wants: ["culture"], rules: ["direct"] }, true);
    expect(props["Mois"]).toEqual({ multi_select: [{ name: "Mai" }] });
    expect(props["Budget / pers"]).toEqual({ number: null });
    expect(props["Envies"]).toEqual({ multi_select: [{ name: "Culture & histoire" }] });
    expect(props["Contraintes"]).toEqual({ multi_select: [{ name: "Vol direct uniquement" }] });
    expect(props["Statut"]).toEqual({ select: { name: "À choisir" } });
  });

  it("n'écrit que ce qui change et refuse l'inconnu", () => {
    expect(projectProperties({ status: "Archivé" }, false)).toEqual({ "Statut": { select: { name: "Archivé" } } });
    expect(() => projectProperties({}, true)).toThrow("Nom manquant");
    expect(() => projectProperties({ wants: ["shopping" as never] }, false)).toThrow("Envies invalide");
  });
});

describe("voyages et réservations", () => {
  it("écrit note, souvenirs et budget d'un voyage", () => {
    const props = tripProperties({ rating: 4, memories: "Top", budget: 1200 }, false) as Record<string, any>;
    expect(props["Note"]).toEqual({ number: 4 });
    expect(props["Souvenirs"].rich_text[0].text.content).toBe("Top");
    expect(props["Budget"]).toEqual({ number: 1200 });
  });
  it("refuse une note hors 1-5 et accepte de l'effacer", () => {
    expect(() => tripProperties({ rating: 7 }, false)).toThrow();
    expect((tripProperties({ rating: null }, false) as Record<string, any>)["Note"]).toEqual({ number: null });
  });
  it("vide les champs d'un transport en modification", () => {
    const id = "406dac8e-ae8e-81d9-a9e1-e5a0de012d53";
    const props = transportProperties({ tripId: id, name: "Vol" }, true) as Record<string, any>;
    expect(props["Référence"].rich_text).toEqual([]);
    expect(props["Date"]).toEqual({ date: null });
    expect(props["Coût"]).toEqual({ number: null });
  });
});

describe("lien envie → voyage", () => {
  it("relie et délie une envie d'un voyage", () => {
    expect(patchProperties({ tripId: "406dac8e-ae8e-81d9-a9e1-e5a0de012d53" })["Voyage"]).toEqual({ relation: [{ id: "406dac8e-ae8e-81d9-a9e1-e5a0de012d53" }] });
    expect(patchProperties({ tripId: null })["Voyage"]).toEqual({ relation: [] });
    expect(() => patchProperties({ tripId: "pas-un-id" })).toThrow("Voyage invalide");
  });
});
