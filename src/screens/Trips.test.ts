import { afterEach, describe, expect, it, vi } from "vitest";
import { countdown } from "./Trips";

afterEach(() => vi.useRealTimers());

describe("compte à rebours", () => {
  const at = (iso: string) => { vi.useFakeTimers(); vi.setSystemTime(new Date(`${iso}T10:00:00Z`)); };
  it("compte les jours avant le départ", () => {
    at("2026-10-27");
    expect(countdown({ status: "À planifier", start: "2027-01-15", end: "2027-01-19" })).toBe("Dans 80 jours");
  });
  it("gère demain, aujourd'hui et le séjour en cours", () => {
    at("2027-01-14");
    expect(countdown({ status: "À planifier", start: "2027-01-15", end: "2027-01-19" })).toBe("Demain");
    at("2027-01-15");
    expect(countdown({ status: "À planifier", start: "2027-01-15", end: "2027-01-19" })).toBe("Départ aujourd'hui");
    at("2027-01-17");
    expect(countdown({ status: "En cours", start: "2027-01-15", end: "2027-01-19" })).toBe("Jour 3");
  });
  it("rien pour un voyage fait ou sans date", () => {
    at("2026-10-27");
    expect(countdown({ status: "Visité", start: "2024-01-01", end: null })).toBeNull();
    expect(countdown({ status: "À planifier", start: null, end: null })).toBeNull();
  });
});
