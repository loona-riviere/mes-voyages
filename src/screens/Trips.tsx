import { useMemo } from "react";
import { dateRange, euros } from "../lib/format";
import type { NotionData } from "../lib/useNotion";
import type { Trip } from "../shared/types";

const tripDays = (t: Trip) =>
  t.days ?? (t.start && t.end ? Math.round((Date.parse(t.end) - Date.parse(t.start)) / 864e5) + 1 : null);

export function Trips({ notion }: { notion: NotionData }) {
  const { current, done, byYear } = useMemo(() => {
    const sorted = [...notion.trips].sort((a, b) => String(b.start ?? "").localeCompare(String(a.start ?? "")));
    const done = sorted.filter((t) => t.status === "Visité");
    const byYear = new Map<string, Trip[]>();
    for (const t of done) {
      const y = t.start?.slice(0, 4) ?? "Sans date";
      byYear.set(y, [...(byYear.get(y) ?? []), t]);
    }
    return { current: sorted.filter((t) => t.status === "En cours"), done, byYear };
  }, [notion.trips]);

  const totalDays = done.reduce((s, t) => s + (tripDays(t) ?? 0), 0);
  const totalBudget = done.reduce((s, t) => s + (t.budget ?? 0), 0);

  return (
    <div className="screen">
      <div className="stats">
        <div className="stat"><small>Voyages</small><b>{done.length}</b></div>
        <div className="stat"><small>Jours</small><b>{totalDays}</b></div>
        <div className="stat"><small>Budget</small><b>{totalBudget >= 1000 ? `${Math.round(totalBudget / 1000)} k€` : euros(totalBudget)}</b></div>
      </div>
      {notion.trips.length === 0 && notion.state === "loading" && <div className="empty">Chargement de tes voyages…</div>}
      {notion.state === "ok" && done.length === 0 && <div className="empty">Aucun voyage au statut « Visité » dans Notion pour l'instant.</div>}
      {current.length > 0 && (
        <>
          <div className="year">En cours</div>
          <div className="timeline">{current.map((t) => <TripItem key={t.id} t={t} />)}</div>
        </>
      )}
      {[...byYear].map(([year, trips]) => (
        <div key={year}>
          <div className="year">{year}</div>
          <div className="timeline">{trips.map((t) => <TripItem key={t.id} t={t} />)}</div>
        </div>
      ))}
    </div>
  );
}

function TripItem({ t }: { t: Trip }) {
  const days = tripDays(t);
  return (
    <article className="trip">
      <div className="trip-top">
        <h3>{t.name}</h3>
        {t.start && <span className="when">{dateRange(t.start, t.end)}</span>}
      </div>
      <div className="wmeta">
        {days != null && <span><b>{days} j</b></span>}
        {t.budget != null && <span><b>{euros(t.budget)}</b> au total</span>}
        {t.pricePerPerson != null && <span><b>{euros(t.pricePerPerson)}</b> / pers.</span>}
        {t.dailyPerPerson != null && <span><b>{euros(t.dailyPerPerson)}</b> / jour</span>}
      </div>
      <a href={t.url} target="_blank" rel="noopener">Ouvrir dans Notion ↗</a>
    </article>
  );
}
