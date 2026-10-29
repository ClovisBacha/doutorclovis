import { describe, expect, test } from "bun:test";
import { CONQUISTAS } from "@/lib/conquistas";
import { cartaoDaChama, cartaoDaConquista, cartaoDoMarco } from "~/lib/jornada/cartoes";
import { descricaoNoApp } from "~/lib/jornada/conquistas";

describe("os cartões de compartilhar", () => {
  test("a conquista leva o título, o emoji, a raridade e a descrição do app", () => {
    for (const def of CONQUISTAS) {
      const c = cartaoDaConquista(def);
      expect(c.titulo).toBe(def.title);
      expect(c.arte).toBe(def.emoji);
      expect(c.detalhe).toBe(descricaoNoApp(def));
      expect(["Comum", "Raro", "Épico"]).toContain(c.selo);
    }
  });

  test("o marco usa o nome do bebê sem artigo, ou 'O bebê'", () => {
    const s = cartaoDoMarco({ tipo: "semana", semana: 25, sementinhas: 25, chave: "x" }, "Helena");
    expect(s.titulo).toBe("Semana 25!");
    expect(s.detalhe).toMatch(/^Helena tem o tamanho de /);
    expect(s.detalhe).not.toMatch(/\b(a|o) Helena\b/);
    const m = cartaoDoMarco({ tipo: "mes", meses: 1, sementinhas: 25, chave: "y" }, null);
    expect(m.titulo).toBe("O bebê com 1 mês!");
    expect(
      cartaoDoMarco({ tipo: "trimestre", trimestre: 2, sementinhas: 100, chave: "z" }, "Theo")
        .titulo,
    ).toBe("Fim do 2º trimestre!");
    expect(cartaoDoMarco({ tipo: "nascimento", sementinhas: 100, chave: "w" }, "Theo").titulo).toBe(
      "Theo chegou!",
    );
  });

  test("a chama, no singular e no plural", () => {
    expect(cartaoDaChama(1, false).titulo).toBe("1 dia seguido");
    expect(cartaoDaChama(14, false).titulo).toBe("14 dias seguidos");
    expect(cartaoDaChama(14, true).detalhe).toMatch(/4º trimestre/);
  });

  test("nada íntimo entra nos cartões", () => {
    const textos = [
      ...CONQUISTAS.map((d) => cartaoDaConquista(d)),
      cartaoDaChama(9, false),
      cartaoDoMarco({ tipo: "semana", semana: 12, sementinhas: 25, chave: "x" }, "Ana"),
    ].map((c) => `${c.titulo} ${c.detalhe ?? ""}`);
    for (const t of textos) expect(t).not.toMatch(/sangr|pressão|glicemia|triste|humor/i);
  });
});

describe("a legenda que o cartão sugere para a Comunidade", () => {
  const { legendaDaChegada, legendaDaSemana, legendaDoCartao, cartaoDaChama, cartaoDoMarco } =
    require("~/lib/jornada/cartoes") as typeof import("~/lib/jornada/cartoes");

  test("diz só o que o cartão já mostra, curta", () => {
    expect(legendaDoCartao(cartaoDaChama(15, false))).toBe("15 dias seguidos 🔥");
    expect(legendaDoCartao(cartaoDoMarco({ tipo: "trimestre", trimestre: 2 } as never, null))).toBe(
      "Fim do 2º trimestre! 🎊",
    );
    expect(legendaDaChegada("Helena")).toBe("Helena chegou! 🍼");
    expect(legendaDaChegada("  ")).toBe("O bebê chegou! 🍼");
    expect(legendaDaSemana(24)).toMatch(/^Semana 24 \S+$/);
  });

  test("a conquista vem entre aspas, com o desenho", () => {
    const l = legendaDoCartao({
      eyebrow: "Conquista desbloqueada",
      titulo: "Primeira Meditação",
      arte: "🧘",
      detalhe: "x",
      selo: null,
      fundo: "violeta",
    });
    expect(l).toBe('Desbloqueei a conquista "Primeira Meditação" 🧘');
  });

  test("nenhuma legenda dá gênero ao bebê nem fala de saúde", () => {
    const todas = [
      legendaDaChegada("Theo"),
      legendaDaChegada(null),
      legendaDaSemana(12),
      legendaDoCartao(cartaoDaChama(3, true)),
    ];
    for (const l of todas) expect(l).not.toMatch(/\b(o|a) (Theo|Helena)\b|peso|kg|consulta|exame/i);
  });
});
