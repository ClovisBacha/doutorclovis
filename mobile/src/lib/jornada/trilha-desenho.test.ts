import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { semComentarios } from "@/lib/sem-comentarios";
import {
  ALTURA,
  FASES,
  ligacoesDaTrilha,
  montarCaminho,
  tracadoDoBloco,
} from "~/lib/jornada/caminho";
import {
  ABAIXO_DA_BARRA,
  desviarDaBarra,
  enfeitesPorBloco,
  iniciosDasSemanas,
  semearNovos,
  Y_INICIAL_DO_SITE,
} from "~/lib/jornada/enfeites";
import type { Blob } from "~/lib/jornada/momentos";
import { estadoDoNo, resumirSemanas } from "~/lib/jornada/trilha";

/**
 * O DESENHO DA TRILHA (18/11/2026, a vistoria: "o jogo com cara de jogo e sem
 * soluço"). O blob é lido uma vez por semana, o traço liga os nós de uma
 * semana à outra, e o enfeite comprado nunca fica atrás da barra da semana.
 */

const cinco = {
  desafio: true,
  w_movement: true,
  w_meditation: true,
  w_bonding: true,
  w_gratitude: true,
};

describe("o resumo das semanas é o mesmo estado de cada nó, lido uma vez", () => {
  const blob: Blob = {
    "dc-path-done-days": [168, 169],
    "dc-path-stickers": [24],
    "dc-path-day-168": cinco,
    "dc-path-day-170": { desafio: true, w_movement: true },
    "dc-path-day-171": cinco,
  };

  test("cada nó do resumo é o estadoDoNo dele", () => {
    const r = resumirSemanas(blob, [23, 24, 25], 171);
    for (const w of [23, 24, 25])
      for (let i = 0; i < 7; i++)
        expect(r.get(w)!.estados[i]).toEqual(estadoDoNo(blob, w * 7 + i, 171));
    // 169 está na lista de feitos sem as flags: fechado mesmo assim
    expect(r.get(24)!.feitos).toEqual([true, true, false, true, false, false, false]);
    expect(r.get(24)!.figurinha).toBe(true);
    expect(r.get(25)!.figurinha).toBe(false);
  });

  test("a semana que não mudou devolve o MESMO objeto (o bloco não se redesenha)", () => {
    const antes = resumirSemanas(blob, [23, 24, 25], 171);
    const depois = resumirSemanas(
      { ...blob, "dc-path-day-170": { ...cinco } },
      [23, 24, 25],
      171,
      antes,
    );
    expect(depois.get(23)).toBe(antes.get(23)!);
    expect(depois.get(25)).toBe(antes.get(25)!);
    expect(depois.get(24)).not.toBe(antes.get(24)!);
    expect(depois.get(24)!.estados[2]).toEqual({ tipo: "passado", momentos: 5, fechado: true });
  });
});

describe("o traço do caminho", () => {
  const blocos = montarCaminho(FASES, 170);

  test("cada semana continua no primeiro nó da semana seguinte, por cima da faixa de fase", () => {
    const ligacoes = ligacoesDaTrilha(blocos);
    blocos.forEach((b, i) => {
      if (b.tipo === "fase") return expect(ligacoes[i]).toBeNull();
      const l = ligacoes[i];
      const seguinte = blocos.slice(i + 1).find((n) => n.tipo === "semana");
      if (!seguinte || seguinte.tipo !== "semana") return expect(l).toBeNull();
      expect(l!.D).toBe(seguinte.dias[0]!.D);
      expect(l!.x).toBe(seguinte.dias[0]!.x);
      // a altura soma tudo o que fica entre os dois nós
      const meio = blocos.slice(i + 1, blocos.indexOf(seguinte)).reduce((s, n) => s + n.altura, 0);
      expect(l!.y).toBe(b.altura + meio + seguinte.dias[0]!.y);
    });
    // a semana 7 fecha a fase 1: a ponte passa pela faixa da fase 2
    const i7 = blocos.findIndex((b) => b.tipo === "semana" && b.semana === 7);
    expect(ligacoes[i7]!.y).toBeGreaterThan(blocos[i7]!.altura + ALTURA.fase);
  });

  test("cheio até hoje, pontilhado depois — e cada pedaço é UM caminho contínuo", () => {
    const i = blocos.findIndex((b) => b.tipo === "semana" && b.semana === 24);
    const b = blocos[i]!;
    if (b.tipo !== "semana") throw new Error("semana 24");
    const { andado, porVir } = tracadoDoBloco(b.dias, ligacoesDaTrilha(blocos)[i]!, 170, 400);
    // 168 → 169 → 170 andados; 170 → 171 … 174 → 175 (a ponte) por vir
    expect(andado.match(/M/g)).toHaveLength(1);
    expect(andado.match(/C/g)).toHaveLength(2);
    expect(porVir.match(/M/g)).toHaveLength(1);
    expect(porVir.match(/C/g)).toHaveLength(5);
    // o pontilhado sai do nó de hoje
    const hoje = b.dias.find((d) => d.D === 170)!;
    expect(porVir.startsWith(`M ${Math.round(hoje.x * 40) / 10} ${hoje.y} `)).toBe(true);
    // tangente vertical: o controle tem o x do nó de onde sai
    expect(andado).toMatch(/^M (\S+) \S+ C \1 /);
  });

  test("uma semana que já passou inteira é só traço cheio; a que vem, só pontilhado", () => {
    const passada = blocos.find((b) => b.tipo === "semana" && b.semana === 20)!;
    const futura = blocos.find((b) => b.tipo === "semana" && b.semana === 30)!;
    if (passada.tipo !== "semana" || futura.tipo !== "semana") throw new Error("semanas");
    expect(tracadoDoBloco(passada.dias, null, 170, 400).porVir).toBe("");
    expect(tracadoDoBloco(futura.dias, null, 170, 400).andado).toBe("");
  });
});

