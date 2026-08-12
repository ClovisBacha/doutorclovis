/**
 * ESPIAR O DIA QUE AINDA NÃO CHEGOU — e por que isso não abre buraco.
 *
 * Pedido do dono: "essa minha conta é premium, correto? Eu tenho que conseguir
 * acessar também os próximos exercícios". A trilha travava o futuro para todo
 * mundo, com o toast "um passo de cada vez".
 *
 * A liberação só é segura por causa de UMA linha: `canEarn={isT}`, com
 * `isT = D === todayD`. É ela que barra Sementinhas, estrela, fechamento do dia
 * e sequência em qualquer dia que não seja hoje — a espiada é de LEITURA por
 * construção, não por disciplina de quem escreve a tela.
 *
 * Se alguém trocar `canEarn` por algo que dependa do plano, a espiada vira
 * fazenda de Sementinhas: dá para abrir 300 dias e fechar todos. Este arquivo
 * existe para que essa troca não passe em silêncio.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const path = readFileSync("src/components/gestacao-path.tsx", "utf8");

describe("o futuro abre, mas não paga", () => {
  test("`canEarn` continua sendo SÓ hoje", () => {
    /* As duas metades da trava, juntas: a definição e o uso. */
    expect(path).toContain("const isT = D === todayD;");
    expect(path).toContain("canEarn={isT}");
    /* E nada de plano no lugar dela. */
    expect(path).not.toMatch(/canEarn=\{[^}]*quizPremium/);
    expect(path).not.toMatch(/canEarn=\{true\}/);
  });

  test("quem assina abre o dia de amanhã; quem não assina, não", () => {
    expect(path).toContain("if (isFuture && !quizPremium) {");
    /* O aviso continua existindo para quem não assina — tirar o toast deixaria
       o toque no nó do futuro sem resposta nenhuma. */
    expect(path).toContain("um passo de cada vez 💛");
  });

  test("o estado do botão acompanha a permissão", () => {
    /* `aria-disabled` e o cursor precisam concordar com o clique: um botão que
       se anuncia desabilitado e abre é pior que os dois estados errados. */
    expect(path).toContain("aria-disabled={isFuture && !quizPremium}");
    expect(path).toContain('${isFuture && !quizPremium ? "cursor-not-allowed" : ""}');
  });
});
