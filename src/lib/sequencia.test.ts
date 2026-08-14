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
import {
  diasComAlgumMomento,
  sequenciaAcesa,
  sequenciaDeDatas,
  sequenciaDeDias,
} from "./sequencia";

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

describe("⚠️ o perdão de um dia — e o que ele NÃO perdoa", () => {
  /* A noite no pronto-socorro não pode custar 40 dias. Ver o cabeçalho de
     `DIAS_POR_PERDAO`: o perdão cresce com o que há a perder. */
  const seguidos = (ate: number, quantos: number) =>
    Array.from({ length: quantos }, (_, i) => ate - i);

  test("com sequência longa, UM dia perdido não zera nada", () => {
    /* 10 dias grudados em hoje (100..91), o dia 90 em branco, e 30 antes
       dele (89..60). */
    const dias = [...seguidos(100, 10), ...seguidos(89, 30)];
    expect(sequenciaDeDias(dias, 100)).toBe(40);
  });

  test("⚠️ com sequência CURTA não há perdão — o saldo nasce em zero", () => {
    /* Quem tem três dias não precisa de proteção; e sem esta regra, alternar
       um dia sim um dia não daria sequência infinita. */
    expect(sequenciaDeDias([100, 99, 98, 96, 95], 100)).toBe(3);
  });

  test("⚠️ um dia sim, um dia não NUNCA vira sequência", () => {
    const alternados = Array.from({ length: 60 }, (_, i) => 100 - i * 2);
    expect(sequenciaDeDias(alternados, 100)).toBe(1);
  });

  test("⚠️ DOIS dias seguidos em branco quebram, por mais longa que seja", () => {
    /* Se ela sumiu dois dias, a sequência acabou mesmo — e dizer o contrário
       faria o número deixar de significar "eu vim quase todo dia". */
    const dias = [...seguidos(100, 20), ...seguidos(77, 60)];
    expect(sequenciaDeDias(dias, 100)).toBe(20);
  });

  test("o saldo é proporcional: 14 dias compram dois perdões", () => {
    const dias = [...seguidos(100, 7), ...seguidos(92, 7), ...seguidos(84, 7)];
    expect(sequenciaDeDias(dias, 100)).toBe(21);
  });

  test("e o terceiro buraco para, porque o saldo acabou", () => {
    /* Sete contados dão um perdão; catorze dão dois. No terceiro buraco a
       conta parou em 21, e `floor(21/7)` = 3 — então este ainda passa. O que
       para é o QUARTO, com 28 contados e 4 de saldo... e por isso o caso de
       verdade é o de cima: o limite existe, mas é generoso de propósito.
       Aqui provamos só que ele EXISTE, com a sequência curta. */
    expect(sequenciaDeDias([100, 98], 100)).toBe(1);
  });

  test("perdoar não conta o dia perdido como feito", () => {
    /* 40 dias com um buraco valem 40, e não 41: o dia vazio é atravessado,
       nunca creditado. */
    const dias = [...seguidos(100, 10), ...seguidos(89, 30)];
    expect(sequenciaDeDias(dias, 100)).toBe(dias.length);
  });
});

