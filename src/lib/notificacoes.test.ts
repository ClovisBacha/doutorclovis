/**
 * A CAIXA DE ENTRADA: o que fica, o que some, e o que NUNCA some.
 *
 * Pedido do dono: "sempre ficará guardado ali as notificações durante pelo
 * menos 7 dias, depois elas somem (as que já foram lidas)". A palavra que
 * carrega o risco é "as que já foram lidas" — e é ela que este arquivo protege.
 */

import { describe, expect, test } from "bun:test";
import {
  contarNaoLidas,
  DIAS_APOS_LIDA,
  visiveis,
  type Lidas,
  type Notificacao,
} from "./notificacoes";

const n = (id: string): Notificacao => ({ id, icone: "💌", titulo: id, corpo: "" });
const AGORA = new Date("2026-08-12T12:00:00.000Z");
const haDias = (d: number) => new Date(AGORA.getTime() - d * 86_400_000).toISOString();

describe("os sete dias", () => {
  test("lida hoje continua na caixa", () => {
    const lidas: Lidas = new Map([["a", haDias(0)]]);
    expect(visiveis([n("a")], lidas, AGORA).map((x) => x.id)).toEqual(["a"]);
  });

  test("lida há seis dias continua; há oito, some", () => {
    const lidas: Lidas = new Map([
      ["seis", haDias(6)],
      ["oito", haDias(8)],
    ]);
    const fica = visiveis([n("seis"), n("oito")], lidas, AGORA).map((x) => x.id);
    expect(fica).toEqual(["seis"]);
  });

  test("a borda exata dos sete dias ainda aparece", () => {
    /* "PELO MENOS 7 dias" — então o sétimo dia inteiro conta. Fechar em
       `>` em vez de `>=` cortaria um dia da promessa. */
    const lidas: Lidas = new Map([["borda", haDias(DIAS_APOS_LIDA)]]);
    expect(visiveis([n("borda")], lidas, AGORA)).toHaveLength(1);
  });
});

describe("o que NUNCA some", () => {
  test("não lida fica, por mais velha que seja", () => {
    /* A única falha grave possível nesta tela: o app decidir por ela que algo
       que ela nunca abriu não importava. */
    expect(visiveis([n("nunca-abri")], new Map(), AGORA)).toHaveLength(1);
  });

  test("carimbo ilegível conta como recém-lida — na dúvida, mostrar", () => {
    const lidas: Lidas = new Map([["torta", "não é uma data"]]);
    expect(visiveis([n("torta")], lidas, AGORA)).toHaveLength(1);
  });
});

describe("a conta do emblema", () => {
  test("conta só o que ela não abriu", () => {
    const lidas: Lidas = new Map([["a", haDias(1)]]);
    expect(contarNaoLidas([n("a"), n("b"), n("c")], lidas)).toBe(3 - 1);
  });

  test("uma lida velha não volta a contar quando some da caixa", () => {
    /* Sutil e importante: `visiveis` esconde a lida antiga, e o emblema conta
       sobre a lista JÁ FILTRADA. Contando sobre a lista crua, uma notificação
       invisível continuaria puxando o número — e a paciente abriria a caixa
       procurando um recado que não está lá. */
    const lista = [n("velha"), n("nova")];
    const lidas: Lidas = new Map([["velha", haDias(30)]]);
    expect(contarNaoLidas(visiveis(lista, lidas, AGORA), lidas)).toBe(1);
  });
});
