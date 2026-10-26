import { useMemo, useState } from "react";
import { MONTH_LETTERS, MONTHS } from "../data/catalogue";
import { Sheet } from "../components/Sheet";
import { euros } from "../lib/format";
import { PRIORITIES, WISH_STATUSES, type Kids, type Priority, type Wish, type WishPatch } from "../shared/types";
import type { NotionData } from "../lib/useNotion";

export interface WishFilter {
  kids: Kids | null;
  priority: Priority | null;
  month: number;
}
export const NO_FILTER: WishFilter = { kids: null, priority: null, month: -1 };

const prioClass = (p: Priority | null) => `prio p${p ? PRIORITIES.indexOf(p) : 2}`;

export function WishesHeader({ filter: f, setFilter }: { filter: WishFilter; setFilter: (f: WishFilter) => void }) {
  const flip = <K extends keyof WishFilter>(k: K, v: WishFilter[K]) => setFilter({ ...f, [k]: f[k] === v ? NO_FILTER[k] : v });
  return (
    <div className="row-scroll" aria-label="Filtres">
      {(["Avec enfants", "Sans enfants"] as const).map((k) => (
        <button key={k} className={`pill${f.kids === k ? " on" : ""}`} aria-pressed={f.kids === k} onClick={() => flip("kids", k)}>{k}</button>
      ))}
      {PRIORITIES.map((p) => (
        <button key={p} className={`pill${f.priority === p ? " on" : ""}`} aria-pressed={f.priority === p} onClick={() => flip("priority", p)}>{p}</button>
      ))}
      <select className={`pill${f.month >= 0 ? " on" : ""}`} aria-label="Mois" value={f.month} onChange={(e) => setFilter({ ...f, month: Number(e.target.value) })}>
        <option value={-1}>Tous les mois</option>
        {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
      </select>
    </div>
  );
}

function MonthBar({ months, sel }: { months: number[]; sel?: number }) {
  return (
    <div className="mini" aria-label={months.length ? `Meilleurs mois : ${months.map((i) => MONTHS[i]).join(", ")}` : "Pas de mois indiqué"}>
      {MONTHS.map((_, i) => <i key={i} className={`${months.includes(i) ? "on" : ""}${sel === i ? " sel" : ""}`} />)}
    </div>
  );
}

export function Wishes({ notion, filter, onOpen }: { notion: NotionData; filter: WishFilter; onOpen: (id: string) => void }) {
  const list = useMemo(
    () =>
      notion.wishes
        .filter((w) => (!filter.kids || w.kids === filter.kids) && (!filter.priority || w.priority === filter.priority) && (filter.month < 0 || w.bestMonths.includes(filter.month)))
        .sort((a, b) => (a.priority ? PRIORITIES.indexOf(a.priority) : 3) - (b.priority ? PRIORITIES.indexOf(b.priority) : 3) || a.name.localeCompare(b.name, "fr")),
    [notion.wishes, filter],
  );
  return (
    <div className="screen">
      <div className="sum"><b>{list.length} envie{list.length > 1 ? "s" : ""}</b><span>sur {notion.wishes.length}</span></div>
      {notion.wishes.length === 0 && notion.state === "loading" && <div className="empty">Chargement de tes envies…</div>}
      {notion.wishes.length > 0 && list.length === 0 && <div className="empty">Aucune envie ne correspond à ces filtres.</div>}
      {notion.wishes.length === 0 && notion.state === "ok" && (
        <div className="empty">Ta liste est vide. Ajoute une destination depuis l'onglet Choisir.</div>
      )}
      {list.map((w) => (
        <button key={w.id} className="wish" onClick={() => onOpen(w.id)}>
          <div className="wish-top">
            <div>
              <h3>{w.name}</h3>
              <div className="sub">{[w.country, w.kids].filter(Boolean).join(" · ")}</div>
            </div>
            <span className={prioClass(w.priority)}>{w.priority ?? "—"}</span>
          </div>
          <MonthBar months={w.bestMonths} sel={filter.month >= 0 ? filter.month : undefined} />
          <div className="wmeta">
            <span><b>{w.idealDays ? `${w.idealDays} j` : "—"}</b> idéal</span>
            <span><b>{w.budget ? euros(w.budget) : "—"}</b> / pers.</span>
            {w.status && <span>{w.status}</span>}
          </div>
        </button>
      ))}
    </div>
  );
}

function Segments<T extends string>({ label, values, value, onPick }: { label: string; values: readonly T[]; value: T | null; onPick: (v: T) => void }) {
  return (
    <section>
      <div className="lbl">{label}</div>
      <div className="segs" role="radiogroup" aria-label={label}>
        {values.map((v) => (
          <button key={v} role="radio" aria-checked={value === v} onClick={() => value !== v && onPick(v)}>{v}</button>
        ))}
      </div>
    </section>
  );
}

export function WishSheet({ wish, onClose, notion, toast }: { wish: Wish | null; onClose: () => void; notion: NotionData; toast: (m: string) => void }) {
  const [last, setLast] = useState<Wish | null>(wish);
  if (wish && wish !== last) setLast(wish);
  const w = wish ?? last;

  const save = async (patch: WishPatch) => {
    if (!w) return;
    try {
      const sent = await notion.patchWish(w.id, patch);
      toast(sent ? "Enregistré dans Notion" : "Enregistré, envoyé à Notion au retour du réseau");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Modification impossible");
    }
  };

  return (
    <Sheet
      open={!!wish}
      title={w?.name ?? ""}
      onClose={onClose}
      footer={w?.url && <a className="btn ghost" href={w.url} target="_blank" rel="noopener">Ouvrir dans Notion ↗</a>}
    >
      {w && (
        <>
          {w.wants.length > 0 && <div className="tags">{w.wants.map((l) => <span key={l} className="tag">{l}</span>)}</div>}
          <Segments label="Priorité" values={PRIORITIES} value={w.priority} onPick={(priority) => save({ priority })} />
          <Segments label="Statut" values={WISH_STATUSES} value={w.status} onPick={(status) => save({ status })} />
          <section>
            <div className="lbl">Meilleurs mois</div>
            <MonthBar months={w.bestMonths} />
            <div className="ml" aria-hidden="true">{[...MONTH_LETTERS].map((c, i) => <span key={i}>{c}</span>)}</div>
          </section>
          <dl className="kv">
            <dt>Pays</dt><dd>{w.country || "—"}</dd>
            <dt>Durée idéale</dt><dd>{w.idealDays ? `${w.idealDays} jours` : "—"}</dd>
            <dt>Budget / pers.</dt><dd>{w.budget ? euros(w.budget) : "—"}</dd>
            <dt>Enfants</dt><dd>{w.kids ?? "—"}</dd>
            {w.notes && <><dt>Notes</dt><dd className="notes">{w.notes}</dd></>}
          </dl>
        </>
      )}
    </Sheet>
  );
}
