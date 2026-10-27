// Formes renvoyées par les Netlify Functions, partagées avec l'app.
import type { Rule, Want } from "../data/catalogue";

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
  kids: Kids | null;
  priority: Priority | null;
  status: WishStatus | null;
  notes: string;
  /** Page du catalogue liée dans Notion (propriété « Destination ») */
  destinationId: string | null;
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
  kids?: Kids | null;
  priority?: Priority;
  status?: WishStatus;
  notes?: string;
  /** Page du catalogue à relier (propriété « Destination ») */
  destinationId?: string | null;
}

export type ProjectStatus = "À choisir" | "Choisi" | "Archivé";

/** Projet de voyage en cours de choix : des critères enregistrés dans Notion. */
export interface Project {
  id: string;
  url: string;
  name: string;
  /** Index de mois, 0 = janvier ; vide = garder les mois en cours */
  months: number[];
  /** null = garder la valeur en cours */
  days: number | null;
  budget: number | null;
  wants: Want[];
  rules: Rule[];
  status: ProjectStatus | null;
  notes: string;
}

export interface ProjectInput {
  name?: string;
  months?: number[];
  days?: number | null;
  budget?: number | null;
  wants?: Want[];
  rules?: Rule[];
  status?: ProjectStatus;
  notes?: string;
}

export interface WishPatch {
  priority?: Priority;
  status?: WishStatus;
}
