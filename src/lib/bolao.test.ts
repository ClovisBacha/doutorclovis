import { describe, expect, test } from "bun:test";
import {
  bolaoDisponivel,
  diaEmNumero,
  diaEmTexto,
  diferencaEmTexto,
  horaEmTexto,
  MARGEM_DE_HORA,
  MARGEM_DE_PESO,
  PESO_MAXIMO,
  PESO_MINIMO,
  pesoEmTexto,
  PONTOS_DA_DATA,
  PONTOS_DA_HORA,
  PONTOS_DO_PESO,
  PONTOS_MAXIMOS,
  pontuar,
  ranking,
  validarPalpite,
  type PalpiteDoBolao,
} from "./bolao";

const REAL = { dia: "2026-09-10", pesoGramas: 3400, horaMinutos: 9 * 60 + 5 };

function palpite(p: Partial<PalpiteDoBolao> = {}): PalpiteDoBolao {
  return { dia: "2026-09-10", pesoGramas: 3400, horaMinutos: 9 * 60 + 5, ...p };
}

describe("diaEmNumero", () => {
  test("lê a data como local, não como meia-noite UTC", () => {
    // O erro que esta função existe para impedir: `new Date("2026-09-10")` é
    // meia-noite UTC, e em São Paulo isso é o dia 9 às 21h. Dois dias seguidos
    // têm de dar números seguidos, sem depender do fuso de quem roda o teste.
    const a = diaEmNumero("2026-09-10")!;
    const b = diaEmNumero("2026-09-11")!;
    expect(b - a).toBe(1);
  });

  test("atravessa a virada do ano e do mês", () => {
    expect(diaEmNumero("2027-01-01")! - diaEmNumero("2026-12-31")!).toBe(1);
    expect(diaEmNumero("2026-03-01")! - diaEmNumero("2026-02-28")!).toBe(1);
  });

  test("conhece o ano bissexto", () => {
    expect(diaEmNumero("2028-02-29")).not.toBeNull();
    expect(diaEmNumero("2026-02-29")).toBeNull();
  });

  test("recusa lixo e datas que não existem", () => {
    for (const s of ["", "amanhã", "2026-13-01", "2026-00-10", "2026-04-31", "10/09/2026"]) {
      expect(diaEmNumero(s)).toBeNull();
    }
  });
});

describe("validarPalpite", () => {
  const DPP = "2026-09-10";

  test("aceita um palpite comum", () => {
    expect(validarPalpite(palpite(), DPP)).toBeNull();
  });

  test("aceita sem hora — deixar em branco é escolha legítima", () => {
    expect(validarPalpite(palpite({ horaMinutos: null }), DPP)).toBeNull();
  });

  test("recusa peso que é erro de dedo", () => {
    // 340 no lugar de 3400: ninguém quis dizer que o bebê pesa 340 g.
    expect(validarPalpite(palpite({ pesoGramas: 340 }), DPP)).toBe("peso");
    expect(validarPalpite(palpite({ pesoGramas: 34000 }), DPP)).toBe("peso");
  });

  test("aceita o prematuro de alto risco — a faixa é generosa de propósito", () => {
    // 900 g com 26 semanas é a paciente DESTE app, não um caso improvável.
    expect(
      validarPalpite({ dia: "2026-07-01", pesoGramas: 900, horaMinutos: null }, DPP),
    ).toBeNull();
    expect(validarPalpite(palpite({ pesoGramas: PESO_MINIMO }), DPP)).toBeNull();
    expect(validarPalpite(palpite({ pesoGramas: PESO_MAXIMO }), DPP)).toBeNull();
  });

  test("recusa data muito longe da DPP nos dois sentidos", () => {
    expect(validarPalpite(palpite({ dia: "2029-09-10" }), DPP)).toBe("data-fora-da-faixa");
    expect(validarPalpite(palpite({ dia: "2020-09-10" }), DPP)).toBe("data-fora-da-faixa");
  });

  test("sem DPP cadastrada, só confere o formato", () => {
    // Faltar a DPP é buraco NOSSO, não dela — recusar o palpite por causa
    // disso seria cobrar dela o nosso dado que falta.
    expect(validarPalpite(palpite({ dia: "2029-09-10" }), null)).toBeNull();
    expect(validarPalpite(palpite({ dia: "nada" }), null)).toBe("data");
  });

  test("recusa hora fora do relógio e peso quebrado", () => {
    expect(validarPalpite(palpite({ horaMinutos: 1440 }), DPP)).toBe("hora");
    expect(validarPalpite(palpite({ horaMinutos: -1 }), DPP)).toBe("hora");
    expect(validarPalpite(palpite({ pesoGramas: 3400.5 }), DPP)).toBe("peso");
    expect(validarPalpite(palpite({ pesoGramas: NaN }), DPP)).toBe("peso");
  });
});

