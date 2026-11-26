import { describe, expect, test } from "bun:test";
import { MOVIMENTOS } from "@/lib/exercicios";
import type { Camada, Desenho, Forma } from "./figura-desenho";
import { desenhoDoMovimento, JUNTAS } from "./figura-poses";
import { desenhoDoCasal } from "./figura-casal";
import { corDaParada, coresDaFigura, paradaEmCor } from "./figura-cores";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  easeInOut,
  paraSvg,
  parteNoTempo,
  QUADROS,
  quadroNoTempo,
  RESPIRO,
  USOS,
  type Parte,
  type Passo,
} from "./figura";

/* A figura do app é do app desde 21/11/2026 (uma personagem, uma pose por
   exercício). Estes testes cobram que o desenho e a tabela das animações
   combinam: toda parte animada existe no desenho, toda origem cai dentro
   dele, e os movimentos que dependem de duas peças andando juntas (o
   agachamento, o balanço, as costelas) não se desmontam no meio. */

const desenhoDe = (id: string): Desenho => {
  const m = MOVIMENTOS.find((x) => x.id === id)!;
  return desenhoDoMovimento(m.id, m.pose);
};

function partes(camadas: readonly Camada[]): Parte[] {
  return camadas.flatMap((c) => [...(c.parte ? [c.parte] : []), ...partes(c.dentro ?? [])]);
}

function caminhos(formas: readonly Forma[]): string[] {
  return formas.flatMap((f) => ("grupo" in f ? caminhos(f.grupo) : [f.d]));
}
function todosOsCaminhos(camadas: readonly Camada[]): string[] {
  return camadas.flatMap((c) => [...caminhos(c.formas ?? []), ...todosOsCaminhos(c.dentro ?? [])]);
}

/** Onde um ponto vai parar com um passo de transformação em volta da origem. */
function mover(p: readonly [number, number], passos: readonly Passo[], origem = [0, 0] as const) {
  let [x, y] = [p[0] - origem[0], p[1] - origem[1]];
  for (const [f, a = 0, b = 0] of [...passos].reverse()) {
    if (f === "rotate") {
      const r = (a * Math.PI) / 180;
      [x, y] = [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)];
    } else if (f === "translate") [x, y] = [x + a, y + b];
    else if (f === "translateX") x += a;
    else if (f === "translateY") y += a;
  }
  return [x + origem[0], y + origem[1]] as const;
}

function noMeio(id: string, parte: Parte, p: readonly [number, number]) {
  const uso = USOS[id]!.find((u) => u.parte === parte)!;
  const q = quadroNoTempo(uso.quadros, uso.duracao, uso.curva, uso.duracao / 2);
  return mover(p, q.transform ?? [], uso.origem);
}

describe("o desenho de cada exercício", () => {
  test("todo exercício do catálogo tem desenho, sem número quebrado", () => {
    for (const m of MOVIMENTOS) {
      const d = desenhoDoMovimento(m.id, m.pose);
      expect({ id: m.id, caixa: d.caixa[2] > 0 && d.caixa[3] > 0 }).toEqual({
        id: m.id,
        caixa: true,
      });
      const ruins = todosOsCaminhos(d.camadas).filter((c) => /NaN|undefined|Infinity/.test(c));
      expect({ id: m.id, ruins }).toEqual({ id: m.id, ruins: [] });
    }
  });

  test("os três da parede e os de deitar não são a mesma figura", () => {
    const iguais = (a: string, b: string) =>
      JSON.stringify(desenhoDe(a)) === JSON.stringify(desenhoDe(b));
    expect(iguais("panturrilha-parede", "costelas-parede")).toBe(false);
    expect(iguais("panturrilha-parede", "agachamento-parede")).toBe(false);
    expect(iguais("costelas-parede", "agachamento-parede")).toBe(false);
    expect(iguais("travesseiro-entre-joelhos", "pernas-elevadas")).toBe(false);
    expect(iguais("tornozelo", "pescoco")).toBe(false);
  });
});

