import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { faseDe, mesmaFase, ROTULO_DO_FILTRO, VAZIO_DO_FILTRO } from "./fase-parecida";

const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

describe("a fase", () => {
  test("os três trimestres e o pós-parto", () => {
    expect(faseDe(8, false)).toBe("t1");
    expect(faseDe(20, false)).toBe("t2");
    expect(faseDe(32, false)).toBe("t3");
    expect(faseDe(32, true)).toBe("pos");
  });

  /**
   * ⚠️ Sem semana conhecida, `null` — e NÃO "t2".
   *
   * `faseDaGratidao` devolve `t2` no desconhecido porque lá o pior caso é uma
   * pergunta de trimestre errado. Aqui o desconhecido significa "não dá para
   * dizer se é parecida", e fingir uma fase colocaria estranhas no recorte de
   * quem ligou o filtro justamente para não vê-las.
   */
  test("⚠️ sem semana é `null`, e não um chute", () => {
    expect(faseDe(null, false)).toBeNull();
    expect(faseDe(undefined, false)).toBeNull();
    expect(faseDe(Number.NaN, false)).toBeNull();
  });

  /* ⚠️ O corte é o de `faseDaGratidao` — 14 e 28 —, e não uma segunda tabela:
     duas divergiriam no primeiro ajuste, e a paciente de 28 semanas cairia num
     grupo aqui e noutro na Gratidão. */
  test("⚠️ os cortes são os mesmos de `faseDaGratidao`", () => {
    expect(faseDe(13, false)).toBe("t1");
    expect(faseDe(14, false)).toBe("t2");
    expect(faseDe(27, false)).toBe("t2");
    expect(faseDe(28, false)).toBe("t3");
  });
});

describe("parecida com a minha", () => {
  test("a mesma fase é parecida", () => {
    expect(mesmaFase("t2", "t2")).toBe(true);
    expect(mesmaFase("t1", "t3")).toBe(false);
  });

  /* ⚠️ Desconhecida não é parecida com NINGUÉM, dos dois lados — é o lado
     seguro: quem liga o filtro está pedindo um recorte, e devolver gente sem
     fase conhecida transformaria o interruptor em decoração. */
  test("⚠️ desconhecida não casa com nada", () => {
    expect(mesmaFase(null, "t2")).toBe(false);
    expect(mesmaFase("t2", null)).toBe(false);
    expect(mesmaFase(null, null)).toBe(false);
  });
});

describe("os textos", () => {
  /**
   * ⚠️ O RÓTULO FALA DA FASE DELA, NUNCA DAS OUTRAS.
   *
   * "Gestantes do 3º trimestre" anunciaria, para quem lesse a tela por cima do
   * ombro dela, em que trimestre ela está — e `mostrar_semana` existe
   * exatamente para essa decisão ser dela.
   */
  test("⚠️ não nomeia trimestre nem fase nenhuma", () => {
    const t = `${ROTULO_DO_FILTRO} ${VAZIO_DO_FILTRO}`.toLocaleLowerCase("pt-BR");
    for (const proibido of ["trimestre", "reta final", "pós-parto", "semana", "1º", "2º", "3º"]) {
      expect(t).not.toContain(proibido);
    }
    expect(ROTULO_DO_FILTRO.toLocaleLowerCase("pt-BR")).toContain("sua");
  });

  /* ⚠️ O vazio EXPLICA a régua e dá a saída — ligar o filtro e não ver ninguém,
     sem explicação, lê como app quebrado. */
  test("⚠️ o vazio diz o que fazer", () => {
    expect(VAZIO_DO_FILTRO.toLocaleLowerCase("pt-BR")).toContain("desligue");
  });
});

/**
 * ⚠️ POR FASE, E NUNCA POR DIAGNÓSTICO.
 *
 * Um recorte "pré-eclâmpsia" seria útil e é exatamente o fórum de conselho
 * leigo que a decisão de não ter comentários existe para impedir. Fase é
 * biografia; diagnóstico é prontuário.
 */
describe("o que o recorte NÃO conhece", () => {
  const regua = semComentarios(readFileSync("src/lib/fase-parecida.ts", "utf8"));

  test("⚠️ nenhuma condição clínica entra na régua", () => {
    const t = regua.toLocaleLowerCase("pt-BR");
    for (const proibido of [
      "eclamps",
      "diabetes",
      "risco",
      "hipertens",
      "gemelar",
      "diagn",
      "condicao",
      "condição",
    ]) {
      expect(t).not.toContain(proibido);
    }
  });

  /**
   * ⚠️ E A FASE NÃO VIAJA PARA O CLIENTE.
   *
   * As datas entram no select das candidatas só para ordenar; o que sai é a
   * lista já recortada. Um cartão que carregasse a fase de alguém desfaria pela
   * lateral a chave `mostrar_semana` — e essa é a diferença entre um RECORTE e
   * um GRUPO.
   */
  test("⚠️ a fileira de sugeridas não desenha fase de ninguém", () => {
    const tela = semComentarios(readFileSync("src/components/rede-instagram.tsx", "utf8"));
    const i = tela.indexOf("function FileiraDePessoas");
    expect(i).toBeGreaterThan(-1);
    const corpo = tela.slice(i, tela.indexOf("\n}\n", i));
    expect(corpo).not.toContain("faseDe");
    expect(corpo).not.toContain("seloSemana");
    expect(corpo).not.toContain("semanas");
  });

  /* ⚠️ E o tipo que viaja continua sem campo de fase. */
  test("⚠️ `PessoaNaLista` não ganhou campo de fase", () => {
    const servidor = semComentarios(readFileSync("src/lib/rede-social.functions.ts", "utf8"));
    const i = servidor.indexOf("export type PessoaNaLista");
    expect(i).toBeGreaterThan(-1);
    const tipo = servidor.slice(i, servidor.indexOf("};", i));
    expect(tipo).not.toContain("fase");
    expect(tipo).not.toContain("semana");
  });
});
