import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { semComentarios } from "@/lib/sem-comentarios";

/**
 * O LUTO E O 4º TRIMESTRE (18/11/2026, a vistoria de design).
 *
 * - O Modo Cuidado é UMA tela (`TelaDoCuidado`): calma, sem bebê nem
 *   gestação, sem mascote nem cara de jogo, com os números de ajuda TOCÁVEIS.
 *   O "Início" do luto desenha a mesma tela.
 * - O pós-parto fala a língua da gestação: as cores do tema (nada do azul do
 *   Tailwind nem das tintas do creme e vinho), ícones de traço no lugar de
 *   "›" e "✓" escritos, a folha única do app e letra de 13 pt para cima.
 */

const RAIZ = join(import.meta.dir, "..");
const ler = (...p: string[]) => semComentarios(readFileSync(join(RAIZ, ...p), "utf8"));

describe("o Modo Cuidado, numa tela só", () => {
  const cuidado = ler("componentes", "jornada", "cuidado.tsx");

  test("os dois números de ajuda se tocam, com nome para o leitor de tela", () => {
    expect(cuidado).toContain("ligar(CVV)");
    expect(cuidado).toContain("aoTocar={pedirSocorro}");
    expect(cuidado).toContain("rotulo={`Ligar para o CVV, ${CVV}`}");
    expect(cuidado).toMatch(/Ligar para o SAMU, \$\{SAMU\}/);
  });

  test("não fala do bebê nem da gestação, e não tem cara de jogo", () => {
    expect(cuidado).not.toMatch(/beb[eê]|gestaç|grávid|pré-natal|ultrassom|semana \d/i);
    expect(cuidado).not.toMatch(/BolhaViva|ArteDaBolha|Flutuar|CartaoDoDia|LinearGradient/);
    expect(cuidado).not.toMatch(/placar|sementinha|Estrelas|corJornada|cor\.jogo/i);
    /* Uma cor de agir só: a framboesa, nos telefones. */
    expect(cuidado).not.toMatch(/cor\.(destaque|agenda|okPonto|sementinha)\b/);
  });

  test("o feito não é verde, e a frase do 192 solta saiu", () => {
    expect(cuidado).toContain("Feito hoje");
    expect(cuidado).not.toMatch(/#16a34a|cor\.ok\b/);
    expect(cuidado).not.toMatch(/ligue 192 —/);
  });

  test("o Início do luto é a mesma tela, com a foto dela", () => {
    const inicio = ler("app", "(abas)", "inicio.tsx");
    expect(inicio).toContain("<TelaDoCuidado");
    expect(inicio).toContain("<BotaoDoPerfil");
    expect(inicio).not.toMatch(/CartaoDaSemana|BolhaViva|Sparkles|IA_NO_APP|COMUNIDADE_NO_APP/);
  });

  test("o cartão do dia que sobrou não tem o degradê de jogo nem a pílula HOJE", () => {
    const dia = ler("componentes", "jornada", "dia-de-hoje.tsx");
    expect(dia).not.toMatch(/LinearGradient|corJornada|>\s*HOJE\s*</);
  });
});

describe("o 4º trimestre no desenho da gestação", () => {
  const pos = ler("componentes", "jornada", "hoje-pos.tsx");

  test("as cores vêm do tema: nada do azul do Tailwind nem das tintas antigas", () => {
    const hex = [...pos.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toLowerCase());
    /* Só o clarão do dia cheio (o mesmo da gestação). */
    expect([...new Set(hex)]).toEqual(["#fff7e0"]);
    expect(pos).not.toMatch(/sombraDe\(|BotaoDaAtividade/);
  });

  test("setas e vistos são ícones, e a folha é a única do app", () => {
    expect(pos).not.toMatch(/[›✓]/);
    expect(pos).toContain("<ChevronRight");
    expect(pos).toContain("<Check");
    expect(pos).not.toMatch(/<Modal\b/);
    expect(pos).toContain("<Folha");
  });

  test("letra de 13 pt para cima, e o topo diz a semana uma vez só", () => {
    const pequenas = [...pos.matchAll(/fontSize:\s*(\d+(?:\.\d+)?)/g)]
      .map((m) => Number(m[1]))
      .filter((n) => n < 13);
    expect(pequenas).toEqual([]);
    expect(pos).not.toMatch(/º dia de vida/);
  });

  test("o número da semana de vida é enfeite, e a rolagem anda no fio nativo", () => {
    expect(pos).toContain("accessibilityElementsHidden");
    expect(pos).toContain("<Animated.ScrollView");
    expect(pos).toMatch(/useNativeDriver: true/);
  });
});
