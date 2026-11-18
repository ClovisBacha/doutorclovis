import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { semComentarios } from "@/lib/sem-comentarios";

/**
 * AS AMIGAS NO TEMA (18/11/2026, a vistoria): a aba e o perfil da amiga
 * somavam ~40 cores escritas à mão e uma paleta paralela (`tinta`), com um
 * rosa de agir quase igual ao do app (#c9316f contra #cf2468) — é isso que dá
 * a cara de montado. Esta catraca cobra que as telas das Amigas peguem cor,
 * avatar, botão e confirmação do lugar comum, e não voltem a inventar os seus.
 */

const RAIZ = join(import.meta.dir, "..");
const ler = (...p: string[]) => semComentarios(readFileSync(join(RAIZ, ...p), "utf8"));

const ARQUIVOS = [
  join("app", "(abas)", "amigas.tsx"),
  join("app", "amigas", "[id].tsx"),
  ...readdirSync(join(RAIZ, "componentes", "amigas"))
    .filter((n) => /\.tsx?$/.test(n))
    .map((n) => join("componentes", "amigas", n)),
];

describe("as Amigas no tema", () => {
  test("nenhuma cor escrita à mão: toda cor sai do tema", () => {
    const soltas = ARQUIVOS.flatMap((arquivo) =>
      [...ler(arquivo).matchAll(/#[0-9a-fA-F]{6}\b|rgba?\(/g)].map((m) => `${arquivo}: ${m[0]}`),
    );
    expect(soltas).toEqual([]);
  });

  test("a paleta paralela `tinta` e o avatar próprio não voltam", () => {
    const pecas = ler("componentes", "amigas", "pecas.tsx");
    expect(pecas).not.toMatch(/export const tinta\b/);
    expect(pecas).not.toMatch(/export function Avatar\b/);
    for (const arquivo of ARQUIVOS) {
      const f = ler(arquivo);
      expect({ arquivo, tinta: /\btinta\.\w+/.test(f) }).toEqual({ arquivo, tinta: false });
      /* O rosto é sempre o Avatar do app (o mesmo do botão do perfil). */
      if (/<Avatar\b/.test(f))
        expect({ arquivo, avatar: /from "~\/componentes\/comunidade\/imagem"/.test(f) }).toEqual({
          arquivo,
          avatar: true,
        });
    }
  });

  test("sombra só pelo tema (a sombra legada sobre fundo translúcido pesa na rolagem)", () => {
    const legadas = ARQUIVOS.filter((a) => /shadowRadius|shadowColor/.test(ler(a)));
    expect(legadas).toEqual([]);
  });

  test("botão sem emoji nem seta de texto no rótulo", () => {
    const fora = ARQUIVOS.flatMap((arquivo) =>
      [...ler(arquivo).matchAll(/rotulo=(?:"([^"]*)"|\{`([^`]*)`\})/g)]
        .map((m) => m[1] ?? m[2] ?? "")
        .filter((r) => /\p{Extended_Pictographic}|›/u.test(r))
        .map((r) => `${arquivo}: ${r}`),
    );
    expect(fora).toEqual([]);
  });

  test("as confirmações de saída são a folha nativa do iPhone, e a reserva é a Folha do app", () => {
    const pecas = ler("componentes", "amigas", "pecas.tsx");
    expect(pecas).toMatch(/ActionSheetIOS\.showActionSheetWithOptions/);
    expect(pecas).toMatch(/destructiveButtonIndex: 0/);
    expect(pecas).toMatch(/cancelButtonIndex: 1/);
    expect(pecas).toMatch(/<Folha\b/);
    expect(pecas).not.toMatch(/<Modal\b/);
    /* Sair da amizade não é mais um botão do tamanho da tela no pé do perfil. */
    expect(ler("app", "amigas", "[id].tsx")).not.toMatch(/Sair da amizade com \{a\.nome\}/);
  });

  test("digitar não redesenha a aba, e o teclado não cobre o campo", () => {
    const aba = ler("app", "(abas)", "amigas.tsx");
    expect(aba).toMatch(/<ChamarUmaAmiga /);
    expect(aba).not.toMatch(/<TextInput\b|setTermo/);
    expect(aba).toMatch(/automaticallyAdjustKeyboardInsets/);
    expect(aba).toMatch(/keyboardDismissMode="interactive"/);
    const pecas = ler("componentes", "amigas", "pecas.tsx");
    expect(pecas).toMatch(/export const LinhaDaAmiga = memo\(/);
    expect(pecas).toMatch(/export const CartaoDaDupla = memo\(/);
  });

  test("o bônus da dupla sai uma vez por dia, e as leituras do foco esperam a transição", () => {
    const economia = ler("componentes", "amigas", "economia.ts");
    expect(economia).toMatch(/bonusCobradoEm === hoje/);
    expect(economia).toMatch(/ymdLocal\(\)/);
    expect(economia).toMatch(/InteractionManager\.runAfterInteractions/);
    for (const arquivo of [
      join("app", "(abas)", "amigas.tsx"),
      join("componentes", "amigas", "faixa-do-hoje.tsx"),
    ]) {
      const f = ler(arquivo);
      expect({ arquivo, espera: /depoisDaTransicao\(/.test(f) }).toEqual({
        arquivo,
        espera: true,
      });
      expect({ arquivo, diario: /cobrarOBonusDoDia\(\)/.test(f) }).toEqual({
        arquivo,
        diario: true,
      });
    }
  });

  test("a bolha só convida no estado vazio, e nunca no luto", () => {
    const aba = ler("app", "(abas)", "amigas.tsx");
    expect(aba).toMatch(/\{vazio \? <EstadoVazio pos=\{pos\} \/> : null\}/);
    const luto = aba.indexOf("if (leitura.careMode || cuidadoDoDia)");
    expect(luto).toBeGreaterThan(-1);
    expect(luto).toBeLessThan(aba.indexOf("<EstadoVazio pos"));
  });
});
