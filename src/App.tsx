import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TabBar, type Tab } from "./components/TabBar";
import { useToast } from "./components/Toast";
import { ago } from "./lib/format";
import { rank } from "./lib/score";
import { useCriteria } from "./lib/useCriteria";
import { localToday, nextStatus } from "./lib/tripStatus";
import { useNotion } from "./lib/useNotion";
import { Choose, ChooseHeader, CriteriaSheet } from "./screens/Choose";
import { Trips } from "./screens/Trips";
import { Unlock } from "./screens/Unlock";
import { isPlanned, NO_FILTER, WishForm, Wishes, WishesHeader, WishSheet, type WishFilter, type WishFormState } from "./screens/Wishes";
import { applyProject, isActive, ProjectForm, ProjectSheet, ProjectsTab, type ProjectSheetState } from "./screens/Projects";

const PROJECT_KEY = "mv-project-v1";

const TITLES: Record<Tab, string> = { choose: "Où partir ?", wishes: "Envies", projects: "Projets", trips: "Voyages" };

export function App() {
  const notion = useNotion();
  const [criteria, setCriteria] = useCriteria();
  const [tab, setTab] = useState<Tab>("choose");
  const [critOpen, setCritOpen] = useState(false);
  const [wishId, setWishId] = useState<string | null>(null);
  const [openTripId, setOpenTripId] = useState<string | null>(null);
  const clearOpenTrip = useCallback(() => setOpenTripId(null), []);
  const [wishForm, setWishForm] = useState<WishFormState>(null);
  const [filter, setFilter] = useState<WishFilter>(NO_FILTER);
  const [scrolled, setScrolled] = useState(false);
  const [projectSheet, setProjectSheet] = useState<ProjectSheetState>(null);
  const [projectForm, setProjectForm] = useState<ProjectSheetState>(null);
  const [toastNode, toast] = useToast();

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const go = useCallback((t: Tab) => {
    setTab(t);
    window.scrollTo(0, 0);
  }, []);
  const openWish = useCallback((id: string) => setWishId(id), []);
  const closeCrit = useCallback(() => setCritOpen(false), []);
  const closeWish = useCallback(() => setWishId(null), []);
  // Statut automatique d'après les dates (une fois par voyage et par ouverture de l'app).
  const autoDone = useRef(new Set<string>());
  useEffect(() => {
    if (notion.state !== "ok") return;
    const today = localToday();
    const due = notion.trips.filter((t) => !autoDone.current.has(t.id) && nextStatus(t, today));
    if (!due.length) return;
    due.forEach((t) => autoDone.current.add(t.id));
    void (async () => {
      for (const t of due) {
        const status = nextStatus(t, today)!;
        try {
          await notion.saveTrip({ status }, t.id);
          toast(status === "Visité" ? `${t.name} est terminé : note-le dans Voyages` : `Bon voyage ! ${t.name} est en cours`);
        } catch {
          // réessayé à la prochaine ouverture
        }
      }
    })();
  }, [notion, notion.state, notion.trips, toast]);

  const liveProjects = useMemo(() => notion.projects.filter((p) => p.status !== "Archivé"), [notion.projects]);
  // Projet choisi dans « Choisir » : il reste choisi même si on change ensuite un critère.
  const [projectId, setProjectIdState] = useState<string>(() => {
    try { return localStorage.getItem(PROJECT_KEY) ?? ""; } catch { return ""; }
  });
  const setProjectId = (id: string) => {
    setProjectIdState(id);
    try { localStorage.setItem(PROJECT_KEY, id); } catch { /* stockage indisponible */ }
  };
  const activeProject = liveProjects.find((p) => p.id === projectId) ?? (projectId ? undefined : liveProjects.find((p) => isActive(p, criteria)));
  const projectModified = !!activeProject && !isActive(activeProject, criteria);
  const saveToProject = async () => {
    if (!activeProject) return;
    try {
      const sent = await notion.saveProject(
        { months: [...criteria.months], days: criteria.days, budget: criteria.budget, wants: [...criteria.wants], rules: [...criteria.rules] },
        activeProject.id,
      );
      toast(sent ? `« ${activeProject.name} » mis à jour` : "Enregistré ici, envoyé à Notion au retour du réseau");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Enregistrement impossible");
    }
  };
  const count = useMemo(() => rank(criteria, notion).results.length, [criteria, notion]);

  if (notion.state === "locked") return <Unlock onUnlock={notion.unlock} error={notion.error} />;

  const waiting = notion.pending ? ` · ${notion.pending} en attente` : "";
  const sync =
    notion.state === "loading" ? "Mise à jour…" :
    notion.state === "offline" ? `Hors ligne${waiting}` :
    notion.state === "error" ? "Erreur · réessayer" :
    notion.updatedAt ? `À jour ${ago(notion.updatedAt)}` : "À jour";

  return (
    <>
      <div className="app">
        <header className={`head${scrolled ? " scrolled" : ""}`}>
          <div className="title-row">
            <h1>{TITLES[tab]}</h1>
            <button className={`sync${notion.state === "error" ? " bad" : notion.state === "offline" ? " off" : ""}`} onClick={() => void notion.refresh()} disabled={notion.state === "loading"}
              title={notion.error ?? undefined}>
              {sync}
            </button>
          </div>
          {tab === "choose" && (
            <>
              <ChooseHeader
                criteria={criteria}
                openCriteria={() => setCritOpen(true)}
                projects={liveProjects}
                activeProject={activeProject?.id ?? ""}
                modified={projectModified}
                onSaveToProject={() => void saveToProject()}
                onPickProject={(id) => {
                  if (id === "new") return setProjectSheet({ mode: "new" });
                  setProjectId(id);
                  const p = liveProjects.find((x) => x.id === id);
                  if (p) { setCriteria(applyProject(p, criteria)); toast(p.name); }
                }}
              />
            </>
          )}
          {tab === "wishes" && notion.wishes.length > 5 && <WishesHeader filter={filter} setFilter={setFilter} />}
        </header>
        <main>
          {notion.state === "error" && notion.error && <div className="banner">{notion.error}</div>}
          {notion.state === "offline" && (
            <div className="banner">
              Pas de réseau : tu vois les données du {notion.updatedAt ? new Date(notion.updatedAt).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "dernier chargement"}.
              {notion.pending === 1 && " 1 changement partira vers Notion au retour du réseau."}
              {notion.pending > 1 && ` ${notion.pending} changements partiront vers Notion au retour du réseau.`}
            </div>
          )}
          {tab === "choose" && <Choose criteria={criteria} setCriteria={setCriteria} notion={notion} toast={toast} onOpenWish={(id) => { go("wishes"); openWish(id); }} />}
          {tab === "wishes" && <Wishes notion={notion} filter={filter} setFilter={setFilter} onOpen={openWish} onNew={() => setWishForm({ mode: "new" })} />}
          {tab === "projects" && (
            <ProjectsTab
              notion={notion}
              onApply={(p) => { setProjectId(p.id); setCriteria(applyProject(p, criteria)); go("choose"); toast(p.name); }}
              onEdit={(p) => setProjectForm({ mode: "edit", id: p.id })}
              onNew={() => setProjectForm({ mode: "new" })}
            />
          )}
          {tab === "trips" && <Trips notion={notion} toast={toast} openId={openTripId} onOpened={clearOpenTrip} />}
        </main>
      </div>
      <TabBar tab={tab} onChange={go} wishCount={notion.wishes.filter((w) => !isPlanned(w)).length} />
      <ProjectForm state={projectForm} onClose={() => setProjectForm(null)} notion={notion} toast={toast} onPlanned={() => go("trips")} />
      <ProjectSheet state={projectSheet} onClose={() => setProjectSheet(null)} criteria={criteria} notion={notion} toast={toast} />
      <CriteriaSheet open={critOpen} onClose={closeCrit} criteria={criteria} setCriteria={setCriteria} count={count}
        modifiedProject={projectModified ? activeProject?.name : undefined} onSaveToProject={() => void saveToProject()} />
      <WishSheet wish={notion.wishes.find((w) => w.id === wishId) ?? null} onClose={closeWish} notion={notion} toast={toast}
        onEdit={(id) => setWishForm({ mode: "edit", id })} onPlanned={(id) => { setOpenTripId(id); go("trips"); }} />
      <WishForm state={wishForm} onClose={() => setWishForm(null)} notion={notion} toast={toast} />
      {toastNode}
    </>
  );
}