describe("pontuar", () => {
  test("acerto em cheio faz o máximo", () => {
    const n = pontuar(palpite(), REAL);
    expect(n.total).toBe(PONTOS_MAXIMOS);
    expect(n.diasDeDiferenca).toBe(0);
    expect(n.gramasDeDiferenca).toBe(0);
  });

  test("a data cai por dia e tem piso em zero", () => {
    expect(pontuar(palpite({ dia: "2026-09-11" }), REAL).data).toBe(PONTOS_DA_DATA - 15);
    expect(pontuar(palpite({ dia: "2026-09-08" }), REAL).data).toBe(PONTOS_DA_DATA - 30);
    // Errar por um mês dá zero, e não um número negativo que a tela teria de
    // explicar.
    expect(pontuar(palpite({ dia: "2026-08-10" }), REAL).data).toBe(0);
  });

  test("o sinal da diferença diz se ela palpitou antes ou depois", () => {
    expect(pontuar(palpite({ dia: "2026-09-08" }), REAL).diasDeDiferenca).toBe(-2);
    expect(pontuar(palpite({ dia: "2026-09-13" }), REAL).diasDeDiferenca).toBe(3);
    expect(diferencaEmTexto(-2)).toBe("2 dias antes");
    expect(diferencaEmTexto(3)).toBe("3 dias depois");
    expect(diferencaEmTexto(0)).toBe("no dia");
    expect(diferencaEmTexto(-1)).toBe("1 dia antes");
  });

  test("o peso tem margem de tolerância antes de começar a cair", () => {
    expect(pontuar(palpite({ pesoGramas: 3400 + MARGEM_DE_PESO }), REAL).peso).toBe(PONTOS_DO_PESO);
    expect(pontuar(palpite({ pesoGramas: 3400 - MARGEM_DE_PESO }), REAL).peso).toBe(PONTOS_DO_PESO);
    expect(pontuar(palpite({ pesoGramas: 3550 }), REAL).peso).toBe(PONTOS_DO_PESO - 10);
    expect(pontuar(palpite({ pesoGramas: 1000 }), REAL).peso).toBe(0);
  });

  test("⚠️ a hora é CIRCULAR — 23h50 e 00h10 são vinte minutos", () => {
    // Bebê nasce de madrugada. Sem a distância circular, quem palpita 00h10 e o
    // parto sai 23h55 tiraria zero por "23h40 de diferença".
    const meiaNoite = { dia: "2026-09-10", pesoGramas: 3400, horaMinutos: 10 };
    const quaseMeiaNoite = { ...REAL, horaMinutos: 23 * 60 + 55 };
    expect(pontuar(meiaNoite, quaseMeiaNoite).hora).toBe(PONTOS_DA_HORA);
  });

  test("⚠️ quem não palpitou hora tira ZERO nela, não a nota cheia", () => {
    // Senão essa pessoa disputaria um total de 160 contra os 200 dos outros, e
    // o ranking compararia notas de provas diferentes.
    const n = pontuar(palpite({ horaMinutos: null }), REAL);
    expect(n.hora).toBe(0);
    expect(n.total).toBe(PONTOS_DA_DATA + PONTOS_DO_PESO);
  });

  test("a hora só vale dentro da margem e depois cai por hora", () => {
    const meia = { ...REAL, horaMinutos: 9 * 60 + 5 };
    expect(pontuar({ ...palpite(), horaMinutos: 9 * 60 + 5 + MARGEM_DE_HORA }, meia).hora).toBe(
      PONTOS_DA_HORA,
    );
    expect(pontuar({ ...palpite(), horaMinutos: 9 * 60 + 5 + 120 }, meia).hora).toBe(
      PONTOS_DA_HORA - 2,
    );
  });
});

