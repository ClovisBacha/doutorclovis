/**
 * A RÉGUA DO CRONÔMETRO, EXERCITADA — e não lida.
 *
 * ⚠️ Esta régua decide se a tela das contrações mostra "⚠️ Ligue para o seu
 * médico agora" com o botão do 192. Até set/2026 ela morava dentro do
 * componente, e a única catraca que a guardava lia o FONTE procurando a string
 * `sinalContracoesPrematuras({ semanas: weeks` — ou seja, provava que a
 * CHAMADA existia, e nada sobre o que ela recebia. Dois defeitos passaram por
 * baixo dessa asserção, e os dois SUPRIMIAM o alerta:
 *
 *   1. ⚠️ **A régua ficava barrada por uma duração que ela não usa.**
 *      `sinalContracoesPrematuras` precisa de DUAS coisas — semanas e
 *      intervalo — e de nenhuma duração; a chamada vinha depois de
 *      `if (completed.length < 2) return`, que exige duas contrações
 *      TERMINADAS. O caso que isso apagava é exatamente o do trabalho de parto
 *      prematuro: a primeira acabou, a segunda está EM CURSO, o intervalo
 *      entre os dois inícios já é conhecido — e a tela respondia
 *      "Monitorando · Continue registrando".
 *
 *   2. ⚠️ **A MÉDIA apagava o alerta.** "Regular" quer dizer que o intervalo
 *      TÍPICO é curto, não que a soma dividida pelo número é curta. Quem começa
 *      a cronometrar em dúvida tem um vão longo antes de o padrão se firmar:
 *      [30, 5, 5, 5] dá média 11,25, e a régua (`iv <= 10`) não dispara com
 *      três contrações de cinco em cinco minutos às 32 semanas.
 */
import { describe, expect, test } from "bun:test";
import {
  analyzeContractions,
  faseDoCronometro,
  type ContracaoParaAnalise,
} from "@/lib/analise-de-contracoes";

const BASE = new Date("2026-09-05T02:00:00-03:00").getTime();

/** Contrações a partir de uma lista de intervalos em minutos, em ordem. */
function comIntervalos(minutos: number[], duracaoSeg = 40, ultimaAberta = false) {
  const inicios = [0];
  for (const m of minutos) inicios.push(inicios[inicios.length - 1] + m * 60000);
  return inicios.map((off, i) => ({
    started_at: new Date(BASE + off).toISOString(),
    ended_at:
      ultimaAberta && i === inicios.length - 1
        ? null
        : new Date(BASE + off + duracaoSeg * 1000).toISOString(),
  })) as ContracaoParaAnalise[];
}

/**
 * ⚠️ O "agora" é PARÂMETRO, e por isso este arquivo não muda de resposta às
 * terças. Ele fica um minuto depois da última contração — que é onde a
 * paciente está quando olha a tela.
 */
function analisar(lista: ContracaoParaAnalise[], semanas: number | null) {
  const ultimo = lista.reduce((m, c) => Math.max(m, new Date(c.started_at).getTime()), BASE);
  return analyzeContractions(lista, semanas, ultimo + 60000);
}

describe("a fase decide qual régua vale", () => {
  test("os quatro cortes", () => {
    expect(faseDoCronometro(12).fase).toBe("sem-regua");
    expect(faseDoCronometro(20).fase).toBe("pre-termo");
    expect(faseDoCronometro(36).fase).toBe("pre-termo");
    expect(faseDoCronometro(37).fase).toBe("termo");
    expect(faseDoCronometro(40).fase).toBe("termo");
    expect(faseDoCronometro(41).fase).toBe("pos-termo");
  });

  test("⚠️ sem semana, ou com semana implausível, a régua é a de PRÉ-TERMO", () => {
    /* A assimetria de dano: aplicar a régua de termo a uma gestante de 30
       semanas TRANQUILIZA quem precisa ligar; aplicar a de pré-termo a uma de
       39 manda ligar quem já ia ligar. */
    for (const s of [null, undefined, Number.NaN, 0, 2, 60]) {
      const r = faseDoCronometro(s as number | null);
      expect(r.fase).toBe("pre-termo");
      expect(r.semanaConhecida).toBe(false);
    }
  });
});

