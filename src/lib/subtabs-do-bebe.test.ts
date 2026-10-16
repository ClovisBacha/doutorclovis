/**
 * A GRADE DA ABA BEBÊ NO MODO CUIDADO.
 *
 * ⚠️ Ela não conhecia o luto: a paciente que acabou de perder a gestação
 * continuava vendo **"Contagem"** (regressiva para o parto), **"Nomes"** (a
 * votação do nome do bebê) e **"Enxoval"**. O componente já RECEBIA `careMode`
 * e o repassava para dentro de duas sub-telas — o que faltava era a própria
 * grade olhar para ele.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { SUBTABS_FORA_DO_LUTO, subtabPermitida, subtabsDoBebe } from "./subtabs-do-bebe";

const TODAS = [
  { key: "semana", label: "Semana" },
  { key: "contagem", label: "Contagem" },
  { key: "album", label: "Álbum" },
  { key: "nome", label: "Nomes" },
  { key: "carta", label: "Carta" },
  { key: "quartinho", label: "Enxoval" },
] as const;

const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const CONTA = semComentarios(readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8"));

describe("o que o luto tira", () => {
  test("fora do luto, a grade é a lista inteira", () => {
    expect(subtabsDoBebe(TODAS, false).map((s) => s.key)).toEqual(TODAS.map((s) => s.key));
  });

  test("⚠️ no luto somem contagem, nomes, carta e enxoval", () => {
    /* Quatro telas cujo assunto é um bebê que vai chegar — para quem acabou de
       saber que ele não chega. */
    const chaves = subtabsDoBebe(TODAS, true).map((s) => s.key);
    for (const fora of ["contagem", "nome", "carta", "quartinho"]) {
      expect(chaves).not.toContain(fora);
    }
  });

  test("⚠️ o ÁLBUM fica — e isso não pode ser desfeito por arrumação", () => {
    /* As fotos são a memória do que houve. Escondê-las seria o app apagar o
       bebê dela — a mesma linha que manteve `exam_files` de pé e que faz
       `podeVerPost` devolver `true` para a autora em luto. */
    expect(subtabsDoBebe(TODAS, true).map((s) => s.key)).toContain("album");
    expect(SUBTABS_FORA_DO_LUTO).not.toContain("album" as never);
  });

  test("⚠️ 'semana' fica — ela já se trata por dentro", () => {
    /* `BabyTab` recebe `careMode` e ajusta o próprio conteúdo. Gatear aqui
       também seria uma segunda régua sobre a mesma decisão, e é assim que as
       duas divergem no primeiro conserto. */
    expect(subtabsDoBebe(TODAS, true).map((s) => s.key)).toContain("semana");
  });

  test("a grade do luto não fica vazia", () => {
    /* Uma aba que abre sem nada lê como app quebrado — e no pior momento. */
    expect(subtabsDoBebe(TODAS, true).length).toBeGreaterThan(0);
  });
});

describe("o pedido de fora passa pela MESMA régua", () => {
  test("⚠️ `initialSub` de tela barrada cai na grade, e não abre", () => {
    /* Este é o portão que falta em quase toda correção deste tipo: o ladrilho
       some, e a tela abre assim mesmo porque alguém pediu por link. */
    for (const barrada of ["contagem", "nome", "carta", "quartinho"]) {
      expect(subtabPermitida(TODAS, true, barrada)).toBeNull();
    }
  });

  test("o pedido permitido passa", () => {
    expect(subtabPermitida(TODAS, true, "album")).toBe("album");
    expect(subtabPermitida(TODAS, false, "contagem")).toBe("contagem");
  });

  test("pedido vazio ou desconhecido vira grade", () => {
    expect(subtabPermitida(TODAS, false, null)).toBeNull();
    expect(subtabPermitida(TODAS, false, "inventada")).toBeNull();
  });
});

describe("a tela usa a régua", () => {
  test("⚠️ a grade desenha a lista FILTRADA, e não a crua", () => {
    expect(CONTA).toContain("subtabsDoBebe(BEBE_SUBTABS, careMode)");
    expect(CONTA).not.toMatch(/<GradeHub\s+itens=\{BEBE_SUBTABS\}/);
  });

  test("⚠️ e o `initialSub` também", () => {
    expect(CONTA).toContain("subtabPermitida(BEBE_SUBTABS, careMode, initialSub)");
    expect(CONTA).not.toMatch(/BEBE_SUBTABS\.some\(\(x\) => x\.key === initialSub\)/);
  });
});
