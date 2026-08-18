import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  aindaVale,
  DIAS_DE_VALIDADE,
  ELOS_QUE_CONTAM,
  ordenarPessoas,
  ordenarSugestoes,
  POSTS_POR_AUTORA,
  type CandidataASugestao,
} from "./sugestoes";

/* Um instante cravado: as funções recebem o `agora`, então nada aqui depende do
   relógio da máquina que roda o teste. */
const AGORA = new Date("2026-08-18T12:00:00Z").getTime();
const diasAtras = (d: number) => new Date(AGORA - d * 24 * 3600 * 1000).toISOString();

function c(postId: string, autorId: string, dias: number, elosEmComum = 0): CandidataASugestao {
  return { postId, autorId, criadoEm: diasAtras(dias), elosEmComum };
}

describe("a ordem da zona de sugestões", () => {
  test("elos em comum vêm antes de recência", () => {
    const r = ordenarSugestoes([c("p1", "a", 0, 0), c("p2", "b", 5, 2)], AGORA);
    expect(r.map((x) => x.postId)).toEqual(["p2", "p1"]);
  });

  test("dentro da mesma faixa de elos, o mais novo primeiro", () => {
    const r = ordenarSugestoes([c("velho", "a", 9, 1), c("novo", "b", 1, 1)], AGORA);
    expect(r.map((x) => x.postId)).toEqual(["novo", "velho"]);
  });

  test(`⚠️ acima de ${ELOS_QUE_CONTAM} elos tanto faz — a mais conectada não domina`, () => {
    // Sem o teto, a pessoa mais conectada da base ocuparia o topo da zona de
    // sugestões de todo mundo, todo dia.
    const r = ordenarSugestoes([c("recente", "a", 0, 3), c("antigo", "b", 8, 40)], AGORA);
    expect(r[0].postId).toBe("recente");
  });

  test(`⚠️ no máximo ${POSTS_POR_AUTORA} publicações por autora`, () => {
    // Numa base pequena, uma pessoa pública que publica muito encheria a zona
    // inteira — e isso não lê como sugestão, lê como empurrão.
    const r = ordenarSugestoes(
      [c("p1", "a", 0), c("p2", "a", 1), c("p3", "a", 2), c("p4", "b", 3)],
      AGORA,
    );
    expect(r.filter((x) => x.autorId === "a")).toHaveLength(POSTS_POR_AUTORA);
    expect(r.map((x) => x.postId)).toContain("p4");
  });

  test("⚠️ o teto guarda as MELHORES da autora, e as excedentes não voltam por baixo", () => {
    const r = ordenarSugestoes([c("p1", "a", 0), c("p2", "a", 1), c("p3", "a", 2)], AGORA);
    expect(r.map((x) => x.postId)).toEqual(["p1", "p2"]);
  });

  test(`⚠️ publicação com mais de ${DIAS_DE_VALIDADE} dias não é sugerida`, () => {
    // O corte é de gestação, não de rede social: quatro meses atrás é outro
    // trimestre, e a conversa daquele post já não é a dela.
    expect(aindaVale(diasAtras(DIAS_DE_VALIDADE - 1), AGORA)).toBe(true);
    expect(aindaVale(diasAtras(DIAS_DE_VALIDADE + 1), AGORA)).toBe(false);
    const r = ordenarSugestoes([c("antigo", "a", 90, 3), c("novo", "b", 2, 0)], AGORA);
    expect(r.map((x) => x.postId)).toEqual(["novo"]);
  });

  test("data inválida não entra", () => {
    const r = ordenarSugestoes(
      [{ postId: "x", autorId: "a", criadoEm: "nada disso", elosEmComum: 9 }],
      AGORA,
    );
    expect(r).toHaveLength(0);
  });

  test("o limite é respeitado", () => {
    const muitas = Array.from({ length: 30 }, (_, i) => c(`p${i}`, `a${i}`, 1));
    expect(ordenarSugestoes(muitas, AGORA, 4)).toHaveLength(4);
  });
});

describe("a fileira de pessoas sugeridas", () => {
  test("elos primeiro, depois quem apareceu por último", () => {
    const r = ordenarPessoas([
      { id: "sumida", elosEmComum: 0, ultimaVez: diasAtras(0) },
      { id: "amiga-de-amiga", elosEmComum: 2, ultimaVez: diasAtras(20) },
    ]);
    expect(r.map((p) => p.id)).toEqual(["amiga-de-amiga", "sumida"]);
  });

  test("⚠️ sem `ultimaVez` ela cai para o fim da FAIXA, não para o fim da lista", () => {
    // `last_seen_at` só passou a ser gravado em ago/2026: `NULL` é sinal de
    // coluna nova, não de conta abandonada.
    const r = ordenarPessoas([
      { id: "sem-elo-ativa", elosEmComum: 0, ultimaVez: diasAtras(1) },
      { id: "com-elo-sem-data", elosEmComum: 2, ultimaVez: null },
    ]);
    expect(r[0].id).toBe("com-elo-sem-data");
  });
});

describe("⚠️ o que NÃO pode virar sinal", () => {
  const FONTE = readFileSync("src/lib/sugestoes.ts", "utf8");
  const SERVIDOR = readFileSync("src/lib/rede-social.functions.ts", "utf8");
  const semComentarios = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  test("engajamento NUNCA entra na ordem", () => {
    // O post que gera mais reação numa comunidade de gestação de alto risco é o
    // da EMERGÊNCIA. Um ranqueamento que aprende engajamento põe o pior dia de
    // uma paciente como a primeira coisa que todas as outras veem.
    const codigo = semComentarios(FONTE);
    for (const proibido of ["reacoes", "reacao", "totalDeReacoes", "curtidas", "popular"]) {
      expect(codigo).not.toContain(proibido);
    }
    expect(codigo).not.toContain("rede_reacoes");
  });

  test("`doctor_id` não monta grafo social", () => {
    // Dado de saúde. Sugerir amizade a partir de com quem ela se trata é usar o
    // prontuário como rede social, mesmo que a tela nunca diga o motivo.
    expect(semComentarios(FONTE)).not.toContain("doctor_id");
    const zona = semComentarios(SERVIDOR);
    const i = zona.indexOf("sugestoesDoFeed");
    expect(i).toBeGreaterThan(-1);
    expect(zona.slice(i, i + 4000)).not.toContain("doctor_id");
  });

  test("⚠️ os elos ordenam e NÃO vão para a tela", () => {
    // "Seguida por Marina e mais 3" entrega quem eu sigo a quem só abriu o
    // feed, e a lista de seguidores deste app não é pública de propósito.
    const tela = semComentarios(readFileSync("src/components/rede-instagram.tsx", "utf8"));
    expect(tela).not.toContain("elosEmComum");
    expect(tela).not.toMatch(/[Ss]eguid[oa] por/);
  });
});
