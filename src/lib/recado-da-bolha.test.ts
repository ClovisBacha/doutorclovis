import { describe, expect, test } from "bun:test";
import {
  TODAS_AS_FRASES,
  faixaDaHora,
  recadoDaBolha,
  type EstadoDoRecado,
} from "./recado-da-bolha";

const base: EstadoDoRecado = { feitos: 0, dia: 140, hora: 10, bebe: "Helena", semana: 20 };

describe("faixaDaHora", () => {
  test("cobre as 24 horas sem buraco", () => {
    for (let h = 0; h < 24; h++) expect(typeof faixaDaHora(h)).toBe("string");
  });

  test("põe cada hora na faixa certa, inclusive as bordas", () => {
    expect(faixaDaHora(0)).toBe("madrugada");
    expect(faixaDaHora(4)).toBe("madrugada");
    expect(faixaDaHora(5)).toBe("cedo");
    expect(faixaDaHora(7)).toBe("cedo");
    expect(faixaDaHora(8)).toBe("manha");
    expect(faixaDaHora(11)).toBe("manha");
    expect(faixaDaHora(12)).toBe("meiodia");
    expect(faixaDaHora(13)).toBe("meiodia");
    expect(faixaDaHora(14)).toBe("tarde");
    expect(faixaDaHora(17)).toBe("tarde");
    expect(faixaDaHora(18)).toBe("fimdetarde");
    expect(faixaDaHora(19)).toBe("fimdetarde");
    expect(faixaDaHora(20)).toBe("noite");
    expect(faixaDaHora(23)).toBe("noite");
  });

  test("aguenta hora fora da faixa sem estourar", () => {
    expect(faixaDaHora(-3)).toBe("madrugada");
    expect(faixaDaHora(99)).toBe("noite");
  });
});

describe("recadoDaBolha — o que não pode acontecer", () => {
  test("NUNCA deixa um buraco de gabarito na tela", () => {
    /* Um "{bebe}" literal no balão é a tela dizendo que está quebrada. Varre
       toda combinação que o app consegue produzir. */
    for (const bebe of [null, "", "  ", "Helena", "Maria Eduarda Ferreira"])
      for (const semana of [null, 0, 1, 20, 42])
        for (const posParto of [false, true])
          for (const careMode of [false, true])
            for (let feitos = 0; feitos <= 5; feitos++)
              for (let hora = 0; hora < 24; hora++)
                for (let dia = 0; dia < 40; dia++) {
                  const t = recadoDaBolha({ feitos, dia, hora, bebe, semana, posParto, careMode });
                  expect(t).not.toContain("{");
                  expect(t).not.toContain("}");
                  expect(t.trim().length).toBeGreaterThan(10);
                  /* Espaço duplo é o rastro de um nome vazio substituído. */
                  expect(t).not.toContain("  ");
                }
  });

  test("no Modo Cuidado não fala do bebê nem em 'vocês dois'", () => {
    for (let dia = 0; dia < 30; dia++)
      for (let feitos = 0; feitos <= 5; feitos++)
        for (const hora of [3, 9, 15, 22]) {
          const t = recadoDaBolha({ ...base, careMode: true, dia, feitos, hora });
          expect(t.toLowerCase()).not.toContain("bebê");
          expect(t.toLowerCase()).not.toContain("vocês dois");
          expect(t).not.toContain("Helena");
          /* Nem convite a comemorar: no luto não existe "dia completo". */
          expect(t.toLowerCase()).not.toContain("comemor");
        }
  });

  test("no pós-parto não diz que o bebê está crescendo aí dentro nem a semana", () => {
    for (let dia = 0; dia < 40; dia++)
      for (let feitos = 0; feitos <= 5; feitos++)
        for (const hora of [3, 6, 9, 13, 16, 19, 22]) {
          const t = recadoDaBolha({ ...base, posParto: true, dia, feitos, hora });
          expect(t).not.toContain("aí dentro");
          expect(t).not.toContain("Semana");
          expect(t.toLowerCase()).not.toContain("vocês dois");
        }
  });

  test("sem nome do bebê, nenhuma frase que dependia dele aparece", () => {
    for (let dia = 0; dia < 40; dia++)
      for (const hora of [6, 10, 16]) {
        const t = recadoDaBolha({ ...base, bebe: null, dia, hora });
        expect(t).not.toContain("aí dentro");
        expect(t).not.toContain("gosta quando você se mexe");
      }
  });

  test("usa só o PRIMEIRO nome — nome comprido estouraria as três linhas", () => {
    const achou = Array.from({ length: 40 }, (_, dia) =>
      recadoDaBolha({ ...base, bebe: "Maria Eduarda Ferreira", dia, hora: 16 }),
    );
    expect(achou.some((t) => t.includes("Maria"))).toBe(true);
    expect(achou.every((t) => !t.includes("Maria Eduarda"))).toBe(true);
  });
});

