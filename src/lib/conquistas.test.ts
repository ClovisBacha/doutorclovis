/**
 * AS CONQUISTAS — a raridade não pode virar gosto, e a economia não pode virar
 * renda.
 *
 * Dois riscos moram aqui, e nenhum dos dois aparece olhando a tela:
 *
 *  1. RARIDADE ARBITRÁRIA. "Achei que essa é épica" não sobrevive à segunda
 *     pessoa que mexe no arquivo. O sintoma é a paciente ver duas conquistas de
 *     esforço parecido com molduras diferentes — e concluir, com razão, que o
 *     sistema é aleatório.
 *
 *  2. INFLAÇÃO. Cada conquista paga Sementinhas, e Sementinha compra item da
 *     loja. Vinte épicas acrescentadas de uma vez transformam a loja em
 *     brinde — e ninguém percebe até a paciente zerar tudo na primeira semana.
 */

import { describe, expect, test } from "bun:test";
import {
  CONQUISTAS,
  RARIDADES,
  RARIDADES_EM_ORDEM,
  ATIVIDADES_DO_DIA,
  aulasRespondidas,
  conquistaPorChave,
  contarPorRaridade,
  diasDistintos,
  ehPosParto,
  maiorSequencia,
  orcamentoDasConquistas,
  sementinhasDaRaridade,
  vezesQueFez,
} from "./conquistas";
import { CUSTO_LOJA_GRATIS } from "./economia-sementinhas";

describe("o catálogo é coerente", () => {
  test("as chaves são únicas", () => {
    const ks = CONQUISTAS.map((c) => c.key);
    expect(new Set(ks).size).toBe(ks.length);
  });

  test("nenhum título ou descrição vazio", () => {
    for (const c of CONQUISTAS) {
      expect(c.title.length).toBeGreaterThan(2);
      expect(c.description.length).toBeGreaterThan(5);
      expect(c.emoji.length).toBeGreaterThan(0);
    }
  });

  test("cobre o app de hoje, e não só o de um ano atrás", () => {
    /* O buraco que este redesenho fechou: o app ganhou meditação, gratidão,
       cartas pro bebê, exercício por queixa e dias fechados, e NENHUM deles
       tinha conquista. Dava para meditar trinta dias seguidos sem a aba de
       conquistas saber que você existia. */
    const chaves = CONQUISTAS.map((c) => c.key).join(" ");
    for (const assunto of ["medita", "gratidao", "carta", "exercicio", "trofeu", "sequencia"]) {
      expect(chaves).toContain(assunto);
    }
  });

  test("são pelo menos 34", () => {
    expect(CONQUISTAS.length).toBeGreaterThanOrEqual(34);
  });

  test("`ehPosParto` só é verdade para as marcadas", () => {
    for (const c of CONQUISTAS) {
      expect(ehPosParto(c.key)).toBe(!!c.posParto);
    }
    expect(ehPosParto("chave-que-nao-existe")).toBe(false);
  });

  test("conquistaPorChave acha o que existe e não inventa o que não existe", () => {
    expect(conquistaPorChave("medita_10")?.raridade).toBe("raro");
    expect(conquistaPorChave("nao-existe")).toBeUndefined();
  });
});

