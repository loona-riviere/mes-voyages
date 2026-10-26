import { useEffect, useState } from "react";
import { RULES, WANT_LABEL } from "../data/catalogue";
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

export function ProjectsRow({ projects, criteria, onApply, onEdit, onNew }: {
  projects: Project[]; criteria: Criteria; onApply: (p: Project) => void; onEdit: (p: Project) => void; onNew: () => void;
}) {
  return (
    <div className="row-scroll" aria-label="Projets">
      {projects.map((p) => {
        const active = isActive(p, criteria);
        return (
          <button key={p.id} className={`project${active ? " on" : ""}`} aria-pressed={active} onClick={() => (active ? onEdit(p) : onApply(p))}>
            {p.status === "Choisi" && <span aria-label="Choisi">✓ </span>}{p.name}
          </button>
        );
      })}
      <button className="project add" onClick={onNew}>+ Projet</button>
    </div>
  );
}

export function ProjectSheet({ state, onClose, criteria, notion, toast }: {
  state: ProjectSheetState; onClose: () => void; criteria: Criteria; notion: NotionData; toast: (m: string) => void;
}) {
  const project = state?.mode === "edit" ? notion.projects.find((p) => p.id === state.id) : undefined;
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (state) setName(project?.name ?? "");
  }, [state, project?.name]);

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      toast(done);
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  };
  const fromCriteria = { months: [...criteria.months], days: criteria.days, budget: criteria.budget, wants: [...criteria.wants], rules: [...criteria.rules] };
  const offline = notion.state === "offline";

  return (
    <Sheet
      open={!!state}
      title={project ? project.name : "Nouveau projet"}
      onClose={onClose}
      footer={project ? (
        <div className="foot-row">
          <button className="btn ghost" disabled={busy || offline} onClick={() => run(() => notion.saveProject({ status: "Archivé" }, project.id), `${project.name} archivé`)}>Archiver</button>
          <button className="btn primary" disabled={busy || offline || !name.trim()}
            onClick={() => run(() => notion.saveProject({ name: name.trim(), ...fromCriteria }, project.id), "Projet mis à jour")}>
            Mettre à jour
          </button>
        </div>
      ) : (
        <button className="btn primary" disabled={busy || offline || !name.trim()}
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
      {offline && <p className="hint">Pas de réseau : les projets ne peuvent pas être modifiés hors ligne.</p>}
      {project?.url && <a className="link" href={project.url} target="_blank" rel="noopener">Ouvrir dans Notion ↗</a>}
    </Sheet>
  );
}
