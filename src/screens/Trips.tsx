import { useMemo, useState } from "react";
import { Sheet } from "../components/Sheet";
import { dateRange, euros } from "../lib/format";
import type { NotionData } from "../lib/useNotion";
import { LODGING_TYPES, TRANSPORT_TYPES, type Lodging, type LodgingType, type Transport, type TransportType, type Trip, type TripStatus } from "../shared/types";

const STATUSES: TripStatus[] = ["À planifier", "En cours", "Visité"];
const tripDays = (t: Trip) =>
  t.days ?? (t.start && t.end ? Math.round((Date.parse(t.end) - Date.parse(t.start)) / 864e5) + 1 : null);
const byStart = (a: Trip, b: Trip) => String(a.start ?? "9999").localeCompare(String(b.start ?? "9999"));
const exact = (e: unknown) => (e instanceof Error ? e.message : "Enregistrement impossible");
const SAVED_LATER = "Enregistré ici, envoyé à Notion au retour du réseau";

type Form = { mode: "new" } | { mode: "view"; id: string } | null;

export function Trips({ notion, toast }: { notion: NotionData; toast: (m: string) => void }) {
  const [form, setForm] = useState<Form>(null);
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
      {current.length > 0 && (<><div className="year">En cours</div><div className="timeline">{current.map(card)}</div></>)}
      {upcoming.length > 0 && (<><div className="year">À venir</div><div className="timeline">{upcoming.map(card)}</div></>)}
      {notion.state === "ok" && notion.trips.length === 0 && <div className="empty">Aucun voyage dans Notion pour l'instant.</div>}
      {[...byYear].map(([year, trips]) => (
        <div key={year}>
          <div className="year">{year}</div>
          <div className="timeline">{trips.map(card)}</div>
        </div>
      ))}
      <TripSheet form={form} onClose={() => setForm(null)} notion={notion} toast={toast} />
    </div>
  );
}

function TripItem({ t, notion, onOpen }: { t: Trip; notion: NotionData; onOpen: () => void }) {
  const days = tripDays(t);
  const flights = notion.transports.filter((x) => x.tripId === t.id).length;
  const lodgings = notion.lodgings.filter((x) => x.tripId === t.id).length;
  return (
    <article className="trip" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen()}>
      <div className="trip-top">
        <h3>{t.name}</h3>
        {t.start && <span className="when">{dateRange(t.start, t.end)}</span>}
      </div>
      <div className="wmeta">
        {days != null && <span><b>{days} j</b></span>}
        {t.budget != null && <span><b>{euros(t.budget)}</b> au total</span>}
        {t.pricePerPerson != null && <span><b>{euros(t.pricePerPerson)}</b> / pers.</span>}
        {t.dailyPerPerson != null && <span><b>{euros(t.dailyPerPerson)}</b> / jour</span>}
        {t.status !== "Visité" && <span>{flights} vol{flights > 1 ? "s" : ""} · {lodgings} logement{lodgings > 1 ? "s" : ""}</span>}
      </div>
    </article>
  );
}

const when = (s: string | null) => (s ? new Date(s).toLocaleString("fr-FR", { day: "numeric", month: "short", ...(s.length > 10 ? { hour: "2-digit", minute: "2-digit" } : {}) }) : "");

