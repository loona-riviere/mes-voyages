import { timingSafeEqual, createHash } from "node:crypto";
import { InvalidInput, NotionError } from "./notion";

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Vérifie la phrase secrète envoyée dans l'en-tête X-Passphrase. Renvoie une réponse d'erreur, ou null si c'est bon. */
export async function guard(req: Request): Promise<Response | null> {
  const expected = process.env.APP_PASSPHRASE;
  if (!expected) return json({ error: "APP_PASSPHRASE n'est pas configurée sur Netlify." }, 500);
  const given = req.headers.get("x-passphrase") ?? "";
  if (given && timingSafeEqual(digest(given), digest(expected))) return null;
  // Ralentit les essais au hasard.
  await new Promise((r) => setTimeout(r, 800));
  return json({ error: "Phrase secrète incorrecte." }, 401);
}

export function fail(e: unknown): Response {
  if (e instanceof InvalidInput) return json({ error: e.message }, 400);
  if (e instanceof NotionError) {
    const hint =
      e.status === 401 ? "Le token Notion est invalide." :
      e.status === 404 ? "Notion ne trouve pas la base : partage la page « Planificateur de Voyage » avec l'intégration." :
      e.status === 429 ? "Notion limite les appels, réessaie dans une minute." :
      e.message;
    return json({ error: hint }, e.status === 404 || e.status === 401 ? 502 : e.status >= 500 ? 502 : e.status);
  }
  console.error(e);
  return json({ error: "Erreur inattendue." }, 500);
}
