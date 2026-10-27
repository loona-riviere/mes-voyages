import type { Config } from "@netlify/functions";
import type { ProjectInput } from "../../src/shared/types";
import { fail, guard, json } from "../lib/http";
import {
  InvalidInput, notion, projectProperties, PROJECTS_DATA_SOURCE, queryAll, toProject, type Page,
} from "../lib/notion";

const PAGE_ID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
const sameId = (a?: string, b?: string) => !!a && !!b && a.replace(/-/g, "") === b.replace(/-/g, "");

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
        const projects = (await queryAll(PROJECTS_DATA_SOURCE)).map(toProject).filter((p) => p.name);
        return json({ projects });
      }
      case "POST": {
        const page = await notion<Page>("/pages", {
          method: "POST",
          body: { parent: { type: "data_source_id", data_source_id: PROJECTS_DATA_SOURCE }, properties: projectProperties(await body<ProjectInput>(req), true) },
        });
        return json({ project: toProject(page) }, 201);
      }
      case "PATCH": {
        const { id, ...patch } = await body<ProjectInput & { id?: string }>(req);
        if (!id || !PAGE_ID.test(id)) throw new InvalidInput("Identifiant invalide");
        const current = await notion<Page & { parent?: { data_source_id?: string } }>(`/pages/${id}`);
        if (!sameId(current.parent?.data_source_id, PROJECTS_DATA_SOURCE)) throw new InvalidInput("Cette page n'est pas un projet");
        const page = await notion<Page>(`/pages/${id}`, { method: "PATCH", body: { properties: projectProperties(patch, false) } });
        return json({ project: toProject(page) });
      }
      default:
        return json({ error: "Méthode non permise" }, 405);
    }
  } catch (e) {
    return fail(e);
  }
};

export const config: Config = { path: "/api/projets" };