function TripSheet({ form, onClose, notion, toast }: { form: Form; onClose: () => void; notion: NotionData; toast: (m: string) => void }) {
  const trip = form?.mode === "view" ? notion.trips.find((t) => t.id === form.id) : undefined;
  const [adding, setAdding] = useState<"transport" | "lodging" | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const close = () => { setAdding(null); setName(""); setStart(""); setEnd(""); onClose(); };
  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e) { toast(exact(e)); } finally { setBusy(false); }
  };

  if (form?.mode === "new") {
    return (
      <Sheet open title="Nouveau voyage" onClose={close}
        footer={<button className="btn primary" disabled={busy || !name.trim() || notion.state === "offline"}
          onClick={() => guard(async () => { await notion.saveTrip({ name: name.trim(), start: start || null, end: end || null }); toast("Voyage créé dans Notion"); close(); })}>Créer le voyage</button>}>
        <section>
          <label className="lbl" htmlFor="tName">Nom</label>
          <input id="tName" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Marrakech" autoComplete="off" />
        </section>
        <section className="two">
          <div><label className="lbl" htmlFor="tStart">Départ</label><input id="tStart" type="date" className="field" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div><label className="lbl" htmlFor="tEnd">Retour</label><input id="tEnd" type="date" className="field" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        </section>
        {notion.state === "offline" && <p className="hint">Un nouveau voyage nécessite le réseau. Les vols et logements, eux, peuvent s'ajouter hors ligne.</p>}
      </Sheet>
    );
  }

  const transports = trip ? notion.transports.filter((x) => x.tripId === trip.id).sort((a, b) => String(a.start ?? "").localeCompare(String(b.start ?? ""))) : [];
  const lodgings = trip ? notion.lodgings.filter((x) => x.tripId === trip.id).sort((a, b) => String(a.start ?? "").localeCompare(String(b.start ?? ""))) : [];

  return (
    <Sheet open={!!trip} title={trip?.name ?? ""} onClose={close}>
      {trip && (
        <>
          <section>
            <div className="lbl">Statut</div>
            <div className="segs" role="radiogroup" aria-label="Statut du voyage">
              {STATUSES.map((s) => (
                <button key={s} role="radio" aria-checked={trip.status === s} disabled={busy || notion.state === "offline"}
                  onClick={() => guard(async () => { await notion.saveTrip({ status: s }, trip.id); })}>{s}</button>
              ))}
            </div>
            {trip.start && <p className="hint">{dateRange(trip.start, trip.end)}{tripDays(trip) != null ? ` · ${tripDays(trip)} jours` : ""}</p>}
          </section>
          <section>
            <div className="lbl">Vols et transports</div>
            {transports.length === 0 && <p className="hint">Rien d'enregistré.</p>}
            {transports.map((x) => <TransportRow key={x.id} x={x} />)}
            {adding === "transport" ? (
              <TransportForm tripId={trip.id} busy={busy} onCancel={() => setAdding(null)}
                onSave={(r) => guard(async () => { toast((await notion.addReservation(r)) ? "Transport ajouté" : SAVED_LATER); setAdding(null); })} />
            ) : <button className="add-proj" onClick={() => setAdding("transport")}>+ Ajouter un vol ou un transport</button>}
          </section>
          <section>
            <div className="lbl">Logements</div>
            {lodgings.length === 0 && <p className="hint">Rien d'enregistré.</p>}
            {lodgings.map((x) => <LodgingRow key={x.id} x={x} />)}
            {adding === "lodging" ? (
              <LodgingForm tripId={trip.id} busy={busy} onCancel={() => setAdding(null)}
                onSave={(r) => guard(async () => { toast((await notion.addReservation(r)) ? "Logement ajouté" : SAVED_LATER); setAdding(null); })} />
            ) : <button className="add-proj" onClick={() => setAdding("lodging")}>+ Ajouter un logement</button>}
          </section>
          {trip.url && <a className="link" href={trip.url} target="_blank" rel="noopener">Ouvrir dans Notion ↗</a>}
        </>
      )}
    </Sheet>
  );
}

function TransportRow({ x }: { x: Transport }) {
  return (
    <div className="resa">
      <b>{x.name}</b>
      <span>{[x.type, x.company, when(x.start), x.reference && `réf. ${x.reference}`, x.cost != null && euros(x.cost)].filter(Boolean).join(" · ")}</span>
    </div>
  );
}
function LodgingRow({ x }: { x: Lodging }) {
  return (
    <div className="resa">
      <b>{x.name}</b>
      <span>{[x.type, x.address, x.start && dateRange(x.start.slice(0, 10), x.end?.slice(0, 10) ?? null), x.cost != null && euros(x.cost)].filter(Boolean).join(" · ")}</span>
    </div>
  );
}

const num = (s: string) => (s.trim() === "" ? null : Math.max(0, Number(s.replace(",", ".")) || 0));
type Save = (r: import("../lib/queue").ReservationInput) => void;

function TransportForm({ tripId, busy, onSave, onCancel }: { tripId: string; busy: boolean; onSave: Save; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<TransportType>("Avion");
  const [company, setCompany] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reference, setReference] = useState("");
  const [cost, setCost] = useState("");
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
          onClick={() => onSave({ kind: "transport", tripId, name: name.trim(), type, company: company.trim(), start: start || null, end: end || null, reference: reference.trim(), cost: num(cost) })}>Ajouter</button>
      </div>
    </div>
  );
}

function LodgingForm({ tripId, busy, onSave, onCancel }: { tripId: string; busy: boolean; onSave: Save; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<LodgingType>("Hôtel");
  const [address, setAddress] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [cost, setCost] = useState("");
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
          onClick={() => onSave({ kind: "lodging", tripId, name: name.trim(), type, address: address.trim(), start: start || null, end: end || null, cost: num(cost) })}>Ajouter</button>
      </div>
    </div>
  );
}
