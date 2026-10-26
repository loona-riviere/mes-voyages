import type { Config } from "@netlify/functions";
import { fail, guard, json } from "../lib/http";
import { queryAll, toTrip, TRIPS_DATA_SOURCE } from "../lib/notion";

export default async (req: Request) => {
  const denied = await guard(req);
  if (denied) return denied;
  if (req.method !== "GET") return json({ error: "Méthode non permise" }, 405);
  try {
    const pages = await queryAll(TRIPS_DATA_SOURCE, [{ property: "Date", direction: "descending" }]);
    return json({ trips: pages.map(toTrip) });
  } catch (e) {
    return fail(e);
  }
};

export const config: Config = { path: "/api/voyages" };
