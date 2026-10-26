import { MONTHS, WANT_LABEL, type Level } from "../data/catalogue";
import { Sheet } from "../components/Sheet";
import { ScoreBreakdown, scoreRows } from "../components/ScoreBreakdown";
import { SeasonDots } from "../components/SeasonDots";
import { ProsCons } from "../components/ResultCard";
import { euros, flightTime } from "../lib/format";
import { explain, highlight, prosCons, rank, type Criteria, type Result } from "../lib/score";
import type { Trip, Wish } from "../shared/types";
import { skyGradient } from "../lib/sky";

function ProsList({ r, c, kind }: { r: Result; c: Criteria; kind: "pros" | "cons" }) {
  const items = prosCons(r, c)[kind];
  return items.length ? <>{items.map((t) => <small key={t} className={kind}>{kind === "pros" ? "+ " : "− "}{t}</small>)}</> : <>—</>;
}

export const resultKey = (r: Result) => (r.kind === "destination" ? r.destination.airport : r.wish.id);
export const resultName = (r: Result) => (r.kind === "destination" ? r.destination.name : r.wish.name);

function seasonOf(r: Result): Level[] {
  if (r.kind === "destination") return [...r.destination.season];
  return Array.from({ length: 12 }, (_, i) => (r.wish.bestMonths.length ? (r.wish.bestMonths.includes(i) ? 2 : 0) : 1) as Level);
}

const monthSpan = (months: readonly number[]) => {
  const s = [...months].sort((a, b) => a - b);
  return `${MONTHS[s[0]].toLowerCase()} à ${MONTHS[s[s.length - 1]].toLowerCase()}`;
};

interface DetailProps {
  result: Result | null;
  criteria: Criteria;
  onClose: () => void;
  comparing: boolean;
  onToggleCompare: () => void;
  onAdd?: () => void;
  onOpenWish: (id: string) => void;
}

