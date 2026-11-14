import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RECOMPENSA_DA_INDICACAO, RECOMPENSA_DO_DEPOIMENTO } from "~/lib/jornada/recompensas";

const doSite = (arquivo: string) =>
  readFileSync(join(import.meta.dir, "..", "..", "..", "..", "src", "lib", arquivo), "utf8");

describe("as recompensas escritas na tela são as que o servidor paga", () => {
  test("indicar uma amiga", () => {
    expect(doSite("referral.functions.ts")).toContain(
      `export const REFERRAL_REWARD = ${RECOMPENSA_DA_INDICACAO};`,
    );
  });
  test("o depoimento aprovado", () => {
    expect(doSite("testimonials.functions.ts")).toContain("amount: SEMENTINHAS.trimesterMilestone");
    expect(doSite("sementinhas.functions.ts")).toContain(
      `trimesterMilestone: ${RECOMPENSA_DO_DEPOIMENTO},`,
    );
  });
});
