/**
 * OS HORÁRIOS LIVRES — onde cada borda vale uma consulta.
 *
 * Este arquivo é quase todo sobre BORDAS, e não por preciosismo: cada uma delas
 * é um encaixe a mais ou a menos na agenda de alguém, todo dia, sem ninguém
 * perceber. "Termina às 12:00" inclui a das 11:30 e exclui a das 12:00; um
 * bloqueio "das 14 às 16" come a das 14:00 e devolve a das 16:00.
 */

/* A CI roda em UTC, e em UTC a conversão de fuso é a identidade — todo teste de
   relógio de consultório passaria sozinho, inclusive contra o código errado. */
process.env.TZ = "America/Sao_Paulo";

import { describe, expect, test } from "bun:test";
import {
  emHora,
  emMinutos,
  expandirGrade,
  horariosLivres,
  livresPorDia,
  paredeDaClinica,
  removerBloqueios,
  removerOcupados,
  removerPassado,
  type RegraDaGrade,
} from "./disponibilidade";

/* 2026-08-20 é uma QUINTA (dia 4). Fixo, e conferido logo abaixo: um teste que
   depende do dia da semana e não o verifica quebra em silêncio se a data mudar. */
const QUINTA = "2026-08-20";
const manhaDeQuinta: RegraDaGrade = { diaDaSemana: 4, inicio: "09:00", fim: "12:00", minutos: 30 };

describe("0. a âncora", () => {
  test("2026-08-20 é mesmo uma quinta-feira", () => {
    expect(new Date(`${QUINTA}T12:00:00`).getDay()).toBe(4);
  });
});

describe("1. a grade vira horários", () => {
  test("das 9 às 12, de 30 em 30, dá seis encaixes", () => {
    const r = expandirGrade([manhaDeQuinta], QUINTA, QUINTA);
    expect(r.map((h) => h.hora)).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]);
  });

  test("o FIM é exclusivo — não existe consulta às 12:00", () => {
    /**
     * A borda que vale um encaixe por dia. Com fim inclusivo, a agenda ofereceria
     * 12:00 num consultório que fecha ao meio-dia — e alguém apareceria.
     */
    const r = expandirGrade([manhaDeQuinta], QUINTA, QUINTA);
    expect(r.map((h) => h.hora)).not.toContain("12:00");
  });

  test("o encaixe que não CABE inteiro não é oferecido", () => {
    /* Das 9 às 10:20 com passo de 30: cabem 9:00 e 9:30. O das 10:00 terminaria
       às 10:30, depois do fim — oferecê-lo marcaria consulta em cima do fecho. */
    const r = expandirGrade([{ ...manhaDeQuinta, fim: "10:20" }], QUINTA, QUINTA);
    expect(r.map((h) => h.hora)).toEqual(["09:00", "09:30"]);
  });

  test("só o dia da semana da regra entra", () => {
    /* Uma semana inteira com regra de quinta: exatamente uma quinta. */
    const r = expandirGrade([manhaDeQuinta], "2026-08-17", "2026-08-23");
    expect([...new Set(r.map((h) => h.dia))]).toEqual([QUINTA]);
  });

  test("a regra vale para TODAS as quintas do período", () => {
    const r = expandirGrade([manhaDeQuinta], "2026-08-01", "2026-08-31");
    expect([...new Set(r.map((h) => h.dia))]).toEqual([
      "2026-08-06",
      "2026-08-13",
      "2026-08-20",
      "2026-08-27",
    ]);
  });

  test("duas regras que se sobrepõem não geram horário repetido", () => {
    /* Ele cadastrou "9 às 12" e depois "10 às 11" sem apagar a primeira. Repetir
       10:00 mostraria o mesmo botão duas vezes na tela da paciente. */
    const r = expandirGrade(
      [manhaDeQuinta, { diaDaSemana: 4, inicio: "10:00", fim: "11:00", minutos: 30 }],
      QUINTA,
      QUINTA,
    );
    expect(r.length).toBe(new Set(r.map((h) => h.hora)).size);
  });

  test("regra impossível é PULADA, e não consertada", () => {
    /**
     * Passo zero seria laço infinito; fim antes do início e hora inválida
     * gerariam horários que ninguém abriu. Inventar um padrão de 30 minutos
     * "para salvar" encheria a agenda de encaixes fantasmas.
     */
    expect(expandirGrade([{ ...manhaDeQuinta, minutos: 0 }], QUINTA, QUINTA)).toEqual([]);
    expect(expandirGrade([{ ...manhaDeQuinta, minutos: -30 }], QUINTA, QUINTA)).toEqual([]);
    expect(
      expandirGrade([{ ...manhaDeQuinta, inicio: "12:00", fim: "09:00" }], QUINTA, QUINTA),
    ).toEqual([]);
    expect(expandirGrade([{ ...manhaDeQuinta, inicio: "25:00" }], QUINTA, QUINTA)).toEqual([]);
  });

  test("período invertido devolve vazio em vez de laço", () => {
    expect(expandirGrade([manhaDeQuinta], "2026-08-31", "2026-08-01")).toEqual([]);
  });
});