describe("⚠️ a raridade tem régua, não gosto", () => {
  test("as três existem, com critério escrito", () => {
    expect(RARIDADES_EM_ORDEM).toEqual(["epico", "raro", "comum"]);
    for (const r of RARIDADES_EM_ORDEM) {
      expect(RARIDADES[r].criterio.length).toBeGreaterThan(30);
    }
  });

  test("as cores são as que o dono pediu: cinza, azul, dourado", () => {
    expect(RARIDADES.comum.anel).toContain("slate");
    expect(RARIDADES.raro.anel).toContain("sky");
    expect(RARIDADES.epico.anel).toContain("amber");
  });

  test("mais difícil paga mais — sempre, sem empate", () => {
    /* O pedido literal: "maior nível de dificuldade, mais sementes". Um empate
       aqui apagaria a diferença que a cor promete. */
    expect(RARIDADES.comum.sementinhas).toBeLessThan(RARIDADES.raro.sementinhas);
    expect(RARIDADES.raro.sementinhas).toBeLessThan(RARIDADES.epico.sementinhas);
  });

  test("⚠️ 'primeira vez' nunca é épica, e 'todos/30' nunca é comum", () => {
    /* A régua aplicada ao catálogo. Uma conquista de estreia que virasse épica
       pagaria 120 🌱 por abrir o app uma vez — e a paciente aprenderia que o
       dourado não quer dizer nada. */
    for (const c of CONQUISTAS) {
      const estreia =
        /^(first_|medita_1$|gratidao_1$|carta_1$|exercicio_1$|trofeu_1$|cantinho_1$)/.test(c.key);
      if (estreia) expect(c.raridade).toBe("comum");
    }
  });

  test("⚠️ o topo de cada escada é épico, e só o topo", () => {
    /* ─── ESTE TESTE JÁ ESTEVE ERRADO DUAS VEZES ────────────────────────────
       1ª versão: `_complete$` — pegava `profile_complete` junto e exigia que
          "preencher o perfil" fosse épica.
       2ª versão: `_(30|50)$` — passou a reprovar `aula_50` no dia em que a
          escada da aula ganhou um degrau acima dele (`course_complete`, 100).

       As duas falhavam pelo mesmo motivo: adivinhar dificuldade pelo NOME da
       chave. A régua de verdade é sobre a ESCADA — o degrau mais alto de cada
       assunto é o épico, e nenhum degrau abaixo dele pode ser. Escrever as
       escadas à mão custa cinco linhas e para de mentir quando um degrau
       novo entra. */
    const ESCADAS: Record<string, string[]> = {
      aula: ["first_course", "course_5", "aula_10", "aula_50", "course_complete"],
      meditacao: ["medita_1", "medita_10", "medita_30"],
      gratidao: ["gratidao_1", "gratidao_10", "gratidao_50"],
      carta: ["carta_1", "carta_10", "carta_30"],
      exercicio: ["exercicio_1", "exercicio_10", "exercicio_30"],
      trofeu: ["trofeu_1", "trofeu_10", "trofeu_30"],
      sequencia: ["sequencia_7", "sequencia_30"],
      cantinho: ["cantinho_1", "cantinho_10"],
    };
    for (const [assunto, degraus] of Object.entries(ESCADAS)) {
      for (const k of degraus) {
        expect(conquistaPorChave(k), `${assunto}: ${k} não existe`).toBeDefined();
      }
      const topo = degraus[degraus.length - 1];
      const abaixo = degraus.slice(0, -1);
      /* O topo é épico — exceto nas escadas curtas (2 degraus), onde o topo
         ainda é repetição sustentada e não marco de meses. */
      if (degraus.length >= 3) {
        expect(conquistaPorChave(topo)!.raridade, `topo de ${assunto}`).toBe("epico");
      }
      for (const k of abaixo) {
        expect(conquistaPorChave(k)!.raridade, `${k} não pode ser épico`).not.toBe("epico");
      }
    }
  });

  test("existe conquista das três raridades — nenhuma prateleira vazia", () => {
    const n = contarPorRaridade(CONQUISTAS);
    expect(n.comum).toBeGreaterThan(0);
    expect(n.raro).toBeGreaterThan(0);
    expect(n.epico).toBeGreaterThan(0);
  });

  test("épico é o mais raro dos três — senão a palavra não quer dizer nada", () => {
    const n = contarPorRaridade(CONQUISTAS);
    expect(n.epico).toBeLessThan(n.comum);
    expect(n.epico).toBeLessThanOrEqual(n.raro);
  });
});

