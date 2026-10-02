import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ComentarioNaTela } from "~/servidor/rede";
import {
  cartoesDoApp,
  chaveDasRegras,
  comCurtida,
  comReacao,
  contagemCurta,
  corDaInicial,
  CORES_DA_INICIAL,
  fotosDoPost,
  fotosParaPublicar,
  inicialDe,
  juntarPaginas,
  LIMITE_DO_COMENTARIO,
  mensagemDoErro,
  montarConversas,
  mostraCampoDeComentar,
  PONTOS_DAS_REGRAS,
  reacaoDoToque,
  reacaoDoToqueDuplo,
  recorteQuadrado,
  respostasNaTela,
  RESPOSTAS_VISIVEIS,
  rotuloDoBotaoSeguir,
  seguro,
  tamanhoReduzido,
  temMais,
} from "./regras";

const site = resolve(import.meta.dir, "../../../../src/lib");

describe("os números repetidos batem com o site", () => {
  test("teto do comentário e respostas visíveis", () => {
    const fonte = readFileSync(join(site, "comentarios.ts"), "utf8");
    expect(fonte).toContain(`LIMITE_DO_COMENTARIO = ${LIMITE_DO_COMENTARIO};`);
    expect(fonte).toContain(`RESPOSTAS_VISIVEIS = ${RESPOSTAS_VISIVEIS};`);
  });
});

describe("seguro", () => {
  test("a ponte que lança vira { ok:false, motivo:'rede' }", async () => {
    const r = await seguro(async () => {
      throw new Error("sem rede");
    });
    expect(r).toEqual({ ok: false, motivo: "rede" });
  });
  test("a recusa do servidor passa como veio, com o recado", async () => {
    const r = await seguro(async () => ({ ok: false as const, motivo: "clinica", recado: "x" }));
    expect(r).toEqual({ ok: false, motivo: "clinica", recado: "x" });
  });
  test("resposta sem `ok` não é sucesso", async () => {
    const r = await seguro(async () => undefined as unknown as { ok: true });
    expect(r.ok).toBe(false);
  });
});

describe("mensagemDoErro", () => {
  test("o recado do servidor é mostrado como chegou", () => {
    expect(mensagemDoErro("clinica", "Abra o SOS.")).toBe("Abra o SOS.");
  });
  test("indisponível é um silêncio só, sem dizer o motivo", () => {
    expect(mensagemDoErro("indisponivel", null, "perfil")).toBe("Este perfil não está disponível.");
    for (const ctx of ["post", "perfil", "comentario", "acao"] as const) {
      const m = mensagemDoErro("indisponivel", null, ctx).toLowerCase();
      for (const p of ["bloque", "luto", "paus", "suspen", "não existe"]) {
        expect(m.includes(p)).toBe(false);
      }
    }
  });
  test("motivo desconhecido nunca devolve vazio", () => {
    expect(mensagemDoErro("xyz").length > 5).toBe(true);
  });
});