describe("2. o bloqueio", () => {
  const livres = expandirGrade([manhaDeQuinta], QUINTA, QUINTA);

  test("come o início e DEVOLVE o fim", () => {
    /**
     * "Bloqueei das 10 às 11" tira 10:00 e 10:30 e mantém 11:00 — que é como
     * qualquer pessoa lê a frase. Fim inclusivo apagaria um encaixe a mais por
     * bloqueio, todo dia.
     */
    const r = removerBloqueios(livres, [
      { inicio: `${QUINTA}T10:00:00-03:00`, fim: `${QUINTA}T11:00:00-03:00` },
    ]);
    expect(r.map((h) => h.hora)).toEqual(["09:00", "09:30", "11:00", "11:30"]);
  });

  test("bloqueio de dia inteiro limpa o dia", () => {
    const r = removerBloqueios(livres, [
      { inicio: `${QUINTA}T00:00:00-03:00`, fim: `2026-08-21T00:00:00-03:00`, motivo: "Congresso" },
    ]);
    expect(r).toEqual([]);
  });

  test("bloqueio em OUTRO dia não mexe neste", () => {
    const r = removerBloqueios(livres, [
      { inicio: "2026-08-13T00:00:00-03:00", fim: "2026-08-14T00:00:00-03:00" },
    ]);
    expect(r.length).toBe(livres.length);
  });

  test("o bloqueio é lido no relógio do CONSULTÓRIO, não em UTC", () => {
    /**
     * Este é o erro de três horas, na direção do bloqueio. `14:00Z` é 11:00 em
     * São Paulo: lido como UTC, o bloqueio da tarde comeria a manhã.
     */
    const r = removerBloqueios(livres, [
      { inicio: `${QUINTA}T14:00:00Z`, fim: `${QUINTA}T15:00:00Z` },
    ]);
    /* 14:00Z–15:00Z é 11:00–12:00 no relógio do consultório: come 11:00 e
       11:30. Lido como UTC seria 14:00–15:00, e a manhã inteira sobreviveria —
       a diferença entre bloquear a tarde e não bloquear nada. */
    expect(r.map((h) => h.hora)).toEqual(["09:00", "09:30", "10:00", "10:30"]);
  });

  test("bloqueio com data podre é ignorado, e não zera a agenda", () => {
    /* Um `null` virando `Invalid Date` numa faixa faria a comparação de string
       apagar tudo ou nada — e "nada disponível" é indistinguível de "o médico
       não abriu horário". */
    const r = removerBloqueios(livres, [{ inicio: "abacaxi", fim: "abacaxi" }]);
    expect(r.length).toBe(livres.length);
  });
});

describe("3. o que já está marcado", () => {
  const livres = expandirGrade([manhaDeQuinta], QUINTA, QUINTA);

  test("sai da lista", () => {
    const r = removerOcupados(livres, [{ dia: QUINTA, hora: "10:00" }]);
    expect(r.map((h) => h.hora)).not.toContain("10:00");
    expect(r.length).toBe(livres.length - 1);
  });

  test("o mesmo horário em outro dia não tira nada", () => {
    const r = removerOcupados(livres, [{ dia: "2026-08-13", hora: "10:00" }]);
    expect(r.length).toBe(livres.length);
  });
});

