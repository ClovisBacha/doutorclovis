/**
 * DIVIDIR O CARTÃO NÃO PODE ESCONDER TRABALHO CLÍNICO.
 *
 * Este é o mesmo defeito que a fita principal do painel quase teve: ao empurrar
 * uma lista para dentro de uma aba, o número que fazia o médico ir até lá some
 * da tela — e a divisão que era para organizar passa a esconder. Lá o trabalho
 * escondido era uma pré-consulta; aqui é um registro fora de faixa sem
 * desfecho.
 */

import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import {
  ABAS_DA_PACIENTE,
  ABA_INICIAL_DA_PACIENTE,
  SECOES_DA_ABA,
  contadorDaAba,
  type SecaoDoProntuario,
} from "./abas-da-paciente";

describe("1. o contador sobe para a aba", () => {
  test("pendentes e SOS somam em «Agora»", () => {
    expect(contadorDaAba("Agora", { pendentes: 2, sosAbertos: 1 })).toBe(3);
  });

  test("um SOS sozinho já acende — é o que não pode esperar", () => {
    expect(contadorDaAba("Agora", { pendentes: 0, sosAbertos: 1 })).toBe(1);
  });

  test("as outras abas não contam nada", () => {
    /* História e Ficha são LEITURA. Um número ali competiria com o de "Agora" e
       ensinaria o médico a ignorar os dois. */
    expect(contadorDaAba("História", { pendentes: 9, sosAbertos: 9 })).toBe(0);
    expect(contadorDaAba("Ficha", { pendentes: 9, sosAbertos: 9 })).toBe(0);
  });

  test("nada pendente é zero, e zero não vira emblema", () => {
    expect(contadorDaAba("Agora", { pendentes: 0, sosAbertos: 0 })).toBe(0);
  });

  test("número negativo não subtrai do outro", () => {
    /* Viria de uma subtração errada lá em cima. Somar -3 com 2 daria zero, e um
       registro grave sem desfecho ficaria sem emblema. */
    expect(contadorDaAba("Agora", { pendentes: -3, sosAbertos: 2 })).toBe(2);
  });
});

describe("2. nenhuma seção do prontuário fica sem casa", () => {
  const TODAS: SecaoDoProntuario[] = ["quem", "mudou", "pendentes", "numeros", "linha"];

  test("as cinco seções aparecem em alguma aba", () => {
    /**
     * Uma seção que existe e não é alcançável é pior que uma que não existe,
     * porque ninguém a procura. Aqui isso seria a linha do tempo clínica
     * inteira sumindo do produto sem erro nenhum.
     */
    const cobertas = new Set(Object.values(SECOES_DA_ABA).flat());
    expect(TODAS.filter((s) => !cobertas.has(s))).toEqual([]);
  });

  test("nenhuma seção aparece em duas abas", () => {
    /* Duas casas para a mesma seção significa dois lugares para atualizar, e o
       médico vendo a mesma lista duas vezes sem saber qual é a de verdade. */
    const vistas = Object.values(SECOES_DA_ABA).flat();
    expect(vistas.length).toBe(new Set(vistas).size);
  });

  test("«quem é ela» fica em Agora, junto do que muda conduta", () => {
    /**
     * Idade gestacional e história de risco mudam a leitura de qualquer número
     * da tela. Empurradas para "Ficha", o médico leria "PA 135/88" sem saber
     * que ela tem pré-eclâmpsia prévia — e 135/88 numa e noutra são coisas
     * diferentes.
     */
    expect(SECOES_DA_ABA.Agora).toContain("quem");
  });

  test("o que pede olhar vem ANTES do que mudou, dentro de Agora", () => {
    /* Ordem é conteúdo aqui: um registro fora de faixa sem desfecho é mais
       urgente que o resumo do período. */
    const a = SECOES_DA_ABA.Agora;
    expect(a.indexOf("pendentes")).toBeLessThan(a.indexOf("mudou"));
  });
});

describe("3. onde o cartão abre", () => {
  test("abre em Agora", () => {
    /* O cartão é aberto no meio de uma consulta ou depois de um alerta — nos
       dois casos a pergunta é "o que eu faço com ela agora". */
    expect(ABA_INICIAL_DA_PACIENTE).toBe("Agora");
    expect(ABAS_DA_PACIENTE[0]).toBe("Agora");
  });

  test("são três abas, e as três têm nome", () => {
    expect(ABAS_DA_PACIENTE).toEqual(["Agora", "História", "Ficha"]);
  });
});

describe("4. e a tela de fato USA a régua", () => {
  /**
   * `contadorDaAba` estar certa não serve de nada se ninguém a chamar. Foi
   * exatamente essa a lacuna que um mutante encontrou na fita principal do
   * painel: a função somava corretamente um objeto que a tela nunca montava.
   */
  const painel = readFileSync("src/routes/_authenticated/painel.tsx", "utf8");

  test("o cartão da paciente monta as abas com a régua deste módulo", () => {
    expect(painel).toContain("contadorDaAba");
    expect(painel).toContain("SECOES_DA_ABA");
    expect(painel).toContain("ABA_INICIAL_DA_PACIENTE");
  });

  test("e alimenta o contador com as LISTAS de verdade, não com zero", () => {
    /**
     * A primeira versão deste teste procurava só `sosAbertos:` no arquivo — e
     * um mutante que trocou a contagem por `sosAbertos: 0` passou por ele
     * inteirinho. A string existia; o que ela media, não.
     *
     * Agora a asserção cobra a FONTE: os SOS sem desfecho e os registros fora
     * de faixa sem desfecho, filtrados das listas que a tela já tem. Com o
     * emblema zerado, uma emergência sem desfecho fica escondida atrás de uma
     * aba fechada.
     */
    const semEspacos = painel.replace(/\s+/g, " ");
    expect(semEspacos).toContain("sosAbertos: sosDela.filter((a) => !a.atendido_em).length");
    expect(semEspacos).toContain(
      'pendentes: prontuario.filter((e) => e.gravidade !== "normal" && !e.tratado_em).length',
    );
  });
});
