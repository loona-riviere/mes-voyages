import { useCallback, useEffect, useRef, useState } from "react";
import type { Destination } from "../data/catalogue";
import type { Lodging, NewWish, Project, ProjectInput, Transport, Trip, TripInput, Wish, WishPatch } from "../shared/types";
import { api, getPassphrase, loadCache, LockedError, saveCache, type Cached } from "./api";
import {
  enqueue, isLocalId, isNetworkError, loadQueue, localLodging, localProject, localTransport, localWish, newLocalId, saveQueue,
  type Pending, type ReservationInput,
} from "./queue";

export type SyncState = "loading" | "ok" | "error" | "offline" | "locked";

export interface NotionData {
  wishes: Wish[];
  trips: Trip[];
  /** Catalogue Notion ; vide tant qu'il n'a jamais été chargé (l'app utilise alors la copie de secours) */
  catalogue: Destination[];
  projects: Project[];
  transports: Transport[];
  lodgings: Lodging[];
  state: SyncState;
  error: string | null;
  updatedAt: number | null;
  pending: number;
  refresh: () => Promise<void>;
  unlock: (pass: string) => Promise<void>;
  /** Les ajouts et modifications renvoient false quand ils attendent le retour du réseau. */
  addWish: (w: NewWish) => Promise<boolean>;
  patchWish: (id: string, patch: WishPatch) => Promise<boolean>;
  saveProject: (p: ProjectInput, id?: string) => Promise<boolean>;
  addReservation: (r: ReservationInput) => Promise<boolean>;
  /** Création et modification d'un voyage : réseau nécessaire. */
  saveTrip: (t: TripInput, id?: string) => Promise<Trip>;
}

interface Data {
  wishes: Wish[];
  projects: Project[];
  transports: Transport[];
  lodgings: Lodging[];
}

/** Applique les changements en attente aux données reçues de Notion. */
function withPending(base: Data, q: Pending[]): Data {
  let { wishes, projects, transports, lodgings } = base;
  for (const p of q) {
    switch (p.kind) {
      case "wish-add": wishes = [...wishes, localWish(p.localId, p.input)]; break;
      case "wish-patch": wishes = wishes.map((w) => (w.id === p.id ? { ...w, ...p.patch } : w)); break;
      case "project-add": projects = [...projects, localProject(p.localId, p.input)]; break;
      case "project-patch":
        projects = projects.map((x) => (x.id === p.id ? { ...x, ...Object.fromEntries(Object.entries(p.patch).filter(([, v]) => v !== undefined)) } : x));
        break;
      case "reservation":
        if (p.input.kind === "transport") transports = [...transports, localTransport(p.localId, p.input)];
        else lodgings = [...lodgings, localLodging(p.localId, p.input)];
        break;
    }
  }
  return { wishes, projects, transports, lodgings };
}

