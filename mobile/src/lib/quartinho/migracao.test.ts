import { describe, expect, test } from "bun:test";
import { CANTINHO_BY_ID } from "@/lib/cantinho";
import { AR_DO_QUARTO, contarDestinos, DESTINO, ITENS_DO_CATALOGO } from "./migracao";
import { ITENS, REGUA_DA_LUZ } from "./quarto";

describe("a migração da lojinha para o quartinho (24/11/2026)", () => {
  test("todo item do catálogo tem UM destino, e todo destino é de um item que existe", () => {
    for (const id of ITENS_DO_CATALOGO)
      expect({ id, tem: !!DESTINO[id] }).toEqual({ id, tem: true });
    for (const id of Object.keys(DESTINO))
      expect({ id, existe: !!CANTINHO_BY_ID[id] }).toEqual({ id, existe: true });
  });

  test("'no quarto' é exatamente o que o quarto vende, nos dois sentidos", () => {
    for (const i of ITENS.filter((x) => x.lojinha))
      expect(DESTINO[i.lojinha!]).toEqual({ tipo: "no-quarto", item: i.id });
    for (const [id, d] of Object.entries(DESTINO))
      if (d.tipo === "no-quarto") expect(ITENS.find((i) => i.id === d.item)?.lojinha).toBe(id);
  });

  test("o ar do quarto é o 'No ar' da lojinha, um por um", () => {
    for (const [a, v] of Object.entries(AR_DO_QUARTO))
      expect(DESTINO[v.lojinha]).toEqual({ tipo: "no-ar", ar: a });
    for (const i of ITENS_DO_CATALOGO.filter((id) => CANTINHO_BY_ID[id]!.type === "clima"))
      expect(DESTINO[i]!.tipo).toBe("no-ar");
  });

  test("o que vem para o quarto já traz a ficha de luz na régua", () => {
    for (const d of Object.values(DESTINO)) {
      if (d.tipo !== "vem-para-o-quarto") continue;
      if (d.proposta.luz) expect(REGUA_DA_LUZ[d.proposta.luz]).toBeGreaterThan(0);
      expect(d.proposta.nome.length).toBeGreaterThan(2);
    }
  });

  test("a trilha não fica com nada: cenários e bolinhas saem do jogo", () => {
    for (const id of ITENS_DO_CATALOGO) {
      const t = CANTINHO_BY_ID[id]!.type;
      if (t === "fundo" || t === "trilha" || t === "tema") expect(DESTINO[id]!.tipo).toBe("fora");
    }
    const c = contarDestinos();
    expect(c["no-quarto"]).toBe(ITENS.filter((i) => i.lojinha).length);
    expect(c["no-quarto"] + c["no-ar"] + c["vem-para-o-quarto"] + c.fora).toBe(
      ITENS_DO_CATALOGO.length,
    );
  });
});
