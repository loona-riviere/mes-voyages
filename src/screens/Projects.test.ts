import { describe, expect, it } from "vitest";
import type { Criteria } from "../lib/score";
import type { Project } from "../shared/types";
import { applyProject, isActive } from "./Projects";

const c: Criteria = { months: [0], days: 10, budget: 3000, wants: ["plage"], rules: [] };
const project = (over: Partial<Project>): Project => ({
  id: "p", url: "", name: "P", months: [], days: null, budget: null, wants: [], rules: [], status: "À choisir", notes: "", ...over,
});

describe("projets dans l'app", () => {
  it("garde les critères en cours pour les colonnes vides", () => {
    expect(applyProject(project({ months: [4], days: 12 }), c)).toEqual({ months: [4], days: 12, budget: 3000, wants: [], rules: [] });
  });

  it("reconnaît le projet actif", () => {
    const safari = project({ months: [8, 9], days: 15, budget: 5000, wants: ["faune"], rules: ["calm"] });
    expect(isActive(safari, applyProject(safari, c))).toBe(true);
    expect(isActive(safari, { ...applyProject(safari, c), days: 14 })).toBe(false);
  });
});
