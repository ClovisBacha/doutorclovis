/**
 * O PREMIUM DA PACIENTE NÃO É DO MÉDICO.
 *
 * ─── A DECISÃO ──────────────────────────────────────────────────────────────
 *
 * O painel tinha um botão "⭐ Premium" na linha de cada paciente, que ligava e
 * desligava as aulas pagas dela — com o rótulo "após confirmar o PIX".
 *
 * Removido por decisão do dono (ago/2026), e a razão é de FRONTEIRA, não de
 * tela: o Premium é a assinatura DELA com a plataforma. Quem cobra é a
 * plataforma, quem decide é ela. Um botão no painel do médico misturava as duas
 * relações — e criava uma cobrança por fora, sem registro, sem prazo e sem
 * recibo, com o médico no meio de um pagamento que não é dele.
 *
 * ─── POR QUE O TESTE OLHA O SERVIDOR, E NÃO A TELA ──────────────────────────
 *
 * "Não tem botão" nunca foi controle de acesso. Se a server function
 * continuasse viva, a capacidade continuaria — bastava chamar o endpoint. O que
 * este arquivo cobra é que ela não existe.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const server = readFileSync("src/lib/patientlink.functions.ts", "utf8");
const painel = readFileSync("src/routes/_authenticated/painel.tsx", "utf8");

describe("a capacidade saiu do servidor, não só da tela", () => {
  test("`setPatientQuizPremium` não existe mais", () => {
    expect(server).not.toContain("export const setPatientQuizPremium");
  });

  test("e o painel não a importa nem a chama", () => {
    expect(painel).not.toContain("setPatientQuizPremium");
    expect(painel).not.toContain("togglePremium");
    expect(painel).not.toContain("premiumBusyId");
  });

  test("o motivo fica registrado onde a função estava", () => {
    /* Sem isto, a próxima pessoa reintroduz o botão achando que foi esquecido —
       o pedido "libera o premium dela pelo painel" é natural de quem não sabe
       que a fronteira foi decidida. */
    expect(server).toContain("O MÉDICO NÃO DÁ NEM TIRA O PREMIUM DA PACIENTE");
  });
});

describe("o placar do cérebro abre a aba", () => {
  test("«Como está o seu cérebro» vem ANTES das filas", () => {
    /**
     * Decisão do dono. O placar responde "o meu cérebro está bom?", que é a
     * pergunta que ele traz ao abrir a aba; as filas respondem "o que eu faço
     * agora", que só importa depois que ele confia no que construiu.
     *
     * E o card carrega o aviso da busca por significado — que, desligada,
     * explica por que a IA parece não saber o que ele já ensinou. Enterrado
     * embaixo de três filas, é diagnóstico que ninguém lê.
     */
    const iPlacar = painel.indexOf("Como está o seu cérebro");
    const iFilas = painel.indexOf("O que está esperando você");
    expect(iPlacar).toBeGreaterThan(-1);
    expect(iFilas).toBeGreaterThan(-1);
    expect(iPlacar).toBeLessThan(iFilas);
  });

  test("e as filas continuam existindo — não foram removidas junto", () => {
    for (const card of ["<BrainGapsCard", "<BrainReviewCard", "<BrainTrainCard"]) {
      expect(painel).toContain(card);
    }
  });
});
