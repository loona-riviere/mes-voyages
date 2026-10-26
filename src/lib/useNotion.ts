import { useCallback, useEffect, useState } from "react";
import type { NewWish, Trip, Wish, WishPatch } from "../shared/types";
import { api, getPassphrase, loadCache, LockedError, saveCache } from "./api";

export type SyncState = "loading" | "ok" | "error" | "locked";

export interface NotionData {
  wishes: Wish[];
  trips: Trip[];
  state: SyncState;
  error: string | null;
  updatedAt: number | null;
  refresh: () => Promise<void>;
  unlock: (pass: string) => Promise<void>;
  addWish: (w: NewWish) => Promise<Wish>;
  patchWish: (id: string, patch: WishPatch) => Promise<void>;
}

export function useNotion(): NotionData {
  const cache = loadCache();
  const [wishes, setWishes] = useState<Wish[]>(cache?.wishes ?? []);
  const [trips, setTrips] = useState<Trip[]>(cache?.trips ?? []);
  const [updatedAt, setUpdatedAt] = useState<number | null>(cache?.at ?? null);
  const [state, setState] = useState<SyncState>(getPassphrase() ? "loading" : "locked");
  const [error, setError] = useState<string | null>(null);

  const store = useCallback((w: Wish[], t: Trip[]) => {
    const at = Date.now();
    setWishes(w);
    setTrips(t);
    setUpdatedAt(at);
    saveCache({ wishes: w, trips: t, at });
  }, []);

  const fail = useCallback((e: unknown) => {
    if (e instanceof LockedError) setState("locked");
    else {
      setState("error");
      setError(e instanceof Error ? e.message : "Erreur inattendue");
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!getPassphrase()) return setState("locked");
    setState("loading");
    setError(null);
    try {
      const [w, t] = await Promise.all([api.wishes(), api.trips()]);
      store(w, t);
      setState("ok");
    } catch (e) {
      fail(e);
    }
  }, [store, fail]);

  useEffect(() => {
    void refresh();
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

  const addWish = useCallback(
    async (input: NewWish) => {
      const w = await api.addWish(input);
      setWishes((prev) => {
        const next = [...prev, w];
        saveCache({ wishes: next, trips, at: Date.now() });
        return next;
      });
      return w;
    },
    [trips],
  );

  const patchWish = useCallback(
    async (id: string, patch: WishPatch) => {
      const before = wishes;
      const next = wishes.map((w) => (w.id === id ? { ...w, ...patch } : w));
      setWishes(next);
      try {
        const saved = await api.patchWish(id, patch);
        const merged = next.map((w) => (w.id === id ? saved : w));
        setWishes(merged);
        saveCache({ wishes: merged, trips, at: Date.now() });
      } catch (e) {
        setWishes(before);
        throw e;
      }
    },
    [wishes, trips],
  );

  return { wishes, trips, state, error, updatedAt, refresh, unlock, addWish, patchWish };
}
