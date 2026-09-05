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
import { analyzeContractions, type ContracaoParaAnalise } from "@/lib/analise-de-contracoes";

/** Contrações a partir de uma lista de intervalos em minutos, em ordem. */
function comIntervalos(minutos: number[], duracaoSeg = 40, ultimaAberta = false) {
  const base = new Date("2026-09-05T02:00:00-03:00").getTime();
  const inicios = [0];
  for (const m of minutos) inicios.push(inicios[inicios.length - 1] + m * 60000);
  return inicios.map((off, i) => ({
    started_at: new Date(base + off).toISOString(),
    ended_at:
      ultimaAberta && i === inicios.length - 1
        ? null
        : new Date(base + off + duracaoSeg * 1000).toISOString(),
  })) as ContracaoParaAnalise[];
}

describe("⚠️ antes das 37 semanas, o alerta não pode ser suprimido", () => {
  test("padrão regular às 32 semanas dispara o urgente", () => {
    const r = analyzeContractions(comIntervalos([5, 5, 5]), 32);
    expect(r.status).toBe("urgente");
    expect(r.label).toContain("Ligue para o seu médico agora");
  });

  test("⚠️ e dispara com a SEGUNDA contração ainda em curso", () => {
    /* O defeito 1: a régua não precisa de duração nenhuma, e ficava atrás de
       `completed.length < 2`. Aqui só a PRIMEIRA terminou. */
    const r = analyzeContractions(comIntervalos([6], 40, true), 32);
    expect(r.status).toBe("urgente");
  });

  test("⚠️ e um vão longo no começo NÃO apaga o padrão que veio depois", () => {
    /* O defeito 2: média de [30,5,5,5] é 11,25 — acima do corte de 10 —
       enquanto o intervalo típico é 5. */
    const media = (30 + 5 + 5 + 5) / 4;
    expect(media).toBeGreaterThan(10);
    const r = analyzeContractions(comIntervalos([30, 5, 5, 5]), 32);
    expect(r.status).toBe("urgente");
  });

  test("⚠️ e o critério é o MENOR dos dois — a mediana nunca ESTREITA o alerta", () => {
    /* O caso inverso: [1, 12, 12] tem média 8,3 (dispara) e mediana 12 (não).
       Trocar a média pela mediana teria silenciado este. Antes das 37 semanas,
       errar para o lado de mandar ligar é o único lado seguro. */
    const mediana = 12;
    expect(mediana).toBeGreaterThan(10);
    const r = analyzeContractions(comIntervalos([1, 12, 12]), 32);
    expect(r.status).toBe("urgente");
  });

  test("a partir das 37 semanas a régua de prematuridade não vale", () => {
    /* Aí quem manda são os cortes de trabalho de parto, que pedem duração. */
    const r = analyzeContractions(comIntervalos([8], 40), 38);
    expect(r.status).not.toBe("urgente");
  });

  test("sem semana conhecida ela não inventa alerta", () => {
    expect(analyzeContractions(comIntervalos([5, 5, 5]), null).status).not.toBe("urgente");
  });

  test("contrações espaçadas antes das 37 semanas não viram urgência", () => {
    /* `iv > 10` não é sinal de prematuridade — e uma tela que grita por
       qualquer coisa é uma tela que ela aprende a ignorar. */
    expect(analyzeContractions(comIntervalos([25, 30, 28]), 32).status).not.toBe("urgente");
  });
});

describe("os cortes de trabalho de parto, depois das 37 semanas", () => {
  test("de 2 em 2 minutos com 70s é maternidade agora", () => {
    const r = analyzeContractions(comIntervalos([2, 2, 2], 70), 39);
    expect(r.status).toBe("urgente");
    expect(r.label).toContain("maternidade");
  });

  test("de 5 em 5 com 50s é trabalho de parto ativo", () => {
    expect(analyzeContractions(comIntervalos([5, 5, 5], 50), 39).status).toBe("alerta");
  });

  test("de 9 em 9 com 35s é atenção", () => {
    expect(analyzeContractions(comIntervalos([9, 9], 35), 39).status).toBe("atencao");
  });

  test("espaçadas e curtas é padrão normal", () => {
    expect(analyzeContractions(comIntervalos([20, 22], 20), 39).status).toBe("normal");
  });
});

describe("o começo da sessão não afirma nada", () => {
  test("com uma contração só, monitora", () => {
    const r = analyzeContractions(comIntervalos([]), 32);
    expect(r.status).toBe("normal");
    expect(r.label).toBe("Monitorando");
  });

  test("com duas ABERTAS depois das 37 semanas, monitora — falta duração", () => {
    const r = analyzeContractions(
      comIntervalos([6], 40, true).map((c, i) => (i === 0 ? { ...c, ended_at: null } : c)),
      39,
    );
    expect(r.label).toBe("Monitorando");
  });
});
