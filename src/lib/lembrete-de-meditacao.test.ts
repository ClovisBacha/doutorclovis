/**
 * O LEMBRETE DIÁRIO — e as duas armadilhas de fuso que ele evita.
 *
 * A primeira já custou três horas neste repositório (`getTimezoneOffset` tem o
 * sinal trocado). A segunda é mais sutil: contar repetição por DIA DO
 * CALENDÁRIO manda o lembrete duas vezes quando o horário dela cai perto da
 * meia-noite UTC — que é o caso de qualquer brasileira que escolha 21h.
 */

import { describe, expect, test } from "bun:test";
import {
  comoHora,
  deHora,
  diaDela,
  estaNaHora,
  fusoDoNavegador,
  horaLocal,
  JANELA_MIN,
  meditouEm,
  minutosUtc,
  paraGuardar,
  textoDoLembrete,
  type Assinante,
} from "./lembrete-de-meditacao";

const SP = -180; // São Paulo
const base = (over: Partial<Assinante> = {}): Assinante => ({
  id: "a",
  utcMin: 0,
  offset: SP,
  enviadoEm: null,
  careMode: false,
  ...over,
});

describe("guardar o horário que ela escolheu", () => {
  test("21:00 em São Paulo vira meia-noite UTC", () => {
    expect(paraGuardar("21:00", SP)).toEqual({ utcMin: 0, offset: -180 });
  });

  test("e volta a ser 21:00 na tela dela", () => {
    expect(horaLocal(0, SP)).toBe("21:00");
  });

  test("a volta ao redor da meia-noite não perde o dia", () => {
    /* 01:00 em São Paulo é 04:00 UTC; 23:00 é 02:00 UTC do dia seguinte. */
    expect(paraGuardar("01:00", SP)?.utcMin).toBe(240);
    expect(paraGuardar("23:00", SP)?.utcMin).toBe(120);
    expect(horaLocal(120, SP)).toBe("23:00");
  });

  test("fuso positivo (Lisboa, verão) também fecha", () => {
    expect(paraGuardar("21:00", 60)?.utcMin).toBe(1200);
    expect(horaLocal(1200, 60)).toBe("21:00");
  });

  test("hora inválida não vira lembrete nenhum", () => {
    expect(paraGuardar("25:00", SP)).toBe(null);
    expect(paraGuardar("", SP)).toBe(null);
    expect(deHora("9:5")).toBe(null);
    expect(deHora("09:05")).toBe(545);
  });

  test("comoHora formata com dois dígitos e dá a volta", () => {
    expect(comoHora(0)).toBe("00:00");
    expect(comoHora(545)).toBe("09:05");
    expect(comoHora(1440)).toBe("00:00");
    expect(comoHora(-60)).toBe("23:00");
  });

  test("⚠️ o fuso do navegador é lido com o sinal TROCADO", () => {
    /* `getTimezoneOffset()` devolve +180 em São Paulo. Usar direto é o erro de
       três horas que a agenda já teve — e aqui ele mandaria o lembrete às 15h. */
    const falso = { getTimezoneOffset: () => 180 } as Date;
    expect(fusoDoNavegador(falso)).toBe(-180);
  });
});

