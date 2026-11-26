/**
 * NO MODO CUIDADO, O CRONÔMETRO DE CONTRAÇÕES PARA DE FALAR DO BEBÊ.
 *
 * ⚠️ O cronômetro fica de pé no luto de propósito (quem perdeu a gestação pode
 * estar em trabalho de parto), mas a caixa vermelha dele dizia "o bebê estiver
 * se mexendo menos que o normal" — para quem acabou de perder o bebê. O
 * componente não recebia `careMode`, e o próprio comentário dele admitia.
 *
 * A régua virou função pura: a tela desenha o que `bandeirasDoParto` devolve,
 * e o teste cobra as duas pontas — a lista e o fio até a tela.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { semComentarios } from "@/lib/sem-comentarios";
import { BANDEIRAS_DO_CORPO, BANDEIRA_DO_BEBE, bandeirasDoParto } from "@/lib/bandeiras-do-parto";

describe("as bandeiras vermelhas do parto", () => {
  test("fora do luto são as quatro da ACOG, e a do bebê é a última", () => {
    const lista = bandeirasDoParto(false);
    expect(lista).toHaveLength(4);
    expect(lista.slice(0, 3)).toEqual([...BANDEIRAS_DO_CORPO]);
    expect(lista[3]).toBe(BANDEIRA_DO_BEBE);
  });

  test("⚠️ no luto ficam só as três do corpo dela — e nenhuma fala do bebê", () => {
    const lista = bandeirasDoParto(true);
    expect(lista).toEqual([...BANDEIRAS_DO_CORPO]);
    for (const b of lista) expect(b).not.toMatch(/beb[êe]/i);
  });

  test("as três do corpo não mudam entre os dois modos", () => {
    expect(bandeirasDoParto(true)).toEqual(bandeirasDoParto(false).slice(0, 3));
  });
});

describe("⚠️ e a tela usa a régua, não uma frase cravada", () => {
  const TELA = semComentarios(readFileSync("src/components/contracoes-tab.tsx", "utf8"));
  const CONTA = semComentarios(readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8"));

  test("o cronômetro desenha `bandeirasDoParto(careMode)`", () => {
    expect(TELA).toContain("bandeirasDoParto(careMode)");
    /* A frase do bebê não pode voltar a morar no JSX — o luto não a alcançaria. */
    expect(TELA).not.toContain("mexendo menos");
  });

  test("e RECEBE o estado da conta — sem a prop, a régua seria código morto", () => {
    /* ⚠️ Só o LUTO, nunca `careMode` (que inclui a leitura instável): a rede
       oscilando não pode tirar um aviso de segurança de quem está grávida. */
    expect(CONTA).toMatch(/<ContracoesTab[^>]*careMode=\{luto\}/);
    expect(CONTA).toMatch(/<RegistrosHub[\s\S]{0,400}luto=\{lutoDoPerfil\}/);
    expect(CONTA).not.toMatch(/<ContracoesTab[^>]*careMode=\{careMode\}/);
  });
});
