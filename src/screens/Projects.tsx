import { useEffect, useState } from "react";
import { MONTH_SHORT, RULES, WANT_LABEL, WANTS } from "../data/catalogue";
import { AddFab } from "../components/AddFab";
import { Sheet } from "../components/Sheet";
import { euros } from "../lib/format";
import { monthList, type Criteria } from "../lib/score";
import type { NotionData } from "../lib/useNotion";
import type { Project } from "../shared/types";

const sameSet = <T,>(a: readonly T[], b: readonly T[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Critères obtenus en appliquant un projet ; ses champs vides gardent les critères en cours. */
export function applyProject(p: Project, c: Criteria): Criteria {
  return {
    months: p.months.length ? p.months : c.months,
    days: p.days ?? c.days,
    budget: p.budget ?? c.budget,
    wants: p.wants,
    rules: p.rules,
  };
}

export function isActive(p: Project, c: Criteria): boolean {
  const a = applyProject(p, c);
  return sameSet(a.months, c.months) && a.days === c.days && a.budget === c.budget && sameSet(a.wants, c.wants) && sameSet(a.rules, c.rules);
}

function summary(c: Pick<Criteria, "months" | "wants" | "rules"> & { days: number | null; budget: number | null }): string {
  const ruleLabel = (k: string) => RULES.find((r) => r.key === k)?.label.toLowerCase();
  return [
    c.months.length ? monthList(c.months).replace(/^./, (x) => x.toUpperCase()) : "Mois en cours",
    c.days != null ? `${c.days} jours` : null,
    c.budget != null ? `${euros(c.budget)} / pers.` : null,
    c.wants.length ? c.wants.map((w) => WANT_LABEL[w]).join(", ") : null,
    c.rules.length ? c.rules.map(ruleLabel).join(", ") : null,
  ].filter(Boolean).join(" · ");
}

export type ProjectSheetState = { mode: "new" } | { mode: "edit"; id: string } | null;

export function ProjectSheet({ state, onClose, criteria, notion, toast }: {
  state: ProjectSheetState; onClose: () => void; criteria: Criteria; notion: NotionData; toast: (m: string) => void;
}) {
  const project = state?.mode === "edit" ? notion.projects.find((p) => p.id === state.id) : undefined;
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (state) setName(project?.name ?? "");
  }, [state, project?.name]);

  const run = async (fn: () => Promise<boolean>, done: string) => {
    setBusy(true);
    try {
      toast((await fn()) ? done : "Enregistré ici, envoyé à Notion au retour du réseau");
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  };
  const fromCriteria = { months: [...criteria.months], days: criteria.days, budget: criteria.budget, wants: [...criteria.wants], rules: [...criteria.rules] };
  return (
    <Sheet
      open={!!state}
      title={project ? project.name : "Nouveau projet"}
      onClose={onClose}
      footer={project ? (
        <div className="foot-row">
          <button className="btn ghost" disabled={busy} onClick={() => run(() => notion.saveProject({ status: "Archivé" }, project.id), `${project.name} archivé`)}>Archiver</button>
          <button className="btn primary" disabled={busy || !name.trim()}
            onClick={() => run(() => notion.saveProject({ name: name.trim(), ...fromCriteria }, project.id), "Projet mis à jour")}>
            Mettre à jour
          </button>
        </div>
      ) : (
        <button className="btn primary" disabled={busy || !name.trim()}
          onClick={() => run(() => notion.saveProject({ name: name.trim(), ...fromCriteria }), "Projet enregistré dans Notion")}>
          Enregistrer le projet
        </button>
      )}
    >
      <section>
        <label className="lbl" htmlFor="projectName">Nom</label>
        <input id="projectName" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Voyage de mai" autoComplete="off" />
      </section>
      {project && (
        <section>
          <div className="lbl">Enregistré</div>
          <p className="proj-sum">{summary(project)}</p>
          {project.notes && <p className="hint">{project.notes}</p>}
        </section>
      )}
      <section>
        <div className="lbl">{project ? "Critères actuels" : "Critères enregistrés"}</div>
        <p className="proj-sum">{summary(criteria)}</p>
        <p className="hint">
          {project
            ? "« Mettre à jour » remplace les critères du projet par ceux-ci."
            : "Le projet garde ces critères. Tu pourras le retrouver ici et dans la base Notion « Projets »."}
        </p>
      </section>
      {project?.url && <a className="link" href={project.url} target="_blank" rel="noopener">Ouvrir dans Notion ↗</a>}
    </Sheet>
  );
}

// ---------- Onglet Projets ----------

const STATUS_ORDER = ["À choisir", "Choisi", "Archivé"] as const;
const MONTH_NAMES = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

export function ProjectsTab({ notion, onApply, onEdit, onNew }: {
  notion: NotionData; onApply: (p: Project) => void; onEdit: (p: Project) => void; onNew: () => void;
}) {
  const [showArchived, setShowArchived] = useState(false);
  const by = (s: string) => notion.projects.filter((p) => (p.status ?? "À choisir") === s);
  const toChoose = by("À choisir");
  const chosen = by("Choisi");
  const archived = by("Archivé");
  return (
    <div className="screen">
      {notion.projects.length === 0 && notion.state === "loading" && <div className="empty">Chargement de tes projets…</div>}
      {notion.projects.length === 0 && notion.state !== "loading" && (
        <div className="empty">Aucun projet pour l'instant. Un projet garde des critères (mois, durée, budget, envies) pour les retrouver d'un toucher.</div>
      )}
      {toChoose.length > 0 && chosen.length > 0 && <div className="group-h">À choisir</div>}
      {toChoose.map((p) => <ProjectCard key={p.id} p={p} onApply={onApply} onEdit={onEdit} />)}
      {chosen.length > 0 && toChoose.length > 0 && <div className="group-h">Choisis</div>}
      {chosen.map((p) => <ProjectCard key={p.id} p={p} onApply={onApply} onEdit={onEdit} />)}
      <AddFab label="Nouveau projet" onClick={onNew} />
      {archived.length > 0 && (
        <>
          <button className="fold" aria-expanded={showArchived} onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? "Masquer" : "Voir"} les {archived.length} projet{archived.length > 1 ? "s" : ""} archivé{archived.length > 1 ? "s" : ""}
          </button>
          {showArchived && archived.map((p) => <ProjectCard key={p.id} p={p} onApply={onApply} onEdit={onEdit} />)}
        </>
      )}
    </div>
  );
}

