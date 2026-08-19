import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  ATIVIDADES_DO_DESAFIO,
  atividadeConhecida,
  chaveDoDesafio,
  diasNaJanela,
  DIAS_ALVO_MAX,
  DIAS_ALVO_PADRAO,
  domingoDaSemana,
  fechou,
  fraseDoGrupo,
  MINIMO_PARA_CONTAR,
  segundaDaSemana,
  vigente,
} from "./desafio-em-grupo";

describe("a semana do desafio", () => {
  test("segunda a domingo", () => {
    // 2026-08-19 é uma quarta-feira.
    expect(segundaDaSemana("2026-08-19")).toBe("2026-08-17");
    expect(domingoDaSemana("2026-08-19")).toBe("2026-08-23");
  });

  test("⚠️ DOMINGO pertence à semana que termina nele, não à seguinte", () => {
    // `getUTCDay()` devolve 0 para domingo: recuar `dia - 1` daria -1 e jogaria
    // o domingo para a semana seguinte. Foi o off-by-one que quase entrou.
    expect(segundaDaSemana("2026-08-23")).toBe("2026-08-17");
    expect(domingoDaSemana("2026-08-23")).toBe("2026-08-23");
  });

  test("segunda é o primeiro dia dela mesma", () => {
    expect(segundaDaSemana("2026-08-17")).toBe("2026-08-17");
  });

  test("atravessa a virada de mês e de ano sem tropeçar", () => {
    expect(segundaDaSemana("2027-01-01")).toBe("2026-12-28");
    expect(domingoDaSemana("2026-12-28")).toBe("2027-01-03");
  });
});

describe("o que conta como fechado", () => {
  const dias = new Set(["2026-08-17", "2026-08-18", "2026-08-20", "2026-09-01"]);

  test("só os dias DENTRO da janela contam", () => {
    expect(diasNaJanela(dias, "2026-08-17", "2026-08-23")).toBe(3);
  });

  test("fora da janela não conta", () => {
    expect(diasNaJanela(dias, "2026-08-24", "2026-08-30")).toBe(0);
  });

  test("⚠️ as DUAS bordas contam — inclusive o domingo", () => {
    /* Uma mutação passou verde trocando `d <= fim` por `d < fim`: o fixture não
       tinha nenhum dia igual ao `fim`. `domingoDaSemana` e `vigente` testam as
       bordas explicitamente; o contador não testava — e um desafio fechado NO
       DOMINGO deixaria de contar, que é o dia em que ele mais fecha. */
    expect(diasNaJanela(new Set(["2026-08-17"]), "2026-08-17", "2026-08-23")).toBe(1);
    expect(diasNaJanela(new Set(["2026-08-23"]), "2026-08-17", "2026-08-23")).toBe(1);
    expect(diasNaJanela(new Set(["2026-08-16"]), "2026-08-17", "2026-08-23")).toBe(0);
    expect(diasNaJanela(new Set(["2026-08-24"]), "2026-08-17", "2026-08-23")).toBe(0);
  });

  test("o alvo é atingido por igualdade, não só por excesso", () => {
    expect(fechou(3, 3)).toBe(true);
    expect(fechou(2, 3)).toBe(false);
    expect(fechou(7, 3)).toBe(true);
  });

  test(`⚠️ o padrão são ${DIAS_ALVO_PADRAO} dias, e não sete`, () => {
    // Sete significa "não faltar um dia", e a semana da internação existe: um
    // desafio que quebra na primeira noite no pronto-socorro ensina a não
    // participar.
    expect(DIAS_ALVO_PADRAO).toBeLessThan(DIAS_ALVO_MAX);
    expect(DIAS_ALVO_PADRAO).toBe(3);
  });
});

describe("o contador do grupo", () => {
  test("⚠️ NÚMERO absoluto, nunca fração nem porcentagem", () => {
    // "3 de 300 fecharam" diz ao grupo inteiro que quase ninguém veio.
    const f = fraseDoGrupo(3) ?? "";
    expect(f).toContain("3 pessoas");
    expect(f).not.toContain("%");
    expect(f).not.toContain(" de ");
  });

  test(`⚠️ abaixo de ${MINIMO_PARA_CONTAR} pessoas a tela não fala do grupo`, () => {
    // Com uma pessoa só, "1 fechou" é ela mesma se olhando no espelho — e num
    // desafio em GRUPO isso lê como "ninguém veio".
    expect(fraseDoGrupo(0)).toBeNull();
    expect(fraseDoGrupo(1)).toBeNull();
    expect(fraseDoGrupo(2)).not.toBeNull();
  });
});

describe("a vigência", () => {
  const d = { inicio: "2026-08-17", fim: "2026-08-23" };

  test("dentro da janela, inclusive nas bordas", () => {
    expect(vigente(d, "2026-08-17")).toBe(true);
    expect(vigente(d, "2026-08-23")).toBe(true);
    expect(vigente(d, "2026-08-16")).toBe(false);
    expect(vigente(d, "2026-08-24")).toBe(false);
  });

  test("arquivado não vale, mesmo dentro da janela", () => {
    expect(vigente({ ...d, arquivadoEm: "2026-08-18T10:00:00Z" }, "2026-08-19")).toBe(false);
  });
});

describe("⚠️ o título é de catálogo fechado", () => {
  test("só as quatro atividades que o app já grava", () => {
    // Campo livre aqui é conselho de saúde de leiga distribuído em massa com o
    // nome do consultório em volta.
    expect(ATIVIDADES_DO_DESAFIO).toHaveLength(4);
    for (const a of ATIVIDADES_DO_DESAFIO) expect(atividadeConhecida(a.chave)).toBe(true);
    expect(atividadeConhecida("beber chá de boldo")).toBe(false);
    expect(atividadeConhecida("")).toBe(false);
  });

  test("e são as MESMAS que o Caminho grava no ledger", () => {
    // Uma quinta atividade aqui seria um desafio que nunca fecha, porque nada
    // no app escreve aquela chave.
    const conquistas = readFileSync("src/lib/conquistas.ts", "utf8");
    const linha = conquistas.match(/ATIVIDADES_DO_DIA = \[(.*?)\]/s)?.[1] ?? "";
    for (const a of ATIVIDADES_DO_DESAFIO) expect(linha).toContain(`"${a.chave}"`);
  });
});

describe("a chave do pagamento", () => {
  test("carrega o desafio E a pessoa", () => {
    // Duas criadoras podem propor desafios na mesma semana: uma chave por
    // semana faria a segunda ser engolida como duplicata.
    expect(chaveDoDesafio("d1", "p1")).toBe("desafio:d1:p1");
    expect(chaveDoDesafio("d1", "p1")).not.toBe(chaveDoDesafio("d2", "p1"));
    expect(chaveDoDesafio("d1", "p1")).not.toBe(chaveDoDesafio("d1", "p2"));
  });
});

describe("⚠️ o grupo NÃO nasce do `ref_code`", () => {
  test("a régua não conhece o código da criadora", () => {
    // Agrupar por `ref_code` recriaria por fora o grupo compulsório que o
    // código foi tirado do grafo de amizade para não criar — e `ref_code` é
    // fixado uma vez, então não haveria como sair.
    const fonte = readFileSync("src/lib/desafio-em-grupo.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(fonte).not.toContain("ref_code");
    expect(fonte).not.toContain("referred_by");
  });
});