describe("a tabela das animações", () => {
  test("todo movimento animado existe no catálogo", () => {
    const ids = new Set(MOVIMENTOS.map((m) => m.id));
    for (const id of Object.keys(USOS))
      expect({ id, existe: ids.has(id) }).toEqual({ id, existe: true });
  });

  test("toda parte animada existe no desenho do exercício", () => {
    for (const [id, usos] of Object.entries(USOS)) {
      const tem = new Set(partes(desenhoDe(id).camadas));
      const faltam = usos.map((u) => u.parte).filter((p) => !tem.has(p));
      expect({ id, faltam }).toEqual({ id, faltam: [] });
    }
  });

  test("toda origem de giro cai dentro do desenho", () => {
    for (const [id, usos] of Object.entries(USOS)) {
      const [x, y, w, h] = desenhoDe(id).caixa;
      for (const u of usos) {
        if (!u.origem) continue;
        const dentro =
          u.origem[0] >= x && u.origem[0] <= x + w && u.origem[1] >= y && u.origem[1] <= y + h;
        expect({ id, parte: u.parte, dentro }).toEqual({ id, parte: u.parte, dentro: true });
      }
    }
  });

  test("todo ciclo começa em 0, termina em 100 e fecha onde começou", () => {
    for (const [nome, quadros] of Object.entries(QUADROS)) {
      const ems = quadros.map((q) => q.em);
      expect({ nome, ems: [ems[0], ems.at(-1)] }).toEqual({ nome, ems: [0, 100] });
      expect({ nome, crescente: ems.every((e, i) => i === 0 || e > ems[i - 1]!) }).toEqual({
        nome,
        crescente: true,
      });
      const a = quadros[0]!;
      const b = quadros.at(-1)!;
      expect({ nome, fecha: JSON.stringify([a.transform, a.opacidade]) }).toEqual({
        nome,
        fecha: JSON.stringify([b.transform, b.opacidade]),
      });
    }
  });

  test("nenhum quadro da tabela está sobrando", () => {
    const usados = new Set([
      RESPIRO.quadros,
      ...Object.values(USOS).flatMap((u) => u.map((x) => x.quadros)),
    ]);
    expect(Object.keys(QUADROS).filter((q) => !usados.has(q as never))).toEqual([]);
  });
});

describe("as peças que andam juntas não se desmontam", () => {
  test("agachamento: o quadril da coxa acompanha o tronco que desce", () => {
    const j = JUNTAS.agachamento;
    const quadril = [41.6, 93.3] as const;
    /* A coxa vai dentro da canela: primeiro gira no joelho, depois a canela
       leva tudo girando no tornozelo. */
    const pelaCoxa = noMeio(
      "agachamento-parede",
      "canela",
      noMeio("agachamento-parede", "coxa", quadril),
    );
    const peloTronco = noMeio("agachamento-parede", "corpo", quadril);
    expect(Math.hypot(pelaCoxa[0] - peloTronco[0], pelaCoxa[1] - peloTronco[1])).toBeLessThan(1.5);
    /* E o quadril desce de verdade (não é um enfeite parado). */
    expect(peloTronco[1] - quadril[1]).toBeGreaterThan(8);
    expect(j.tornozelo[1]).toBeGreaterThan(j.joelho[1]);
  });

  test("balanço: as mãos e os joelhos ficam no chão e levam o ombro e o quadril juntos", () => {
    const ombro = [109.9, 59.6] as const;
    const pelaMao = noMeio("balanco", "braco", ombro);
    const peloTronco = noMeio("balanco", "corpo", ombro);
    expect(Math.hypot(pelaMao[0] - peloTronco[0], pelaMao[1] - peloTronco[1])).toBeLessThan(1);
    const quadril = [69.5, 71] as const;
    const pelaCoxa = noMeio("balanco", "coxa", quadril);
    const peloTronco2 = noMeio("balanco", "corpo", quadril);
    expect(Math.hypot(pelaCoxa[0] - peloTronco2[0], pelaCoxa[1] - peloTronco2[1])).toBeLessThan(1);
  });

  test("costelas: o braço apoiado na parede acompanha o ombro", () => {
    const l = { giro: 40, quadril: JUNTAS.costelas.quadril };
    const r = (l.giro * Math.PI) / 180;
    /* O ombro do desenho: o ponto (0.5, 7) do tronco inclinado 40°. */
    const base = [
      l.quadril[0] - (1 * Math.cos(r) - 49 * Math.sin(r)),
      l.quadril[1] - (1 * Math.sin(r) + 49 * Math.cos(r)),
    ];
    const ombro = [
      base[0]! + 0.5 * Math.cos(r) - 7 * Math.sin(r),
      base[1]! + 0.5 * Math.sin(r) + 7 * Math.cos(r),
    ] as const;
    const peloTronco = noMeio("costelas-parede", "corpo", ombro);
    const peloBraco = noMeio("costelas-parede", "braco", ombro);
    expect(Math.hypot(peloTronco[0] - peloBraco[0], peloTronco[1] - peloBraco[1])).toBeLessThan(
      1.5,
    );
  });
});