describe("um buraco no meio quebra a sequência", () => {
  test("conta só o trecho colado ao fim", () => {
    /* É o que a torna uma SEQUÊNCIA. Somar tudo daria 5.
       ⚠️ Continua 2 mesmo com o perdão: o buraco vale um saldo de
       `floor(2/7)` = 0. */
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

  test("a chama acende nas duas trilhas — e na folha que a explica", () => {
    const fonte = readFileSync("src/components/gestacao-path.tsx", "utf8");
    /* Três: a fita da gestação, a do pós-parto e a `FolhaDaChama`, que abre ao
       tocar no número. A terceira nasceu junto com o perdão de um dia — perdão
       que ninguém sabe que existe não acalma ninguém, e a paciente internada
       precisa poder tocar no número e ler que ele não vai zerar. */
    expect([...fonte.matchAll(/<ChamaDaSequencia/g)]).toHaveLength(3);
    /* E ninguém escreveu `streak > 0` à mão para decidir se acende. */
    expect(fonte).not.toMatch(/streak > 0/);
  });
});

describe("UM exercício já conta o dia", () => {
  /* O defeito que abriu esta parte: o dono fez um exercício e a chama não
     acendeu, porque a sequência lia `doneDays` — dias com os CINCO momentos
     fechados. Quem fez três de cinco ficava com o mesmo zero de quem não abriu
     o app, o que transforma o gancho em cobrança. */
  const K = "dc-path-day-";

  test("um único momento marcado já vira dia", () => {
    expect(diasComAlgumMomento([[`${K}100`, '{"agua":true}']], K)).toEqual([100]);
  });

  test("dia aberto e sem nada feito NÃO conta", () => {
    /* Só abrir a folha do dia grava o objeto vazio. Se isso contasse, a
       sequência mediria visita em vez de cuidado. */
    expect(diasComAlgumMomento([[`${K}100`, "{}"]], K)).toEqual([]);
    expect(diasComAlgumMomento([[`${K}100`, '{"agua":false}']], K)).toEqual([]);
  });

  test("três dias com um momento cada acendem a chama em 3", () => {
    const armazem: [string, string][] = [
      [`${K}98`, '{"aula":true}'],
      [`${K}99`, '{"respirar":true}'],
      [`${K}100`, '{"movimento":true}'],
    ];
    expect(sequenciaDeDias(diasComAlgumMomento(armazem, K), 100)).toBe(3);
  });

  test("as outras chaves da jornada não viram dia", () => {
    /* `dc-path-done-days`, `dc-path-lessons`, `dc-path-presente-visto-…` e a
       chave do pós-parto convivem no mesmo armazém. */
    const armazem: [string, string][] = [
      ["dc-path-done-days", "[97,98,99]"],
      ["dc-path-lessons", '{"12":100}'],
      ["dc-path-pos-day-3", '{"banho":true}'],
      ["dc-path-presente-visto-2026-08-11T12:00:00.000Z", "true"],
      [`${K}100`, '{"agua":true}'],
    ];
    expect(diasComAlgumMomento(armazem, K)).toEqual([100]);
  });

  test("o pós-parto tem prefixo PRÓPRIO e não invade a gestação", () => {
    const armazem: [string, string][] = [
      [`${K}100`, '{"agua":true}'],
      ["dc-path-pos-day-5", '{"banho":true}'],
    ];
    expect(diasComAlgumMomento(armazem, "dc-path-pos-day-")).toEqual([5]);
  });

  test("sufixo que não é número é descartado", () => {
    /* `dc-path-day-` é prefixo de `dc-path-day-12`, mas casaria também com uma
       chave futura como `dc-path-day-notas` — que viraria NaN e, sem a guarda,
       um dia fantasma na contagem. */
    expect(diasComAlgumMomento([[`${K}notas`, '{"x":true}']], K)).toEqual([]);
    expect(diasComAlgumMomento([[`${K}12abc`, '{"x":true}']], K)).toEqual([]);
  });

  test("JSON corrompido não derruba a contagem", () => {
    const armazem: [string, string | null][] = [
      [`${K}99`, "{quebrado"],
      [`${K}100`, '{"agua":true}'],
      [`${K}98`, null],
    ];
    expect(diasComAlgumMomento(armazem, K)).toEqual([100]);
  });

  test("armazém vazio é zero, e não erro", () => {
    expect(diasComAlgumMomento([], K)).toEqual([]);
    expect(sequenciaDeDias(diasComAlgumMomento([], K), 100)).toBe(0);
  });

  test("a chama NÃO lê mais doneDays", () => {
    /* `doneDays` continua existindo e continua pintando o nó da trilha e
       soltando a figurinha da semana — ele responde "fechou o dia?", que é
       outra pergunta. Se a chama voltar a lê-lo, um exercício deixa de contar
       e o defeito do dono volta. */
    const fonte = readFileSync("src/components/gestacao-path.tsx", "utf8");
    expect(fonte).not.toMatch(/sequenciaDeDias\(doneDays/);
    expect(fonte).not.toMatch(/sequenciaDeDias\(posDone/);
    expect([...fonte.matchAll(/diasComAlgumMomento\(/g)]).toHaveLength(2);
  });

  test("os prefixos saem da MESMA chave que grava", () => {
    /* Escritos à mão, uma renomeação futura de `LS.dayTasks` faria a chama
       parar de acender sem erro nenhum aparecer. */
    const fonte = readFileSync("src/components/gestacao-path.tsx", "utf8");
    expect(fonte).toMatch(/const DIA_KEY = LS\.dayTasks\(0\)\.slice\(0, -1\)/);
    expect(fonte).toMatch(/const POS_DIA_KEY = LS\.posDayTasks\(0\)\.slice\(0, -1\)/);
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
