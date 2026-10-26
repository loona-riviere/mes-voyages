import { MONTH_LETTERS, MONTHS, type Level } from "../data/catalogue";

/** Frise de 12 pastilles : vide = mauvaise saison, claire = correcte, pleine = idéale. */
export function SeasonDots({ season, months = [] }: { season: readonly Level[]; months?: readonly number[] }) {
  const label = season.map((v, i) => `${MONTHS[i]} ${["à éviter", "correct", "idéal"][v]}`).join(", ");
  return (
    <div className="dots" role="img" aria-label={`Saisonnalité : ${label}`}>
      {season.map((v, i) => (
        <span key={i} className={`v${v}${months.includes(i) ? " sel" : ""}`}>
          <i />
          {MONTH_LETTERS[i]}
        </span>
      ))}
    </div>
  );
}
