import { describe, expect, test } from "bun:test";
import { linhaDaDuplaNoHoje, primeiroNomeDaAmiga, rostosDaFaixa } from "~/lib/jornada/amigas";

const dupla = (o: Partial<Parameters<typeof linhaDaDuplaNoHoje>[0] & object> = {}) => ({
  estado: "ativa",
  nome: "Juliana Almeida",
  sequencia: 6,
  recorde: 12,
  paradaHa: 0,
  ...o,
});

describe("as amigas no Hoje", () => {
  test("os rostos: quem apareceu por último primeiro, e quantas ficaram de fora", () => {
    const a = (id: string, vistaEm: string | null) => ({ id, vistaEm });
    const { rostos, mais } = rostosDaFaixa(
      [
        a("nunca", null),
        a("ontem", "2026-10-27T10:00:00Z"),
        a("agora", "2026-10-28T10:00:00Z"),
        a("semana", "2026-10-20T10:00:00Z"),
      ],
      3,
    );
    expect(rostos.map((r) => r.id)).toEqual(["agora", "ontem", "semana"]);
    expect(mais).toBe(1);
    expect(rostosDaFaixa([], 5)).toEqual({ rostos: [], mais: 0 });
  });

  test("a dupla diz o fato — e no pós-parto não existe", () => {
    expect(linhaDaDuplaNoHoje(dupla(), true, false)).toBe("🔥 6 dias juntas com Juliana");
    expect(linhaDaDuplaNoHoje(dupla({ sequencia: 1 }), true, false)).toBe(
      "🔥 1 dia juntas com Juliana",
    );
    expect(linhaDaDuplaNoHoje(dupla({ sequencia: 0, recorde: 0 }), true, false)).toBe(
      "🔥 A chama com Juliana começa quando as duas aparecerem",
    );
    expect(linhaDaDuplaNoHoje(dupla({ sequencia: 0, paradaHa: 6 }), true, false)).toBe(
      "A dupla com Juliana está em pausa — nada se perdeu",
    );
    expect(linhaDaDuplaNoHoje(dupla({ estado: "convite-recebido" }), true, false)).toBe(
      "Juliana te chamou para a dupla 🔥",
    );
    expect(linhaDaDuplaNoHoje(dupla({ estado: "convite-enviado" }), true, false)).toBe(
      "Você chamou Juliana para a dupla",
    );
    expect(linhaDaDuplaNoHoje(null, true, false)).toContain("Chame uma amiga para a dupla");
    expect(linhaDaDuplaNoHoje(null, false, false)).toBeNull();
    expect(linhaDaDuplaNoHoje(dupla(), true, true)).toBeNull();
    expect(linhaDaDuplaNoHoje(dupla({ estado: "convite-recebido" }), true, true)).toBeNull();
  });

  test("a pausa nunca diz o motivo", () => {
    const t = linhaDaDuplaNoHoje(dupla({ sequencia: 0, paradaHa: 9 }), true, false)!;
    expect(t).not.toMatch(/sumiu|parou|doente|hospital|internad|aconteceu|motivo/i);
  });

  test("o primeiro nome", () => {
    expect(primeiroNomeDaAmiga("Juliana Almeida")).toBe("Juliana");
    expect(primeiroNomeDaAmiga("  ")).toBe("sua amiga");
    expect(primeiroNomeDaAmiga(null)).toBe("sua amiga");
  });
});

describe("a faixa das amigas nas telas do Hoje", () => {
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  const { join } = require("node:path") as typeof import("node:path");
  const { semComentarios } = require("@/lib/sem-comentarios") as {
    semComentarios: (s: string) => string;
  };
  const RAIZ = join(import.meta.dir, "..", "..");
  const ler = (...p: string[]) => semComentarios(readFileSync(join(RAIZ, ...p), "utf8"));

  test("na gestação e no pós-parto, e não no Modo Cuidado", () => {
    const hoje = ler("app", "(abas)", "jornada.tsx");
    expect(hoje).toContain("amigas={<AmigasNoHoje pos={false} />}");
    expect(hoje).toContain("amigas={<AmigasNoHoje pos />}");
    const cuidado = hoje.slice(hoje.indexOf("function JornadaDoCuidado"));
    expect(cuidado.slice(0, cuidado.indexOf("\nfunction ", 10))).not.toContain("AmigasNoHoje");
  });

  test("o bônus da dupla só se cobra na gestação, fora do Modo Cuidado, com a dupla ativa", () => {
    const faixa = ler("componentes", "amigas", "faixa-do-hoje.tsx");
    expect(faixa).toContain('if (!pos && !l.careMode && l.dupla?.estado === "ativa")');
    expect(faixa).toContain("if (!leitura || leitura.careMode) return null;");
  });
});
