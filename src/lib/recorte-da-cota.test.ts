/**
 * O QUE A COTA CONTA — exercitado, e não conferido por string.
 *
 * ─── A LISTA DE EXCLUSÕES ERRAVA POR CONSTRUÇÃO ─────────────────────────────
 *
 * O recorte era `.neq("canal","suporte").neq("canal","teste")…`: contava TUDO
 * menos o que estivesse na lista. Todo canal novo entrava na cota do médico por
 * omissão — sem ninguém decidir.
 *
 * E aconteceu. Uma trava mecânica encontrou OITO chamadas pagas de modelo que
 * ninguém media: agenda do WhatsApp, triagem de sintomas, carta semanal do
 * bebê, busca de médicos, teleconsulta, conselheiro, nutrição e o rascunho do
 * cérebro. Medi-las com a régua antiga faria a franquia de dúvidas clínicas da
 * gestante ser consumida por uma busca de médico — e ela ficaria sem resposta
 * clínica por causa disso.
 *
 * Invertido para lista de PERMISSÃO, o erro fica impossível: quem quiser que um
 * canal novo conte precisa dizer isso de propósito, e isso aparece no diff.
 *
 * O teste não lê o arquivo: passa um construtor de consulta de mentira e olha
 * os filtros que a função realmente aplicou.
 */

import { describe, expect, test } from "bun:test";
import { CANAL_DA_COTA, aplicarRecorteDaCota } from "./cota-ia.server";

type Filtro = { op: string; coluna: string; valor: string };

/** Construtor de consulta que só anota o que pediram. */
function consultaFalsa() {
  const filtros: Filtro[] = [];
  const q: any = {
    eq: (coluna: string, valor: string) => {
      filtros.push({ op: "eq", coluna, valor });
      return q;
    },
    neq: (coluna: string, valor: string) => {
      filtros.push({ op: "neq", coluna, valor });
      return q;
    },
    not: (coluna: string, op: string, valor: string) => {
      filtros.push({ op: `not.${op}`, coluna, valor });
      return q;
    },
    /* Sobrevive à cadeia: quem chama continua com `.gte(...)` depois. */
    gte: () => q,
  };
  return { q, filtros };
}

describe("o recorte da cota", () => {
  const { q, filtros } = consultaFalsa();
  aplicarRecorteDaCota(q);

  test("conta o chat do app — o canal que o portão consegue parar", () => {
    /* O portão vive em `getBrainContext` e protege um caminho só. Contar o que
       ele não consegue interromper faria a cota estourar por um trabalho que
       ninguém tem como frear. */
    expect(filtros).toEqual([{ op: "eq", coluna: "canal", valor: "app" }]);
  });

  test("é uma lista de PERMISSÃO, não de exclusão", () => {
    /* O ponto inteiro desta mudança. Um `neq` aqui significaria que a régua
       voltou a ser "conta tudo menos…", e o próximo canal criado entraria na
       franquia da gestante sem ninguém decidir. */
    expect(filtros.some((f) => f.op.startsWith("neq") || f.op.startsWith("not"))).toBe(false);
  });

  test("um filtro só — nada de recorte extra escondido", () => {
    /* O erro simétrico: um filtro a mais faz a cota nunca estourar, o médico
       usa de graça e a conta chega para a plataforma. */
    expect(filtros).toHaveLength(1);
  });

  test("o canal é literalmente 'app'", () => {
    /* Literal, e não derivado da constante: um teste que só reafirma a
       constante passa verde quando alguém a troca por 'whatsapp'. Foi medido
       nesta base — mutar um limiar deixava a suíte inteira verde. */
    expect(CANAL_DA_COTA).toBe("app");
  });
});

describe("os canais que NÃO podem consumir a franquia clínica", () => {
  /* Cada um destes grava em `ai_usage`. Nenhum é dúvida clínica respondida pelo
     cérebro do médico, e nenhum é interrompível pelo portão de cota. */
  const FORA = [
    "suporte", // pergunta sobre a plataforma, respondida pela plataforma
    "teste", // o médico exercitando o próprio cérebro
    "cota-80", // marca de aviso
    "cota-100", // marca de aviso
    "agenda-whatsapp", // bot de marcação de horário
    "triagem", // orientação de sintoma — caminho de segurança, não freável
    "carta-semanal", // a carta do bebê
    "busca-medicos", // interpretar o texto de quem procura obstetra
    "teleconsulta", // resumo da consulta
    "conselheiro", // diagnóstico do consultório, para o médico
    "nutricao", // o chat de nutrição
    "rascunho-lacuna", // o rascunho que o médico revisa antes de publicar
  ];

  for (const canal of FORA) {
    test(`"${canal}" não conta na cota`, () => {
      const { q, filtros } = consultaFalsa();
      aplicarRecorteDaCota(q);
      const permitido = filtros.find((f) => f.op === "eq" && f.coluna === "canal")?.valor;
      expect(permitido).not.toBe(canal);
    });
  }
});
