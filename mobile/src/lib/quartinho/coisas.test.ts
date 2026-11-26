import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { semComentarios } from "@/lib/sem-comentarios";
import {
  alternarCoisa,
  chaveDaCoisa,
  COISAS,
  coisasDoComodo,
  falaDaCoisa,
  lerEstadoDasCoisas,
  luzesAcesas,
} from "./coisas";

/**
 * AS COISAS QUE SE TOCAM NO QUARTINHO (25/11/2026, o dono: "onde tem luzes
 * [...] quando a gente clicar em cima deles, eles têm que acender [...] quando
 * clica na geladeira, abre a geladeira [...] no forno, abre o forno [...] na
 * cortina, fecha e abre a cortina [...] sem gastar nenhum crédito").
 */

const RAIZ = join(import.meta.dir, "..", "..");
const codigo = (...p: string[]) => semComentarios(readFileSync(join(RAIZ, ...p), "utf8"));

describe("as coisas do quartinho", () => {
  test("as duas luzes do teto e a cortina em cada cômodo; a geladeira e o forno na cozinha", () => {
    const tipos = (c: "quarto" | "cozinha") =>
      coisasDoComodo(c)
        .map((x) => `${x.tipo}:${x.id}`)
        .sort();
    expect(tipos("quarto")).toEqual(["cortina:cortina", "luz:luz-direita", "luz:luz-esquerda"]);
    expect(tipos("cozinha")).toEqual([
      "cortina:cortina",
      "luz:luz-direita",
      "luz:luz-esquerda",
      "porta:forno",
      "porta:geladeira",
    ]);
    const chaves = COISAS.map(chaveDaCoisa);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  test("tudo o que se toca está na faixa que a tela mostra (a pintura cobre e corta as beiradas)", () => {
    for (const c of COISAS) {
      const [x0, y0, x1, y1] = c.toque;
      expect({
        c: chaveDaCoisa(c),
        dentro: x0 >= 0.085 && x1 <= 0.915 && y0 > 0.15 && y1 <= 0.7,
      }).toEqual({
        c: chaveDaCoisa(c),
        dentro: true,
      });
      expect(x1 > x0 && y1 > y0).toBe(true);
      if (c.tipo === "luz") {
        /* O ponto aceso está dentro do toque, e a luz cai para baixo dele. */
        expect(c.ponto[0] > x0 && c.ponto[0] < x1 && c.ponto[1] > y0 && c.ponto[1] < y1).toBe(true);
        expect(c.chao[1]).toBeGreaterThan(c.ponto[1]);
      }
      if (c.tipo === "porta")
        for (const f of c.folhas) {
          const [a, b, cc, d] = f.caixa;
          expect(a >= x0 - 0.01 && cc <= x1 + 0.01 && b >= y0 - 0.01 && d <= y1 + 0.01).toBe(true);
        }
      if (c.tipo === "cortina") {
        expect(c.panos).toHaveLength(2);
        for (const p of c.panos) expect(p).toHaveLength(4);
        /* Cada pano cobre a metade dele: os dois se encontram no meio. */
        const dentro = c.panos.map((p) => p[1]![0]);
        expect(Math.abs(dentro[0]! - dentro[1]!)).toBeLessThan(0.01);
        /* O remendo da luz pintada no chão: de onde vem a cópia, ou a cor. */
        for (const r of [...c.remendos.dia, ...c.remendos.noite]) {
          expect(r.mancha).toHaveLength(4);
          expect(!!r.de !== !!r.tinta).toBe(true);
        }
      }
    }
  });

  test("tocar liga e desliga; o que vem do aparelho é filtrado", () => {
    const k = "cozinha:geladeira";
    const aberto = alternarCoisa([], k);
    expect(aberto).toEqual([k]);
    expect(alternarCoisa(aberto, k)).toEqual([]);
    /* Chave que não existe não entra. */
    expect(alternarCoisa([], "sala:tv")).toEqual([]);
    expect(lerEstadoDasCoisas(null)).toEqual([]);
    expect(lerEstadoDasCoisas(["quarto:luz-esquerda", 3, "x", "quarto:luz-esquerda"])).toEqual([
      "quarto:luz-esquerda",
    ]);
    expect(luzesAcesas(["quarto:luz-esquerda", "cozinha:luz-direita"], "quarto")).toBe(1);
  });

  test("a Bolha só conta o que aconteceu: curto, sem conduta", () => {
    for (const c of COISAS)
      for (const agora of [true, false]) {
        const f = falaDaCoisa(c, agora);
        expect(f.length).toBeLessThan(36);
        expect(f).not.toMatch(/deve|precisa|faz bem|saud|dieta|ajuda a/i);
      }
  });

  test("a tela: a porta e a cortina por baixo dos itens, a luz por cima, e o estado no aparelho", () => {
    const tela = codigo("app", "quartinho.tsx");
    const ordem = ["<PortasECortinas", "<ToquesDasCoisas", "<Cena", "<LuzesDasCoisas"].map((t) =>
      tela.indexOf(t),
    );
    expect(ordem.every((i) => i > 0)).toBe(true);
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem);
    /* Brincadeira, não posse: no aparelho, por conta, e apagado no sair (`dc-`). */
    expect(tela).toMatch(/`dc-quartinho-coisas:\$\{uid\}`/);
    /* A cortina fechada tira o sol e o luar da janela. */
    expect(tela).toMatch(/semJanela=\{cortinaFechada\(coisas, c\.id\)\}/);
    const coisas = codigo("componentes", "quartinho", "coisas.tsx");
    /* Nada anda em laço (o que travava o app): só a transição de abrir e fechar. */
    expect(coisas).not.toMatch(/Animated\.loop|shadowColor/);
    expect(coisas).toMatch(/useNativeDriver: true/);
    /* A porta é a própria pintura girando na dobradiça. */
    expect(coisas).toMatch(/transformOrigin: f\.dobradica === "direita" \? "right" : "bottom"/);
  });
});
