import { useMemo, useState } from "react";
import { MONTHS, RULES, WANT_LABEL, WANTS, type Rule, type Want } from "../data/catalogue";
import { PRESETS } from "../data/presets";
import { Sheet } from "../components/Sheet";
import { ResultCard } from "../components/ResultCard";
import { roundTo50 } from "../lib/format";
import { rank, tripCost, type Criteria, type DestinationResult } from "../lib/score";
import type { NotionData } from "../lib/useNotion";

const SHORT: Record<Want, string> = {
  plage: "Plage", nature: "Nature", faune: "Faune", rando: "Rando", plongee: "Plongée",
  culture: "Culture", ville: "Ville", gastro: "Gastro", desert: "Désert", neige: "Neige",
};

interface Props {
  criteria: Criteria;
  setCriteria: (c: Criteria) => void;
  notion: NotionData;
  toast: (m: string) => void;
  onOpenWish: (id: string) => void;
}

const toggle = <T,>(list: readonly T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export function ChooseHeader({ criteria: c, setCriteria, openCriteria }: Pick<Props, "criteria" | "setCriteria"> & { openCriteria: () => void }) {
  return (
    <>
      <div className="row-scroll" aria-label="Critères">
        <button className="pill on" onClick={openCriteria}>{MONTHS[c.month]}</button>
        <button className="pill" onClick={openCriteria}>{c.days} jours</button>
        <button className="pill" onClick={openCriteria}>{c.budget.toLocaleString("fr-FR")} €</button>
        <button className="pill" onClick={openCriteria}>
          {c.wants.length ? SHORT[c.wants[0]] : "Toutes envies"}
          {c.wants.length > 1 && <span className="n">+{c.wants.length - 1}</span>}
        </button>
        <button className="pill" onClick={openCriteria}>
          {c.rules.length ? <>Contraintes <span className="n">{c.rules.length}</span></> : "Sans contrainte"}
        </button>
      </div>
      <div className="row-scroll" aria-label="Départs rapides">
        {PRESETS.map((p) => (
          <button key={p.name} className="preset" onClick={() => setCriteria({ month: p.month, days: p.days, budget: p.budget, wants: p.wants, rules: p.rules })}>
            {p.name}
          </button>
        ))}
      </div>
    </>
  );
}

export function CriteriaSheet({ open, onClose, criteria: c, setCriteria, count }: {
  open: boolean; onClose: () => void; criteria: Criteria; setCriteria: (c: Criteria) => void; count: number;
}) {
  const set = (patch: Partial<Criteria>) => setCriteria({ ...c, ...patch });
  return (
    <Sheet
      open={open}
      title="Critères"
      onClose={onClose}
      footer={<button className="btn primary" onClick={onClose}>Voir les {count} destinations</button>}
    >
      <section>
        <div className="lbl">Mois du départ <b>{MONTHS[c.month]}</b></div>
        <div className="months">
          {MONTHS.map((m, i) => (
            <button key={m} aria-pressed={i === c.month} aria-label={m} onClick={() => set({ month: i })}>{m.slice(0, 3)}</button>
          ))}
        </div>
      </section>
      <section>
        <div className="lbl"><label htmlFor="days">Durée</label> <b>{c.days} jours</b></div>
        <input id="days" type="range" min={2} max={21} value={c.days} onChange={(e) => set({ days: Number(e.target.value) })} />
      </section>
      <section>
        <div className="lbl"><label htmlFor="budget">Budget par personne</label> <b>vols + sur place</b></div>
        <div className="money">
          <input id="budget" type="number" inputMode="numeric" min={200} step={100} value={c.budget}
            onChange={(e) => set({ budget: Math.max(0, Number(e.target.value) || 0) })} />
          <span>€ / pers.</span>
        </div>
      </section>
      <section>
        <div className="lbl">Envies</div>
        <div className="chips">
          {WANTS.map((w) => (
            <button key={w.key} className="chip" aria-pressed={c.wants.includes(w.key)} onClick={() => set({ wants: toggle(c.wants, w.key) })}>{w.label}</button>
          ))}
        </div>
      </section>
      <section>
        <div className="lbl">Contraintes</div>
        <div className="chips">
          {RULES.map((r) => (
            <button key={r.key} className="chip" aria-pressed={c.rules.includes(r.key)} onClick={() => set({ rules: toggle<Rule>(c.rules, r.key) })}>{r.label}</button>
          ))}
        </div>
      </section>
    </Sheet>
  );
}

export function Choose({ criteria, notion, toast, onOpenWish }: Props) {
  const [shown, setShown] = useState(8);
  const [adding, setAdding] = useState<string | null>(null);
  const { results, hiddenNotDirect } = useMemo(
    () => rank(criteria, { wishes: notion.wishes, trips: notion.trips }),
    [criteria, notion.wishes, notion.trips],
  );

  const add = async (r: DestinationResult) => {
    const d = r.destination;
    setAdding(d.airport);
    try {
      await notion.addWish({
        name: d.name,
        country: d.country,
        wants: d.wants.map((w) => WANT_LABEL[w]),
        bestMonths: d.season.flatMap((v, i) => (v === 2 ? [i] : [])),
        idealDays: criteria.days,
        budget: roundTo50(tripCost(d, criteria.days)),
        priority: "Envie",
        status: "Idée",
        notes: d.pitch,
      });
      toast(`${d.name} ajouté à tes envies`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Ajout impossible");
    } finally {
      setAdding(null);
    }
  };

  const list = results.slice(0, shown);
  return (
    <div className="screen">
      <div className="sum">
        <b>{results.length} destinations classées</b>
        <span>{hiddenNotDirect ? `${hiddenNotDirect} écartées (escale)` : "score sur 100"}</span>
      </div>
      {list.length === 0 && <div className="empty">Aucune destination ne passe ces contraintes. Essaie d'autoriser les escales.</div>}
      {list.map((r, i) => (
        <ResultCard
          key={r.kind === "destination" ? r.destination.airport : r.wish.id}
          result={r}
          rank={i + 1}
          criteria={criteria}
          adding={r.kind === "destination" && adding === r.destination.airport}
          onAdd={notion.state === "ok" && r.kind === "destination" ? () => add(r) : undefined}
          onOpenWish={onOpenWish}
        />
      ))}
      {results.length > shown && (
        <button className="more" onClick={() => setShown(shown + 8)}>Voir {Math.min(8, results.length - shown)} de plus</button>
      )}
      <p className="note">Coûts et temps de vol estimés depuis Paris : vol A/R en éco et budget moyen sur place. Les vols directs peuvent être saisonniers.</p>
    </div>
  );
}
