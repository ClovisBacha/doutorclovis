/**
 * O PLACAR DO CÉREBRO NÃO PODE MENTIR PARA O MÉDICO.
 *
 * Ele é a prova de valor do produto: "sua IA cobriu 91% das dúvidas". É com
 * esse número que o médico decide se o Segundo Cérebro está funcionando — e se
 * vale continuar pagando.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const cerebro = readFileSync("src/lib/secondbrain.server.ts", "utf8");
const painel = readFileSync("src/routes/_authenticated/painel.tsx", "utf8");

describe("a mesma mensagem não conta como acerto E como lacuna", () => {
  /**
   * Era "bloco não-vazio → registra o hit". Mas o bloco nasce não-vazio só com
   * persona, frases ou regras preenchidas — que é o que o produto pede no
   * primeiro acesso. Então, para todo médico que configurou o estilo, QUALQUER
   * pergunta contava um acerto, inclusive as que não casaram com nada. E a
   * mesma mensagem já tinha agendado uma lacuna algumas linhas acima.
   *
   * `hits / (hits + lacunas)`: a mesma pergunta nos dois lados da fração. A
   * cobertura subia sozinha conforme ele preenchia a persona, sem uma única
   * entrada de conhecimento.
   */
  test("o hit exige que alguma orientação dele tenha casado", () => {
    expect(cerebro).toContain("if (selected.length > 0) logBrainHit(target, channel);");
  });

  test("é a MESMA condição de hadCoverage — as duas não podem discordar", () => {
    /* As duas respondem "alguma orientação dele entrou nesta resposta?". Se
       divergirem, o placar volta a mentir por outro caminho. */
    const i = cerebro.indexOf("if (selected.length > 0) logBrainHit");
    expect(cerebro.slice(i, i + 600)).toContain("hadCoverage: selected.length > 0");
  });

  test("o hit não é mais registrado só por o bloco existir", () => {
    expect(cerebro).not.toMatch(/^\s*logBrainHit\(target, channel\);$/m);
  });
});

describe("o contador da faixa desce quando o médico trabalha", () => {
  /**
   * `onContar` só era chamado no CARREGAMENTO. O médico resolvia a fila
   * inteira e o badge "O que está esperando você" continuava no número de
   * quando ele abriu a tela, até recarregar. Um número que não responde ao
   * trabalho ensina a ignorar o número.
   */
  test("resolver uma lacuna recontabiliza a fila", () => {
    const i = painel.indexOf("setSoParaEla(false);");
    expect(i).toBeGreaterThan(-1);
    expect(painel.slice(i, i + 400)).toContain("onContar?.(restantes.length)");
  });

  test("ignorar também", () => {
    const i = painel.indexOf('else toast.error("Não foi possível ignorar.");');
    expect(i).toBeGreaterThan(-1);
    expect(painel.slice(Math.max(0, i - 500), i)).toContain("onContar?.(restantes.length)");
  });

  test("treinar uma pergunta desce o total exato", () => {
    /* `totalQ` vem de uma contagem exata do servidor: a tela mostra 50 e o
       cabeçalho diz quantas existem. Sem descer, ele responde as 50 e o número
       fica igual. */
    const i = painel.indexOf("setTotalQ((n) => Math.max(0, n - 1));");
    expect(i).toBeGreaterThan(-1);
    expect(painel.slice(i, i + 200)).toContain("onContar?.(Math.max(0, totalQ - 1))");
  });
});

describe('a caixa "só para ela" é do item, não da tela', () => {
  test("ela é desmarcada ao terminar uma lacuna", () => {
    /* Ficar marcada faria a PRÓXIMA lacuna ser respondida em modo individual
       sem ele perceber — e aí o conhecimento que ele achou que estava criando
       simplesmente não existe. */
    const i = painel.indexOf("async function resolve(gapId: string)");
    expect(i).toBeGreaterThan(-1);
    expect(painel.slice(i, i + 2000)).toContain("setSoParaEla(false)");
  });
});
