import { euros, flightTime } from "../lib/format";
import { highlight, prosCons, type Criteria, type Result } from "../lib/score";
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
  onOpen: () => void;
  comparing: boolean;
  onToggleCompare: () => void;
}

export function ProsCons({ result, criteria, limit }: { result: Result; criteria: Criteria; limit?: number }) {
  let { pros, cons } = prosCons(result, criteria);
  if (limit) {
    // Peu de lignes sur la carte : les points faibles d'abord, le reste est dans le détail.
    cons = cons.slice(0, 1);
    pros = pros.slice(0, Math.max(1, limit - cons.length));
  }
  return (
    <ul className="pc">
      {pros.map((p) => <li key={p} className="pro"><span aria-label="Point fort">+</span>{p}</li>)}
      {cons.map((c) => <li key={c} className="con"><span aria-label="Point faible">−</span>{c}</li>)}
    </ul>
  );
}

const stop = (fn: () => void) => (e: React.MouseEvent) => {
  e.stopPropagation();
  fn();
};

export function ResultCard({ result: r, rank, criteria, onAdd, adding, onOpenWish, onOpen, comparing, onToggleCompare }: Props) {
  const wish = r.kind === "destination" ? r.wish : r.wish;
  const trip = r.kind === "destination" ? r.trip : undefined;
  const tags = r.kind === "destination" ? r.destination.wants : r.wants;
  const season = r.kind === "destination"
    ? r.destination.season
    : Array.from({ length: 12 }, (_, i) => (r.wish.bestMonths.length ? (r.wish.bestMonths.includes(i) ? 2 : 0) : 1) as 0 | 1 | 2);
  const flag = wish ? `Sur ta liste${wish.priority ? ` · ${wish.priority}` : ""}` : trip ? `Déjà fait en ${trip.start?.slice(0, 4) ?? "?"}` : null;

  return (
    <article className={`card${comparing ? " picked" : ""}`} onClick={onOpen}>
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
                {r.direct ? "sans escale" : "avec escale"}
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
        <SeasonDots season={season} months={criteria.months} />
        {highlight(r) && <p className="highlight">{highlight(r)}</p>}
        <ProsCons result={r} criteria={criteria} limit={3} />
        <div className="card-actions">
          {r.kind === "destination" && !wish && onAdd && (
            <button className="btn" onClick={stop(onAdd)} disabled={adding}>
              {adding ? "Ajout…" : "Ajouter à mes envies"}
            </button>
          )}
          {wish && onOpenWish && (
            <button className="btn ghost" onClick={stop(() => onOpenWish(wish.id))}>Voir l'envie</button>
          )}
          <button className={`btn cmp-toggle${comparing ? " on" : ""}`} aria-pressed={comparing} onClick={stop(onToggleCompare)}>
            {comparing ? "✓ Comparer" : "+ Comparer"}
          </button>
        </div>
      </div>
    </article>
  );
}
