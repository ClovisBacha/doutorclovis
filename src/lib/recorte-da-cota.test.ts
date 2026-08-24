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
import { readFileSync, readdirSync } from "node:fs";
import { CANAIS_DA_COTA, aplicarRecorteDaCota } from "./cota-ia.server";

type Filtro = { op: string; coluna: string; valor: string };

/** Construtor de consulta que só anota o que pediram. */
function consultaFalsa() {
  const filtros: Filtro[] = [];
  const q: any = {
    eq: (coluna: string, valor: string) => {
      filtros.push({ op: "eq", coluna, valor });
      return q;
    },
    in: (coluna: string, valores: readonly string[]) => {
      filtros.push({ op: "in", coluna, valor: [...valores].join(",") });
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

  test("conta os chats clínicos do app — o que o portão consegue parar", () => {
    /* O portão vive em `getBrainContext`. Contar o que ele não consegue
       interromper faria a cota estourar por um trabalho que ninguém tem como
       frear — e a gestante ficaria sem resposta clínica por causa disso. */
    expect(filtros).toEqual([{ op: "in", coluna: "canal", valor: "app,nutricao" }]);
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

  test("os canais são literalmente 'app' e 'nutricao'", () => {
    /* Literais, e não derivados da constante: um teste que só a reafirma passa
       verde quando alguém troca 'app' por 'whatsapp'. Foi medido nesta base —
       mutar um limiar deixava a suíte inteira verde.
       Os dois são chat CLÍNICO da paciente com o cérebro do médico. Um terceiro
       aqui precisa ser essa mesma coisa, e não "mais um lugar que usa IA". */
    expect([...CANAIS_DA_COTA].sort()).toEqual(["app", "nutricao"]);
  });
});

describe("os canais que NÃO podem consumir a franquia clínica", () => {
  /**
   * ─── A LISTA ESCRITA À MÃO NÃO PROVAVA NADA ────────────────────────────────
   *
   * A versão anterior era uma lista fixa de 15 nomes, escrita à mão. Alguns dos
   * nomes não correspondem a nenhum literal do código (`teste`, `cota-80`,
   * `cota-100`, `embedding` — os dois de cota são montados dinamicamente), e
   * nada garantia que ela acompanhasse os canais reais.
   *
   * E o defeito estrutural é maior que os oito nomes errados: um canal NOVO
   * nasceria sem teste nenhum, porque ninguém lembraria de vir aqui escrevê-lo.
   * O portão de cota é `allow-list`, então um canal novo já nasce fora da cota —
   * o que este teste tem de garantir é que ele nasça fora DE PROPÓSITO, e que
   * ninguém amplie a allow-list sem passar por aqui.
   *
   * A lista passa a ser DESCOBERTA na fonte. Um canal novo entra sozinho.
   */
  const CANAIS_NA_FONTE = (() => {
    const achados = new Set<string>();
    const arquivos = readdirSync("src/lib")
      .filter((f) => f.endsWith(".ts") && !f.includes(".test."))
      .map((f) => `src/lib/${f}`)
      .concat(
        readdirSync("src/routes/api")
          .filter((f) => f.endsWith(".ts"))
          .map((f) => `src/routes/api/${f}`),
      );
    for (const f of arquivos) {
      const bruto = readFileSync(f, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      /* TODOS os literais da linha, e não só o que vem logo depois dos
         dois-pontos: o canal do chat é um TERNÁRIO —
         `canal: soSuporte ? "suporte" : patient ? "app" : "site"` — e uma
         regex ancorada em `canal:\s*"` perdia os três de uma vez, incluindo o
         `app`, que é o canal principal do produto. */
      for (const linha of bruto.split("\n")) {
        if (!/\bcanal:/.test(linha)) continue;
        for (const m of linha.matchAll(/"([a-z0-9-]+)"/g)) achados.add(m[1]);
      }
    }
    return [...achados].sort();
  })();

  test("a varredura acha canais de verdade — senão o resto é decoração", () => {
    /* Se a descoberta quebrar, todos os testes abaixo passam com zero itens e
       este arquivo vira enfeite, que é o que ele existe para não ser. */
    expect(CANAIS_NA_FONTE.length).toBeGreaterThanOrEqual(10);
    expect(CANAIS_NA_FONTE).toContain("app");
  });

  test("os canais do ternário do chat entram — eram os que sumiam", () => {
    /* `app` é o canal principal do produto e não estava na varredura enquanto
       a regex ficou ancorada em `canal:\s*"`. Um teste de inventário que perde
       o item mais importante é pior que não ter inventário. */
    expect(CANAIS_NA_FONTE).toContain("app");
    expect(CANAIS_NA_FONTE).toContain("site");
    expect(CANAIS_NA_FONTE).toContain("suporte");
  });

  for (const canal of CANAIS_NA_FONTE.filter(
    (c) => !([...CANAIS_DA_COTA] as string[]).includes(c),
  )) {
    test(`"${canal}" não conta na cota`, () => {
      const { q, filtros } = consultaFalsa();
      aplicarRecorteDaCota(q);
      const permitidos = (filtros.find((f) => f.op === "in")?.valor ?? "").split(",");
      expect(permitidos).not.toContain(canal);
    });
  }

  for (const canal of CANAIS_DA_COTA) {
    test(`"${canal}" CONTA na cota — o simétrico`, () => {
      /* Sem isto, esvaziar a allow-list passaria em todos os testes acima:
         "nenhum canal conta" satisfaz "este canal não conta". */
      const { q, filtros } = consultaFalsa();
      aplicarRecorteDaCota(q);
      const permitidos = (filtros.find((f) => f.op === "in")?.valor ?? "").split(",");
      expect(permitidos).toContain(canal);
    });
  }
});