describe("o volume (a terceira volta, 21/11/2026)", () => {
  /* "Dar mais movimento e refinar ainda mais para parecer realmente uma arte
     3D", o dono: cada peça é pintada com a luz de estúdio. */
  type Pintura = Extract<Forma, { d: string }>;
  const pinturas = (formas: readonly Forma[]): Pintura[] =>
    formas.flatMap((f) => ("grupo" in f ? pinturas(f.grupo) : [f]));
  const todas = (camadas: readonly Camada[]): Pintura[] =>
    camadas.flatMap((c) => [...pinturas(c.formas ?? []), ...todas(c.dentro ?? [])]);
  /* As massas: o corpo, a roupa, o cabelo, o tênis e os móveis. Detalhe por
     cima (a bochecha, o traço do rosto, a sombra do pescoço) vem com
     opacidade, e não conta. */
  const MASSAS = new Set([
    "pele",
    "peleSombra",
    "roupa",
    "legging",
    "leggingSombra",
    "cabelo",
    "tenis",
    "sola",
    "apoio",
    "apoioSombra",
    "tapete",
  ]);

  test("toda massa da personagem e dos móveis vem com luz e sombra (nada chapado)", () => {
    for (const m of MOVIMENTOS) {
      const chapadas = todas(desenhoDoMovimento(m.id, m.pose).camadas).filter(
        (f) => f.cor && MASSAS.has(f.cor) && !f.traco && f.opacidade == null && !f.gradiente,
      );
      expect({ id: m.id, chapadas: chapadas.length }).toEqual({ id: m.id, chapadas: 0 });
    }
  });

  test("nenhum degradê tem número quebrado, e as paradas andam de 0 a 1", () => {
    for (const m of MOVIMENTOS) {
      for (const f of todas(desenhoDoMovimento(m.id, m.pose).camadas)) {
        const g = f.gradiente;
        if (!g) continue;
        const numeros = [
          ...(g.tipo === "linear" ? [...g.de, ...g.ate] : [...g.centro, g.raio]),
          ...g.paradas.flatMap((p) => [p[0], p[2] ?? 0, p[3] ?? 1]),
        ];
        expect({ id: m.id, ok: numeros.every(Number.isFinite) }).toEqual({ id: m.id, ok: true });
        const ems = g.paradas.map((p) => p[0]);
        expect({
          id: m.id,
          ordem: ems.every((e, i) => e >= 0 && e <= 1 && (i === 0 || e >= ems[i - 1]!)),
        }).toEqual({ id: m.id, ordem: true });
      }
    }
  });

  test("a cor translúcida vira cor e opacidade (o banquinho da noite não sai branco)", () => {
    const noite = { ...coresDaFigura("#dcd2fb"), apoio: "rgba(255,255,255,0.24)" };
    const { cor, opacidade } = paradaEmCor(noite, [0, "apoio", 0, 0.5]);
    expect(cor).toBe("#ffffff");
    expect(opacidade).toBeCloseTo(0.12, 5);
  });

  test("a sombra do volume puxa para a ameixa da marca, e não para o cinza", () => {
    const sombra = corDaParada(coresDaFigura("#007a55"), [1, "legging", -0.2]);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(sombra.slice(i, i + 2), 16));
    /* Ameixa: o azul passa do verde (cinza seria r = g = b). */
    expect(b!).toBeGreaterThan(g!);
    expect(r!).toBeGreaterThan(g!);
  });
});

describe("as imagens que saíram bugadas (21/11/2026, noite)", () => {
  type Pintura = Extract<Forma, { d: string }>;
  const pinturas = (formas: readonly Forma[]): Pintura[] =>
    formas.flatMap((f) => ("grupo" in f ? pinturas(f.grupo) : [f]));
  const todas = (camadas: readonly Camada[]): Pintura[] =>
    camadas.flatMap((c) => [...pinturas(c.formas ?? []), ...todas(c.dentro ?? [])]);

  test("o braço de quem acompanha some antes da borda, e não termina num corte", () => {
    /* O desenho é recortado na caixa: a manga, que vem de fora, acabava num
       corte reto, um toco de braço solto no céu da noite. */
    for (const tipo of ["mao-no-sacro", "mao-na-barriga"] as const) {
      const d = desenhoDoCasal(tipo);
      const bordas = [d.caixa[0], d.caixa[0] + d.caixa[2]];
      const mangas = todas(d.camadas).filter((f) => f.cor === "parceiroManga");
      expect(mangas.length).toBeGreaterThan(0);
      for (const m of mangas) {
        const g = m.gradiente;
        expect(g?.tipo).toBe("linear");
        if (g?.tipo !== "linear") continue;
        expect({ tipo, naBorda: bordas.includes(g.de[0]) }).toEqual({ tipo, naBorda: true });
        expect({ tipo, opacidadeNaBorda: g.paradas[0]![3] }).toEqual({ tipo, opacidadeNaBorda: 0 });
      }
    }
  });

  test("a corcunda do gato-camelo é a própria blusa abaulando, com a mesma luz", () => {
    /* Era um balão por cima das costas, com brilho próprio: uma mochila. */
    const d = desenhoDe("gatocamelo");
    const corpo = d.camadas.find((c) => c.parte === "corpo")!;
    const corcunda = corpo.dentro!.find((c) => c.parte === "corcunda")!;
    const [tronco] = corpo.formas!;
    const [costas] = corcunda.formas!;
    expect(tronco && "grupo" in tronco && costas && "grupo" in costas).toBe(true);
    if (!tronco || !("grupo" in tronco) || !costas || !("grupo" in costas)) return;
    /* No mesmo lugar do tronco, pintada com o degradê da blusa. */
    expect(costas.transform).toBe(tronco.transform);
    const blusa = pinturas(tronco.grupo).find((f) => f.cor === "roupa")!;
    expect(pinturas(costas.grupo).map((f) => f.gradiente)).toEqual([blusa.gradiente]);
    expect(todas(corcunda.dentro ?? []).length + pinturas(corcunda.formas!).length).toBe(1);
  });
});

