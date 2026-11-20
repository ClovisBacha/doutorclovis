import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MOVIMENTOS } from "@/lib/exercicios";
import { semComentarios } from "@/lib/sem-comentarios";
import {
  easeInOut,
  paraSvg,
  parteNoTempo,
  QUADROS,
  quadroNoTempo,
  USOS,
  type Passo,
  type Quadro,
} from "./figura";

/* A figura do app é a do site, número por número: estes testes leem o
   `styles.css` e o componente do site, e quebram se alguém mexer num lado sem
   mexer no outro. */
const RAIZ = join(import.meta.dir, "..", "..", "..", "..");
const CSS = readFileSync(join(RAIZ, "src", "styles.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const FIGURA = semComentarios(
  readFileSync(join(RAIZ, "src", "components", "figura-movimento.tsx"), "utf8"),
);

function passos(s: string): Passo[] {
  return [...s.matchAll(/(\w+)\(([^)]*)\)/g)].map(
    ([, f, a]) => [f, ...a!.split(",").map((x) => parseFloat(x))] as unknown as Passo,
  );
}

/** Os `@keyframes dc-mv-*` do site, como a tabela do app os escreve. */
function quadrosDoSite(): Map<string, Quadro[]> {
  const fora = new Map<string, Quadro[]>();
  for (const m of CSS.matchAll(/@keyframes dc-mv-(\w+)\s*\{/g)) {
    let i = m.index! + m[0].length;
    const inicio = i;
    for (let fundo = 1; fundo > 0; i++) {
      if (CSS[i] === "{") fundo++;
      else if (CSS[i] === "}") fundo--;
    }
    const quadros: Quadro[] = [];
    for (const b of CSS.slice(inicio, i - 1).matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const tr = /transform:\s*([^;]+);/.exec(b[2]!)?.[1];
      const op = /opacity:\s*([^;]+);/.exec(b[2]!)?.[1];
      for (const sel of b[1]!.split(",").map((s) => s.trim())) {
        if (!sel) continue;
        quadros.push({
          em: sel === "from" ? 0 : sel === "to" ? 100 : parseFloat(sel),
          ...(tr ? { transform: passos(tr) } : {}),
          ...(op != null ? { opacidade: Number(op) } : {}),
        });
      }
    }
    quadros.sort((a, b) => a.em - b.em);
    /* Sem o 0%, o CSS parte da figura parada: as mesmas funções, sem mexer. */
    if (quadros[0]!.em !== 0 && quadros[0]!.transform) {
      quadros.unshift({
        em: 0,
        transform: quadros[0]!.transform.map(
          ([f]) =>
            [
              f,
              ...(f === "translate" ? [0, 0] : f.startsWith("scale") ? [1] : [0]),
            ] as unknown as Passo,
        ),
      });
    }
    fora.set(m[1]!, quadros);
  }
  return fora;
}

describe("a figura do app anima como a do site", () => {
  test("cada @keyframes dc-mv-* do styles.css está na tabela, com os mesmos números", () => {
    const site = quadrosDoSite();
    expect([...site.keys()].sort()).toEqual(Object.keys(QUADROS).sort());
    for (const [nome, quadros] of site) {
      const app = QUADROS[nome as keyof typeof QUADROS] as readonly Quadro[];
      expect({ nome, quadros: app.map((q) => ({ ...q })) }).toEqual({ nome, quadros });
    }
  });

  test("os movimentos que se mexem são os mesmos, com a mesma duração e a mesma curva", () => {
    const animados = new Set([...FIGURA.matchAll(/anim === "([\w-]+)"/g)].map((m) => m[1]));
    expect([...animados].sort()).toEqual(Object.keys(USOS).sort());
    /* `dc-mv-${fecha ? "fecha" : "respira"} 5s` é o único nome montado na hora. */
    expect(FIGURA).toContain('dc-mv-${fecha ? "fecha" : "respira"} 5s ease-in-out infinite');
    const usosDoSite = new Set(
      [...FIGURA.matchAll(/dc-mv-(\w+) ([\d.]+)s (ease-in-out|linear) infinite/g)].map(
        ([, nome, dur, curva]) => `${nome} ${Number(dur)} ${curva}`,
      ),
    );
    usosDoSite.add("respira 5 ease-in-out").add("fecha 5 ease-in-out");
    const usosDoApp = new Set(
      Object.values(USOS)
        .flat()
        .map((u) => `${u.quadros} ${u.duracao} ${u.curva}`),
    );
    expect([...usosDoApp].sort()).toEqual([...usosDoSite].sort());
  });

  test("toda origem de giro do app existe no componente do site", () => {
    const origens = new Set(
      [...FIGURA.matchAll(/transformOrigin: "(\d+)px (\d+)px"/g)].map(([, x, y]) => `${x} ${y}`),
    );
    for (const u of Object.values(USOS).flat())
      if (u.origem) expect(origens.has(u.origem.join(" "))).toBe(true);
  });

  test("todo movimento animado existe no catálogo", () => {
    const ids = new Set(MOVIMENTOS.map((m) => m.id));
    for (const id of Object.keys(USOS)) expect(ids.has(id)).toBe(true);
  });
});

describe("a conta dos quadros", () => {
  test("ease-in-out: começa e termina parado, e passa do meio no meio", () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 5);
    expect(easeInOut(0.1)).toBeLessThan(0.1);
    expect(easeInOut(0.9)).toBeGreaterThan(0.9);
  });

  test("nos quadros, o número exato do site; entre eles, a curva", () => {
    expect(quadroNoTempo("ombros", 3, "ease-in-out", 0.75).transform).toEqual([
      ["translate", 0, -4],
    ]);
    expect(quadroNoTempo("ombros", 3, "ease-in-out", 0.375).transform![0]![2]).toBeCloseTo(-2, 5);
    expect(quadroNoTempo("tornozelo", 3, "linear", 1.5).transform).toEqual([["rotate", 180]]);
    /* O ciclo recomeça: 3,75 s no ombro é o mesmo que 0,75 s. */
    expect(quadroNoTempo("ombros", 3, "ease-in-out", 3.75).transform).toEqual([
      ["translate", 0, -4],
    ]);
  });

  test("as duas poses do gato-camelo se revezam", () => {
    expect(parteNoTempo("gatocamelo", "colunaNeutra", 0).opacity).toBe(1);
    expect(parteNoTempo("gatocamelo", "colunaRedonda", 0).opacity).toBe(0);
    expect(parteNoTempo("gatocamelo", "colunaNeutra", 3.5).opacity).toBe(0);
    expect(parteNoTempo("gatocamelo", "colunaRedonda", 3.5).opacity).toBe(1);
  });

  test("o transform do SVG gira em volta da origem do site", () => {
    expect(
      paraSvg(
        [
          ["rotate", -7],
          ["translateY", -2],
        ],
        [60, 96],
      ),
    ).toBe("translate(60 96) rotate(-7) translate(0 -2) translate(-60 -96)");
    expect(paraSvg([["scaleX", 0.78]])).toBe("scale(0.78 1)");
    expect(parteNoTempo("ombros", "quadril", 1)).toEqual({});
    expect(parteNoTempo("piriforme", "tronco", 1)).toEqual({});
  });
});
