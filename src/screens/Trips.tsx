import { useMemo, useState } from "react";
import { Sheet } from "../components/Sheet";
import { DEFAULT_CHECKLIST, parseChecklist, serializeChecklist } from "../lib/checklist";
import { MONTHS } from "../data/catalogue";
import { dateRange, euros } from "../lib/format";
import type { ReservationInput } from "../lib/queue";
import type { NotionData } from "../lib/useNotion";
import { LODGING_TYPES, TRANSPORT_TYPES, type Lodging, type LodgingType, type Transport, type TransportType, type Trip, type TripStatus } from "../shared/types";

const STATUSES: TripStatus[] = ["À planifier", "En cours", "Visité"];
const tripDays = (t: Trip) =>
  t.days ?? (t.start && t.end ? Math.round((Date.parse(t.end) - Date.parse(t.start)) / 864e5) + 1 : null);
const byStart = (a: Trip, b: Trip) => String(a.start ?? "9999").localeCompare(String(b.start ?? "9999"));
const exact = (e: unknown) => (e instanceof Error ? e.message : "Enregistrement impossible");
const SAVED_LATER = "Enregistré ici, envoyé à Notion au retour du réseau";
const today = () => new Date().toISOString().slice(0, 10);
const num = (s: string) => (s.trim() === "" ? null : Math.max(0, Number(s.replace(",", ".")) || 0));
const dayDiff = (iso: string) => Math.round((Date.parse(iso) - Date.parse(today())) / 864e5);

/** Texte du compte à rebours, ou null pour un voyage sans date ou déjà fait. */
export function countdown(t: Pick<Trip, "status" | "start" | "end">): string | null {
  if (t.status === "Visité" || !t.start) return null;
  const d = dayDiff(t.start);
  if (d > 1) return `Dans ${d} jours`;
  if (d === 1) return "Demain";
  if (d === 0) return "Départ aujourd'hui";
  if (t.end && dayDiff(t.end) >= 0) return `Jour ${-d + 1}`;
  return null;
}

type Form = { mode: "new" } | { mode: "view"; id: string } | null;