describe("⚠️ antes das 37 semanas, o alerta não pode ser suprimido", () => {
  test("padrão regular às 32 semanas dispara o urgente", () => {
    const r = analisar(comIntervalos([5, 5, 5]), 32);
    expect(r.status).toBe("urgente");
    expect(r.label).toContain("Ligue para o seu médico agora");
  });

  test("⚠️ e dispara com a SEGUNDA contração ainda em curso", () => {
    /* O defeito 1: a régua não precisa de duração nenhuma, e ficava atrás de
       `completed.length < 2`. Aqui só a PRIMEIRA terminou. */
    const r = analisar(comIntervalos([6], 40, true), 32);
    expect(r.status).toBe("urgente");
  });

  test("⚠️ e um vão longo no começo NÃO apaga o padrão que veio depois", () => {
    /* O defeito 2: média de [30,5,5,5] é 11,25 — acima do corte de 10 —
       enquanto o intervalo típico é 5. */
    const media = (30 + 5 + 5 + 5) / 4;
    expect(media).toBeGreaterThan(10);
    expect(analisar(comIntervalos([30, 5, 5, 5]), 32).status).toBe("urgente");
  });

  test("⚠️ e o critério é o MENOR dos dois — a mediana nunca ESTREITA o alerta", () => {
    /* O caso inverso: [1, 12, 12] tem média 8,3 (dispara) e mediana 12 (não).
       Trocar a média pela mediana teria silenciado este. */
    expect(analisar(comIntervalos([1, 12, 12]), 32).status).toBe("urgente");
  });

  test("⚠️ SEIS EM UMA HORA dispara mesmo com o intervalo ACIMA de 10 min", () => {
    /* O caso que separa as duas réguas do NICHD, e que a versão anterior não
       via: seis contrações de 11 em 11 minutos cabem em 55 minutos. O
       intervalo diz 11 (não dispara); a contagem da hora diz 6 (dispara). */
    const lista = comIntervalos([11, 11, 11, 11, 11]);
    expect(lista.length).toBe(6);
    const r = analisar(lista, 31);
    expect(r.naUltimaHora).toBe(6);
    expect(r.status).toBe("urgente");
    expect(r.detail).toContain("6 contrações em uma hora");
  });

  test("cinco na hora, com o mesmo espaçamento, NÃO dispara", () => {
    /* O piso da fonte é SEIS. Uma tela que grita por qualquer coisa é uma tela
       que ela aprende a ignorar. */
    const r = analisar(comIntervalos([11, 11, 11, 11]), 31);
    expect(r.naUltimaHora).toBe(5);
    expect(r.status).not.toBe("urgente");
  });

  test("a partir das 37 semanas a régua de prematuridade não vale", () => {
    expect(analisar(comIntervalos([8], 40), 38).status).not.toBe("urgente");
    expect(analisar(comIntervalos([11, 11, 11, 11, 11]), 38).status).not.toBe("urgente");
  });

  test("⚠️ sem semana conhecida ela não INVENTA prematuridade — mas também não tranquiliza", () => {
    /* `sinalContracoesPrematuras` devolve `null` sem semana, de propósito. O
       lado seguro é segurado pela FASE, não por um alerta inventado. */
    const r = analisar(comIntervalos([5, 5, 5]), null);
    expect(r.status).toBe("atencao");
    expect(r.fase).toBe("pre-termo");
    expect(r.semanaConhecida).toBe(false);
    /* E o texto não afirma uma semana que o app não sabe. */
    expect(r.label).not.toMatch(/\d+ semanas/);
  });

  test("contrações espaçadas antes das 37 semanas não viram urgência — nem 'normal'", () => {
    const r = analisar(comIntervalos([25, 30, 28]), 32);
    expect(r.status).toBe("atencao");
    expect(r.status).not.toBe("normal");
  });
});

describe("⚠️ antes do termo, NENHUM estado tranquiliza", () => {
  /* É o pior erro possível desta tela: "isso parece treinamento" ou "seu padrão
     está tranquilo" antes de 37 semanas contradiz frontalmente a ACOG ("do not
     wait... call right away") e não tem base — contar contração em casa não
     prediz parto prematuro. Numa gestante de alto risco o custo é um
     corticoide que não foi dado. */
  const cenarios: ContracaoParaAnalise[][] = [
    [],
    comIntervalos([]),
    comIntervalos([40], 20),
    comIntervalos([25, 30, 28], 25),
    comIntervalos([12, 12, 12], 30),
    comIntervalos([5, 5, 5], 60),
  ];

  test("em nenhuma semana antes de 37, e em nenhum cenário, o status é 'normal'", () => {
    for (const semanas of [null, 8, 20, 26, 31, 34, 36]) {
      for (const lista of cenarios) {
        const r = analisar(lista, semanas);
        expect(`${semanas} ${JSON.stringify(lista.length)} ${r.status}`).not.toContain("normal");
      }
    }
  });
});