describe("a hora chegou?", () => {
  const em = (h: number, m: number) => new Date(Date.UTC(2026, 7, 13, h, m));

  test("manda dentro da janela, não manda fora", () => {
    const a = base({ utcMin: 0 });
    expect(estaNaHora(a, em(0, 0))).toBe(true);
    expect(estaNaHora(a, em(0, 59))).toBe(true);
    expect(estaNaHora(a, em(1, 10))).toBe(false); // 70 min: a borda
    expect(estaNaHora(a, em(12, 0))).toBe(false);
  });

  test("⚠️ um cron atrasado manda tarde, em vez de não mandar", () => {
    /* A janela é aberta de propósito: é a mesma escolha do lembrete de
       consulta. O que ela impede é o lembrete horas depois. */
    expect(JANELA_MIN).toBeGreaterThan(60);
    expect(estaNaHora(base({ utcMin: 0 }), em(1, 5))).toBe(true);
  });

  test("a janela dá a volta na meia-noite UTC", () => {
    const a = base({ utcMin: 1430 }); // 23:50 UTC
    expect(estaNaHora(a, em(23, 55))).toBe(true);
    expect(estaNaHora(a, em(0, 30))).toBe(true); // dia seguinte, 40 min depois
    expect(estaNaHora(a, em(2, 0))).toBe(false);
  });

  test("⚠️ e a repetição é contada em HORAS, nunca em dias do calendário", () => {
    /* Este é o defeito que a contagem por dia teria: manda às 23:55 (dia A) e
       de novo às 00:10 (dia B), vinte minutos depois, no ouvido de quem já
       tinha sido lembrada. */
    const a = base({ utcMin: 1430, enviadoEm: em(23, 55) });
    expect(estaNaHora(a, em(0, 10))).toBe(false);
  });

  test("no dia seguinte volta a mandar", () => {
    const ontem = new Date(Date.UTC(2026, 7, 12, 0, 5));
    expect(estaNaHora(base({ utcMin: 0, enviadoEm: ontem }), em(0, 5))).toBe(true);
  });

  test("sem horário escolhido, nunca", () => {
    expect(estaNaHora(base({ utcMin: null }), em(0, 0))).toBe(false);
  });

  test("no Modo Cuidado, nunca", () => {
    /* Quem acabou de perder a gestação não recebe convite diário para uma
       trilha de bem-estar. A meditação continua aberta para ela — o que some é
       o empurrão. */
    expect(estaNaHora(base({ careMode: true }), em(0, 0))).toBe(false);
  });
});

describe("já meditou hoje?", () => {
  const blob = { "dc-path-med-log": { dias: ["2026-08-13"], minutos: 40 } };

  test("o dia dela sai do deslocamento dela, não do relógio do servidor", () => {
    /* 01:00 UTC do dia 14 ainda é dia 13 em São Paulo. Sem isto o servidor
       acharia que ela não meditou "hoje" e mandaria o lembrete às 22h. */
    expect(diaDela(new Date(Date.UTC(2026, 7, 14, 1, 0)), SP)).toBe("2026-08-13");
    expect(diaDela(new Date(Date.UTC(2026, 7, 14, 4, 0)), SP)).toBe("2026-08-14");
  });

  test("meditou → o dia bate", () => {
    expect(meditouEm(blob, "2026-08-13")).toBe(true);
    expect(meditouEm(blob, "2026-08-14")).toBe(false);
  });

  test("⚠️ blob estranho vira 'não sei', e 'não sei' MANDA", () => {
    /* O blob é escrito pelo navegador dela. Tratar formato inesperado como
       "já meditou" apagaria o recurso inteiro sem erro nenhum aparecer. */
    for (const lixo of [null, undefined, 42, "x", {}, { "dc-path-med-log": 7 }]) {
      expect(meditouEm(lixo, "2026-08-13")).toBe(false);
    }
    expect(meditouEm({ "dc-path-med-log": { dias: "2026-08-13" } }, "2026-08-13")).toBe(false);
  });
});

describe("o texto", () => {
  test("com sequência, o número vem primeiro", () => {
    expect(textoDoLembrete(7).title).toContain("7 dias seguidos");
  });

  test("sem sequência, não cobra nada de ninguém", () => {
    const t = textoDoLembrete(0);
    expect(`${t.title} ${t.body}`).not.toMatch(/você não|perdeu|faltou|há \d+ dias/i);
    expect(t.body).toContain("Três minutos");
  });

  test("nenhum dos dois promete clínica", () => {
    for (const s of [0, 1, 5]) {
      const t = textoDoLembrete(s);
      expect(`${t.title} ${t.body}`).not.toMatch(/está tudo bem|vai passar|saudável|seu bebê/i);
    }
  });
});

describe("minutosUtc", () => {
  test("lê o relógio UTC, nunca o do servidor", () => {
    /* O contêiner da Vercel roda em UTC, mas isso é acidente de hospedagem —
       `getHours()` mudaria o comportamento numa mudança de região. */
    expect(minutosUtc(new Date("2026-08-13T21:30:00Z"))).toBe(21 * 60 + 30);
  });
});