describe("⚠️ a economia não vira renda", () => {
  const total = orcamentoDasConquistas(CONQUISTAS);

  test("desbloquear tudo paga menos que três lojas grátis", () => {
    /* A loja grátis custa 704 🌱 e some por volta do 15º dia. As conquistas
       levam MESES para completar — se elas sozinhas pagassem várias lojas, o
       jogo teria uma segunda moeda infinita e a primeira perderia o sentido.
       O número exato importa menos que o teto: ele existe para avisar no dia
       em que alguém acrescentar vinte épicas de uma vez. */
    expect(total).toBeLessThan(CUSTO_LOJA_GRATIS * 3);
  });

  test("mas paga o suficiente para valer a pena", () => {
    expect(total).toBeGreaterThan(CUSTO_LOJA_GRATIS);
  });

  test("o valor por raridade bate com a tabela", () => {
    expect(sementinhasDaRaridade("comum")).toBe(RARIDADES.comum.sementinhas);
    expect(sementinhasDaRaridade("epico")).toBe(RARIDADES.epico.sementinhas);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   A LEITURA DO LEDGER
   ══════════════════════════════════════════════════════════════════════════ */

const CICLO = "2026-03-07";
const OUTRO = "2025-01-01";

function chave(ativ: string, ciclo: string, dia: number) {
  return `wellness:${ativ}:${ciclo}:${dia}`;
}

describe("vezesQueFez", () => {
  test("conta os dias em que a atividade aconteceu", () => {
    const ks = [chave("meditation", CICLO, 10), chave("meditation", CICLO, 11)];
    expect(vezesQueFez(ks, "meditation", CICLO)).toBe(2);
  });

  test("a mesma atividade no mesmo dia conta UMA vez", () => {
    const ks = [chave("meditation", CICLO, 10), chave("meditation", CICLO, 10)];
    expect(vezesQueFez(ks, "meditation", CICLO)).toBe(1);
  });

  test("não mistura atividades", () => {
    const ks = [chave("meditation", CICLO, 10), chave("bonding", CICLO, 10)];
    expect(vezesQueFez(ks, "meditation", CICLO)).toBe(1);
    expect(vezesQueFez(ks, "bonding", CICLO)).toBe(1);
    expect(vezesQueFez(ks, "movement", CICLO)).toBe(0);
  });

  test("⚠️ NÃO conta a gestação anterior", () => {
    /* Sem o recorte por ciclo, a segunda gestação nasceria com as conquistas
       da primeira já dadas — e a jornada nova começaria sem nada a conquistar. */
    const ks = [chave("meditation", OUTRO, 10), chave("meditation", OUTRO, 11)];
    expect(vezesQueFez(ks, "meditation", CICLO)).toBe(0);
  });

  test("lixo no ledger não conta", () => {
    const ks = [null, undefined, "", "wellness:", "outra-coisa:1:2:3", "wellness:meditation:c"];
    expect(vezesQueFez(ks, "meditation", CICLO)).toBe(0);
  });

  test("gasto na loja (dedupe_key nulo) não vira conquista", () => {
    expect(vezesQueFez([null, null, null], "meditation", CICLO)).toBe(0);
  });
});

describe("⚠️ diasDistintos — 'repetição sustentada' que se faz numa tarde", () => {
  test("dez registros no mesmo dia contam UM dia", () => {
    /* O defeito exato que isto conserta: `health_7_days` e `journal_10` são
       de raridade `raro` ("hábito custa semanas") e contavam LINHAS. Dava
       para fechá-las salvando dez vezes seguidas numa tarde. */
    const mesmaTarde = Array.from({ length: 10 }, (_, i) => `2026-03-07T1${i % 10}:00:00-03:00`);
    expect(diasDistintos(mesmaTarde)).toBe(1);
  });

  test("dias diferentes contam separado", () => {
    expect(diasDistintos(["2026-03-07T10:00:00-03:00", "2026-03-08T10:00:00-03:00"])).toBe(2);
  });

  test("⚠️ o dia é o de São Paulo, não o UTC", () => {
    /* 22h de Brasília é 01h do dia seguinte em UTC. Contando por UTC, dois
       registros da MESMA noite virariam dois dias — e a conquista de sete
       dias sairia em quatro noites. */
    const noite = "2026-03-07T22:00:00-03:00";
    const maisTarde = "2026-03-07T23:30:00-03:00";
    expect(diasDistintos([noite, maisTarde])).toBe(1);
  });

  test("nulo, vazio e data inválida não contam", () => {
    expect(diasDistintos([null, undefined, "", "nao-e-data"])).toBe(0);
  });

  test("lista vazia é zero", () => {
    expect(diasDistintos([])).toBe(0);
  });
});

describe("⚠️ as conquistas da Escola do Bebê apontam pra aula do dia", () => {
  test("as três chaves continuam existindo", () => {
    /* Elas liam `course_progress`, e o nó que abriria a Escola não é mais
       emitido pela trilha — eram três conquistas impossíveis, uma épica.
       As CHAVES ficam: apagá-las tiraria a medalha de quem já a tivesse, e o
       app não pode tirar de volta o que deu. */
    for (const k of ["first_course", "course_5", "course_complete"]) {
      expect(conquistaPorChave(k)).toBeDefined();
    }
  });

  test("e o texto delas não promete mais a Escola", () => {
    /* Descrição que fala de "módulos da Escola do Bebê" seria a mesma mentira
       com outra fonte de dados. */
    for (const k of ["first_course", "course_5", "course_complete"]) {
      const d = conquistaPorChave(k)!.description.toLowerCase();
      expect(d).not.toContain("módulo");
      expect(d).not.toContain("escola do bebê");
    }
  });

  test("a escada da aula tem UM épico só", () => {
    /* 1 · 5 · 10 · 50 · 100. Dois dourados na mesma escada fariam o dourado
       valer metade. */
    const escada = ["first_course", "course_5", "aula_10", "aula_50", "course_complete"];
    const epicos = escada.filter((k) => conquistaPorChave(k)?.raridade === "epico");
    expect(epicos).toEqual(["course_complete"]);
  });
});

describe("aulasRespondidas", () => {
  test("conta as do ciclo, sem repetir dia", () => {
    const ks = [`dailyquiz:${CICLO}:20`, `dailyquiz:${CICLO}:20`, `dailyquiz:${CICLO}:21`];
    expect(aulasRespondidas(ks, CICLO)).toBe(2);
  });

  test("ignora outro ciclo e outros prefixos", () => {
    const ks = [`dailyquiz:${OUTRO}:20`, chave("meditation", CICLO, 20)];
    expect(aulasRespondidas(ks, CICLO)).toBe(0);
  });
});

describe("maiorSequencia", () => {
  test("dias seguidos contam", () => {
    const ks = [10, 11, 12].map((d) => chave("meditation", CICLO, d));
    expect(maiorSequencia(ks, CICLO)).toBe(3);
  });

  test("um buraco corta a sequência, e a MAIOR vence", () => {
    const ks = [10, 11, 20, 21, 22, 23].map((d) => chave("bonding", CICLO, d));
    expect(maiorSequencia(ks, CICLO)).toBe(4);
  });

  test("atividades diferentes no mesmo dia não inflam", () => {
    const ks = [chave("meditation", CICLO, 5), chave("bonding", CICLO, 5)];
    expect(maiorSequencia(ks, CICLO)).toBe(1);
  });

  test("⚠️ é a MAIOR já feita, não a atual", () => {
    /* Conquista é marco: "você já conseguiu sete dias seguidos" é um fato que
       aconteceu. Tirá-la porque a sequência quebrou seria transformar
       conquista em cobrança — e este app não faz isso. A chama do Caminho
       continua mostrando a sequência atual; são perguntas diferentes. */
    const ks = [1, 2, 3, 4, 5, 6, 7, /* buraco */ 40].map((d) => chave("gratitude", CICLO, d));
    expect(maiorSequencia(ks, CICLO)).toBe(7);
  });

  test("sem nada, zero", () => {
    expect(maiorSequencia([], CICLO)).toBe(0);
  });

  test("atividade desconhecida não conta", () => {
    /* Se amanhã alguém gravar `wellness:banho:...`, o dia não passa a valer
       sequência por engano. */
    expect(maiorSequencia([chave("banho", CICLO, 5)], CICLO)).toBe(0);
  });

  test("as quatro atividades conhecidas são as do Caminho", () => {
    expect([...ATIVIDADES_DO_DIA].sort()).toEqual(
      ["bonding", "gratitude", "meditation", "movement"].sort(),
    );
  });
});
