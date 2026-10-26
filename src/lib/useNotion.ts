import { useCallback, useEffect, useRef, useState } from "react";
import type { Destination } from "../data/catalogue";
import type { NewWish, Project, ProjectInput, Trip, Wish, WishPatch } from "../shared/types";
import { api, getPassphrase, loadCache, LockedError, saveCache } from "./api";
import { enqueue, isLocalId, isNetworkError, loadQueue, localWish, saveQueue, type Pending } from "./queue";

export type SyncState = "loading" | "ok" | "error" | "offline" | "locked";

export interface NotionData {
  wishes: Wish[];
  trips: Trip[];
  /** Catalogue Notion ; vide tant qu'il n'a jamais été chargé (l'app utilise alors la copie de secours) */
  catalogue: Destination[];
  projects: Project[];
  state: SyncState;
  error: string | null;
  updatedAt: number | null;
  pending: number;
  refresh: () => Promise<void>;
  unlock: (pass: string) => Promise<void>;
  /** Renvoie false si l'ajout attend le retour du réseau. */
  addWish: (w: NewWish) => Promise<boolean>;
  patchWish: (id: string, patch: WishPatch) => Promise<boolean>;
  saveProject: (p: ProjectInput, id?: string) => Promise<Project>;
}

/** Applique les changements en attente aux données reçues de Notion. */
function withPending(wishes: Wish[], q: Pending[]): Wish[] {
  let out = wishes;
  for (const p of q) {
    if (p.kind === "add") out = [...out, localWish(p.localId, p.input)];
    else out = out.map((w) => (w.id === p.id ? { ...w, ...p.patch } : w));
  }
  return out;
}

export function useNotion(): NotionData {
  const cache = loadCache();
  const queue = useRef<Pending[]>(loadQueue());
  const [wishes, setWishes] = useState<Wish[]>(withPending(cache?.wishes ?? [], queue.current));
  const [trips, setTrips] = useState<Trip[]>(cache?.trips ?? []);
  const [catalogue, setCatalogue] = useState<Destination[]>(cache?.catalogue ?? []);
  const [projects, setProjects] = useState<Project[]>(cache?.projects ?? []);
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
        if (first.kind === "add") await api.addWish(first.input);
        else await api.patchWish(first.id, first.patch);
      } catch (e) {
        if (isNetworkError(e) || e instanceof LockedError) throw e;
        // Refus de Notion (envie supprimée entre-temps…) : on abandonne ce changement.
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
      // Le catalogue est facultatif : sans lui, l'app garde la dernière version ou la copie de secours.
      // Catalogue et projets sont facultatifs : sans eux, l'app garde la dernière version connue.
      const optional = <T,>(p: Promise<T>, what: string) =>
        p.catch((e: unknown) => {
          if (e instanceof LockedError || isNetworkError(e)) throw e;
          console.warn(`${what} indisponible`, e);
          return null;
        });
      const [w, t, fresh, freshProjects] = await Promise.all([
        api.wishes(),
        api.trips(),
        optional(api.catalogue(), "Catalogue Notion"),
        optional(api.projects(), "Projets Notion"),
      ]);
      const cat = fresh ?? loadCache()?.catalogue ?? [];
      const proj = freshProjects ?? loadCache()?.projects ?? [];
      setProjects(proj);
      const at = Date.now();
      saveCache({ wishes: w, trips: t, catalogue: cat, projects: proj, at });
      setWishes(withPending(w, queue.current));
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

  const addWish = useCallback(async (input: NewWish) => {
    try {
      if (!navigator.onLine) throw new TypeError("hors ligne");
      const w = await api.addWish(input);
      setWishes((prev) => [...prev, w]);
      return true;
    } catch (e) {
      if (!isNetworkError(e)) throw e;
      const localId = `local-${Date.now()}`;
      keepLocally({ kind: "add", localId, input });
      setWishes((prev) => [...prev, localWish(localId, input)]);
      return false;
    }
  }, []);

  const patchWish = useCallback(async (id: string, patch: WishPatch) => {
    let before: Wish[] = [];
    setWishes((prev) => {
      before = prev;
      return prev.map((w) => (w.id === id ? { ...w, ...patch } : w));
    });
    if (isLocalId(id) || !navigator.onLine) {
      keepLocally({ kind: "patch", id, patch });
      return false;
    }
    try {
      const saved = await api.patchWish(id, patch);
      setWishes((prev) => prev.map((w) => (w.id === id ? saved : w)));
      return true;
    } catch (e) {
      if (isNetworkError(e)) {
        keepLocally({ kind: "patch", id, patch });
        return false;
      }
      setWishes(before);
      throw e;
    }
  }, []);

  // Garde le cache à jour avec ce qui est affiché (modifications comprises).
  useEffect(() => {
    if (updatedAt) saveCache({ wishes: wishes.filter((w) => !isLocalId(w.id)), trips, catalogue, projects, at: updatedAt });
  }, [wishes, trips, catalogue, projects, updatedAt]);

  /** Crée ou met à jour un projet (en ligne seulement). Un projet archivé disparaît de la liste. */
  const saveProject = useCallback(async (input: ProjectInput, id?: string) => {
    const saved = id ? await api.patchProject(id, input) : await api.addProject(input);
    setProjects((prev) => {
      const others = prev.filter((p) => p.id !== saved.id);
      return saved.status === "Archivé" ? others : id ? prev.map((p) => (p.id === id ? saved : p)) : [...prev, saved];
    });
    return saved;
  }, []);

  return { wishes, trips, catalogue, projects, saveProject, state, error, updatedAt, pending, refresh, unlock, addWish, patchWish };
}