function ProjectCard({ p, onApply, onEdit }: { p: Project; onApply: (p: Project) => void; onEdit: (p: Project) => void }) {
  const ruleLabel = (k: string) => RULES.find((r) => r.key === k)?.label ?? k;
  return (
    <article className={`proj${p.status === "Choisi" ? " done" : ""}`}>
      <div className="proj-top">
        <h3>{p.name}</h3>
        <span className="proj-status">{p.status === "Choisi" ? "✓ Choisi" : p.status ?? "À choisir"}</span>
      </div>
      <div className="proj-facts">
        {p.months.length > 0 && <span>{monthList(p.months).replace(/^./, (x) => x.toUpperCase())}</span>}
        {p.days != null && <span>{p.days} jours</span>}
        {p.budget != null && <span>{euros(p.budget)} / pers.</span>}
        {p.wants.map((w) => <span key={w}>{WANT_LABEL[w]}</span>)}
        {p.rules.map((r) => <span key={r}>{ruleLabel(r)}</span>)}
        {!p.months.length && p.days == null && p.budget == null && !p.wants.length && !p.rules.length && <span>Aucun critère enregistré</span>}
      </div>
      {p.notes && <p className="proj-notes">{p.notes}</p>}
      <div className="proj-actions">
        <button className="btn ghost" onClick={() => onEdit(p)}>Modifier</button>
        {p.status !== "Archivé" && <button className="btn primary" onClick={() => onApply(p)}>Voir les destinations</button>}
      </div>
    </article>
  );
}

