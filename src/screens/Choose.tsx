import { useMemo, useState } from "react";
import { MONTH_SHORT, MONTHS, RULES, WANT_LABEL, WANTS, type Rule, type Want } from "../data/catalogue";
import { Sheet } from "../components/Sheet";
import { ResultCard } from "../components/ResultCard";
import { CompareSheet, DetailSheet, resultKey, resultName } from "./Detail";
import { roundTo50 } from "../lib/format";
import { rank, tripCost, type Criteria, type DestinationResult } from "../lib/score";
import type { NotionData } from "../lib/useNotion";
import type { Project } from "../shared/types";

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

export function ChooseHeader({ criteria: c, openCriteria, projects, activeProject, modified, onSaveToProject, onPickProject }: Pick<Props, "criteria"> & {
  openCriteria: () => void;
  projects: Project[];
  activeProject: string;
  /** Les critères ont changé depuis l'application du projet */
  modified: boolean;
  onSaveToProject: () => void;
  /** "" = aucun projet, "new" = créer un projet */
  onPickProject: (id: string) => void;
}) {
  const months = c.months.length === 1 ? MONTHS[c.months[0]] : [...c.months].sort((a, b) => a - b).map((m) => MONTH_SHORT[m]).join(" · ");
  const summary = [
    months,
    `${c.days} jours`,
    `${c.budget.toLocaleString("fr-FR")} €`,
    c.wants.length ? c.wants.map((w) => SHORT[w]).join(", ") : null,
    c.rules.length ? `${c.rules.length} contrainte${c.rules.length > 1 ? "s" : ""}` : null,
  ].filter(Boolean);
  return (
    <div className="crit-head">
      <button className="crit-sum" onClick={openCriteria} aria-label="Modifier les critères">
        <span>{summary.join(" · ")}</span>
        <i>Modifier</i>
      </button>
      <select className="proj-pick" aria-label="Projet" value={activeProject} onChange={(e) => onPickProject(e.target.value)}>
        <option value="">Sans projet</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>{p.status === "Choisi" ? "✓ " : ""}{p.name}{modified && p.id === activeProject ? " · modifié" : ""}</option>
        ))}
        <option value="new">+ Nouveau projet…</option>
      </select>
      {modified && (
        <div className="proj-modified">
          <span>Critères changés depuis le projet</span>
          <button className="text-btn" onClick={onSaveToProject}>Enregistrer dans le projet</button>
        </div>
      )}
    </div>
  );
}

