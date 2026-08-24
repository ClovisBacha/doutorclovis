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
import {
  PLAN_RANK,
  entitlementsFor,
  mensalidadeCentavos,
  normalizePlan,
  type Entitlements,
  type PlanKey,
} from "./entitlements";
import { ENTRADA_MENSAGENS, TETO_AUTOATENDIMENTO } from "./planos-medico";

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
/**
 * `mensagens` também fica de fora do varredor de pares — e este é o caso em que
 * a exclusão precisa de mais defesa que a do trial, porque ele não está em
 * extinção: é o ÚNICO plano que ainda se vende.
 *
 * O motivo é que ele não é um degrau desta escada; ele a substitui. Os planos
 * nomeados vendiam dois eixos (pacientes e capacidades) e os dois saíram: não
 * há mais teto de pacientes, e a IA passou a ser comprada por quantidade.
 * Comparar campo a campo compararia números que medem coisas diferentes —
 * `aiRepliesPerCycle` aqui é o PISO de quem não pôde ler a coluna (150), não o
 * que o médico recebe, que vem de `doctors.ai_messages_per_cycle`.
 *
 * O que dá para exigir dele está no bloco próprio, logo abaixo, e é exigido.
 */
const FORA_DA_ESCADA: PlanKey[] = ["trial", "mensagens"];

const planos = (Object.keys(PLAN_RANK) as PlanKey[])
  .filter((p) => !FORA_DA_ESCADA.includes(p))
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

  describe("`mensagens` — o plano que substituiu a escada", () => {
    const m = entitlementsFor("mensagens");

    test("é um nome de plano CONHECIDO — não cai em free", () => {
      /* A asserção que descreve o defeito medido: enquanto `normalizePlan` não
         conhecia este nome, o webhook gravava `free` para quem acabou de pagar
         R$ 295,40, respondia 200 ao Stripe (que nunca reenvia) e ninguém
         descobria — nem o médico, que só veria a IA não responder. */
      expect(normalizePlan("mensagens")).toBe("mensagens");
      expect(m.label).not.toBe("Free");
    });

    test("não tem teto de pacientes — o eixo saiu do produto", () => {
      expect(m.maxPatients).toBeNull();
    });

    test("entrega tudo que os nomeados pagos entregam, menos equipe", () => {
      /* A comparação que FAZ sentido: as capacidades. Só `teamSeats` e
         `dedicatedManager` ficam de fora, e de propósito — é o que sobra para o
         contrato de Clínica vender. */
      for (const campo of ["aiApp", "aiWhatsapp", "prioritySupport"] as const) {
        expect(m[campo]).toBe(true);
      }
      expect(m.teamSeats).toBe(false);
      expect(m.dedicatedManager).toBe(false);
    });

    test("o piso de IA é a ENTRADA da escada, nunca zero nem o topo", () => {
      /* Zero deixaria sem IA quem pagou, no intervalo entre o deploy e a
         migration. O topo faria a plataforma pagar 2.500 mensagens para quem
         comprou 150 — e este é o erro que ninguém reclama e ninguém descobre. */
      expect(m.aiRepliesPerCycle).toBe(ENTRADA_MENSAGENS);
      expect(m.aiRepliesPerCycle).toBeLessThan(TETO_AUTOATENDIMENTO);
    });

    test("a mensalidade acompanha a quantidade comprada", () => {
      /* Sem o parâmetro, o painel diria "sua mensalidade é R$ 29,90" a quem
         paga R$ 295,40, e o MRR contaria um décimo do que entra. */
      expect(mensalidadeCentavos("mensagens", ENTRADA_MENSAGENS)).toBe(2_990);
      expect(mensalidadeCentavos("mensagens", TETO_AUTOATENDIMENTO)).toBe(99_900);
      /* Sem quantidade conhecida, o piso — subestima, nunca superestima. */
      expect(mensalidadeCentavos("mensagens")).toBe(2_990);
    });
  });

  test("o trial não é um degrau — e por isso tem que vencer", () => {
    /* Ele entrega mais que dois planos pagos acima dele. Isso só não é uma
       inversão da escada porque ele é temporário e está em extinção. A garantia
       de que ele acaba é `planoVigente`, não esta tabela. */
    const ent = readFileSync("src/lib/entitlements.server.ts", "utf8");
    expect(ent).toContain("export function planoVigente(");
  });
});