describe("paginação", () => {
  test("não repete post entre páginas", () => {
    const r = juntarPaginas([{ id: "a" }, { id: "b" }], [{ id: "b" }, { id: "c" }]);
    expect(r.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });
  test("o fim é só proximo nulo — página vazia com cursor continua", () => {
    expect(temMais(null)).toBe(false);
    expect(temMais(undefined)).toBe(false);
    expect(temMais("")).toBe(false);
    expect(temMais("2026-09-01T00:00:00Z")).toBe(true);
  });
});

describe("reações", () => {
  test("reagir, trocar e tirar mexem nas contagens certas", () => {
    const p0 = { reacoes: { amei: 2 }, minhaReacao: null };
    const p1 = comReacao(p0, "amei");
    expect(p1.reacoes).toEqual({ amei: 3 });
    const p2 = comReacao(p1, "abraco");
    expect(p2.reacoes).toEqual({ amei: 2, abraco: 1 });
    expect(p2.minhaReacao).toBe("abraco");
    const p3 = comReacao(p2, null);
    expect(p3.reacoes).toEqual({ amei: 2 });
    expect(p3.minhaReacao).toBe(null);
  });
  test("a contagem nunca fica zerada nem negativa na tela", () => {
    const p = comReacao({ reacoes: { festa: 1 }, minhaReacao: "festa" }, null);
    expect(p.reacoes).toEqual({});
  });
  test("tocar a mesma tira; outra troca", () => {
    expect(reacaoDoToque("amei", "amei")).toBe(null);
    expect(reacaoDoToque("amei", "forca")).toBe("forca");
  });
  test("o toque duplo só dá, nunca tira", () => {
    expect(reacaoDoToqueDuplo(null)).toBe("amei");
    expect(reacaoDoToqueDuplo("amei")).toBe(null);
    expect(reacaoDoToqueDuplo("torcendo")).toBe("amei");
  });
});

const c = (id: string, criadoEm: string, extra: Partial<ComentarioNaTela> = {}): ComentarioNaTela => ({
  id,
  autorId: "u",
  autorNome: "U",
  autorAvatar: null,
  texto: id,
  criadoEm,
  possoApagar: false,
  ...extra,
});

describe("comentários", () => {
  test("um nível de resposta, em ordem de tempo, órfã vira raiz", () => {
    const conv = montarConversas([
      c("r2", "2026-09-02T10:00:00Z"),
      c("r1", "2026-09-01T10:00:00Z"),
      c("x2", "2026-09-01T12:00:00Z", { respondeA: "r1" }),
      c("x1", "2026-09-01T11:00:00Z", { respondeA: "r1" }),
      c("orfa", "2026-09-03T10:00:00Z", { respondeA: "sumiu" }),
    ]);
    expect(conv.map((v) => v.raiz.id)).toEqual(["r1", "r2", "orfa"]);
    expect(conv[0].respostas.map((r) => r.id)).toEqual(["x1", "x2"]);
  });
  test("o fixado sobe para o topo", () => {
    const conv = montarConversas([
      c("a", "2026-09-01T10:00:00Z"),
      c("b", "2026-09-02T10:00:00Z", { fixadoEm: "2026-09-03T00:00:00Z" }),
    ]);
    expect(conv[0].raiz.id).toBe("b");
  });
  test("três respostas e 'ver mais'", () => {
    const rs = [1, 2, 3, 4, 5].map((i) => c(`x${i}`, `2026-09-01T1${i}:00:00Z`));
    expect(respostasNaTela(rs, false).visiveis.length).toBe(3);
    expect(respostasNaTela(rs, false).escondidas).toBe(2);
    expect(respostasNaTela(rs, true).escondidas).toBe(0);
    expect(respostasNaTela(rs.slice(0, 3), false).escondidas).toBe(0);
  });
  test("campo de comentar só com abertos E possoComentar", () => {
    expect(mostraCampoDeComentar({ abertos: true, possoComentar: true })).toBe(true);
    expect(mostraCampoDeComentar({ abertos: false, possoComentar: true })).toBe(false);
    expect(mostraCampoDeComentar({ abertos: true, possoComentar: false })).toBe(false);
  });
  test("curtir e descurtir", () => {
    const a = comCurtida(c("a", "2026-09-01T10:00:00Z", { curtidas: 0 }), true);
    expect(a.curtidas).toBe(1);
    expect(a.euCurti).toBe(true);
    expect(comCurtida(a, false).curtidas).toBe(0);
    expect(comCurtida(a, true)).toBe(a);
  });
});

describe("fotos", () => {
  test("lado maior vai a 1080, proporção mantida; pequena não cresce", () => {
    expect(tamanhoReduzido(4032, 3024)).toEqual({ width: 1080, height: 810 });
    expect(tamanhoReduzido(3000, 4000)).toEqual({ width: 810, height: 1080 });
    expect(tamanhoReduzido(800, 600)).toBe(null);
    expect(tamanhoReduzido(0, 600)).toBe(null);
  });
  test("recorte quadrado central", () => {
    expect(recorteQuadrado(1200, 800)).toEqual({ originX: 200, originY: 0, width: 800, height: 800 });
    expect(recorteQuadrado(500, 500)).toBe(null);
  });
  test("a 1ª foto vai em imagem, as outras em extras, no máximo 4", () => {
    expect(fotosParaPublicar([])).toEqual({ imagem: null, extras: [] });
    expect(fotosParaPublicar(["a", "b", "c", "d", "e"])).toEqual({
      imagem: "a",
      extras: ["b", "c", "d"],
    });
  });
  test("as fotos do post não repetem a capa", () => {
    expect(fotosDoPost({ imagemUrl: "a", imagens: ["a", "b"] })).toEqual(["a", "b"]);
    expect(fotosDoPost({ imagemUrl: "a", imagens: [] })).toEqual(["a"]);
    expect(fotosDoPost({ imagemUrl: null, imagens: [] })).toEqual([]);
  });
});

describe("gente", () => {
  test("inicial e cor estáveis", () => {
    expect(inicialDe(" ana")).toBe("A");
    expect(inicialDe("")).toBe("?");
    expect(corDaInicial("abc")).toBe(corDaInicial("abc"));
    expect(CORES_DA_INICIAL.includes(corDaInicial("qualquer") as never)).toBe(true);
  });
  test("contagem curta", () => {
    expect(contagemCurta(12)).toBe("12");
    expect(contagemCurta(12_345)).toBe("12,3 mil");
    expect(contagemCurta(-1)).toBe("0");
  });
  test("botão de seguir", () => {
    expect(rotuloDoBotaoSeguir(null)).toBe("Seguir");
    expect(rotuloDoBotaoSeguir("pendente")).toBe("Pendente");
    expect(rotuloDoBotaoSeguir("ativo")).toBe("Seguindo");
  });
});

describe("regras e boas-vindas", () => {
  test("a chave das Regras leva o uid", () => {
    expect(chaveDasRegras("u1")).toBe("dc-regras-comunidade:u1");
  });
  test("as Regras dizem o que a Apple pede (1.2)", () => {
    const tudo = PONTOS_DAS_REGRAS.map((p) => `${p.titulo} ${p.texto}`).join(" ");
    expect(tudo).toContain("24 horas");
    expect(/ofensivo/.test(tudo)).toBe(true);
    expect(/Denunciar/.test(tudo)).toBe(true);
    expect(/Bloquear/.test(tudo)).toBe(true);
    expect(/removid/.test(tudo)).toBe(true);
  });
  test("os cartões não prometem médico nem apontam para o que o app não tem", () => {
    const cartoes = cartoesDoApp();
    expect(cartoes.length >= 3).toBe(true);
    for (const k of cartoes) {
      expect(/seu médico/i.test(k.texto)).toBe(false);
      expect(k.texto.includes("⊞")).toBe(false);
    }
    expect(cartoes.some((k) => k.id === "clinico" && k.texto.includes("192"))).toBe(true);
  });
});

describe("catracas das telas da Comunidade", () => {
  const raizes = [resolve(import.meta.dir, "../../app/comunidade"), resolve(import.meta.dir, "../../componentes/comunidade"), resolve(import.meta.dir, ".")];
  const arquivos: string[] = [resolve(import.meta.dir, "../../app/(abas)/comunidade.tsx")];
  const andar = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) andar(p);
      else if (/\.tsx?$/.test(n) && !n.endsWith(".test.ts")) arquivos.push(p);
    }
  };
  for (const r of raizes) andar(r);

  test("nenhum valor de @/lib/comentarios (arrasta a régua clínica)", () => {
    for (const a of arquivos) {
      const fonte = readFileSync(a, "utf8");
      const ruins = fonte.match(/import\s+(?!type\b)[^;]*from\s+["']@\/lib\/comentarios["']/g);
      expect(ruins ?? []).toEqual([]);
    }
  });
  test("nada de *.functions, *.server, pergunta-clinica", () => {
    for (const a of arquivos) {
      const fonte = readFileSync(a, "utf8");
      expect(/from\s+["']@\/lib\/[^"']*(\.functions|\.server|pergunta-clinica)["']/.test(fonte)).toBe(false);
    }
  });
  test("nenhuma URL de imagem externa na bancada", () => {
    const fonte = readFileSync(resolve(import.meta.dir, "bancada.ts"), "utf8");
    expect(/https?:\/\//.test(fonte)).toBe(false);
  });
});
