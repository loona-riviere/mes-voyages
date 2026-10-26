import { WANT_LABEL, type Want } from "../data/catalogue";
import { euros, flightTime } from "../lib/format";
import { explain, type Criteria, type Result } from "../lib/score";
import { skyGradient } from "../lib/sky";
import { SeasonDots } from "./SeasonDots";

const CROWD = ["Peu fréquenté", "Affluence moyenne", "Très fréquenté"];

interface Props {
  result: Result;
  rank: number;
  criteria: Criteria;
  onAdd?: () => void;
  adding?: boolean;
  onOpenWish?: (id: string) => void;
}

function Tags({ tags, hits }: { tags: readonly Want[]; hits: readonly Want[] }) {
  return (
    <div className="tags">
      {tags.map((t) => (
        <span key={t} className={`tag${hits.includes(t) ? " hit" : ""}`}>{WANT_LABEL[t]}</span>
      ))}
    </div>
  );
}

export function ResultCard({ result: r, rank, criteria, onAdd, adding, onOpenWish }: Props) {
  const wish = r.kind === "destination" ? r.wish : r.wish;
  const trip = r.kind === "destination" ? r.trip : undefined;
  const tags = r.kind === "destination" ? r.destination.wants : r.wants;
  const season = r.kind === "destination"
    ? r.destination.season
    : Array.from({ length: 12 }, (_, i) => (r.wish.bestMonths.length ? (r.wish.bestMonths.includes(i) ? 2 : 0) : 1) as 0 | 1 | 2);
  const flag = wish ? `Sur ta liste${wish.priority ? ` · ${wish.priority}` : ""}` : trip ? `Déjà fait en ${trip.start?.slice(0, 4) ?? "?"}` : null;

  return (
    <article className="card">
      <div className="sky" style={{ "--sky": skyGradient(tags[0]) } as React.CSSProperties}>
        {flag ? <span className="flag">{flag}</span> : <span className="rank">n° {rank}</span>}
        <span className="score" aria-label={`Score ${r.score} sur 100`}>
          <b>{r.score}</b>
          <small>sur 100</small>
        </span>
      </div>
      <div className="card-in">
        <div>
          <h2 className="name">{r.kind === "destination" ? r.destination.name : r.wish.name}</h2>
          <div className="sub">
            {r.kind === "destination" ? (
              <>
                <span className="mono">CDG → {r.destination.airport}</span> · {flightTime(r.destination.flightHours)}{" "}
                {r.destination.direct ? "sans escale" : "avec escale"}
              </>
            ) : (
              r.wish.country || "Sur ta liste d'envies"
            )}
            {wish && trip && <span className="flag-inline">Déjà fait en {trip.start?.slice(0, 4)}</span>}
          </div>
        </div>
        <p className="pitch">{r.kind === "destination" ? r.destination.pitch : r.wish.notes || "Une idée de ta liste, hors catalogue."}</p>
        <div className="facts">
          <span className={r.over > 0 ? "over" : ""}>
            {r.cost != null ? <>≈ <b>{euros(r.cost)}</b> / pers.</> : "Budget à estimer"}
          </span>
          {r.kind === "destination" ? (
            <>
              <span>{CROWD[r.destination.crowd]}</span>
              <span><b>{r.minDays} j</b> conseillés</span>
            </>
          ) : (
            r.idealDays != null && <span>Idéal : <b>{r.idealDays} j</b></span>
          )}
        </div>
        <SeasonDots season={season} month={criteria.month} />
        <Tags tags={tags} hits={r.hits} />
        <p className="why">{explain(r, criteria)}</p>
        {r.kind === "destination" && !wish && onAdd && (
          <button className="btn" onClick={onAdd} disabled={adding}>
            {adding ? "Ajout…" : "Ajouter à mes envies"}
          </button>
        )}
        {wish && onOpenWish && (
          <button className="btn ghost" onClick={() => onOpenWish(wish.id)}>Voir dans mes envies</button>
        )}
      </div>
    </article>
  );
}
