/**
 * O GRÁFICO NÃO PODE INVENTAR DADO CLÍNICO.
 *
 * A pressão é o caso perigoso, e este arquivo é quase todo sobre ele. Duas
 * séries independentes — uma de sistólicas, outra de diastólicas — casam a
 * medida de hoje com a de anteontem e desenham um par que nunca existiu. O
 * prontuário já teve exatamente esse defeito e exibiu "168/78" com etiqueta de
 * grave, composto de duas leituras de dias diferentes.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { semComentarios } from "./sem-comentarios";
import { seriesDePressao } from "@/components/grafico-clinico";
import { sinalPressao } from "./sinais-clinicos";

const gravidadeReal = (s: number, d: number) => sinalPressao(s, d)?.gravidade ?? null;

const ev = (em: string, systolic?: number, diastolic?: number) => ({
  ocorrido_em: em,
  dados: { systolic, diastolic } as Record<string, unknown>,
});

describe("1. o par vem do mesmo registro", () => {
  test("sistólica e diastólica saem emparelhadas, ponto a ponto", () => {
    const [sis, dia] = seriesDePressao(
      [ev("2026-08-01T10:00:00Z", 120, 80), ev("2026-08-05T10:00:00Z", 130, 85)],
      gravidadeReal,
    );
    expect(sis.pontos.map((p) => p.valor)).toEqual([120, 130]);
    expect(dia.pontos.map((p) => p.valor)).toEqual([80, 85]);
    /* Os dois lados apontam para os MESMOS instantes: é isso que impede a
       composição de leituras de dias diferentes. */
    expect(sis.pontos.map((p) => p.em)).toEqual(dia.pontos.map((p) => p.em));
  });

  test("registro com METADE da pressão não entra em nenhuma das duas", () => {
    /**
     * Meia pressão não é pressão. Deixar a sistólica sozinha na série faria a
     * linha dela ter um ponto a mais que a da diastólica — e a partir daí os
     * índices das duas deixam de corresponder ao mesmo dia.
     */
    const [sis, dia] = seriesDePressao(
      [
        ev("2026-08-01T10:00:00Z", 120, 80),
        ev("2026-08-03T10:00:00Z", 140),
        ev("2026-08-05T10:00:00Z", 130, 85),
      ],
      gravidadeReal,
    );
    expect(sis.pontos).toHaveLength(2);
    expect(dia.pontos).toHaveLength(2);
    expect(sis.pontos.map((p) => p.valor)).toEqual([120, 130]);
  });

  test("a ordem é cronológica, mesmo com a entrada embaralhada", () => {
    /* O prontuário ordena por DESCENDENTE para a linha do tempo. Desenhar nessa
       ordem faria a linha andar para trás — e a mesma armadilha já transformou
       +4,1 kg em +1,6 kg nesta base. */
    const [sis] = seriesDePressao(
      [ev("2026-08-05T10:00:00Z", 130, 85), ev("2026-08-01T10:00:00Z", 120, 80)],
      gravidadeReal,
    );
    expect(sis.pontos.map((p) => p.valor)).toEqual([120, 130]);
  });
});

describe("2. a gravidade é a do PAR, e a mesma dos dois pontos", () => {
  test("um par grave pinta as duas linhas", () => {
    const [sis, dia] = seriesDePressao([ev("2026-08-01T10:00:00Z", 170, 110)], gravidadeReal);
    expect(sis.pontos[0].gravidade).toBe("grave");
    /* A diastólica recebe a MESMA gravidade: 110 sozinho não conta a história,
       e um ponto normal ao lado de um grave, no mesmo instante, faria o médico
       procurar qual dos dois acreditar. */
    expect(dia.pontos[0].gravidade).toBe("grave");
  });

  test("uma pressão normal não vira ponto de alerta", () => {
    /**
     * Este é o teste que pega a versão errada que eu quase deixei passar:
     * `sinalPressao(sistolica, 70)` — uma diastólica inventada para arrancar a
     * gravidade da sistólica sozinha. Com 90/70 o par tem diferença de 20 e
     * dispara "diferença implausível"; a tela pintaria de laranja uma pressão
     * perfeitamente normal.
     */
    const [sis, dia] = seriesDePressao([ev("2026-08-01T10:00:00Z", 118, 76)], gravidadeReal);
    expect(sis.pontos[0].gravidade).toBe("normal");
    expect(dia.pontos[0].gravidade).toBe("normal");
  });

  test("a régua usada é a de `sinais-clinicos`, e não uma cópia", () => {
    /* Se alguém trocar a função por um `>= 140` escrito aqui, este caso quebra:
       120/95 é diastólica alta com sistólica normal, e só a régua de verdade
       sabe disso. */
    const [sis] = seriesDePressao([ev("2026-08-01T10:00:00Z", 120, 95)], gravidadeReal);
    expect(sis.pontos[0].gravidade).toBe(sinalPressao(120, 95)?.gravidade);
    expect(sis.pontos[0].gravidade).not.toBe("normal");
  });
});