/** Formulaire complet d'un projet (création ou modification). */
export function ProjectForm({ state, onClose, notion, toast, onPlanned }: {
  state: ProjectSheetState; onClose: () => void; notion: NotionData; toast: (m: string) => void; onPlanned: () => void;
}) {
  const project = state?.mode === "edit" ? notion.projects.find((p) => p.id === state.id) : undefined;
  const [name, setName] = useState("");
  const [months, setMonths] = useState<number[]>([]);
  const [days, setDays] = useState("");
  const [budget, setBudget] = useState("");
  const [wants, setWants] = useState<Project["wants"]>([]);
  const [rules, setRules] = useState<Project["rules"]>([]);
  const [status, setStatus] = useState<NonNullable<Project["status"]>>("À choisir");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!state) return;
    setName(project?.name ?? "");
    setMonths(project?.months ?? []);
    setDays(project?.days != null ? String(project.days) : "");
    setBudget(project?.budget != null ? String(project.budget) : "");
    setWants(project?.wants ?? []);
    setRules(project?.rules ?? []);
    setStatus(project?.status ?? "À choisir");
    setNotes(project?.notes ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, project?.id]);

  const flip = <T,>(list: readonly T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const num = (s: string) => (s.trim() === "" ? null : Math.max(0, Number(s) || 0));
  const save = async () => {
    setBusy(true);
    try {
      const sent = await notion.saveProject({ name: name.trim(), months, days: num(days), budget: num(budget), wants, rules, status, notes }, project?.id);
      toast(!sent ? "Enregistré ici, envoyé à Notion au retour du réseau" : project ? "Projet mis à jour" : "Projet enregistré dans Notion");
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  };

  /** Le projet est décidé : on crée le voyage et on marque le projet « Choisi ». */
  const plan = async () => {
    if (!project) return;
    setBusy(true);
    try {
      await notion.saveTrip({ name: name.trim() || project.name, status: "À planifier" });
      await notion.saveProject({ status: "Choisi" }, project.id);
      toast("Voyage créé : ajoute les dates et les réservations");
      onClose();
      onPlanned();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Création impossible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={!!state}
      title={project ? "Modifier le projet" : "Nouveau projet"}
      onClose={onClose}
      footer={project ? (
        <div className="foot-row">
          <button className="btn ghost" disabled={busy || notion.state === "offline"} onClick={plan}>Créer le voyage</button>
          <button className="btn primary" disabled={busy || !name.trim()} onClick={save}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
        </div>
      ) : <button className="btn primary" disabled={busy || !name.trim()} onClick={save}>{busy ? "Enregistrement…" : "Enregistrer"}</button>}
    >
      <section>
        <label className="lbl" htmlFor="pfName">Nom</label>
        <input id="pfName" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Voyage de mai" autoComplete="off" />
      </section>
      <section>
        <div className="lbl">Mois envisagés <b>{months.length ? `${months.length}` : "aucun"}</b></div>
        <div className="mini-months">
          {MONTH_NAMES.map((m, i) => (
            <button key={m} aria-pressed={months.includes(i)} onClick={() => setMonths(flip(months, i))}>{MONTH_SHORT[i]}</button>
          ))}
        </div>
      </section>
      <section className="num-row">
        <div>
          <label className="lbl" htmlFor="pfDays">Durée (jours)</label>
          <input id="pfDays" className="field" type="number" inputMode="numeric" min={2} max={21} value={days} onChange={(e) => setDays(e.target.value)} placeholder="Libre" />
        </div>
        <div>
          <label className="lbl" htmlFor="pfBudget">Budget / pers. (€)</label>
          <input id="pfBudget" className="field" type="number" inputMode="numeric" min={0} step={100} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Libre" />
        </div>
      </section>
      <section>
        <div className="lbl">Envies</div>
        <div className="chips">
          {WANTS.map((w) => <button key={w.key} className="chip" aria-pressed={wants.includes(w.key)} onClick={() => setWants(flip(wants, w.key))}>{w.label}</button>)}
        </div>
      </section>
      <section>
        <div className="lbl">Contraintes</div>
        <div className="chips">
          {RULES.map((r) => <button key={r.key} className="chip" aria-pressed={rules.includes(r.key)} onClick={() => setRules(flip(rules, r.key))}>{r.label}</button>)}
        </div>
      </section>
      <section>
        <div className="lbl">Statut</div>
        <div className="segs" role="radiogroup" aria-label="Statut">
          {STATUS_ORDER.map((s) => <button key={s} role="radio" aria-checked={status === s} onClick={() => setStatus(s)}>{s}</button>)}
        </div>
      </section>
      <section>
        <label className="lbl" htmlFor="pfNotes">Notes</label>
        <textarea id="pfNotes" className="field textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Dates à attendre, hésitations, destinations en lice…" />
      </section>
      {project?.url && <a className="link" href={project.url} target="_blank" rel="noopener">Ouvrir dans Notion ↗</a>}
    </Sheet>
  );
}
