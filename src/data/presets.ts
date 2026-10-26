import type { Criteria } from "../lib/score";

export interface Preset extends Criteria {
  name: string;
}

export const PRESETS: readonly Preset[] = [
  { name: "Safari 2027", months: [8, 9], days: 15, budget: 5000, wants: ["faune", "nature"], rules: ["noBeach", "calm"] },
  { name: "Les 30 ans en janvier", months: [0], days: 5, budget: 900, wants: ["culture", "gastro"], rules: ["direct"] },
  { name: "Jordanie en mai", months: [4], days: 8, budget: 2000, wants: ["culture", "desert", "rando"], rules: [] },
  { name: "Long week-end", months: [new Date().getMonth()], days: 4, budget: 700, wants: [], rules: ["direct"] },
];

export const DEFAULT_CRITERIA: Criteria = PRESETS[0];
