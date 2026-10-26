import type { Config } from "@netlify/functions";
import type { Destination } from "../../src/data/catalogue";
import { fail, guard, json } from "../lib/http";
import { CATALOGUE_DATA_SOURCE, queryAll, toDestination } from "../lib/notion";

export default async (req: Request) => {
  const denied = await guard(req);
  if (denied) return denied;
  if (req.method !== "GET") return json({ error: "Méthode non permise" }, 405);
  try {
    const pages = await queryAll(CATALOGUE_DATA_SOURCE);
    const destinations = pages.map(toDestination).filter((d): d is Destination => d !== null);
    return json({ destinations });
  } catch (e) {
    return fail(e);
  }
};

export const config: Config = { path: "/api/catalogue" };
