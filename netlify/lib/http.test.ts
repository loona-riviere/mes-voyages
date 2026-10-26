import { afterEach, describe, expect, it, vi } from "vitest";
import { guard } from "./http";

describe("phrase secrète", () => {
  afterEach(() => vi.unstubAllEnvs());
  const req = (p?: string) => new Request("https://x/api/envies", { headers: p ? { "x-passphrase": p } : {} });

  it("laisse passer la bonne phrase", async () => {
    vi.stubEnv("APP_PASSPHRASE", "cap sur les lofoten");
    expect(await guard(req("cap sur les lofoten"))).toBeNull();
  });

  it("refuse une phrase absente ou fausse", async () => {
    vi.stubEnv("APP_PASSPHRASE", "cap sur les lofoten");
    expect((await guard(req()))?.status).toBe(401);
    expect((await guard(req("cap sur")))?.status).toBe(401);
  });

  it("refuse tout si la variable n'est pas configurée", async () => {
    vi.stubEnv("APP_PASSPHRASE", "");
    expect((await guard(req("")))?.status).toBe(500);
  });
});
