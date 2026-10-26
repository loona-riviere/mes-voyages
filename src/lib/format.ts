export const roundTo50 = (n: number) => Math.round(n / 50) * 50;

export const euros = (n: number) => `${roundTo50(n).toLocaleString("fr-FR")} €`;

export function flightTime(h: number): string {
  const H = Math.floor(h);
  const M = Math.round((h - H) * 60);
  return M ? `${H} h ${String(M).padStart(2, "0")}` : `${H} h`;
}

const short: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };

/** « 2 → 16 août » ou « 28 sept. → 4 oct. » */
export function dateRange(start: string, end: string | null): string {
  const a = new Date(start);
  if (!end) return a.toLocaleDateString("fr-FR", short);
  const b = new Date(end);
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} → ${b.toLocaleDateString("fr-FR", short)}`
    : `${a.toLocaleDateString("fr-FR", short)} → ${b.toLocaleDateString("fr-FR", short)}`;
}

export function ago(ts: number): string {
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}
