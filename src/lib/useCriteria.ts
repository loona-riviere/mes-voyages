import { useEffect, useState } from "react";
import { MONTHS, RULES, WANTS, type Rule, type Want } from "../data/catalogue";
import { DEFAULT_CRITERIA } from "../data/presets";
import type { Criteria } from "./score";

const KEY = "mv-criteria-v1";
const wantKeys = WANTS.map((w) => w.key as string);
const ruleKeys = RULES.map((r) => r.key as string);

function load(): Criteria {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Criteria> | null;
    if (!c) return DEFAULT_CRITERIA;
    return {
      month: Number.isInteger(c.month) && c.month! >= 0 && c.month! < MONTHS.length ? c.month! : DEFAULT_CRITERIA.month,
      days: Math.min(21, Math.max(2, Number(c.days) || DEFAULT_CRITERIA.days)),
      budget: Math.max(0, Number(c.budget) || DEFAULT_CRITERIA.budget),
      wants: (c.wants ?? []).filter((w): w is Want => wantKeys.includes(w)),
      rules: (c.rules ?? []).filter((r): r is Rule => ruleKeys.includes(r)),
    };
  } catch {
    return DEFAULT_CRITERIA;
  }
}

export function useCriteria() {
  const [criteria, setCriteria] = useState<Criteria>(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(criteria));
    } catch {
      // stockage indisponible
    }
  }, [criteria]);
  return [criteria, setCriteria] as const;
}
