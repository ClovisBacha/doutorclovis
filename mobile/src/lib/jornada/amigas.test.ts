import { describe, expect, test } from "bun:test";
import {
  BONUS_DA_DUPLA,
  corDaUltimaVez,
  emPausa,
  fraseDoErroDaDupla,
  fraseDoPedido,
  linhaDaDupla,
  memoriaDaDupla,
} from "~/lib/jornada/amigas";

describe("as amigas no app", () => {
  test("o pedido por código diz o nome; o por e-mail não revela se achou", () => {
    expect(fraseDoPedido({ ok: true, achou: true, nome: "Juliana" }).texto).toMatch(
      /^Pedido enviado para Juliana/,
    );
    const email = fraseDoPedido({ ok: true, achou: null, nome: null });
    expect(email.texto).toMatch(/^Se esse e-mail for de alguém do app/);
    expect(email.ok).toBe(true);
    expect(fraseDoPedido({ ok: false, error: "nao_encontrada" }).ok).toBe(false);
    expect(fraseDoPedido({ ok: false, error: "muitos_convites" }).texto).toMatch(/amanhã/);
    expect(fraseDoPedido({ ok: false, error: "qualquer" }).texto).toMatch(/Tente de novo/);
  });

  test("a pausa: só na dupla ativa, chama em zero e 4 dias sem a outra", () => {
    expect(emPausa({ estado: "ativa", sequencia: 0, paradaHa: 5 })).toBe(true);
    expect(emPausa({ estado: "ativa", sequencia: 0, paradaHa: 2 })).toBe(false);
    expect(emPausa({ estado: "ativa", sequencia: 3, paradaHa: 9 })).toBe(false);
    expect(emPausa({ estado: "convite-enviado", sequencia: 0, paradaHa: 9 })).toBe(false);
    expect(emPausa({ estado: "ativa", sequencia: 0, paradaHa: null })).toBe(false);
  });

  test("a linha da dupla e a memória", () => {
    expect(linhaDaDupla({ sequencia: 6, recorde: 12 })).toBe("🔥 6 dias juntas");
    expect(linhaDaDupla({ sequencia: 1, recorde: 1 })).toBe("🔥 1 dia juntas");
    expect(linhaDaDupla({ sequencia: 0, recorde: 0 })).toBe(
      "a chama começa quando as duas aparecerem",
    );
    expect(linhaDaDupla({ sequencia: 0, recorde: 8 })).toBe("a chama está esperando vocês duas");
    expect(memoriaDaDupla({ sequencia: 6, recorde: 12, juntas: 20 })).toBe(
      "🏅 A melhor de vocês foi 12 dias seguidos · 20 dias juntas no total",
    );
    expect(memoriaDaDupla({ sequencia: 6, recorde: 6, juntas: 6 })).toBeNull();
  });

  test("os erros da dupla e o bônus da fonte única", () => {
    expect(fraseDoErroDaDupla("sem_vinculo")).toMatch(/conectadas/);
    expect(fraseDoErroDaDupla(undefined)).toMatch(/Tente de novo/);
    expect(BONUS_DA_DUPLA).toBe(10);
  });

  test("o pontinho da última vez: verde só na última hora", () => {
    expect(corDaUltimaVez("agora mesmo")).toBe("#22c55e");
    expect(corDaUltimaVez("há 2h")).toBe("#f59e0b");
    expect(corDaUltimaVez("ontem")).toBe("#a8a29e");
    expect(corDaUltimaVez("há 3 dias")).toBe("#a8a29e");
    expect(corDaUltimaVez("há 1 mês")).toBe("#a8a29e");
  });
});