describe("os cortes de trabalho de parto, a partir das 37 semanas", () => {
  test("de 2 em 2 minutos com 70s manda LIGAR — e não diagnostica", () => {
    const r = analisar(comIntervalos([2, 2, 2], 70), 39);
    expect(r.status).toBe("urgente");
    expect(r.label).toContain("Ligue");
  });

  test("⚠️ de 5 em 5 com 50s por DEZ minutos ainda não é o padrão — o '1' quer dizer uma hora", () => {
    const r = analisar(comIntervalos([5, 5], 50), 39);
    expect(r.status).toBe("atencao");
    expect(r.detail).toContain("está assim há 10 min");
  });

  test("⚠️ de 5 em 5 com 50s SUSTENTADO por uma hora é o padrão combinado", () => {
    const r = analisar(comIntervalos(Array(13).fill(5), 50), 39);
    expect(r.sustentadoMin).toBe(65);
    expect(r.status).toBe("alerta");
    expect(r.label).toContain("5-1-1");
  });

  test("de 9 em 9 com 35s é atenção", () => {
    expect(analisar(comIntervalos([9, 9], 35), 39).status).toBe("atencao");
  });

  test("espaçadas e curtas, no termo, podem ser 'ainda espaçadas'", () => {
    /* Ficar em casa na fase latente é recomendação ATIVA, com dano medido da
       admissão precoce — então aqui o verde é defensável, ao contrário do
       pré-termo. */
    const r = analisar(comIntervalos([20, 22], 20), 39);
    expect(r.status).toBe("normal");
    expect(r.label).toBe("Ainda espaçadas");
  });

  test("sem duração nenhuma, ela pede o encerramento em vez de afirmar padrão", () => {
    const lista = comIntervalos([6]).map((c) => ({ ...c, ended_at: null }));
    const r = analisar(lista, 39);
    expect(r.label).toContain("Falta a duração");
  });
});

describe("as pontas da gestação", () => {
  test("⚠️ antes das 20 semanas não existe padrão a acompanhar — e a caixa não é verde", () => {
    const r = analisar(comIntervalos([40, 45], 30), 16);
    expect(r.fase).toBe("sem-regua");
    expect(r.status).toBe("atencao");
    expect(r.label).toContain("Antes das 20 semanas");
    /* Nenhum número de padrão é exibido: exibi-lo sugeriria uma régua que não
       existe nessa faixa. */
    expect(r.detail).not.toMatch(/5-1-1|a cada \d+ min/);
  });

  test("⚠️ mas contração REGULAR antes das 20 semanas continua mandando ligar — com o texto certo", () => {
    /* O limite é o mesmo, e ele mora em `sinais-clinicos.ts`. O que muda é a
       palavra: trabalho de parto prematuro é definido a partir de 20 semanas,
       e chamar isso de prematuridade numa gestante de 16 seria afirmar um
       quadro que não é o dela. */
    const r = analisar(comIntervalos([5, 5, 5], 50), 16);
    expect(r.status).toBe("urgente");
    expect(r.label).toContain("Ligue para o seu médico");
    expect(r.detail).toContain("antes das 20 semanas");
    expect(r.detail).not.toContain("37 semanas");
  });

  test("⚠️ a partir das 41 semanas o cronômetro deixa de ser a resposta", () => {
    const r = analisar(comIntervalos([20, 22], 20), 41);
    expect(r.fase).toBe("pos-termo");
    expect(r.status).toBe("atencao");
    expect(r.detail).toContain("acompanhamento do consultório");
  });

  test("mas o urgente continua urgente depois das 41", () => {
    expect(analisar(comIntervalos([2, 2, 2], 70), 41).status).toBe("urgente");
  });
});

describe("o começo da sessão não afirma nada", () => {
  test("no termo, com uma contração só, monitora", () => {
    const r = analisar(comIntervalos([]), 39);
    expect(r.status).toBe("normal");
    expect(r.label).toBe("Monitorando");
  });

  test("⚠️ antes do termo, com a lista VAZIA, ela já diz o que a ACOG diz", () => {
    /* É com zero contrações registradas que esta faixa mais precisa da frase:
       não há um número a alcançar antes de ligar. */
    const r = analisar([], 30);
    expect(r.label).toContain("não espere fechar um padrão");
    expect(r.detail).toContain("Nenhuma contração na última hora");
  });
});

describe("a janela é de SESSENTA minutos, e não 'as últimas N'", () => {
  test("contração de duas horas atrás não entra na conta da hora", () => {
    const lista: ContracaoParaAnalise[] = [
      { started_at: new Date(BASE - 130 * 60000).toISOString(), ended_at: null },
      { started_at: new Date(BASE - 10 * 60000).toISOString(), ended_at: null },
      { started_at: new Date(BASE).toISOString(), ended_at: null },
    ];
    const r = analyzeContractions(lista, 39, BASE + 60000);
    expect(r.naUltimaHora).toBe(2);
  });

  test("e o futuro não conta (relógio do aparelho adiantado)", () => {
    const lista: ContracaoParaAnalise[] = [
      { started_at: new Date(BASE + 30 * 60000).toISOString(), ended_at: null },
      { started_at: new Date(BASE).toISOString(), ended_at: null },
    ];
    expect(analyzeContractions(lista, 39, BASE).naUltimaHora).toBe(1);
  });
});