export function useNotion(): NotionData {
  const cache = loadCache();
  const queue = useRef<Pending[]>(loadQueue());
  const initial = withPending(
    { wishes: cache?.wishes ?? [], projects: cache?.projects ?? [], transports: cache?.transports ?? [], lodgings: cache?.lodgings ?? [] },
    queue.current,
  );
  const [wishes, setWishes] = useState<Wish[]>(initial.wishes);
  const [projects, setProjects] = useState<Project[]>(initial.projects);
  const [transports, setTransports] = useState<Transport[]>(initial.transports);
  const [lodgings, setLodgings] = useState<Lodging[]>(initial.lodgings);
  const [trips, setTrips] = useState<Trip[]>(cache?.trips ?? []);
  const [catalogue, setCatalogue] = useState<Destination[]>(cache?.catalogue ?? []);
  const [updatedAt, setUpdatedAt] = useState<number | null>(cache?.at ?? null);
  const [state, setState] = useState<SyncState>(getPassphrase() ? "loading" : "locked");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(queue.current.length);
  const syncing = useRef(false);

  const setQueue = (q: Pending[]) => {
    queue.current = q;
    saveQueue(q);
    setPending(q.length);
  };

  /** Envoie la file d'attente à Notion, dans l'ordre. S'arrête à la première erreur réseau. */
  const flush = useCallback(async () => {
    while (queue.current.length) {
      const [first, ...rest] = queue.current;
      try {
        switch (first.kind) {
          case "wish-add": await api.addWish(first.input); break;
          case "wish-patch": await api.patchWish(first.id, first.patch); break;
          case "project-add": await api.addProject(first.input); break;
          case "project-patch": await api.patchProject(first.id, first.patch); break;
          case "reservation": await api.addReservation(first.input); break;
        }
      } catch (e) {
        if (isNetworkError(e) || e instanceof LockedError) throw e;
        // Refus de Notion (élément supprimé entre-temps…) : on abandonne ce changement.
        console.warn("Changement hors ligne abandonné", first, e);
      }
      setQueue(rest);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!getPassphrase()) return setState("locked");
    if (syncing.current) return;
    if (!navigator.onLine) return setState("offline");
    syncing.current = true;
    setState("loading");
    setError(null);
    try {
      await flush();
      // Catalogue, projets et réservations sont facultatifs : sans eux, l'app garde la dernière version connue.
      const optional = <T,>(p: Promise<T>, what: string) =>
        p.catch((e: unknown) => {
          if (e instanceof LockedError || isNetworkError(e)) throw e;
          console.warn(`${what} indisponible`, e);
          return null;
        });
      const old = loadCache();
      const [w, t, freshCat, freshProjects, freshRes] = await Promise.all([
        api.wishes(),
        api.trips(),
        optional(api.catalogue(), "Catalogue Notion"),
        optional(api.projects(), "Projets Notion"),
        optional(api.reservations(), "Réservations Notion"),
      ]);
      const next: Data = {
        wishes: w,
        projects: freshProjects ?? old?.projects ?? [],
        transports: freshRes?.transports ?? old?.transports ?? [],
        lodgings: freshRes?.lodgings ?? old?.lodgings ?? [],
      };
      const cat = freshCat ?? old?.catalogue ?? [];
      const at = Date.now();
      saveCache({ ...next, trips: t, catalogue: cat, at });
      const shown = withPending(next, queue.current);
      setWishes(shown.wishes);
      setProjects(shown.projects);
      setTransports(shown.transports);
      setLodgings(shown.lodgings);
      setTrips(t);
      setCatalogue(cat);
      setUpdatedAt(at);
      setState("ok");
    } catch (e) {
      if (e instanceof LockedError) setState("locked");
      else if (isNetworkError(e)) setState("offline");
      else {
        setState("error");
        setError(e instanceof Error ? e.message : "Erreur inattendue");
      }
    } finally {
      syncing.current = false;
    }
  }, [flush]);

  useEffect(() => {
    void refresh();
    const online = () => void refresh();
    const offline = () => setState((s) => (s === "locked" ? s : "offline"));
    const visible = () => document.visibilityState === "visible" && navigator.onLine && void refresh();
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);

  const unlock = useCallback(
    async (pass: string) => {
      setError(null);
      try {
        await api.unlock(pass);
      } catch (e) {
        if (!(e instanceof LockedError)) setError(e instanceof Error ? e.message : "Erreur inattendue");
        throw e;
      }
      await refresh();
    },
    [refresh],
  );

  const keepLocally = (item: Pending) => {
    setQueue(enqueue(queue.current, item));
    setState("offline");
  };

  /** Envoie tout de suite ; sans réseau, garde le changement pour plus tard. Renvoie true si Notion l'a reçu. */
  const sendOrQueue = async (send: () => Promise<void>, item: Pending, applyLocal: () => void): Promise<boolean> => {
    try {
      if (!navigator.onLine) throw new TypeError("hors ligne");
      await send();
      return true;
    } catch (e) {
      if (!isNetworkError(e)) throw e;
      keepLocally(item);
      applyLocal();
      return false;
    }
  };

  const addWish = useCallback(async (input: NewWish) => {
    const localId = newLocalId();
    return sendOrQueue(
      async () => { const saved = await api.addWish(input); setWishes((prev) => [...prev, saved]); },
      { kind: "wish-add", localId, input },
      () => setWishes((prev) => [...prev, localWish(localId, input)]),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patchWish = useCallback(async (id: string, patch: WishPatch) => {
    let before: Wish[] = [];
    setWishes((prev) => {
      before = prev;
      return prev.map((w) => (w.id === id ? { ...w, ...patch } : w));
    });
    try {
      if (isLocalId(id)) throw new TypeError("pas encore créée");
      return await sendOrQueue(
        async () => { const saved = await api.patchWish(id, patch); setWishes((prev) => prev.map((w) => (w.id === id ? saved : w))); },
        { kind: "wish-patch", id, patch },
        () => undefined,
      );
    } catch (e) {
      if (e instanceof TypeError) {
        keepLocally({ kind: "wish-patch", id, patch });
        return false;
      }
      setWishes(before);
      throw e;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveProject = useCallback(async (input: ProjectInput, id?: string) => {
    if (id) {
      let before: Project[] = [];
      setProjects((prev) => {
        before = prev;
        return prev.map((p) => (p.id === id ? { ...p, ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) } : p));
      });
      try {
        if (isLocalId(id)) throw new TypeError("pas encore créé");
        return await sendOrQueue(
          async () => { const saved = await api.patchProject(id, input); setProjects((prev) => prev.map((p) => (p.id === id ? saved : p))); },
          { kind: "project-patch", id, patch: input },
          () => undefined,
        );
      } catch (e) {
        if (e instanceof TypeError) {
          keepLocally({ kind: "project-patch", id, patch: input });
          return false;
        }
        setProjects(before);
        throw e;
      }
    }
    const localId = newLocalId();
    return sendOrQueue(
      async () => { const saved = await api.addProject(input); setProjects((prev) => [...prev, saved]); },
      { kind: "project-add", localId, input },
      () => setProjects((prev) => [...prev, localProject(localId, input)]),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addReservation = useCallback(async (input: ReservationInput) => {
    const localId = newLocalId();
    return sendOrQueue(
      async () => {
        const saved = await api.addReservation(input);
        if (saved.transport) setTransports((prev) => [...prev, saved.transport!]);
        if (saved.lodging) setLodgings((prev) => [...prev, saved.lodging!]);
        // Les formules de budget du voyage se recalculent dans Notion : on relit les voyages.
        void api.trips().then(setTrips).catch(() => undefined);
      },
      { kind: "reservation", localId, input },
      () => {
        if (input.kind === "transport") setTransports((prev) => [...prev, localTransport(localId, input)]);
        else setLodgings((prev) => [...prev, localLodging(localId, input)]);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveTrip = useCallback(async (input: TripInput, id?: string) => {
    const saved = id ? await api.patchTrip(id, input) : await api.addTrip(input);
    setTrips((prev) => (id ? prev.map((t) => (t.id === id ? saved : t)) : [saved, ...prev]));
    return saved;
  }, []);

  // Garde le cache à jour avec ce qui est affiché, sans les éléments pas encore créés.
  useEffect(() => {
    if (!updatedAt) return;
    const synced: Cached = {
      wishes: wishes.filter((w) => !isLocalId(w.id)),
      projects: projects.filter((p) => !isLocalId(p.id)),
      transports: transports.filter((t) => !isLocalId(t.id)),
      lodgings: lodgings.filter((l) => !isLocalId(l.id)),
      trips, catalogue, at: updatedAt,
    };
    saveCache(synced as Cached);
  }, [wishes, projects, transports, lodgings, trips, catalogue, updatedAt]);

  return {
    wishes, trips, catalogue, projects, transports, lodgings, state, error, updatedAt, pending,
    refresh, unlock, addWish, patchWish, saveProject, addReservation, saveTrip,
  };
}