describe("ranking", () => {
  type Linha = PalpiteDoBolao & { quem: string };

  test("ordena pelo total e marca o ganhador", () => {
    const palpites: Linha[] = [
      { quem: "tia", dia: "2026-09-14", pesoGramas: 3000, horaMinutos: null },
      { quem: "vô", dia: "2026-09-10", pesoGramas: 3400, horaMinutos: 9 * 60 + 5 },
      { quem: "primo", dia: "2026-09-11", pesoGramas: 3450, horaMinutos: 10 * 60 },
    ];
    const r = ranking(palpites, REAL);
    expect(r[0].palpite.quem).toBe("vô");
    expect(r[0].posicao).toBe(1);
    expect(r[0].nota.total).toBe(PONTOS_MAXIMOS);
    expect(r[1].palpite.quem).toBe("primo");
    expect(r[2].palpite.quem).toBe("tia");
  });

  test("empate divide a posição e a seguinte pula", () => {
    const palpites: Linha[] = [
      { quem: "a", dia: "2026-09-11", pesoGramas: 3400, horaMinutos: 9 * 60 + 5 },
      { quem: "b", dia: "2026-09-09", pesoGramas: 3400, horaMinutos: 9 * 60 + 5 },
      { quem: "c", dia: "2026-09-20", pesoGramas: 2000, horaMinutos: null },
    ];
    const r = ranking(palpites, REAL);
    expect(r.map((x) => x.posicao)).toEqual([1, 1, 3]);
  });

  test("⚠️ não premia quem palpitou primeiro", () => {
    // Premiar a ordem de chegada puniria exatamente quem a mecânica quer
    // trazer de volta: a pessoa que revisita e ajusta o palpite.
    const cedo: Linha = { quem: "cedo", dia: "2026-09-15", pesoGramas: 3000, horaMinutos: null };
    const tarde: Linha = { quem: "tarde", dia: "2026-09-10", pesoGramas: 3400, horaMinutos: null };
    expect(ranking([cedo, tarde], REAL)[0].palpite.quem).toBe("tarde");
  });

  test("aguenta lista vazia", () => {
    expect(ranking([], REAL)).toEqual([]);
  });
});

describe("bolaoDisponivel", () => {
  test("⚠️ NUNCA em Modo Cuidado", () => {
    // Uma lista de pessoas queridas apostando alegremente numa data que não vai
    // chegar é o pior artefato que este app conseguiria produzir.
    expect(bolaoDisponivel({ careMode: true, temGestacao: true })).toBe(false);
  });

  test("precisa de gestação aberta", () => {
    expect(bolaoDisponivel({ careMode: false, temGestacao: false })).toBe(false);
    expect(bolaoDisponivel({ careMode: false, temGestacao: true })).toBe(true);
  });
});

describe("formatação", () => {
  test("peso em quilos com vírgula e três casas", () => {
    expect(pesoEmTexto(3400)).toBe("3,400 kg");
    expect(pesoEmTexto(3045)).toBe("3,045 kg");
    expect(pesoEmTexto(900)).toBe("0,900 kg");
  });

  test("hora com dois dígitos, e travessão quando não há", () => {
    expect(horaEmTexto(9 * 60 + 5)).toBe("09:05");
    expect(horaEmTexto(0)).toBe("00:00");
    expect(horaEmTexto(23 * 60 + 59)).toBe("23:59");
    expect(horaEmTexto(null)).toBe("—");
  });
});

describe("diaEmTexto", () => {
  test("⚠️ fatia a string — nunca passa por new Date", () => {
    // `new Date("2026-09-08")` é meia-noite UTC, e `getDate()` em São Paulo
    // devolve 7: a lista mostraria todo palpite um dia adiantado.
    expect(diaEmTexto("2026-09-08")).toBe("08/09");
    expect(diaEmTexto("2026-01-01")).toBe("01/01");
    expect(diaEmTexto("2026-12-31")).toBe("31/12");
  });

  test("devolve a entrada quando ela não é uma data", () => {
    expect(diaEmTexto("qualquer coisa")).toBe("qualquer coisa");
  });
});
