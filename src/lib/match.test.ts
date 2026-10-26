import { describe, expect, it } from "vitest";
import { CATALOGUE } from "../data/catalogue";
import type { Trip } from "../shared/types";
import { matchCatalogue, norm, tripFor } from "./match";

const trip = (name: string, start: string, status: Trip["status"] = "Visité"): Trip => ({
  id: name + start, url: "", name, status, start, end: null, budget: null, days: null, pricePerPerson: null, dailyPerPerson: null,
});

describe("match", () => {
  it("normalise accents et casse", () => {
    expect(norm("  Écosse ")).toBe("ecosse");
  });

  it("retrouve une destination dans un nom libre", () => {
    expect(matchCatalogue("Road trip en Écosse", CATALOGUE)?.name).toBe("Écosse");
    expect(matchCatalogue("Île de la Réunion", CATALOGUE)?.name).toBe("La Réunion");
    expect(matchCatalogue("Mongolie", CATALOGUE)).toBeUndefined();
  });

  it("prend le voyage visité le plus récent", () => {
    const japon = CATALOGUE.find((d) => d.name === "Japon")!;
    const trips = [trip("Japon", "2019-04-01"), trip("Japon", "2024-10-01"), trip("Japon", "2027-04-01", "À planifier")];
    expect(tripFor(japon, trips)?.start).toBe("2024-10-01");
  });
});