describe("o enfeite comprado nunca fica atrás da barra da semana", () => {
  const alturas = [120, 300, 300];
  const ehSemana = [false, true, true];
  const em = (y: number) => ({ k: `k${y}`, id: "planta-trevo", x: 50, y, s: 1 });

  test("no bloco de semana, a faixa da barra desce para baixo dela; na fase, nada muda", () => {
    const inicios = [8, 128, 428];
    const porBloco = enfeitesPorBloco(
      [em(10), em(128), em(128 + 50), em(128 + ALTURA.semana + 7), em(128 + 200), em(428 + 119)],
      alturas,
      ehSemana,
    );
    expect(porBloco.map((b) => b.map((e) => e.y))).toEqual([
      [2],
      [ABAIXO_DA_BARRA, ABAIXO_DA_BARRA, ABAIXO_DA_BARRA, 200],
      [ABAIXO_DA_BARRA],
    ]);
    expect(iniciosDasSemanas(alturas, ehSemana)).toEqual(inicios.slice(1));
    // sem dizer quais blocos são semana, o lugar gravado vale (o modo Arrumar)
    expect(enfeitesPorBloco([em(128 + 50)], alturas)[1]![0]!.y).toBe(50);
  });

  test("o desvio em y do site, e na semeadura", () => {
    const inicios = iniciosDasSemanas(alturas, ehSemana);
    expect(desviarDaBarra(128 + 30, inicios)).toBe(128 + ABAIXO_DA_BARRA);
    expect(desviarDaBarra(128 + 200, inicios)).toBe(128 + 200);
    expect(desviarDaBarra(60, inicios)).toBe(60);

    const blocos = montarCaminho(FASES, 170);
    const hs = blocos.map((b) => b.altura);
    const semanas = blocos.map((b) => b.tipo === "semana");
    const ini = iniciosDasSemanas(hs, semanas);
    const total = Y_INICIAL_DO_SITE + hs.reduce((s, h) => s + h, 0) + 40;
    const ids = ["bicho-joaninha", "luz-vela", "planta-suculenta", "agua-poca", "bicho-coelho"];
    const r = semearNovos(null, ids, total, 17000, ini);
    for (const p of r.decoracao!.items) {
      const dentro = ini.map((i) => p.y - i).find((y) => y >= 0 && y < ALTURA.semana + 8);
      expect(dentro).toBeUndefined();
    }
  });
});

describe("a trilha sem soluço (catraca do fonte)", () => {
  const RAIZ = join(import.meta.dir, "..", "..");
  const fonte = (...p: string[]) => semComentarios(readFileSync(join(RAIZ, ...p), "utf8"));
  const TRILHA = [
    "caminho.tsx",
    "caminho-pos.tsx",
    "blocos.tsx",
    "pecas.tsx",
    "enfeites.tsx",
    "rolagem.tsx",
  ].map((f) => ({ f, codigo: fonte("componentes", "caminho", f) }));

  test("nenhum laço eterno de enfeite: tudo dá algumas voltas e descansa", () => {
    for (const { f, codigo } of TRILHA) {
      const lacos = codigo.match(/Animated\.loop\(/g) ?? [];
      expect({ f, lacos: lacos.length }).toEqual({ f, lacos: 0 });
    }
  });

  test("a lista abre em hoje sem o recentrar por tempo, e só ouve a rolagem no Arrumar", () => {
    const rolagem = fonte("componentes", "caminho", "rolagem.tsx");
    expect(rolagem).toMatch(/contentOffset/);
    const caminho = fonte("componentes", "caminho", "caminho.tsx");
    expect(caminho).not.toMatch(/setTimeout|onContentSizeChange|extraData/);
    expect(caminho).toMatch(/onScroll=\{arrumando \? aoRolarArrumando : aoRolar\}/);
    expect(fonte("componentes", "caminho", "enfeites.tsx")).not.toMatch(/rolagem\.addListener/);
  });

  test("ícone é desenho, não emoji; cor vem do tema; sombra é a do tema", () => {
    for (const { f, codigo } of TRILHA) {
      expect({ f, emoji: /🎁|💛|✏️|🔒|✓|✕|⤢|↩/.test(codigo) }).toEqual({ f, emoji: false });
      expect({ f, sombraAntiga: /shadowRadius/.test(codigo) }).toEqual({ f, sombraAntiga: false });
      expect({ f, hex: /"#[0-9a-fA-F]{3,8}"/.test(codigo) }).toEqual({ f, hex: false });
    }
    expect(fonte("componentes", "caminho", "cores.ts")).not.toMatch(/"#[0-9a-fA-F]{3,8}"/);
  });

  test("a folha do dia tem a ação principal e fala 'trilha'", () => {
    const dia = fonte("app", "jornada", "dia.tsx");
    expect(dia).toMatch(/Começar: \$\{META_DAS_ATIVIDADES\[proxima\]\.titulo\}/);
    expect(dia).toMatch(/Voltar à trilha/);
    expect(dia).not.toMatch(/Caminho|Star\b/);
  });
});
