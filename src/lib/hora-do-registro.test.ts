/**
 * A HORA NÃO PODE MUDAR ENTRE O SERVIDOR E O APARELHO.
 *
 * ⚠️ O defeito que este arquivo trava foi MEDIDO nas duas telas clínicas, e é
 * da classe que já deixou este app sem abrir: `toLocaleString` no render
 * formata no fuso do RUNTIME, e o servidor deste app roda em UTC enquanto o
 * aparelho dela roda em `America/Sao_Paulo`. A mesma sessão saía 04:40 no HTML
 * e 01:40 na primeira pintura.
 *
 * ⚠️ O teste RODA a régua sob dois fusos de processo — é a única forma de
 * provar isto sem dois navegadores. Ler o fonte procurando `timeZone:` provaria
 * que a palavra está lá, e não que ela vale.
 */
import { describe, expect, test } from "bun:test";
import { diaCurto, horaCurta, intervaloCurto, rotuloDoInstante } from "@/lib/hora-do-registro";

/** Roda um trecho com o fuso do PROCESSO trocado, e devolve o que ele deu. */
function sobFuso<T>(tz: string, f: () => T): T {
  const antes = process.env.TZ;
  process.env.TZ = tz;
  try {
    return f();
  } finally {
    process.env.TZ = antes;
  }
}

const INSTANTE = "2026-09-05T21:40:00-03:00";

describe("⚠️ a hora é a mesma em qualquer fuso de processo", () => {
  test("hora curta", () => {
    const utc = sobFuso("UTC", () => horaCurta(INSTANTE));
    const sp = sobFuso("America/Sao_Paulo", () => horaCurta(INSTANTE));
    const toquio = sobFuso("Asia/Tokyo", () => horaCurta(INSTANTE));
    expect(utc).toBe("21:40");
    expect(sp).toBe(utc);
    expect(toquio).toBe(utc);
  });

  test("dia e hora juntos", () => {
    const utc = sobFuso("UTC", () => diaCurto(INSTANTE) + " " + horaCurta(INSTANTE));
    expect(utc).toContain("05/09");
    expect(utc).toContain("21:40");
    expect(sobFuso("Asia/Tokyo", () => diaCurto(INSTANTE) + " " + horaCurta(INSTANTE))).toBe(utc);
  });

  test("⚠️ e o DIA também vira no fuso do consultório, não no do processo", () => {
    /* Às 22h de São Paulo já é o dia seguinte em UTC — é a virada que faria a
       mesma sessão aparecer em dois dias diferentes no gráfico. */
    const noite = "2026-09-05T22:30:00-03:00";
    expect(sobFuso("UTC", () => diaCurto(noite))).toBe("05/09");
    expect(sobFuso("America/Sao_Paulo", () => diaCurto(noite))).toBe("05/09");
  });

  test("instante impossível não estoura — devolve o traço", () => {
    expect(horaCurta("não é data")).toBe("—");
    expect(diaCurto("")).toBe("—");
  });
});

describe("⚠️ e as telas clínicas usam a régua, e não o formatador cru", () => {
  test("chutes e contrações não chamam toLocale* direto", async () => {
    const { readFileSync } = await import("node:fs");
    const { semComentarios } = await import("@/lib/sem-comentarios");
    for (const arquivo of [
      "src/components/kicks-tab.tsx",
      "src/components/contracoes-tab.tsx",
    ] as const) {
      const codigo = semComentarios(readFileSync(arquivo, "utf8"));
      expect(`${arquivo}: ${/toLocale(String|TimeString|DateString)\(/.test(codigo)}`).toBe(
        `${arquivo}: false`,
      );
    }
  });
});

describe("⚠️ a hora sozinha só vale para HOJE", () => {
  /* 05/09/2026 21:40 em São Paulo. */
  const HOJE = new Date("2026-09-05T21:40:00-03:00").getTime();

  test("o que é de hoje fica curto — a lista é densa e é o caso de quase toda linha", () => {
    const cedo = new Date("2026-09-05T08:12:00-03:00");
    expect(sobFuso("UTC", () => rotuloDoInstante(cedo, HOJE))).toBe("08:12");
    expect(sobFuso("Asia/Tokyo", () => rotuloDoInstante(cedo, HOJE))).toBe("08:12");
  });

  test("⚠️ o que NÃO é de hoje carrega a data — a hora sozinha afirmaria que foi hoje", () => {
    const ontem = new Date("2026-09-04T14:20:00-03:00");
    for (const tz of ["UTC", "America/Sao_Paulo", "Asia/Tokyo"]) {
      const r = sobFuso(tz, () => rotuloDoInstante(ontem, HOJE));
      expect(`${tz}: ${r}`).toBe(`${tz}: 04/09 14:20`);
    }
  });

  test("⚠️ o dia é o CIVIL do consultório, e não o do processo", () => {
    /* 05/09 23:30 em São Paulo já é 06/09 em UTC: comparar por `getDate()`
       faria a linha das 23h30 aparecer com data toda noite. */
    const noite = new Date("2026-09-05T23:30:00-03:00");
    for (const tz of ["UTC", "Asia/Tokyo"]) {
      expect(`${tz}: ${sobFuso(tz, () => rotuloDoInstante(noite, HOJE))}`).toBe(`${tz}: 23:30`);
    }
  });

  test("instante impossível não estoura", () => {
    expect(rotuloDoInstante("não é data", HOJE)).toBe("—");
  });
});

describe("⚠️ o intervalo entre episódios não é dito em minutos", () => {
  test("dentro do episódio, minutos — é a unidade do alarme", () => {
    expect(intervaloCurto(4)).toBe("4min");
    expect(intervaloCurto(119)).toBe("119min");
  });

  test("⚠️ acima da janela da análise, horas — 1340min é ruído com cara de medida", () => {
    /* A régua clínica desta tela olha as duas últimas horas e nada além. */
    expect(intervaloCurto(120)).toBe("2h");
    expect(intervaloCurto(1340)).toBe("22h");
  });

  test("⚠️ e o corte é de TEMPO, nunca de calendário", () => {
    /* 23h50 e 00h10 são vinte minutos e o MESMO episódio; uma régua por data
       os separaria justamente na noite em que isso mais importa. */
    expect(intervaloCurto(20)).toBe("20min");
  });

  test("dias, quando são dias — e nada estoura", () => {
    expect(intervaloCurto(60 * 24 * 6)).toBe("6d");
    expect(intervaloCurto(Number.NaN)).toBe("—");
    expect(intervaloCurto(-5)).toBe("—");
  });
});