export function Trips({ notion, toast }: { notion: NotionData; toast: (m: string) => void }) {
  const [form, setForm] = useState<Form>(null);
  const [view, setView] = useState<"list" | "calendar">("list");
  const { current, upcoming, done, byYear } = useMemo(() => {
    const all = [...notion.trips];
    const done = all.filter((t) => t.status === "Visité").sort((a, b) => byStart(b, a));
    const byYear = new Map<string, Trip[]>();
    for (const t of done) {
      const y = t.start?.slice(0, 4) ?? "Sans date";
      byYear.set(y, [...(byYear.get(y) ?? []), t]);
    }
    return {
      current: all.filter((t) => t.status === "En cours").sort(byStart),
      upcoming: all.filter((t) => t.status === "À planifier").sort(byStart),
      done, byYear,
    };
  }, [notion.trips]);

  const totalDays = done.reduce((s, t) => s + (tripDays(t) ?? 0), 0);
  const totalBudget = done.reduce((s, t) => s + (t.budget ?? 0), 0);
  const card = (t: Trip) => <TripItem key={t.id} t={t} notion={notion} onOpen={() => setForm({ mode: "view", id: t.id })} />;

  return (
    <div className="screen">
      <div className="stats">
        <div className="stat"><small>Voyages faits</small><b>{done.length}</b></div>
        <div className="stat"><small>Jours</small><b>{totalDays}</b></div>
        <div className="stat"><small>Budget</small><b>{totalBudget >= 1000 ? `${Math.round(totalBudget / 1000)} k€` : euros(totalBudget)}</b></div>
      </div>
      {notion.trips.length === 0 && notion.state === "loading" && <div className="empty">Chargement de tes voyages…</div>}
      <button className="add-proj" onClick={() => setForm({ mode: "new" })}>+ Nouveau voyage</button>
      {notion.trips.length > 0 && (
        <div className="segs" role="radiogroup" aria-label="Affichage">
          <button role="radio" aria-checked={view === "list"} onClick={() => setView("list")}>Liste</button>
          <button role="radio" aria-checked={view === "calendar"} onClick={() => setView("calendar")}>Calendrier</button>
        </div>
      )}
      {view === "calendar" && <YearCalendar trips={notion.trips} onOpen={(id) => setForm({ mode: "view", id })} />}
      {view === "list" && <>{current.length > 0 && (<><div className="year">En cours</div><div className="timeline">{current.map(card)}</div></>)}
      {upcoming.length > 0 && (<><div className="year">À venir</div><div className="timeline">{upcoming.map(card)}</div></>)}
      {notion.state === "ok" && notion.trips.length === 0 && <div className="empty">Aucun voyage pour l'instant. Ajoute-en un avec le bouton ci-dessus, même un voyage déjà fait.</div>}
      {[...byYear].map(([year, trips]) => (
        <div key={year}>
          <div className="year">{year}</div>
          <div className="timeline">{trips.map(card)}</div>
        </div>
      ))}</>}
      <TripSheet form={form} onClose={() => setForm(null)} notion={notion} toast={toast} />
    </div>
  );
}

function YearCalendar({ trips, onOpen }: { trips: Trip[]; onOpen: (id: string) => void }) {
  const years = useMemo(() => {
    const ys = new Set<number>([new Date().getFullYear()]);
    for (const t of trips) for (const d of [t.start, t.end]) if (d) ys.add(Number(d.slice(0, 4)));
    return [...ys].sort((a, b) => a - b);
  }, [trips]);
  const [year, setYear] = useState(() => {
    const next = trips.filter((t) => t.status !== "Visité" && t.start).sort(byStart)[0];
    return next?.start ? Number(next.start.slice(0, 4)) : new Date().getFullYear();
  });
  const touches = (t: Trip, m: number) => {
    if (!t.start) return false;
    const a = Date.parse(t.start);
    const b = Date.parse(t.end ?? t.start);
    return a < Date.UTC(year, m + 1, 1) && b >= Date.UTC(year, m, 1);
  };
  return (
    <div className="cal">
      <div className="segs" role="radiogroup" aria-label="Année">
        {years.map((y) => <button key={y} role="radio" aria-checked={year === y} onClick={() => setYear(y)}>{y}</button>)}
      </div>
      {MONTHS.map((m, i) => {
        const here = trips.filter((t) => touches(t, i)).sort(byStart);
        return (
          <div key={m} className="cal-row">
            <span className="cal-m">{m.slice(0, 4)}{m.length > 4 ? "." : ""}</span>
            <span className="cal-t">
              {here.length === 0 && <i className="cal-empty">—</i>}
              {here.map((t) => (
                <button key={t.id} className={`cal-chip s${STATUSES.indexOf(t.status as TripStatus)}`} onClick={() => onOpen(t.id)}>
                  {t.name}{t.start ? ` · ${dateRange(t.start, t.end)}` : ""}
                </button>
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const Stars = ({ value, onChange }: { value: number | null; onChange?: (n: number | null) => void }) => (
  <span className="stars" role={onChange ? "radiogroup" : undefined} aria-label="Note">
    {[1, 2, 3, 4, 5].map((n) => (
      <button key={n} type="button" disabled={!onChange} aria-label={`${n} sur 5`} aria-pressed={(value ?? 0) >= n}
        onClick={() => onChange?.(value === n ? null : n)}>★</button>
    ))}
  </span>
);

function TripItem({ t, notion, onOpen }: { t: Trip; notion: NotionData; onOpen: () => void }) {
  const days = tripDays(t);
  const flights = notion.transports.filter((x) => x.tripId === t.id).length;
  const lodgings = notion.lodgings.filter((x) => x.tripId === t.id).length;
  const cd = countdown(t);
  return (
    <article className="trip" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen()}>
      <div className="trip-top">
        <h3>{t.name}</h3>
        {t.start && <span className="when">{dateRange(t.start, t.end)}</span>}
      </div>
      {cd && <div className="countdown">{cd}</div>}
      <div className="wmeta">
        {days != null && <span><b>{days} j</b></span>}
        {t.budget != null && <span><b>{euros(t.budget)}</b> au total</span>}
        {t.pricePerPerson != null && <span><b>{euros(t.pricePerPerson)}</b> / pers.</span>}
        {t.dailyPerPerson != null && <span><b>{euros(t.dailyPerPerson)}</b> / jour</span>}
        {t.status === "Visité" && t.rating != null && <Stars value={t.rating} />}
        {t.status !== "Visité" && <span>{flights} vol{flights > 1 ? "s" : ""} · {lodgings} logement{lodgings > 1 ? "s" : ""}</span>}
      </div>
    </article>
  );
}

const when = (s: string | null) => (s ? new Date(s).toLocaleString("fr-FR", { day: "numeric", month: "short", ...(s.length > 10 ? { hour: "2-digit", minute: "2-digit" } : {}) }) : "");

type Adding = { kind: "transport" | "lodging"; editId?: string } | null;

function TripSheet({ form, onClose, notion, toast }: { form: Form; onClose: () => void; notion: NotionData; toast: (m: string) => void }) {
  const trip = form?.mode === "view" ? notion.trips.find((t) => t.id === form.id) : undefined;
  const [adding, setAdding] = useState<Adding>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [budget, setBudget] = useState("");
  const [status, setStatus] = useState<TripStatus>("À planifier");
  const [rating, setRating] = useState<number | null>(null);
  const [memories, setMemories] = useState("");

  const load = (t?: Trip) => {
    setName(t?.name ?? ""); setStart(t?.start ?? ""); setEnd(t?.end ?? ""); setBudget(t?.budget != null ? String(t.budget) : "");
    setStatus(t?.status === "À visiter" || !t?.status ? "À planifier" : t.status); setRating(t?.rating ?? null); setMemories(t?.memories ?? "");
  };
  const [loaded, setLoaded] = useState<string | null>(null);
  const key = form?.mode === "view" ? form.id : form?.mode ?? null;
  if (key !== loaded) { setLoaded(key); setAdding(null); setEditing(false); load(trip); }

  const close = () => { setAdding(null); setEditing(false); onClose(); };
  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e) { toast(exact(e)); } finally { setBusy(false); }
  };
  const offline = notion.state === "offline";
  const fields = { name: name.trim(), start: start || null, end: end || null, budget: num(budget), status, rating: status === "Visité" ? rating : null, memories: memories.trim() };

  const editor = (
    <>
      <section>
        <label className="lbl" htmlFor="tName">Nom</label>
        <input id="tName" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Marrakech" autoComplete="off" />
      </section>
      <section className="two">
        <div><label className="lbl" htmlFor="tStart">Départ</label><input id="tStart" type="date" className="field" value={start} onChange={(e) => setStart(e.target.value)} /></div>
        <div><label className="lbl" htmlFor="tEnd">Retour</label><input id="tEnd" type="date" className="field" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
      </section>
      <section>
        <div className="lbl">Statut</div>
        <div className="segs" role="radiogroup" aria-label="Statut du voyage">
          {STATUSES.map((s) => <button key={s} role="radio" aria-checked={status === s} onClick={() => setStatus(s)}>{s}</button>)}
        </div>
      </section>
      <section>
        <label className="lbl" htmlFor="tBudget">Budget total (€)</label>
        <input id="tBudget" className="field" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Facultatif" />
      </section>
      {status === "Visité" && (
        <>
          <section><div className="lbl">Note</div><Stars value={rating} onChange={setRating} /></section>
          <section>
            <label className="lbl" htmlFor="tMem">Souvenirs</label>
            <textarea id="tMem" className="field textarea" value={memories} onChange={(e) => setMemories(e.target.value)} placeholder="Ce qu'on a aimé, ce qu'on referait, les bonnes adresses…" />
          </section>
        </>
      )}
      {offline && <p className="hint">Modifier un voyage nécessite le réseau. Les vols et logements, eux, peuvent s'ajouter hors ligne.</p>}
    </>
  );

  if (form?.mode === "new") {
    return (
      <Sheet open title="Nouveau voyage" onClose={close}
        footer={<button className="btn primary" disabled={busy || !name.trim() || offline}
          onClick={() => guard(async () => { await notion.saveTrip(fields); toast("Voyage créé"); close(); })}>Créer le voyage</button>}>
        {editor}
      </Sheet>
    );
  }

  const transports = trip ? notion.transports.filter((x) => x.tripId === trip.id).sort((a, b) => String(a.start ?? "").localeCompare(String(b.start ?? ""))) : [];
  const lodgings = trip ? notion.lodgings.filter((x) => x.tripId === trip.id).sort((a, b) => String(a.start ?? "").localeCompare(String(b.start ?? ""))) : [];
  const cd = trip ? countdown(trip) : null;

  const saveRes = (r: ReservationInput) => guard(async () => {
    if (adding?.editId) { await notion.updateReservation(r, adding.editId); toast("Modifié"); }
    else toast((await notion.addReservation(r)) ? (r.kind === "transport" ? "Transport ajouté" : "Logement ajouté") : SAVED_LATER);
    setAdding(null);
  });
  const remove = (kind: "transport" | "lodging", id: string, label: string) => {
    if (!window.confirm(`Supprimer « ${label} » ?`)) return;
    void guard(async () => { await notion.deleteReservation(kind, id); toast("Supprimé"); });
  };
  const editT = adding?.kind === "transport" && adding.editId ? transports.find((x) => x.id === adding.editId) : undefined;
  const editL = adding?.kind === "lodging" && adding.editId ? lodgings.find((x) => x.id === adding.editId) : undefined;

  return (
    <Sheet open={!!trip} title={trip?.name ?? ""} onClose={close}
      footer={editing ? (
        <div className="foot-row">
          <button className="btn ghost" onClick={() => { load(trip); setEditing(false); }}>Annuler</button>
          <button className="btn primary" disabled={busy || !name.trim() || offline}
            onClick={() => guard(async () => { await notion.saveTrip(fields, trip!.id); toast("Voyage mis à jour"); setEditing(false); })}>Enregistrer</button>
        </div>
      ) : undefined}>
      {trip && editing && editor}
      {trip && !editing && (
        <>
          <section>
            {cd && <div className="countdown big">{cd}</div>}
            <p className="hint" style={{ marginTop: 0 }}>
              {trip.status} {trip.start ? `· ${dateRange(trip.start, trip.end)}` : ""}{tripDays(trip) != null ? ` · ${tripDays(trip)} jours` : ""}
            </p>
            {trip.budget != null && <p className="hint">Budget prévu : {euros(trip.budget)}</p>}
            {trip.status === "Visité" && <Stars value={trip.rating} />}
            {trip.memories && <p className="memo">{trip.memories}</p>}
            <button className="btn ghost" onClick={() => { load(trip); setEditing(true); }}>Modifier le voyage</button>
          </section>
          {trip.status !== "Visité" && <Checklist trip={trip} notion={notion} toast={toast} />}
          <section>
            <div className="lbl">Vols et transports</div>
            {transports.length === 0 && <p className="hint">Rien d'enregistré.</p>}
            {transports.map((x) => (
              <TransportRow key={x.id} x={x} disabled={offline || busy}
                onEdit={() => setAdding({ kind: "transport", editId: x.id })} onDelete={() => remove("transport", x.id, x.name)} />
            ))}
            {adding?.kind === "transport" ? (
              <TransportForm key={adding.editId ?? "new"} tripId={trip.id} initial={editT} busy={busy} onCancel={() => setAdding(null)} onSave={saveRes} />
            ) : <button className="add-proj" onClick={() => setAdding({ kind: "transport" })}>+ Ajouter un vol ou un transport</button>}
          </section>
          <section>
            <div className="lbl">Logements</div>
            {lodgings.length === 0 && <p className="hint">Rien d'enregistré.</p>}
            {lodgings.map((x) => (
              <LodgingRow key={x.id} x={x} disabled={offline || busy}
                onEdit={() => setAdding({ kind: "lodging", editId: x.id })} onDelete={() => remove("lodging", x.id, x.name)} />
            ))}
            {adding?.kind === "lodging" ? (
              <LodgingForm key={adding.editId ?? "new"} tripId={trip.id} initial={editL} busy={busy} onCancel={() => setAdding(null)} onSave={saveRes} />
            ) : <button className="add-proj" onClick={() => setAdding({ kind: "lodging" })}>+ Ajouter un logement</button>}
          </section>
          {trip.url && <a className="link" href={trip.url} target="_blank" rel="noopener">Ouvrir dans Notion ↗</a>}
        </>
      )}
    </Sheet>
  );
}

function Checklist({ trip, notion, toast }: { trip: Trip; notion: NotionData; toast: (m: string) => void }) {
  const items = parseChecklist(trip.checklist);
  const [text, setText] = useState("");
  const save = async (next: typeof items) => {
    try { await notion.saveTrip({ checklist: serializeChecklist(next) }, trip.id); } catch (e) { toast(exact(e)); }
  };
  const done = items.filter((i) => i.done).length;
  return (
    <section>
      <div className="lbl">À faire avant le départ {items.length > 0 && <b>{done}/{items.length}</b>}</div>
      {items.length === 0 && <button className="add-proj" disabled={notion.state === "offline"} onClick={() => save(DEFAULT_CHECKLIST.map((label) => ({ done: false, label })))}>Ajouter la liste type</button>}
      {items.map((it, i) => (
        <div key={i} className="todo">
          <label>
            <input type="checkbox" checked={it.done} disabled={notion.state === "offline"} onChange={() => save(items.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))} />
            <span className={it.done ? "done" : ""}>{it.label}</span>
          </label>
          <button aria-label={`Retirer ${it.label}`} disabled={notion.state === "offline"} onClick={() => save(items.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      {items.length > 0 && (
        <form className="todo-add" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { void save([...items, { done: false, label: text.trim() }]); setText(""); } }}>
          <input className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ajouter une tâche" aria-label="Nouvelle tâche" />
        </form>
      )}
    </section>
  );
}

function RowActions({ onEdit, onDelete, disabled }: { onEdit: () => void; onDelete: () => void; disabled: boolean }) {
  return (
    <span className="row-actions">
      <button disabled={disabled} onClick={onEdit}>Modifier</button>
      <button disabled={disabled} onClick={onDelete}>Supprimer</button>
    </span>
  );
}

function TransportRow({ x, onEdit, onDelete, disabled }: { x: Transport; onEdit: () => void; onDelete: () => void; disabled: boolean }) {
  return (
    <div className="resa">
      <b>{x.name}</b>
      <span>{[x.type, x.company, when(x.start), x.reference && `réf. ${x.reference}`, x.cost != null && euros(x.cost)].filter(Boolean).join(" · ")}</span>
      <RowActions onEdit={onEdit} onDelete={onDelete} disabled={disabled} />
    </div>
  );
}
function LodgingRow({ x, onEdit, onDelete, disabled }: { x: Lodging; onEdit: () => void; onDelete: () => void; disabled: boolean }) {
  return (
    <div className="resa">
      <b>{x.name}</b>
      <span>{[x.type, x.address, x.start && dateRange(x.start.slice(0, 10), x.end?.slice(0, 10) ?? null), x.cost != null && euros(x.cost)].filter(Boolean).join(" · ")}</span>
      <RowActions onEdit={onEdit} onDelete={onDelete} disabled={disabled} />
    </div>
  );
}

type Save = (r: ReservationInput) => void;

function TransportForm({ tripId, initial, busy, onSave, onCancel }: { tripId: string; initial?: Transport; busy: boolean; onSave: Save; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<TransportType>(initial?.type ?? "Avion");
  const [company, setCompany] = useState(initial?.company ?? "");
  const [start, setStart] = useState(initial?.start ?? "");
  const [end, setEnd] = useState(initial?.end ?? "");
  const [reference, setReference] = useState(initial?.reference ?? "");
  const [cost, setCost] = useState(initial?.cost != null ? String(initial.cost) : "");
  return (
    <div className="resa-form">
      <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Paris → Marrakech (AF1277)" aria-label="Intitulé" />
      <select className="field" value={type} onChange={(e) => setType(e.target.value as TransportType)} aria-label="Type">
        {TRANSPORT_TYPES.map((t) => <option key={t}>{t}</option>)}
      </select>
      <input className="field" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Compagnie" aria-label="Compagnie" />
      <div className="two">
        <label>Départ<input type="datetime-local" className="field" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label>Arrivée<input type="datetime-local" className="field" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
      </div>
      <div className="two">
        <input className="field" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Référence de réservation" aria-label="Référence" autoCapitalize="characters" />
        <input className="field" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Prix (€)" aria-label="Prix" />
      </div>
      <div className="foot-row">
        <button className="btn ghost" onClick={onCancel}>Annuler</button>
        <button className="btn primary" disabled={busy || !name.trim()}
          onClick={() => onSave({ kind: "transport", tripId, name: name.trim(), type, company: company.trim(), start: start || null, end: end || null, reference: reference.trim(), cost: num(cost) })}>
          {initial ? "Enregistrer" : "Ajouter"}
        </button>
      </div>
    </div>
  );
}

function LodgingForm({ tripId, initial, busy, onSave, onCancel }: { tripId: string; initial?: Lodging; busy: boolean; onSave: Save; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<LodgingType>(initial?.type ?? "Hôtel");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [start, setStart] = useState(initial?.start?.slice(0, 10) ?? "");
  const [end, setEnd] = useState(initial?.end?.slice(0, 10) ?? "");
  const [cost, setCost] = useState(initial?.cost != null ? String(initial.cost) : "");
  return (
    <div className="resa-form">
      <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du logement" aria-label="Nom" />
      <select className="field" value={type} onChange={(e) => setType(e.target.value as LodgingType)} aria-label="Type">
        {LODGING_TYPES.map((t) => <option key={t}>{t}</option>)}
      </select>
      <input className="field" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Adresse" aria-label="Adresse" />
      <div className="two">
        <label>Arrivée<input type="date" className="field" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label>Départ<input type="date" className="field" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
      </div>
      <input className="field" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Prix total (€)" aria-label="Prix" />
      <div className="foot-row">
        <button className="btn ghost" onClick={onCancel}>Annuler</button>
        <button className="btn primary" disabled={busy || !name.trim()}
          onClick={() => onSave({ kind: "lodging", tripId, name: name.trim(), type, address: address.trim(), start: start || null, end: end || null, cost: num(cost) })}>
          {initial ? "Enregistrer" : "Ajouter"}
        </button>
      </div>
    </div>
  );
}
