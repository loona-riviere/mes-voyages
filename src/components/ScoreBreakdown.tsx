import { MONTHS, WANT_LABEL } from "../data/catalogue";
import { euros } from "../lib/format";
import { WEIGHTS, type Criteria, type Result } from "../lib/score";

const SEASON = ["mauvaise saison", "saison correcte", "très bonne saison"];

/** Lignes du score : ce que chaque critère rapporte sur son maximum. */
export function scoreRows(r: Result, c: Criteria) {
  const p = r.parts;
  const month = MONTHS[r.month].toLowerCase();
  return [
    { label: "Saison", value: p.season, max: WEIGHTS.season, note: r.kind === "wish" && !r.wish.bestMonths.length ? "pas de mois dans Notion" : `${SEASON[r.season]} en ${month}` },
    {
      label: "Envies", value: p.wants, max: WEIGHTS.wants,
      note: c.wants.length ? (r.hits.length ? r.hits.map((h) => WANT_LABEL[h]).join(", ") : "aucune ne colle") : "aucune envie choisie",
    },
    {
      label: "Budget", value: p.budget, max: WEIGHTS.budget,
      note: r.cost == null ? "pas de budget dans Notion" : r.over > 0 ? `≈ ${euros(r.cost)}, ${Math.round(r.over * 100)} % au-dessus` : `≈ ${euros(r.cost)}, dans le budget`,
    },
    {
      label: "Durée", value: p.duration, max: WEIGHTS.duration,
      note: r.kind === "destination" ? `${r.minDays} j conseillés pour ce trajet` : r.idealDays ? `${r.idealDays} j idéal (Notion)` : "pas de durée dans Notion",
    },
    {
      label: "Calme", value: p.crowd, max: WEIGHTS.crowd,
      note: !c.rules.includes("calm") ? "non demandé, points offerts" : r.kind === "destination" ? ["peu fréquenté", "affluence moyenne", "très fréquenté"][r.destination.crowd] : "inconnu",
    },
  ];
}

export function ScoreBreakdown({ result: r, criteria: c }: { result: Result; criteria: Criteria }) {
  return (
    <div className="breakdown">
      {scoreRows(r, c).map((row) => (
        <div key={row.label} className="bd-row">
          <div className="bd-top">
            <span>{row.label}</span>
            <b>{Math.round(row.value)}<small> / {row.max}</small></b>
          </div>
          <div className="bd-bar"><i style={{ transform: `scaleX(${row.value / row.max})` }} /></div>
          <div className="bd-note">{row.note}</div>
        </div>
      ))}
      {r.parts.adjustments.map((a) => (
        <div key={a.label} className="bd-adj">
          <span>{a.label}</span>
          <b className={a.points < 0 ? "neg" : "pos"}>{a.points > 0 ? "+" : "−"}{Math.abs(a.points)}</b>
        </div>
      ))}
      <div className="bd-total">
        <span>Score</span>
        <b>{r.score}<small> / 100</small></b>
      </div>
      {Math.round(r.points) > 100 && <p className="hint">Plafonné à 100 (total brut : {Math.round(r.points)}).</p>}
    </div>
  );
}
