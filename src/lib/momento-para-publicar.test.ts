import { describe, expect, test } from "bun:test";
import { momentoDe } from "./momento";
import { lerMomentoParaPublicar, VALIDADE_MINUTOS } from "./momento-para-publicar";

const AGORA = new Date("2026-08-20T12:00:00Z").getTime();
const m = momentoDe({ especie: "trofeu", numero: 12, emCuidado: false })!;

/** O bilhete cru, para não depender de `localStorage` no bun. */
function cru(o: unknown): string {
  return JSON.stringify(o);
}

describe("ler o bilhete", () => {
  test("o que foi guardado agora volta inteiro", () => {
    const b = cru({ momento: m, quando: AGORA });
    const lido = lerBilhete(b, AGORA);
    expect(lido?.titulo).toBe(m.titulo);
  });

  /* ⚠️ Trinta minutos: o cartão nasce de um toque em "Compartilhar" e o
     compositor abre no segundo seguinte. Um bilhete de horas faria o cartão de
     ontem aparecer sobre a foto que ela está publicando hoje. */
  test("⚠️ vence em trinta minutos", () => {
    const quase = cru({ momento: m, quando: AGORA - (VALIDADE_MINUTOS - 1) * 60_000 });
    const velho = cru({ momento: m, quando: AGORA - (VALIDADE_MINUTOS + 1) * 60_000 });
    expect(lerBilhete(quase, AGORA)).not.toBeNull();
    expect(lerBilhete(velho, AGORA)).toBeNull();
  });

  test("⚠️ bilhete do futuro é descartado", () => {
    expect(lerBilhete(cru({ momento: m, quando: AGORA + 5 * 60_000 }), AGORA)).toBeNull();
  });

  /* ⚠️ Derrubar a Comunidade por causa de um JSON torto seria trocar um
     conforto por um defeito. Mesma decisão de `lerRascunho`. */
  test("⚠️ lixo vira null, nunca exceção", () => {
    for (const lixo of [
      "{",
      "null",
      "[]",
      cru({ quando: AGORA }),
      cru({ momento: 42, quando: AGORA }),
      cru({ momento: { titulo: "x" }, quando: AGORA }),
    ]) {
      expect(lerBilhete(lixo, AGORA)).toBeNull();
    }
    expect(lerBilhete(null, AGORA)).toBeNull();
  });
});

/* ── O dublê do armazenamento ────────────────────────────────────────────
   `lerMomentoParaPublicar` lê o `localStorage`, que não existe no `bun test`.
   Em vez de um dublê global (que vazaria para os outros arquivos da suíte),
   monta-se um `localStorage` mínimo por chamada. */
function lerBilhete(valor: string | null, agora: number) {
  const g = globalThis as unknown as { localStorage?: Storage };
  const antes = g.localStorage;
  g.localStorage = {
    getItem: () => valor,
    setItem: () => {},
    removeItem: () => {},
  } as unknown as Storage;
  try {
    return lerMomentoParaPublicar(agora);
  } finally {
    g.localStorage = antes;
  }
}
