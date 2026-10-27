import type { Config } from "@netlify/functions";
import type { LodgingInput, TransportInput } from "../../src/shared/types";
import { fail, guard, json } from "../lib/http";
import {
  InvalidInput, LODGINGS_DATA_SOURCE, lodgingProperties, notion, queryAll, toLodging, toTransport,
  TRANSPORTS_DATA_SOURCE, transportProperties, type Page,
} from "../lib/notion";

async function body<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new InvalidInput("Corps JSON invalide");
  }
}

const create = (dataSource: string, properties: Record<string, unknown>) =>
  notion<Page>("/pages", { method: "POST", body: { parent: { type: "data_source_id", data_source_id: dataSource }, properties } });

export default async (req: Request) => {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    if (req.method === "GET") {
      const [transports, lodgings] = await Promise.all([queryAll(TRANSPORTS_DATA_SOURCE), queryAll(LODGINGS_DATA_SOURCE)]);
      return json({ transports: transports.map(toTransport), lodgings: lodgings.map(toLodging) });
    }
    if (req.method === "POST") {
      const input = await body<({ kind: "transport" } & TransportInput) | ({ kind: "lodging" } & LodgingInput)>(req);
      if (input.kind === "transport") return json({ transport: toTransport(await create(TRANSPORTS_DATA_SOURCE, transportProperties(input))) }, 201);
      if (input.kind === "lodging") return json({ lodging: toLodging(await create(LODGINGS_DATA_SOURCE, lodgingProperties(input))) }, 201);
      throw new InvalidInput("Type de réservation inconnu");
    }
    return json({ error: "Méthode non permise" }, 405);
  } catch (e) {
    return fail(e);
  }
};

export const config: Config = { path: "/api/reservations" };
