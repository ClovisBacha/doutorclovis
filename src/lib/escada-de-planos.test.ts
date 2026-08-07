/**
 * A ESCADA DE PLANOS PRECISA SUBIR — SEMPRE.
 *
 * ─── O DEFEITO ──────────────────────────────────────────────────────────────
 *
 * `CLINICA` fica ACIMA de `ELITE` no `PLAN_RANK` e herdava de `PRO`. Resultado:
 * ela entregava `premiumInvitesPerMonth: 0` e o selo "Pro" enquanto o Elite,
 * um degrau ABAIXO, dá 25 convites e o selo "Elite". Subir de plano rebaixava
 * o médico em dois eixos.
 *
 * E o estrago se espalhava: a exceção "só sobe quem está abaixo do Elite", no
 * assento de clínica, existia justamente para contornar a escada quebrada. Uma
 * regra torta gera a próxima.
 *
 * ─── POR QUE UM TESTE DE PARES, E NÃO UM CASO ───────────────────────────────
 *
 * Conferir "Clínica ≥ Elite" consertaria hoje e não amanhã. O que precisa ser
 * verdade é a PROPRIEDADE: para todo par a < b na escada, b entrega pelo menos
 * o que a entrega, campo a campo. Um plano novo entra e é conferido de graça.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { PLAN_RANK, entitlementsFor, type Entitlements, type PlanKey } from "./entitlements";

/** `null` = ilimitado. Na comparação, vale mais que qualquer número. */
const numerico = (v: number | null) => (v === null ? Number.POSITIVE_INFINITY : v);

const PESO_DO_SELO: Record<Entitlements["badge"], number> = {
  "": 0,
  Starter: 1,
  Pro: 2,
  Elite: 3,
  Black: 4,
};

/**
 * O `trial` FICA DE FORA da comparação, e isto é uma decisão, não uma
 * conveniência.
 *
 * Ele dá 150 pacientes — mais que o Essencial (15) e que o Starter (50), que
 * são pagos e ficam acima dele na escada. Visto como degrau, é uma inversão
 * feia: sair do trial para o plano de entrada TIRA capacidade.
 *
 * Só que o trial não é um degrau: ele foi REMOVIDO para médicos novos ("o
 * trial de 14 dias saiu", `doctors.functions.ts`), e quem ainda está nele
 * recebeu uma promessa de 14 dias que não se corta pelo meio. É um estado
 * temporário em extinção, não um plano que alguém compra.
 *
 * O que ele NÃO pode é durar para sempre — e isso quem garante é
 * `planoVigente`, com teste próprio.
 */
const planos = (Object.keys(PLAN_RANK) as PlanKey[])
  .filter((p) => p !== "trial")
  .sort((a, b) => PLAN_RANK[a] - PLAN_RANK[b]);

describe("para todo par de planos, o de cima entrega pelo menos o de baixo", () => {
  for (let i = 0; i < planos.length; i++) {
    for (let j = i + 1; j < planos.length; j++) {
      const baixo = planos[i];
      const cima = planos[j];
      test(`${cima} ≥ ${baixo}`, () => {
        const a = entitlementsFor(baixo);
        const b = entitlementsFor(cima);

        // Tetos: null (ilimitado) vale como infinito.
        expect(numerico(b.maxPatients)).toBeGreaterThanOrEqual(numerico(a.maxPatients));
        expect(numerico(b.maxBrains)).toBeGreaterThanOrEqual(numerico(a.maxBrains));
        expect(numerico(b.aiRepliesPerCycle)).toBeGreaterThanOrEqual(numerico(a.aiRepliesPerCycle));
        expect(b.premiumInvitesPerMonth).toBeGreaterThanOrEqual(a.premiumInvitesPerMonth);

        // Capacidades: ligado não pode desligar ao subir.
        for (const campo of [
          "aiApp",
          "aiWhatsapp",
          "clinicalToolsAdvanced",
          "dashboardAdvanced",
          "prioritySupport",
          "teamSeats",
          "dedicatedManager",
        ] as const) {
          if (a[campo]) expect(b[campo]).toBe(true);
        }

        // Selo: o de cima nunca vale menos que o de baixo.
        expect(PESO_DO_SELO[b.badge]).toBeGreaterThanOrEqual(PESO_DO_SELO[a.badge]);
      });
    }
  }
});

describe("a escada tem os degraus que o produto vende", () => {
  test("free é o piso e não tem IA", () => {
    /* Se o piso tivesse IA, todo o resto da escada perderia o sentido — e a
       plataforma pagaria a conta de quem não paga nada. */
    expect(PLAN_RANK.free).toBe(0);
    expect(entitlementsFor("free").aiApp).toBe(false);
  });

  test("todo plano pago tem IA no app", () => {
    for (const p of planos) {
      if (p === "free") continue;
      expect(entitlementsFor(p).aiApp).toBe(true);
    }
  });

  test("o trial não é um degrau — e por isso tem que vencer", () => {
    /* Ele entrega mais que dois planos pagos acima dele. Isso só não é uma
       inversão da escada porque ele é temporário e está em extinção. A garantia
       de que ele acaba é `planoVigente`, não esta tabela. */
    const ent = readFileSync("src/lib/entitlements.server.ts", "utf8");
    expect(ent).toContain("export function planoVigente(");
  });
});
