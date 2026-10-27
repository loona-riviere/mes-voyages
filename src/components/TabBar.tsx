import type { ReactNode } from "react";

export type Tab = "choose" | "wishes" | "projects" | "trips";

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: "choose", label: "Choisir", icon: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></> },
  { id: "wishes", label: "Envies", icon: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /> },
  { id: "projects", label: "Projets", icon: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16M8 14h4" /></> },
  { id: "trips", label: "Voyages faits", icon: <><path d="M4 6h16M4 12h10M4 18h13" /><circle cx="19" cy="12" r="1.5" /></> },
];

export function TabBar({ tab, onChange, wishCount }: { tab: Tab; onChange: (t: Tab) => void; wishCount: number }) {
  return (
    <nav className="tabbar" aria-label="Onglets">
      <div className="tabbar-in">
        {TABS.map((t) => (
          <button key={t.id} className="tab" aria-current={tab === t.id ? "page" : undefined} onClick={() => onChange(t.id)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">{t.icon}</svg>
            {t.label}
            {t.id === "wishes" && wishCount > 0 && <span className="cnt">{wishCount}</span>}
          </button>
        ))}
      </div>
    </nav>
  );
}
