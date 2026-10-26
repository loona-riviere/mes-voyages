import { useCallback, useEffect, useMemo, useState } from "react";
import { TabBar, type Tab } from "./components/TabBar";
import { useToast } from "./components/Toast";
import { ago } from "./lib/format";
import { rank } from "./lib/score";
import { useCriteria } from "./lib/useCriteria";
import { useNotion } from "./lib/useNotion";
import { Choose, ChooseHeader, CriteriaSheet } from "./screens/Choose";
import { Trips } from "./screens/Trips";
import { Unlock } from "./screens/Unlock";
import { NO_FILTER, Wishes, WishesHeader, WishSheet, type WishFilter } from "./screens/Wishes";
import { applyProject, ProjectSheet, ProjectsRow, type ProjectSheetState } from "./screens/Projects";

const TITLES: Record<Tab, string> = { choose: "Où partir ?", wishes: "Envies", trips: "Voyages faits" };

export function App() {
  const notion = useNotion();
  const [criteria, setCriteria] = useCriteria();
  const [tab, setTab] = useState<Tab>("choose");
  const [critOpen, setCritOpen] = useState(false);
  const [wishId, setWishId] = useState<string | null>(null);
  const [filter, setFilter] = useState<WishFilter>(NO_FILTER);
  const [scrolled, setScrolled] = useState(false);
  const [projectSheet, setProjectSheet] = useState<ProjectSheetState>(null);
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
              <ProjectsRow
                projects={notion.projects}
                criteria={criteria}
                onApply={(p) => { setCriteria(applyProject(p, criteria)); toast(p.name); }}
                onEdit={(p) => setProjectSheet({ mode: "edit", id: p.id })}
                onNew={() => setProjectSheet({ mode: "new" })}
              />
              <ChooseHeader criteria={criteria} openCriteria={() => setCritOpen(true)} />
            </>
          )}
          {tab === "wishes" && <WishesHeader filter={filter} setFilter={setFilter} />}
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
          {tab === "wishes" && <Wishes notion={notion} filter={filter} onOpen={openWish} />}
          {tab === "trips" && <Trips notion={notion} />}
        </main>
      </div>
      <TabBar tab={tab} onChange={go} wishCount={notion.wishes.length} />
      <ProjectSheet state={projectSheet} onClose={() => setProjectSheet(null)} criteria={criteria} notion={notion} toast={toast} />
      <CriteriaSheet open={critOpen} onClose={closeCrit} criteria={criteria} setCriteria={setCriteria} count={count} />
      <WishSheet wish={notion.wishes.find((w) => w.id === wishId) ?? null} onClose={closeWish} notion={notion} toast={toast} />
      {toastNode}
    </>
  );
}