describe("recadoDaBolha — a frase certa para o momento", () => {
  test("com os 5 fechados, sempre celebra", () => {
    for (let dia = 0; dia < 40; dia++)
      for (const hora of [3, 9, 15, 22]) {
        const t = recadoDaBolha({ ...base, feitos: 5, dia, hora });
        expect(t.startsWith("🌟")).toBe(true);
      }
  });

  test("começado e não fechado, fala do meio do caminho", () => {
    for (let feitos = 1; feitos <= 4; feitos++)
      for (let dia = 0; dia < 20; dia++) {
        const t = recadoDaBolha({ ...base, feitos, dia });
        expect(t.startsWith("✨")).toBe(true);
      }
  });

  test("o total é parâmetro, não número cravado", () => {
    /* Já mudou uma vez (6 → 5). Cravado no texto, o "de 6" ficaria escrito na
       tela por mais tempo do que foi verdade. */
    expect(recadoDaBolha({ ...base, feitos: 2, dia: 0, total: 8 })).toContain("2 de 8");
  });

  test("mostra quantos faltam, com o número certo", () => {
    const t = recadoDaBolha({ ...base, feitos: 3, dia: 0 });
    expect(t).toContain("3 de 5");
  });

  test("na abertura, a faixa de hora entra no bolo", () => {
    const madrugada = Array.from({ length: 40 }, (_, dia) =>
      recadoDaBolha({ ...base, dia, hora: 3 }),
    );
    expect(madrugada.some((t) => t.includes("Não consegue dormir"))).toBe(true);
    /* E a frase da madrugada não vaza para o meio da tarde. */
    const tarde = Array.from({ length: 40 }, (_, dia) => recadoDaBolha({ ...base, dia, hora: 15 }));
    expect(tarde.every((t) => !t.includes("Não consegue dormir"))).toBe(true);
  });

  test("sem hora conhecida, ainda devolve um texto — e nenhum de hora", () => {
    for (let dia = 0; dia < 20; dia++) {
      const t = recadoDaBolha({ ...base, hora: null, dia });
      expect(t.length).toBeGreaterThan(10);
      expect(t).not.toContain("Não consegue dormir");
      expect(t).not.toContain("Boa noite");
    }
  });
});

describe("recadoDaBolha — determinismo", () => {
  test("mesma entrada devolve sempre a mesma frase", () => {
    /* Se um dia isto falhar, é porque alguém pôs `Math.random()` aqui — e o
       sintoma em produção é a tela trocar de texto sozinha na hidratação. */
    for (let i = 0; i < 50; i++)
      expect(recadoDaBolha({ ...base, dia: 137 })).toBe(recadoDaBolha({ ...base, dia: 137 }));
  });

  test("gira com o dia: em 12 dias seguidos aparecem pelo menos 5 frases distintas", () => {
    const vistos = new Set(
      Array.from({ length: 12 }, (_, i) => recadoDaBolha({ ...base, dia: 100 + i })),
    );
    expect(vistos.size).toBeGreaterThanOrEqual(5);
  });

  test("aguenta dia negativo (DUM corrigida para frente)", () => {
    expect(() => recadoDaBolha({ ...base, dia: -13 })).not.toThrow();
    expect(recadoDaBolha({ ...base, dia: -13 })).not.toContain("{");
  });
});

describe("as frases em si", () => {
  test("todas cabem em três linhas do balão", () => {
    /* O balão tem 257px e o texto ~217px de coluna, o que dá ~26 caracteres
       por linha a 15px. Três linhas = 78. O teto é do TEMPLATE: o nome do bebê
       entra no lugar de `{bebe}` (7 caracteres) e é sempre o primeiro nome. */
    for (const fr of TODAS_AS_FRASES) expect(fr.texto.length).toBeLessThanOrEqual(78);
  });

  test("nenhuma frase repetida", () => {
    const textos = TODAS_AS_FRASES.map((f) => f.texto);
    expect(new Set(textos).size).toBe(textos.length);
  });

  test("toda frase que cita o bebê está marcada como tal", () => {
    /* Sem esta marca a frase entraria no sorteio de quem não deu nome e sairia
       com um buraco, e no pós-parto falaria de barriga. */
    for (const fr of TODAS_AS_FRASES) {
      if (fr.texto.includes("{bebe}")) expect(fr.pedeBebe).toBe(true);
      if (fr.texto.includes("{semana}")) expect(fr.pedeSemana).toBe(true);
      if (fr.pedeBebe || fr.pedeSemana) expect(fr.soGestacao).toBe(true);
    }
  });

  test("são as 33 aprovadas mais as 3 do Modo Cuidado", () => {
    expect(TODAS_AS_FRASES.length).toBe(36);
  });
});