describe("3. o desenho", () => {
  test("só a sistólica carrega a faixa de referência", () => {
    /**
     * Duas faixas verdes empilhadas no mesmo gráfico viram uma mancha só, e a
     * de baixo esconde a de cima. A faixa que importa ler é a da sistólica.
     */
    const [sis, dia] = seriesDePressao([ev("2026-08-01T10:00:00Z", 120, 80)], gravidadeReal);
    expect(sis.referencia).toEqual({ de: 90, ate: 140 });
    expect(dia.referencia).toBeNull();
  });

  test("sem nenhum par, as duas séries saem vazias — e não quebram", () => {
    const [sis, dia] = seriesDePressao([], gravidadeReal);
    expect(sis.pontos).toEqual([]);
    expect(dia.pontos).toEqual([]);
  });
});

describe("⚠️ o ponto do gráfico não se anuncia como botão", () => {
  test('o alvo do ponto é `role="img"`, e não `role="button"`', async () => {
    /* Ele não tem `onClick` nem ação de teclado: anunciar "botão" faz a
       paciente apertar Enter e nada acontecer — e a varredura de
       acessibilidade o contava como um controle de toque de 13×13px, muito
       abaixo dos 44. É um ponto de dado com descrição, e os valores continuam
       legíveis pela fita de estatísticas e pela lista abaixo. */
    const { readFileSync } = await import("node:fs");
    const { semComentarios } = await import("@/lib/sem-comentarios");
    const codigo = semComentarios(readFileSync("src/components/grafico-clinico.tsx", "utf8"));
    expect(codigo).not.toContain('role="button"');
    /* E o alvo continua existindo, maior que a marca — 4px de ponto com 4px de
       alvo é impossível de acertar no celular. */
    expect(codigo).toMatch(/r=\{14\}[\s\S]{0,200}fill="transparent"/);
  });
});

describe("⚠️ a identidade é da TELA, e a moldura é de quem já desenhou o cartão", () => {
  const grafico = semComentarios(readFileSync("src/components/grafico-clinico.tsx", "utf8"));
  const chutes = semComentarios(readFileSync("src/components/kicks-tab.tsx", "utf8"));

  test("a paleta é CATÁLOGO FECHADO, nunca um hex por prop", () => {
    /* Prop de cor livre convida o próximo a escolher um tom bonito e não
       medido — cada par daqui passou nas seis checagens do validador nos dois
       modos, contra a superfície de cada um. */
    expect(grafico).toContain("paleta?: PaletaDoGrafico");
    expect(grafico).toMatch(/const PALETAS = \{/);
    expect(grafico).not.toMatch(/cor\?: string/);
  });

  test("cada paleta define os DOIS tokens, nos DOIS modos", () => {
    const i = grafico.indexOf("const PALETAS = {");
    const bloco = grafico.slice(i, grafico.indexOf("} as const;", i));
    for (const nome of ["clinica", "chutes"]) {
      const j = bloco.indexOf(nome + ":");
      expect(j).toBeGreaterThan(-1);
      const fim = bloco.indexOf('",', j);
      const linha = bloco.slice(j, fim);
      for (const tok of [
        "[--serie-a:#",
        "[--serie-b:#",
        "dark:[--serie-a:#",
        "dark:[--serie-b:#",
      ]) {
        expect(nome + " → " + linha).toContain(tok);
      }
    }
  });

  test("⚠️ os chutes NÃO herdam o índigo do prontuário", () => {
    const i = grafico.indexOf("chutes:");
    const linha = grafico.slice(i, grafico.indexOf('",', i));
    expect(linha).not.toContain("#4F46E5");
    /* `sky-700` é o MESMO tom do botão de iniciar sessão da aba. */
    expect(linha.toUpperCase()).toContain("#0369A1");
    expect(chutes).toContain('paleta="chutes"');
    expect(chutes).toContain("bg-sky-700");
  });

  test("⚠️ a figura não desenha moldura dentro de um cartão que já existe", () => {
    /* Duas bordas concêntricas, com a de dentro sendo justamente o cartão de
       contorno que o app da paciente já tinha tirado de todas as outras
       telas. */
    expect(grafico).toContain('moldura?: "cartao" | "nenhuma"');
    expect(grafico).toMatch(/moldura === "cartao" \? "rounded-2xl border/);
    const i = chutes.indexOf("<GraficoClinico");
    const uso = chutes.slice(i, chutes.indexOf("/>", i));
    expect(uso).toContain('moldura="nenhuma"');
    /* E o cartão de fora continua sendo o material do app. */
    expect(chutes.slice(Math.max(0, i - 400), i)).toContain("card-material");
  });

  test("o estado vazio usa a MESMA caixa — senão ele volta a aninhar", () => {
    const figuras = grafico.match(/<figure className=\{caixa\}>/g) ?? [];
    expect(figuras.length).toBe(2);
    expect(grafico).not.toContain('<figure className="rounded-2xl border');
  });
});
