import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { montarAlbum, semanaDoPost, SEMANA_MAXIMA } from "./album-da-gestacao";

const LMP = "2026-01-01";
const em = (dias: number) =>
  new Date(Date.parse(`${LMP}T12:00:00`) + dias * 86_400_000).toISOString();
const p = (id: string, dias: number) => ({ id, criadoEm: em(dias) });

describe("⚠️ a semana da publicação — e o que ela RECUSA a inventar", () => {
  test("o primeiro dia é a semana 1", () => {
    expect(semanaDoPost(em(0), LMP)).toBe(1);
    expect(semanaDoPost(em(6), LMP)).toBe(1);
    expect(semanaDoPost(em(7), LMP)).toBe(2);
  });

  test("⚠️ ANTES da DUM não tem semana — a conta é mais velha que a gestação", () => {
    /* Chutar uma poria "1 semana" numa foto de antes de tudo. */
    expect(semanaDoPost(em(-1), LMP)).toBeNull();
  });

  test("⚠️ DEPOIS da 42ª também não — a gestação acabou", () => {
    /* Sem esta recusa, uma foto tirada depois do parto sairia rotulada "38
       semanas", e o app estaria afirmando uma coisa que não sabe. */
    expect(semanaDoPost(em(SEMANA_MAXIMA * 7 - 1), LMP)).toBe(SEMANA_MAXIMA);
    expect(semanaDoPost(em(SEMANA_MAXIMA * 7), LMP)).toBeNull();
  });

  test("data ilegível não vira semana", () => {
    expect(semanaDoPost("nada", LMP)).toBeNull();
    expect(semanaDoPost(em(3), "nada")).toBeNull();
  });
});

describe("⚠️ o álbum", () => {
  test("⚠️ SEM DUM não há álbum — toda semana seria chute", () => {
    expect(montarAlbum([p("a", 3)], null)).toEqual([]);
  });

  test("⚠️ do COMEÇO para o fim, ao contrário da grade", () => {
    /* É a única diferença que justifica o recurso: a grade responde "o que ela
       publicou por último", e o álbum responde "como foi". */
    const a = montarAlbum([p("novo", 100), p("velho", 10)], LMP);
    expect(a.map((s) => s.posts[0].id)).toEqual(["velho", "novo"]);
  });

  test("⚠️ e dentro da semana também", () => {
    const [s] = montarAlbum([p("b", 9), p("a", 8)], LMP);
    expect(s.posts.map((x) => x.id)).toEqual(["a", "b"]);
  });

  test("⚠️ semana VAZIA não vira seção", () => {
    /* Um "17 semanas" em branco transforma a ausência em cobrança: houve
       semanas em que ela não teve o que publicar. */
    const a = montarAlbum([p("a", 0), p("b", 70)], LMP);
    expect(a.map((s) => s.chave)).toEqual(["semana:1", "semana:11"]);
  });

  test("uma seção por semana, com o título no singular só na primeira", () => {
    const a = montarAlbum([p("a", 0), p("b", 7)], LMP);
    expect(a.map((s) => s.titulo)).toEqual(["1 semana", "2 semanas"]);
  });

  test("⚠️ o que ficou FORA da gestação tem seção própria, sem semana", () => {
    const a = montarAlbum([p("antes", -30), p("meio", 50), p("depois", 400)], LMP);
    expect(a.map((s) => s.chave)).toEqual(["antes", "semana:8", "depois"]);
    expect(a[0].posts.map((x) => x.id)).toEqual(["antes"]);
    expect(a[2].posts.map((x) => x.id)).toEqual(["depois"]);
  });

  test('⚠️ o título é "Depois", e NUNCA "Pós-parto"', () => {
    /* O app não sabe se houve parto — só que a publicação nasceu passada a 42ª
       semana. Nomear o desfecho é o tipo de afirmação que este app não faz. */
    const a = montarAlbum([p("d", 400)], LMP);
    expect(a[0].titulo).toBe("Depois");
    const fonte = readFileSync("src/lib/album-da-gestacao.ts", "utf8");
    const semProsa = fonte.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(semProsa).not.toContain("Pós-parto");
    expect(semProsa).not.toContain("Nasceu");
  });

  test("nenhuma publicação, nenhuma seção", () => {
    expect(montarAlbum([], LMP)).toEqual([]);
  });
});

describe("⚠️ a régua não conhece perfil, sessão nem alvo", () => {
  test("⚠️ e por isso não há como pedir o álbum de outra pessoa AQUI", () => {
    /* O recorte é do servidor (a sessão, sem `alvoId`); esta régua só recebe
       uma lista e uma data. Um parâmetro de dono aqui convidaria o chamador a
       montar o álbum de qualquer uma. */
    const fonte = readFileSync("src/lib/album-da-gestacao.ts", "utf8");
    const semProsa = fonte.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const proibido of ["alvoId", "accessToken", "supabase", "user_id"]) {
      expect(semProsa).not.toContain(proibido);
    }
  });
});
