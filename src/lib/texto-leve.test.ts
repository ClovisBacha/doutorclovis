import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { blocosDe, semMarcas, temMarcas, trechosDe } from "./texto-leve";
import { semComentarios } from "./sem-comentarios";

describe("texto leve — negrito", () => {
  test("o par fechado vira trecho em negrito, e o resto fica texto", () => {
    expect(trechosDe("coma **folha escura** hoje")).toEqual([
      { texto: "coma ", negrito: false },
      { texto: "folha escura", negrito: true },
      { texto: " hoje", negrito: false },
    ]);
  });
  test("⚠️ um `**` solto fica como está — no streaming o par ainda não chegou", () => {
    expect(trechosDe("isto **ainda vem")).toEqual([{ texto: "isto **ainda vem", negrito: false }]);
  });
  test("dois pares na mesma linha", () => {
    expect(
      trechosDe("**a** e **b**")
        .filter((t) => t.negrito)
        .map((t) => t.texto),
    ).toEqual(["a", "b"]);
  });
  test("linha vazia devolve um trecho vazio, e não lista vazia", () => {
    expect(trechosDe("")).toEqual([{ texto: "", negrito: false }]);
  });
});

describe("texto leve — blocos", () => {
  const RESPOSTA =
    "Vejo arroz e feijão.\n\nPara a próxima, duas ideias:\n• Uma **folha escura** ao lado.\n• Meio limão no feijão.";

  test("parágrafos separados por linha em branco, e os itens seguidos viram UMA lista", () => {
    const b = blocosDe(RESPOSTA);
    expect(b.map((x) => x.tipo)).toEqual(["paragrafo", "paragrafo", "lista"]);
    const lista = b[2];
    if (lista.tipo !== "lista") throw new Error("esperava lista");
    expect(lista.ordenada).toBe(false);
    expect(lista.itens).toHaveLength(2);
    expect(lista.itens[0][1]).toEqual({ texto: "folha escura", negrito: true });
  });
  test("os quatro marcadores contam, e o texto do item vem SEM o marcador", () => {
    for (const m of ["• ", "- ", "– ", "* "]) {
      const b = blocosDe(`${m}um item`);
      expect(b).toEqual([
        { tipo: "lista", ordenada: false, itens: [[{ texto: "um item", negrito: false }]] },
      ]);
    }
  });
  test("lista numerada é ordenada, e não se mistura com a de marcador", () => {
    const b = blocosDe("1. primeiro\n2) segundo\n• solto");
    expect(b.map((x) => (x.tipo === "lista" ? x.ordenada : "p"))).toEqual([true, false]);
  });
  test("⚠️ `**Negrito**` no começo da linha NÃO é marcador de lista", () => {
    const b = blocosDe("**Atenção:** beba água");
    expect(b[0].tipo).toBe("paragrafo");
  });
  test("linhas de um mesmo parágrafo ficam juntas, na ordem", () => {
    const b = blocosDe("a\nb\nc");
    expect(b).toHaveLength(1);
    if (b[0].tipo !== "paragrafo") throw new Error();
    expect(b[0].linhas.map((l) => l[0].texto)).toEqual(["a", "b", "c"]);
  });
  test("texto sem marca nenhuma é um parágrafo só, e `temMarcas` diz que não há o que desenhar", () => {
    expect(temMarcas("Posso comer sushi? Depende do peixe.")).toBe(false);
    expect(temMarcas(RESPOSTA)).toBe(true);
    expect(temMarcas("- item")).toBe(true);
  });
  test("`temMarcas` não deixa estado no regex global entre chamadas", () => {
    expect(temMarcas("**a**")).toBe(true);
    expect(temMarcas("**a**")).toBe(true);
    expect(temMarcas("sem")).toBe(false);
  });
});

describe("texto leve — a prévia sem marcas", () => {
  test("tira os asteriscos e normaliza o marcador para •", () => {
    expect(semMarcas("- coma **bem**\n2. e beba")).toBe("• coma bem\n• e beba");
  });
  test("texto sem marca sai byte a byte igual", () => {
    const t = "Nada a mudar aqui.\nNem aqui.";
    expect(semMarcas(t)).toBe(t);
  });
});

describe("a bolha da nutrição desenha o texto leve, e a foto fica em memória", () => {
  const TELA = semComentarios(readFileSync("src/components/nutricao-tab.tsx", "utf8"));

  test("a resposta da IA passa pelo TextoLeve; a fala DELA continua crua", () => {
    /* A garantia: quem formata é o componente, e só do lado do assistente —
       o que ela digitou não é interpretado. */
    expect(TELA).toMatch(/<TextoLeve texto=\{m\.content\}/);
    expect(TELA).toMatch(/dela \? \(/);
  });
  test("⚠️ `whitespace-pre-wrap` continua na bolha — os parágrafos dependem dele", () => {
    expect(TELA).toMatch(/max-w-\[80%\] whitespace-pre-wrap/);
  });
  test("a prévia do cartão compacto usa a versão SEM marcas", () => {
    expect(TELA).toMatch(/\{semMarcas\(ultimaResposta\)\}/);
  });
  test("⚠️ a miniatura só aparece na bolha DELA, e nunca é gravada nem enviada", () => {
    expect(TELA).toMatch(/dela && fotos\[i\]/);
    /* Em memória: nenhuma escrita da miniatura no localStorage, e o histórico
       que vai ao servidor continua sendo só `content`. */
    const i = TELA.indexOf("const [fotos, setFotos]");
    expect(i).toBeGreaterThan(-1);
    expect(TELA).not.toMatch(/localStorage\.setItem\([^)]*fotos/);
    expect(TELA).not.toMatch(/JSON\.stringify\([^)]*fotos/);
    expect(TELA).toMatch(/parts: \[\{ type: "text", text: m\.content \}\]/);
  });
  test("a miniatura nasce do MESMO bitmap da redução — uma decodificação, não duas", () => {
    const i = TELA.indexOf("async function reduzirParaAFoto");
    const j = TELA.indexOf("\nfunction ", i + 1);
    const corpo = TELA.slice(i, j);
    expect((corpo.match(/createImageBitmap\(/g) ?? []).length).toBe(1);
    expect(corpo).toMatch(/miniatura/);
  });
});
