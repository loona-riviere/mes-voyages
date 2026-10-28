import { describe, expect, it } from "vitest";
import { nextStatus } from "./tripStatus";

describe("statut automatique", () => {
  const trip = { status: "À planifier" as const, start: "2027-01-15", end: "2027-01-19" };
  it("ne change rien avant le départ", () => expect(nextStatus(trip, "2027-01-14")).toBeNull());
  it("passe en cours pendant le séjour, jour du retour compris", () => {
    expect(nextStatus(trip, "2027-01-15")).toBe("En cours");
    expect(nextStatus(trip, "2027-01-19")).toBe("En cours");
    expect(nextStatus({ ...trip, status: "En cours" }, "2027-01-17")).toBeNull();
  });
  it("passe en visité le lendemain du retour", () => {
    expect(nextStatus(trip, "2027-01-20")).toBe("Visité");
    expect(nextStatus({ ...trip, status: "En cours" }, "2027-01-20")).toBe("Visité");
  });
  it("laisse les voyages sans dates et déjà faits", () => {
    expect(nextStatus({ status: "À planifier", start: null, end: null }, "2027-01-20")).toBeNull();
    expect(nextStatus({ ...trip, status: "Visité" }, "2027-02-01")).toBeNull();
  });
});
