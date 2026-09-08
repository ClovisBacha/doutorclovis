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
import { dataHoraCurta, diaCurto, horaCurta } from "@/lib/hora-do-registro";

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

  test("data e hora", () => {
    const utc = sobFuso("UTC", () => dataHoraCurta(INSTANTE));
    expect(utc).toContain("05/09/2026");
    expect(utc).toContain("21:40");
    expect(sobFuso("Asia/Tokyo", () => dataHoraCurta(INSTANTE))).toBe(utc);
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
    expect(dataHoraCurta(Number.NaN)).toBe("—");
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
