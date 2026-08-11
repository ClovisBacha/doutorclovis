/**
 * A SEQUÊNCIA DE DIAS — o número mais olhado da tela, e o último sem prova.
 *
 * Ele estava escrito duas vezes dentro de `gestacao-path.tsx` (gestação e
 * pós-parto), em `useMemo` idênticos a cinco mil linhas de distância, e nenhum
 * dos dois tinha teste. Estes casos são os que decidem se a paciente vê o
 * número certo — e o primeiro deles é o que mais dói se quebrar.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { sequenciaAcesa, sequenciaDeDatas, sequenciaDeDias } from "./sequencia";

describe("a virada da meia-noite não apaga a sequência", () => {
  test("hoje ainda não feito conta a partir de ONTEM", () => {
    /* O caso mais importante do arquivo. Sem ele, quem tem 40 dias seguidos
       abre o app às 7 da manhã, ainda não fez nada, e vê ZERO — a sequência
       que a trouxe de volta 40 vezes apagada por causa do relógio. */
    expect(sequenciaDeDias([97, 98, 99], 100)).toBe(3);
  });

  test("e fechar o dia de hoje soma mais um", () => {
    expect(sequenciaDeDias([97, 98, 99, 100], 100)).toBe(4);
  });

  test("dois dias parada zera de verdade", () => {
    /* Ontem em branco ainda perdoa (é a regra acima); anteontem não. */
    expect(sequenciaDeDias([97, 98], 100)).toBe(0);
  });
});

describe("um buraco no meio quebra a sequência", () => {
  test("conta só o trecho colado ao fim", () => {
    /* É o que a torna uma SEQUÊNCIA. Somar tudo daria 5. */
    expect(sequenciaDeDias([90, 91, 92, 99, 100], 100)).toBe(2);
  });

  test("um dia só, hoje", () => {
    expect(sequenciaDeDias([100], 100)).toBe(1);
  });

  test("um dia só, ontem", () => {
    expect(sequenciaDeDias([99], 100)).toBe(1);
  });
});

describe("nada feito é zero, e não erro", () => {
  test("lista vazia", () => {
    expect(sequenciaDeDias([], 100)).toBe(0);
  });

  test("só dias antigos", () => {
    expect(sequenciaDeDias([10, 11, 12], 100)).toBe(0);
  });
});

describe("o blob vem de armazenamento local, e chega torto", () => {
  test("fora de ordem conta igual", () => {
    /* `doneDays` é um array sincronizado entre aparelhos; a ordem não é
       promessa de ninguém. */
    expect(sequenciaDeDias([100, 98, 99, 97], 100)).toBe(4);
  });

  test("repetidos não inflam a conta", () => {
    expect(sequenciaDeDias([99, 99, 99, 100], 100)).toBe(2);
  });

  test("dias futuros não entram", () => {
    /* Um relógio adiantado noutro aparelho já gravou dia à frente nesta base.
       O futuro não pode virar sequência — ela terminaria depois de hoje. */
    expect(sequenciaDeDias([100, 101, 102], 100)).toBe(1);
  });

  test("blob corrompido não trava a aba", () => {
    /* Sem o teto, um conjunto que contenha todo inteiro abaixo de hoje faria o
       laço girar até o fim da memória. Errar o número é ruim; travar a tela da
       paciente é pior. */
    const doidos = Array.from({ length: 500 }, (_, i) => 100 - i);
    expect(sequenciaDeDias(doidos, 100)).toBe(500);
  });
});

describe("a chama pergunta ao arquivo, não ao componente", () => {
  test("acesa a partir de um dia", () => {
    expect(sequenciaAcesa(0)).toBe(false);
    expect(sequenciaAcesa(1)).toBe(true);
    expect(sequenciaAcesa(40)).toBe(true);
  });

  test("as TRÊS contagens usam a mesma régua", () => {
    /* Eram três cópias do mesmo laço dentro de `gestacao-path.tsx`: gestação,
       pós-parto e meditação. Cópias divergem no primeiro conserto — alguém
       arruma a meia-noite numa e as outras ficam erradas por meses, porque
       ninguém abre as três telas no mesmo dia. */
    const fonte = readFileSync("src/components/gestacao-path.tsx", "utf8");
    /* Duas chamadas por dia gestacional (gestação e pós-parto) e uma por data
       de calendário (meditação) — as três telas que tinham cópia própria. */
    expect([...fonte.matchAll(/sequenciaDeDias\(/g)]).toHaveLength(2);
    expect([...fonte.matchAll(/sequenciaDeDatas\(/g)]).toHaveLength(1);
    /* E nenhuma reescreveu o laço à mão. */
    expect(fonte).not.toMatch(/let s = 0;\s*\n\s*let d = set\.has\(todayD\)/);
    expect(fonte).not.toMatch(/function sequenciaDeDias\(/);
  });

  test("a chama acende nas duas trilhas", () => {
    const fonte = readFileSync("src/components/gestacao-path.tsx", "utf8");
    expect([...fonte.matchAll(/<ChamaDaSequencia/g)]).toHaveLength(2);
    /* E ninguém escreveu `streak > 0` à mão para decidir se acende. */
    expect(fonte).not.toMatch(/streak > 0/);
  });
});

describe("a meditação conta pelo calendário, e sem se perder no fuso", () => {
  const em = (iso: string) => {
    const [a, m, d] = iso.split("-").map(Number);
    return new Date(a, m - 1, d, 15, 0, 0); // 15h locais: bem dentro do dia
  };

  test("três dias seguidos", () => {
    expect(sequenciaDeDatas(["2026-08-09", "2026-08-10", "2026-08-11"], em("2026-08-11"))).toBe(3);
  });

  test("hoje ainda sem meditar conta a partir de ontem", () => {
    expect(sequenciaDeDatas(["2026-08-09", "2026-08-10"], em("2026-08-11"))).toBe(2);
  });

  test("atravessa a virada do mês", () => {
    /* O laço antigo andava com `setDate(-1)`, que resolve isso sozinho. A
       conversão para dias inteiros também — e este teste é o que prova. */
    expect(sequenciaDeDatas(["2026-07-30", "2026-07-31", "2026-08-01"], em("2026-08-01"))).toBe(3);
  });

  test("e a virada do ano", () => {
    expect(sequenciaDeDatas(["2025-12-30", "2025-12-31", "2026-01-01"], em("2026-01-01"))).toBe(3);
  });

  test("ano bissexto não abre buraco", () => {
    expect(sequenciaDeDatas(["2028-02-28", "2028-02-29", "2028-03-01"], em("2028-03-01"))).toBe(3);
  });

  test("o dia é LOCAL, não UTC", () => {
    /* `diaISO` grava o dia local. Ler a string com `new Date(s)` cru a trataria
       como UTC — em São Paulo, tudo antes das 21h viraria o dia anterior e a
       sequência quebraria sozinha todo fim de tarde. Aqui, às 23h do dia 11, a
       sequência que termina no dia 11 tem de continuar valendo. */
    const tarde = new Date(2026, 7, 11, 23, 30, 0);
    expect(sequenciaDeDatas(["2026-08-10", "2026-08-11"], tarde)).toBe(2);
  });

  test("lixo no registro é ignorado, não conta como dia", () => {
    expect(sequenciaDeDatas(["", "ontem", "2026-08-11"], em("2026-08-11"))).toBe(1);
  });
});
