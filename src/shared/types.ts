// Formes renvoyées par les Netlify Functions, partagées avec l'app.

export type Priority = "Très envie" | "Envie" | "Un jour";
export type WishStatus = "Idée" | "En réflexion" | "Planifié";
export type Kids = "Sans enfants" | "Avec enfants";
export type TripStatus = "À visiter" | "À planifier" | "En cours" | "Visité";

export const PRIORITIES: readonly Priority[] = ["Très envie", "Envie", "Un jour"];
export const WISH_STATUSES: readonly WishStatus[] = ["Idée", "En réflexion", "Planifié"];

export interface Wish {
  id: string;
  url: string;
  name: string;
  country: string;
  /** Libellés Notion (« Plage », « Faune sauvage »…) */
  wants: string[];
  /** Index de mois, 0 = janvier */
  bestMonths: number[];
  idealDays: number | null;
  budget: number | null;
  withWhom: string | null;
  kids: Kids | null;
  priority: Priority | null;
  status: WishStatus | null;
  notes: string;
}

export interface Trip {
  id: string;
  url: string;
  name: string;
  status: TripStatus | null;
  /** AAAA-MM-JJ */
  start: string | null;
  end: string | null;
  budget: number | null;
  days: number | null;
  pricePerPerson: number | null;
  dailyPerPerson: number | null;
}

export interface NewWish {
  name: string;
  country?: string;
  wants?: string[];
  bestMonths?: number[];
  idealDays?: number | null;
  budget?: number | null;
  withWhom?: string | null;
  kids?: Kids | null;
  priority?: Priority;
  status?: WishStatus;
  notes?: string;
}

export interface WishPatch {
  priority?: Priority;
  status?: WishStatus;
}