export function DetailSheet({ result: r, criteria: c, onClose, comparing, onToggleCompare, onAdd, onOpenWish }: DetailProps) {
  const wish = r?.kind === "destination" ? r.wish : r?.wish;
  const trip = r?.kind === "destination" ? r.trip : undefined;
  return (
    <Sheet
      open={!!r}
      title={r ? resultName(r) : ""}
      onClose={onClose}
      footer={r && (
        <div className="foot-row">
          <button className="btn ghost" onClick={onToggleCompare}>{comparing ? "Retirer de la comparaison" : "Comparer"}</button>
          {r.kind === "destination" && !wish && onAdd && <button className="btn" onClick={onAdd}>Ajouter à mes envies</button>}
          {wish && <button className="btn" onClick={() => onOpenWish(wish.id)}>Voir l'envie</button>}
        </div>
      )}
    >
      {r && (
        <>
          <div className="detail-sky" style={{ "--sky": skyGradient(r.kind === "destination" ? r.destination.wants[0] : r.wants[0]) } as React.CSSProperties}>
            <span className="score"><b>{r.score}</b><small>sur 100</small></span>
          </div>
          <p className="pitch">{r.kind === "destination" ? r.destination.pitch : r.wish.notes || "Une idée de ta liste, hors catalogue."}</p>
          {highlight(r) && <p className="highlight">{highlight(r)}</p>}
          <ProsCons result={r} criteria={c} />
          <section>
            <div className="lbl">Pourquoi ce score</div>
            <ScoreBreakdown result={r} criteria={c} />
          </section>
          <section>
            <div className="lbl">Saison</div>
            <SeasonDots season={seasonOf(r)} months={c.months} />
            {r.kind === "destination" && r.destination.highlights && (
              <ul className="hl-list">
                {Object.entries(r.destination.highlights).map(([m, t]) => (
                  <li key={m} className={c.months.includes(Number(m)) ? "on" : ""}><b>{MONTHS[Number(m)]}</b> {t}</li>
                ))}
              </ul>
            )}
          </section>
          {r.kind === "destination" ? (
            <dl className="kv">
              <dt>Vol</dt>
              <dd>
                <span className="mono">CDG → {r.destination.airport}</span>, {flightTime(r.destination.flightHours)}{" "}
                {r.direct ? "sans escale" : "avec escale"}
                {r.destination.directMonths && <span className="dd-note">Direct de {monthSpan(r.destination.directMonths)} seulement</span>}
              </dd>
              <dt>Coût / pers.</dt>
              <dd>
                ≈ {euros(r.cost)}
                <span className="dd-note">Vol A/R {euros(r.destination.flightPrice)} + {c.days} j × {r.destination.dailyBudget} €</span>
              </dd>
              <dt>Affluence</dt><dd>{["Peu fréquenté", "Moyenne", "Très fréquenté"][r.destination.crowd]}</dd>
              <dt>Paludisme</dt><dd>{r.destination.malaria === true ? "Oui, demander un avis médical" : r.destination.malaria === "partiel" ? "Dans une partie du pays" : "Non"}</dd>
              <dt>Envies</dt><dd>{r.destination.wants.map((w) => WANT_LABEL[w]).join(", ")}</dd>
              {trip && <><dt>Déjà fait</dt><dd>{trip.start?.slice(0, 4)}{trip.url && <> · <a href={trip.url} target="_blank" rel="noopener">Notion ↗</a></>}</dd></>}
            </dl>
          ) : (
            <dl className="kv">
              <dt>Pays</dt><dd>{r.wish.country || "—"}</dd>
              <dt>Budget / pers.</dt><dd>{r.cost != null ? euros(r.cost) : "—"}</dd>
              <dt>Durée idéale</dt><dd>{r.idealDays ? `${r.idealDays} jours` : "—"}</dd>
            </dl>
          )}
          <p className="why">{explain(r, c)} Estimations depuis Paris, à vérifier avant de réserver.</p>
        </>
      )}
    </Sheet>
  );
}

interface CompareProps {
  open: boolean;
  results: Result[];
  criteria: Criteria;
  notion: { wishes: readonly Wish[]; trips: readonly Trip[] };
  onClose: () => void;
  onRemove: (key: string) => void;
}

/** Score de chaque destination si on partait tel mois, toutes choses égales par ailleurs. */
function MonthByMonth({ results, criteria: c, notion }: { results: Result[]; criteria: Criteria; notion: CompareProps["notion"] }) {
  const keys = results.map(resultKey);
  const grid = MONTHS.map((_, m) => {
    const ranked = rank({ ...c, months: [m], rules: c.rules.filter((r) => r !== "direct") }, notion).results;
    return keys.map((k) => ranked.find((r) => resultKey(r) === k)?.score ?? 0);
  });
  return (
    <section>
      <div className="lbl">Score selon le mois</div>
      <table className="cmp mbm">
        <thead><tr><th />{results.map((r) => <th key={resultKey(r)} scope="col">{resultName(r)}</th>)}</tr></thead>
        <tbody>
          {grid.map((row, m) => {
            const top = Math.max(...row);
            return (
              <tr key={m} className={c.months.includes(m) ? "sel" : ""}>
                <th scope="row">{MONTHS[m]}</th>
                {row.map((v, i) => <td key={keys[i]} className={v === top && row.some((x) => x !== v) ? "win" : ""}>{v}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="hint">Mêmes critères, en changeant seulement le mois. Les mois choisis sont surlignés.</p>
    </section>
  );
}

export function CompareSheet({ open, results, criteria: c, notion, onClose, onRemove }: CompareProps) {
  const rows = results.map((r) => scoreRows(r, c));
  const best = (vals: number[]) => Math.max(...vals);
  const line = (label: string, cells: (r: Result, i: number) => React.ReactNode) => (
    <tr><th scope="row">{label}</th>{results.map((r, i) => <td key={resultKey(r)}>{cells(r, i)}</td>)}</tr>
  );
  const scoreLine = (k: number) => {
    const vals = rows.map((rw) => rw[k].value);
    return (
      <tr key={k}>
        <th scope="row">{rows[0]?.[k].label} <small>/ {rows[0]?.[k].max}</small></th>
        {results.map((r, i) => (
          <td key={resultKey(r)} className={vals[i] === best(vals) && vals.some((v) => v !== vals[i]) ? "win" : ""}>
            {Math.round(vals[i])}
            <small>{rows[i][k].note}</small>
          </td>
        ))}
      </tr>
    );
  };
  return (
    <Sheet open={open} title="Comparer" onClose={onClose}>
      {results.length < 2 ? (
        <p className="empty">Ajoute au moins deux destinations avec « Comparer ».</p>
      ) : (
        <div className="cmp-wrap">
          <table className="cmp">
            <thead>
              <tr>
                <th />
                {results.map((r) => (
                  <th key={resultKey(r)} scope="col">
                    <span className="cmp-name">{resultName(r)}</span>
                    <button className="cmp-x" onClick={() => onRemove(resultKey(r))} aria-label={`Retirer ${resultName(r)}`}>×</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="cmp-total">
                <th scope="row">Score</th>
                {results.map((r) => <td key={resultKey(r)} className={r.score === Math.max(...results.map((x) => x.score)) ? "win" : ""}>{r.score}</td>)}
              </tr>
              {[0, 1, 2, 3, 4].map(scoreLine)}
              {line("Points forts", (r) => <ProsList r={r} c={c} kind="pros" />)}
              {line("Points faibles", (r) => <ProsList r={r} c={c} kind="cons" />)}
              {line("Bonus / malus", (r) => r.parts.adjustments.length ? r.parts.adjustments.map((a) => <small key={a.label}>{a.points > 0 ? "+" : "−"}{Math.abs(a.points)} {a.label}</small>) : "—")}
              {line("Coût / pers.", (r) => (r.cost != null ? `≈ ${euros(r.cost)}` : "—"))}
              {line("Vol", (r) => (r.kind === "destination" ? <>{flightTime(r.destination.flightHours)}<small>{r.direct ? "direct" : "avec escale"}</small></> : "—"))}
              {line("Paludisme", (r) => (r.kind === "destination" ? (r.destination.malaria === true ? "Oui" : r.destination.malaria ? "En partie" : "Non") : "—"))}
              {line("À ne pas manquer", (r) => highlight(r) ?? "—")}
            </tbody>
          </table>
          <MonthByMonth results={results} criteria={c} notion={notion} />
          <div className="cmp-seasons">
            {results.map((r) => (
              <div key={resultKey(r)}>
                <div className="lbl">{resultName(r)}</div>
                <SeasonDots season={seasonOf(r)} months={c.months} />
              </div>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  );
}
