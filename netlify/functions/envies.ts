import type { Config } from "@netlify/functions";
import type { NewWish, WishPatch } from "../../src/shared/types";
import { fail, guard, json } from "../lib/http";
import {
  InvalidInput, newWishProperties, notion, patchProperties, queryAll, toWish, WISHES_DATA_SOURCE, type Page,
} from "../lib/notion";

const PAGE_ID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

async function body<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new InvalidInput("Corps JSON invalide");
  }
}

export default async (req: Request) => {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    switch (req.method) {
      case "GET": {
        const pages = await queryAll(WISHES_DATA_SOURCE);
        return json({ wishes: pages.map(toWish) });
      }
      case "POST": {
        const properties = newWishProperties(await body<NewWish>(req));
        const page = await notion<Page>("/pages", {
          method: "POST",
          body: { parent: { type: "data_source_id", data_source_id: WISHES_DATA_SOURCE }, properties },
        });
        return json({ wish: toWish(page) }, 201);
      }
      case "PATCH": {
        const { id, ...patch } = await body<WishPatch & { id?: string }>(req);
        if (!id || !PAGE_ID.test(id)) throw new InvalidInput("Identifiant invalide");
        const current = await notion<Page & { parent?: { data_source_id?: string } }>(`/pages/${id}`);
        if (current.parent?.data_source_id?.replace(/-/g, "") !== WISHES_DATA_SOURCE.replace(/-/g, "")) {
          throw new InvalidInput("Cette page n'est pas une envie");
        }
        const page = await notion<Page>(`/pages/${id}`, {
          method: "PATCH",
          body: { properties: patchProperties(patch) },
        });
        return json({ wish: toWish(page) });
      }
      default:
        return json({ error: "Méthode non permise" }, 405);
    }
  } catch (e) {
    return fail(e);
  }
};

export const config: Config = { path: "/api/envies" };
