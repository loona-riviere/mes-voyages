import { useEffect, useMemo, useState } from "react";
import { MONTH_LETTERS, MONTHS, WANTS } from "../data/catalogue";
import { Sheet } from "../components/Sheet";
import { euros } from "../lib/format";
import { PRIORITIES, WISH_STATUSES, type Kids, type Priority, type Wish, type WishPatch } from "../shared/types";
import type { NotionData } from "../lib/useNotion";

export interface WishFilter {
  kids: Kids | null;
  /** "none" = envies sans priorité */
  priority: Priority | "none" | null;
  month: number;
}
export const NO_FILTER: WishFilter = { kids: null, priority: null, month: -1 };
export const isFiltered = (f: WishFilter) => f.kids !== null || f.priority !== null || f.month >= 0;

export function matchesFilter(w: Wish, f: WishFilter): boolean {
  if (f.kids && w.kids !== f.kids) return false;
  if (f.priority === "none" ? w.priority !== null : f.priority && w.priority !== f.priority) return false;
  return f.month < 0 || w.bestMonths.includes(f.month);
}

const prioClass = (p: Priority | null) => `prio p${p ? PRIORITIES.indexOf(p) : 2}`;

export function WishesHeader({ filter: f, setFilter }: { filter: WishFilter; setFilter: (f: WishFilter) => void }) {
  return (
    <div className="row-scroll" aria-label="Filtres">
      <select className={`pill${f.priority ? " on" : ""}`} aria-label="Priorité" value={f.priority ?? ""}
        onChange={(e) => setFilter({ ...f, priority: (e.target.value || null) as WishFilter["priority"] })}>
        <option value="">Toutes les priorités</option>
        {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        <option value="none">Sans priorité</option>
      </select>
      <select className={`pill${f.kids ? " on" : ""}`} aria-label="Enfants" value={f.kids ?? ""}
        onChange={(e) => setFilter({ ...f, kids: (e.target.value || null) as Kids | null })}>
        <option value="">Avec ou sans enfants</option>
        <option value="Sans enfants">À faire sans enfants</option>
        <option value="Avec enfants">Avec enfants</option>
      </select>
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

export type WishFormState = { mode: "new" } | { mode: "edit"; id: string } | null;

export function Wishes({ notion, filter, setFilter, onOpen, onNew }: {
  notion: NotionData; filter: WishFilter; setFilter: (f: WishFilter) => void; onOpen: (id: string) => void; onNew: () => void;
}) {
  const list = useMemo(
    () =>
      notion.wishes
        .filter((w) => matchesFilter(w, filter))
        .sort((a, b) => (a.priority ? PRIORITIES.indexOf(a.priority) : 3) - (b.priority ? PRIORITIES.indexOf(b.priority) : 3) || a.name.localeCompare(b.name, "fr")),
    [notion.wishes, filter],
  );
  return (
    <div className="screen">
      <div className="sum">
        <b>{list.length} envie{list.length > 1 ? "s" : ""}</b>
        {isFiltered(filter)
          ? <button className="reset" onClick={() => setFilter(NO_FILTER)}>Effacer les filtres ({notion.wishes.length - list.length} masquées)</button>
          : <span>toutes tes envies</span>}
      </div>
      <button className="add-proj" onClick={onNew}>+ Nouvelle envie</button>
      {notion.wishes.length === 0 && notion.state === "loading" && <div className="empty">Chargement de tes envies…</div>}
      {notion.wishes.length > 0 && list.length === 0 && <div className="empty">Aucune envie ne correspond à ces filtres.</div>}
      {notion.wishes.length === 0 && notion.state === "ok" && (
        <div className="empty">Ta liste est vide. Ajoute une envie avec le bouton ci-dessus, ou depuis l'onglet Choisir.</div>
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

export function WishSheet({ wish, onClose, notion, toast, onEdit, onPlanned }: { wish: Wish | null; onClose: () => void; notion: NotionData; toast: (m: string) => void; onEdit: (id: string) => void; onPlanned: () => void }) {
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

  const plan = async () => {
    if (!w) return;
    try {
      await notion.saveTrip({ name: w.name, status: "À planifier" });
      await notion.patchWish(w.id, { status: "Planifié" });
      toast("Voyage créé : ajoute les dates et les réservations");
      onClose();
      onPlanned();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Création impossible");
    }
  };

  return (
    <Sheet
      open={!!wish}
      title={w?.name ?? ""}
      onClose={onClose}
      footer={w && (
        <div className="foot-row">
          <button className="btn ghost" onClick={() => { onClose(); onEdit(w.id); }}>Modifier</button>
          <button className="btn primary" disabled={notion.state === "offline"} onClick={plan}>Planifier un voyage</button>
        </div>
      )}
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
          {w.url && <a className="link" href={w.url} target="_blank" rel="noopener">Ouvrir dans Notion ↗</a>}
        </>
      )}
    </Sheet>
  );
}

const num = (s: string) => (s.trim() === "" ? null : Math.max(0, Number(s.replace(",", ".")) || 0));
const flip = <T,>(list: readonly T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const KIDS_VALUES = ["Sans enfants", "Avec enfants"] as const;

export function WishForm({ state, onClose, notion, toast }: { state: WishFormState; onClose: () => void; notion: NotionData; toast: (m: string) => void }) {
  const wish = state?.mode === "edit" ? notion.wishes.find((w) => w.id === state.id) : undefined;
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [wants, setWants] = useState<string[]>([]);
  const [months, setMonths] = useState<number[]>([]);
  const [days, setDays] = useState("");
  const [budget, setBudget] = useState("");
  const [kids, setKids] = useState<Kids | null>(null);
  const [priority, setPriority] = useState<Priority>("Envie");
  const [status, setStatus] = useState<Wish["status"]>("Idée");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!state) return;
    setName(wish?.name ?? ""); setCountry(wish?.country ?? ""); setWants(wish?.wants ?? []); setMonths(wish?.bestMonths ?? []);
    setDays(wish?.idealDays != null ? String(wish.idealDays) : ""); setBudget(wish?.budget != null ? String(wish.budget) : "");
    setKids(wish?.kids ?? null); setPriority(wish?.priority ?? "Envie"); setStatus(wish?.status ?? "Idée"); setNotes(wish?.notes ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, wish?.id]);

  const run = async (fn: () => Promise<boolean | void>, done: string) => {
    setBusy(true);
    try {
      const sent = await fn();
      toast(sent === false ? "Enregistré ici, envoyé à Notion au retour du réseau" : done);
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  };
  const fields = { name: name.trim(), country: country.trim(), wants, bestMonths: months, idealDays: num(days), budget: num(budget), kids, notes: notes.trim() };

  return (
    <Sheet open={!!state} title={wish ? "Modifier l'envie" : "Nouvelle envie"} onClose={onClose}
      footer={
        <div className="foot-row">
          {wish && (
            <button className="btn ghost" disabled={busy || notion.state === "offline"}
              onClick={() => window.confirm(`Supprimer « ${wish.name} » ?`) && void run(() => notion.deleteWish(wish.id), "Envie supprimée")}>Supprimer</button>
          )}
          <button className="btn primary" disabled={busy || !name.trim()}
            onClick={() => run(async () => wish ? notion.patchWish(wish.id, { ...fields, priority, ...(status ? { status } : {}) }) : notion.addWish({ ...fields, priority, ...(status ? { status } : {}) }), wish ? "Envie mise à jour" : "Envie ajoutée")}>
            {busy ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      }>
      <section>
        <label className="lbl" htmlFor="wfName">Destination</label>
        <input id="wfName" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Japon" autoComplete="off" />
      </section>
      <section>
        <label className="lbl" htmlFor="wfCountry">Pays</label>
        <input id="wfCountry" className="field" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Facultatif" autoComplete="off" />
      </section>
      <section>
        <div className="lbl">Ce qu'on y cherche</div>
        <div className="chips">
          {WANTS.map((w) => <button key={w.key} type="button" className="chip" aria-pressed={wants.includes(w.label)} onClick={() => setWants(flip(wants, w.label))}>{w.label}</button>)}
        </div>
      </section>
      <section>
        <div className="lbl">Meilleurs mois</div>
        <div className="chips">
          {MONTHS.map((m, i) => <button key={m} type="button" className="chip" aria-pressed={months.includes(i)} onClick={() => setMonths(flip(months, i).sort((a, b) => a - b))}>{m.slice(0, 4)}{m.length > 4 ? "." : ""}</button>)}
        </div>
      </section>
      <section className="two">
        <div><label className="lbl" htmlFor="wfDays">Durée idéale (j)</label><input id="wfDays" className="field" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} /></div>
        <div><label className="lbl" htmlFor="wfBudget">Budget / pers. (€)</label><input id="wfBudget" className="field" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} /></div>
      </section>
      <Segments label="Priorité" values={PRIORITIES} value={priority} onPick={setPriority} />
      <Segments label="Statut" values={WISH_STATUSES} value={status} onPick={setStatus} />
      <section>
        <div className="lbl">Enfants</div>
        <div className="segs" role="radiogroup" aria-label="Enfants">
          {KIDS_VALUES.map((k) => <button key={k} role="radio" aria-checked={kids === k} onClick={() => setKids(kids === k ? null : k)}>{k}</button>)}
        </div>
      </section>
      <section>
        <label className="lbl" htmlFor="wfNotes">Notes</label>
        <textarea id="wfNotes" className="field textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Pourquoi cette envie, idées d'itinéraire…" />
      </section>
    </Sheet>
  );
}