describe("4. o passado e a antecedência", () => {
  const livres = expandirGrade([manhaDeQuinta], QUINTA, QUINTA);

  test("horário que já passou não é oferecido", () => {
    const agora = new Date(`${QUINTA}T10:05:00-03:00`);
    const r = removerPassado(livres, agora, 0);
    expect(r.map((h) => h.hora)).toEqual(["10:30", "11:00", "11:30"]);
  });

  test("a antecedência empurra o corte para a frente", () => {
    /**
     * Um horário livre daqui a dez minutos é livre no banco e impossível na
     * vida: ela não chega, e o médico fica com um buraco que parecia cheio.
     */
    const agora = new Date(`${QUINTA}T09:05:00-03:00`);
    expect(removerPassado(livres, agora, 2).map((h) => h.hora)).toEqual(["11:30"]);
  });

  test("sem `agora`, nada é cortado — a conta não inventa relógio", () => {
    expect(horariosLivres({ regras: [manhaDeQuinta], de: QUINTA, ate: QUINTA }).length).toBe(6);
  });
});

describe("5. a conta inteira", () => {
  test("grade menos bloqueio menos ocupado menos passado", () => {
    const r = horariosLivres({
      regras: [manhaDeQuinta],
      de: QUINTA,
      ate: QUINTA,
      bloqueios: [{ inicio: `${QUINTA}T11:00:00-03:00`, fim: `${QUINTA}T12:00:00-03:00` }],
      ocupados: [{ dia: QUINTA, hora: "09:30" }],
      agora: new Date(`${QUINTA}T08:00:00-03:00`),
      antecedenciaHoras: 1,
    });
    /* 09:00 cai pela antecedência (corte às 09:00 inclusive → fica),
       09:30 está ocupado, 11:00 e 11:30 estão bloqueados. */
    expect(r.map((h) => h.hora)).toEqual(["09:00", "10:00", "10:30"]);
  });

  test("sem regra nenhuma, não há horário — e isso não é erro", () => {
    /* Médico que ainda não montou a grade. A tela precisa distinguir isso de
       "tudo ocupado", e o vazio aqui é o sinal honesto. */
    expect(horariosLivres({ regras: [], de: QUINTA, ate: QUINTA })).toEqual([]);
  });
});

describe("6. as conversões", () => {
  test("hora e minutos vão e voltam", () => {
    expect(emMinutos("09:30")).toBe(570);
    expect(emHora(570)).toBe("09:30");
    expect(emHora(0)).toBe("00:00");
    expect(emMinutos("00:00")).toBe(0);
  });

  test("hora impossível não vira número", () => {
    expect(emMinutos("25:00")).toBeNull();
    expect(emMinutos("9:00")).toBeNull();
    expect(emMinutos("")).toBeNull();
  });

  test("instante vira o relógio do consultório", () => {
    /* 17:30Z é 14:30 em São Paulo — a diferença que faz a teleconsulta aparecer
       no horário certo da grade. */
    expect(paredeDaClinica("2026-08-20T17:30:00Z")).toEqual({ dia: "2026-08-20", hora: "14:30" });
  });

  test("instante podre não vira relógio", () => {
    expect(paredeDaClinica("abacaxi")).toBeNull();
  });

  test("a virada do dia em UTC ainda é o dia anterior aqui", () => {
    /**
     * 2026-08-21T01:00Z é 22:00 do dia 20 em São Paulo. Fatiar o ISO daria dia
     * 21 — e a consulta apareceria no dia seguinte ao que foi marcada.
     */
    expect(paredeDaClinica("2026-08-21T01:00:00Z")).toEqual({ dia: "2026-08-20", hora: "22:00" });
  });
});

describe("7. agrupado por dia, que é como a tela mostra", () => {
  test("junta as horas de cada dia, em ordem", () => {
    const r = livresPorDia([
      { dia: "2026-08-21", hora: "09:00" },
      { dia: "2026-08-20", hora: "10:00" },
      { dia: "2026-08-20", hora: "09:00" },
    ]);
    expect(r).toEqual([
      { dia: "2026-08-20", horas: ["10:00", "09:00"] },
      { dia: "2026-08-21", horas: ["09:00"] },
    ]);
  });
});