export function CriteriaSheet({ open, onClose, criteria: c, setCriteria, count, modifiedProject, onSaveToProject }: {
  open: boolean; onClose: () => void; criteria: Criteria; setCriteria: (c: Criteria) => void; count: number;
  /** Nom du projet choisi quand les critères en diffèrent */
  modifiedProject?: string;
  onSaveToProject: () => void;
}) {
  const set = (patch: Partial<Criteria>) => setCriteria({ ...c, ...patch });
  return (
    <Sheet
      open={open}
      title="Critères"
      onClose={onClose}
      footer={modifiedProject ? (
        <div className="foot-row">
          <button className="btn ghost" onClick={() => { onSaveToProject(); onClose(); }}>Enregistrer dans « {modifiedProject} »</button>
          <button className="btn primary" onClick={onClose}>Voir les {count}</button>
        </div>
      ) : <button className="btn primary" onClick={onClose}>Voir les {count} destinations</button>}
    >
      <section>
        <div className="lbl">Mois du départ <b>{c.months.length > 1 ? `${c.months.length} mois` : MONTHS[c.months[0]]}</b></div>
        <div className="months">
          {MONTHS.map((m, i) => (
            <button key={m} aria-pressed={c.months.includes(i)} aria-label={m}
              onClick={() => {
                const next = toggle(c.months, i);
                if (next.length) set({ months: next });
              }}>
              {MONTH_SHORT[i]}
            </button>
          ))}
        </div>
        <p className="hint">Tu hésites ? Choisis plusieurs mois : chaque destination est notée sur son meilleur.</p>
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
  const [detail, setDetail] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const { results, hiddenNotDirect } = useMemo(
    () => rank(criteria, notion),
    [criteria, notion.wishes, notion.trips, notion.catalogue],
  );

  const add = async (r: DestinationResult) => {
    const d = r.destination;
    setAdding(d.airport);
    try {
      const sent = await notion.addWish({
        name: d.name,
        country: d.country,
        wants: d.wants.map((w) => WANT_LABEL[w]),
        bestMonths: d.season.flatMap((v, i) => (v === 2 ? [i] : [])),
        idealDays: criteria.days,
        budget: roundTo50(tripCost(d, criteria.days)),
        priority: "Envie",
        status: "Idée",
        notes: d.pitch,
        destinationId: d.id,
      });
      toast(sent ? `${d.name} ajouté à tes envies` : `${d.name} ajouté, envoyé à Notion au retour du réseau`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Ajout impossible");
    } finally {
      setAdding(null);
    }
  };

  const list = results.slice(0, shown);
  const byKey = (k: string) => results.find((r) => resultKey(r) === k);
  const detailResult = detail ? byKey(detail) ?? null : null;
  const pickedResults = picked.map(byKey).filter((r): r is NonNullable<typeof r> => !!r);
  const togglePick = (k: string) => {
    if (picked.includes(k)) return setPicked(picked.filter((x) => x !== k));
    if (picked.length >= 3) return toast("3 destinations maximum dans la comparaison");
    setPicked([...picked, k]);
  };
  return (
    <div className="screen">
      <div className="sum">
        <b>{results.length} destinations classées</b>
        <span>{hiddenNotDirect ? `${hiddenNotDirect} écartées (escale)` : "score sur 100"}</span>
      </div>
      {list.length === 0 && <div className="empty">Aucune destination ne passe ces contraintes. Essaie d'autoriser les escales.</div>}
      {list.map((r, i) => (
        <ResultCard
          key={resultKey(r)}
          result={r}
          rank={i + 1}
          criteria={criteria}
          adding={r.kind === "destination" && adding === r.destination.airport}
          onAdd={r.kind === "destination" ? () => add(r) : undefined}
          onOpenWish={onOpenWish}
          onOpen={() => setDetail(resultKey(r))}
          comparing={picked.includes(resultKey(r))}
          onToggleCompare={() => togglePick(resultKey(r))}
        />
      ))}
      {results.length > shown && (
        <button className="more" onClick={() => setShown(shown + 8)}>Voir {Math.min(8, results.length - shown)} de plus</button>
      )}
      <p className="note">Coûts et temps de vol estimés depuis Paris : vol A/R en éco et budget moyen sur place. Les vols directs peuvent être saisonniers.</p>
      {picked.length > 0 && (
        <div className="cmp-bar" role="region" aria-label="Comparaison">
          <span>{pickedResults.map(resultName).join(" · ")}</span>
          <button className="btn primary" onClick={() => setComparing(true)} disabled={picked.length < 2}>
            {picked.length < 2 ? "Choisis-en une autre" : `Comparer (${picked.length})`}
          </button>
          <button className="x" onClick={() => setPicked([])} aria-label="Vider la comparaison">×</button>
        </div>
      )}
      <DetailSheet
        result={detailResult}
        criteria={criteria}
        onClose={() => setDetail(null)}
        comparing={!!detail && picked.includes(detail)}
        onToggleCompare={() => detail && togglePick(detail)}
        onAdd={detailResult?.kind === "destination" ? () => add(detailResult) : undefined}
        onOpenWish={(id) => { setDetail(null); onOpenWish(id); }}
      />
      <CompareSheet
        open={comparing}
        results={pickedResults}
        criteria={criteria}
        notion={notion}
        onClose={() => setComparing(false)}
        onRemove={(k) => setPicked(picked.filter((x) => x !== k))}
      />
    </div>
  );
}
