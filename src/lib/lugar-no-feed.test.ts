import { describe, expect, test } from "bun:test";
import {
  chaveDoLugar,
  deveRestaurar,
  lerLugar,
  paraGuardar,
  VALIDADE_MINUTOS,
} from "./lugar-no-feed";

const AGORA = new Date("2026-08-20T12:00:00Z");
const haMinutos = (n: number) => new Date(AGORA.getTime() - n * 60_000).toISOString();

describe("a chave", () => {
  /* ⚠️ O aparelho é compartilhado. Sem o id da conta, quem entrasse depois
     começaria no lugar em que a outra parou, num feed que não é o dela. */
  test("⚠️ carrega o id da conta", () => {
    expect(chaveDoLugar("a")).not.toBe(chaveDoLugar("b"));
    expect(chaveDoLugar("a")).toContain("a");
  });
});

describe("guardar", () => {
  test("guarda o id e o instante", () => {
    const t = paraGuardar("p1", AGORA)!;
    expect(JSON.parse(t)).toEqual({ postId: "p1", em: AGORA.toISOString() });
  });

  test("id vazio não vira lugar", () => {
    expect(paraGuardar("", AGORA)).toBeNull();
    expect(paraGuardar("   ", AGORA)).toBeNull();
  });
});

describe("ler", () => {
  test("o que acabou de ser guardado volta inteiro", () => {
    expect(lerLugar(paraGuardar("p9", AGORA), AGORA)?.postId).toBe("p9");
  });

  /* ⚠️ "Onde eu parei" é uma pergunta sobre a MESMA sessão. Um lugar de ontem
     devolveria a paciente ao meio de um feed que mudou inteiro — e o que ela
     quer de manhã é justamente o que apareceu de novo. */
  test("⚠️ vence em trinta minutos", () => {
    const quase = JSON.stringify({ postId: "p1", em: haMinutos(VALIDADE_MINUTOS - 1) });
    const velho = JSON.stringify({ postId: "p1", em: haMinutos(VALIDADE_MINUTOS + 1) });
    expect(lerLugar(quase, AGORA)).not.toBeNull();
    expect(lerLugar(velho, AGORA)).toBeNull();
  });

  /* ⚠️ Relógio dessincronizado daria um lugar que nunca vence. */
  test("⚠️ carimbo do FUTURO é descartado", () => {
    const futuro = JSON.stringify({ postId: "p1", em: haMinutos(-5) });
    expect(lerLugar(futuro, AGORA)).toBeNull();
  });

  /* ⚠️ Derrubar a Comunidade inteira por causa de um JSON torto seria trocar
     um conforto por um defeito. Mesma decisão de `lerRascunho`. */
  test("⚠️ lixo vira null, nunca exceção", () => {
    expect(lerLugar("{", AGORA)).toBeNull();
    expect(lerLugar("null", AGORA)).toBeNull();
    expect(lerLugar('{"postId":42}', AGORA)).toBeNull();
    expect(lerLugar('{"postId":"p","em":"ontem"}', AGORA)).toBeNull();
    expect(lerLugar(null, AGORA)).toBeNull();
    expect(lerLugar("", AGORA)).toBeNull();
  });
});

describe("deveRestaurar", () => {
  /* ⚠️ Rolar para um elemento que não existe não faz nada — e ela ficaria no
     topo sem entender por que o app às vezes guarda o lugar e às vezes não. */
  test("⚠️ só se o post ainda estiver na lista", () => {
    const l = { postId: "p3", em: AGORA.toISOString() };
    expect(deveRestaurar(l, ["p1", "p2", "p3"])).toBe(true);
    expect(deveRestaurar(l, ["p1", "p2"])).toBe(false);
  });

  /* ⚠️ Ela já está no topo. Restaurar o primeiro gasta uma rolagem à toa e, com
     o feed ainda carregando imagens, dá um solavanco visível. */
  test("⚠️ nunca para o PRIMEIRO da lista", () => {
    const l = { postId: "p1", em: AGORA.toISOString() };
    expect(deveRestaurar(l, ["p1", "p2"])).toBe(false);
  });

  test("sem lugar guardado, não restaura", () => {
    expect(deveRestaurar(null, ["p1", "p2"])).toBe(false);
  });

  test("lista vazia não restaura", () => {
    expect(deveRestaurar({ postId: "p1", em: AGORA.toISOString() }, [])).toBe(false);
  });
});