describe("a leveza (a segunda volta, 21/11/2026)", () => {
  /* "Ficou bom, mas tente refinar ainda mais e dar mais leveza", o dono: a
     primeira personagem tinha a legging quase preta e a blusa na cor forte da
     atividade, massas escuras no disco branco. */
  const luminancia = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const v = parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const contraNoBranco = (hex: string) => Math.round((1.05 / (luminancia(hex) + 0.05)) * 100) / 100;
  /* O verde do Mexer (`corDaAtividade.mexer.acao`). */
  const cores = coresDaFigura("#007a55");

  test("nenhuma massa da personagem é escura (até 3,5:1 contra o disco branco)", () => {
    const massas = ["roupa", "legging", "pele", "tenis", "apoio"] as const;
    const pesadas = massas
      .map((m) => ({ m, razao: contraNoBranco(cores[m]) }))
      .filter((x) => x.razao > 3.5);
    expect(pesadas).toEqual([]);
  });

  test("as sombras (o lado de longe, a dobra) são um tom abaixo, nunca uma mancha (até 4,5:1)", () => {
    const sombras = ["roupaSombra", "leggingSombra", "peleSombra"] as const;
    const pesadas = sombras
      .map((m) => ({ m, razao: contraNoBranco(cores[m]) }))
      .filter((x) => x.razao > 4.5);
    expect(pesadas).toEqual([]);
  });

  test("e nem por isso a roupa some no branco (pelo menos 2,5:1)", () => {
    expect(contraNoBranco(cores.roupa)).toBeGreaterThanOrEqual(2.5);
    expect(contraNoBranco(cores.legging)).toBeGreaterThanOrEqual(2.5);
  });

  test("as cores moram num lugar só: o componente não escreve cor à mão", () => {
    const fonte = readFileSync(
      join(import.meta.dir, "../../componentes/jornada/figura-movimento.tsx"),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(fonte.match(/#[0-9a-f]{6}\b/gi) ?? []).toEqual([]);
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

  test("nos quadros, o número exato; entre eles, a curva", () => {
    expect(quadroNoTempo("ombros", 3, "ease-in-out", 0.75).transform).toEqual([
      ["translate", 0, -4],
    ]);
    expect(quadroNoTempo("ombros", 3, "ease-in-out", 0.375).transform![0]![2]).toBeCloseTo(-2, 5);
    expect(quadroNoTempo("circuloNaBola", 6, "linear", 0).transform).toEqual([
      ["translate", 2.6, 0],
    ]);
    /* O ciclo recomeça: 3,75 s no ombro é o mesmo que 0,75 s. */
    expect(quadroNoTempo("ombros", 3, "ease-in-out", 3.75).transform).toEqual([
      ["translate", 0, -4],
    ]);
  });

  test("o gato-camelo: as costas arredondam e a cabeça desce juntas", () => {
    expect(parteNoTempo("gatocamelo", "corcunda", 0).opacity).toBe(0);
    expect(parteNoTempo("gatocamelo", "corcunda", 3.5).opacity).toBe(1);
    expect(parteNoTempo("gatocamelo", "cabeca", 3.5).transform).toContain("rotate(20)");
  });

  test("o transform do SVG gira em volta da origem", () => {
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
    expect(paraSvg([["scaleY", 0.7]])).toBe("scale(1 0.7)");
    expect(parteNoTempo("ombros", "tronco", 1)).toEqual({});
    expect(parteNoTempo("pelve", "tronco", 1)).toEqual({});
  });
});
