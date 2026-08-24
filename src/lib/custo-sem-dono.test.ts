/**
 * O QUE A PLATAFORMA PAGA SOZINHA.
 *
 * `ai_usage` grava `doctor_id = null` para tudo que não pertence a consultório
 * nenhum: paciente sem médico vinculado, widget do site público e suporte. E
 * toda leitura de consumo que existia era POR MÉDICO — o card do painel, "quem
 * consome mais", a projeção do mês.
 *
 * Ninguém lia as linhas sem dono. É o mesmo padrão da `similaridade` que este
 * projeto acabou de consertar — coluna escrita e nunca lida —, só que desta vez
 * é a nossa conta: não havia nenhuma tela dizendo quanto gastamos com quem
 * ainda não é paciente de ninguém, que é o número que decide se o widget
 * público se paga.
 */

import { describe, expect, test } from "bun:test";
import { agruparPorCanal, type LinhaDeUso } from "./platform.functions";

const l = (canal: string | null, entrada: number, saida: number): LinhaDeUso => ({
  canal,
  input_tokens: entrada,
  output_tokens: saida,
});

describe("a soma por canal", () => {
  test("junta as linhas do mesmo canal", () => {
    const r = agruparPorCanal([l("site", 100, 50), l("site", 200, 100)]);
    expect(r).toEqual([{ canal: "site", respostas: 2, entrada: 300, saida: 150 }]);
  });

  test("o canal mais caro vem primeiro", () => {
    /* Ordenar é o que transforma o número em decisão: "o widget gastou X e o
       suporte gastou Y" permite desligar um dos dois. Um total só não permite
       decidir nada. */
    const r = agruparPorCanal([l("suporte", 10, 10), l("site", 900, 900)]);
    expect(r.map((c) => c.canal)).toEqual(["site", "suporte"]);
  });

  test("ordena pelo TOTAL, não só pela saída", () => {
    /* Entrada é a maior parcela num prompt com o cérebro dentro — ignorá-la
       poria no topo o canal errado, e o corte iria para o lugar errado. */
    const r = agruparPorCanal([l("a", 0, 100), l("b", 500, 0)]);
    expect(r[0]?.canal).toBe("b");
  });
});

describe("linha sem rótulo é gasto real", () => {
  test("canal nulo vira '(sem canal)' e NÃO é descartado", () => {
    /* Descartar produziria um total que não fecha com a fatura — exatamente o
       defeito que este card existe para acabar. */
    const r = agruparPorCanal([l(null, 10, 20)]);
    expect(r).toEqual([{ canal: "(sem canal)", respostas: 1, entrada: 10, saida: 20 }]);
  });

  test("canal em branco também", () => {
    expect(agruparPorCanal([l("   ", 1, 1)])[0]?.canal).toBe("(sem canal)");
  });

  test("tokens ausentes contam como zero, e a resposta ainda conta", () => {
    /* O número de RESPOSTAS não pode sumir porque o provedor não devolveu
       `usage`: sem ele, "gastamos pouco" e "não medimos" ficam iguais. */
    const r = agruparPorCanal([{ canal: "site", input_tokens: null, output_tokens: null }]);
    expect(r).toEqual([{ canal: "site", respostas: 1, entrada: 0, saida: 0 }]);
  });
});

describe("nada a mostrar não é erro", () => {
  test("lista vazia devolve lista vazia", () => {
    expect(agruparPorCanal([])).toEqual([]);
  });
});
