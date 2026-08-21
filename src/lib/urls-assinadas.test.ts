/**
 * O LOTE DE URLs ASSINADAS — a correção da lentidão que o dono relatou.
 *
 * "Clico na foto de quem publicou e demora cinco segundos pra abrir o perfil."
 * A causa era uma ida à rede POR ARQUIVO: `createSignedUrl` (singular) faz um
 * `POST` ao Storage para cada caminho, e uma tela de perfil com doze
 * publicações de até cinco fotos chegava a sessenta requisições antes de a
 * primeira imagem aparecer.
 *
 * ⚠️ O invariante que mais importa aqui NÃO é o desempenho — é a ORDEM. Quem
 * chama casa por índice (`linhas.map`), e devolver fora de ordem trocaria o
 * rosto de uma paciente pelo de outra. É o defeito mais grave que este arquivo
 * poderia produzir, e é o que estes testes travam.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { expiraEmSegundos, MARGEM_DE_RENOVACAO_SEG, renovarUrlsAssinadas } from "./imagens.server";

const agora = () => Math.floor(Date.now() / 1000);
const comExp = (segundos: number, caminho: string) => {
  const payload = Buffer.from(JSON.stringify({ exp: agora() + segundos })).toString("base64url");
  return `https://x/storage/v1/object/sign/rede/${caminho}?token=a.${payload}.b`;
};
/** Vence em um minuto: precisa ser renovada. */
const velha = (c: string) => comExp(60, c);
/** Sete dias pela frente: não se toca nela. */
const fresca = (c: string) => comExp(7 * 24 * 3600, c);

/** Uma URL assinada de mentira, com o `exp` que a gente quiser. */
function assinadaFalsa(expEpoch: number, caminho = "abc/foto.jpg", balde = "rede"): string {
  const payload = Buffer.from(JSON.stringify({ url: `${balde}/${caminho}`, exp: expEpoch }))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `https://x.supabase.co/storage/v1/object/sign/${balde}/${caminho}?token=aaa.${payload}.bbb`;
}

describe("ler o vencimento de dentro do token", () => {
  test("lê o `exp` do payload", () => {
    const alvo = 1_800_000_000;
    expect(expiraEmSegundos(assinadaFalsa(alvo))).toBe(alvo);
  });

  /**
   * ⚠️ NÃO DECIFROU VALE RENOVAR.
   *
   * O `exp` é lido só para decidir "vale a pena renovar?" — quem valida o token
   * é o Storage, do outro lado. Devolver `null` faz quem chama re-assinar, que
   * é o lado seguro: o pior caso é uma requisição a mais, nunca uma foto
   * quebrada.
   */
  test("⚠️ token ausente, quebrado ou sem `exp` devolve null", () => {
    expect(expiraEmSegundos("https://x/storage/v1/object/sign/rede/a.jpg")).toBeNull();
    expect(expiraEmSegundos("https://x/storage/v1/object/sign/rede/a.jpg?token=lixo")).toBeNull();
    expect(expiraEmSegundos("https://x/o?token=a.bbbb.c")).toBeNull();
    const semExp = Buffer.from(JSON.stringify({ url: "rede/a" })).toString("base64url");
    expect(expiraEmSegundos(`https://x/o?token=a.${semExp}.c`)).toBeNull();
  });

  /* ⚠️ `exp` que não é número não vira número. Um token forjado com
     `exp: "9999999999"` faria a comparação virar string vs número. */
  test("⚠️ `exp` que não é número devolve null", () => {
    const texto = Buffer.from(JSON.stringify({ exp: "9999999999" })).toString("base64url");
    expect(expiraEmSegundos(`https://x/o?token=a.${texto}.c`)).toBeNull();
  });

  test("data URL não tem token, e não estoura", () => {
    expect(expiraEmSegundos("data:image/jpeg;base64,AAAA")).toBeNull();
  });
});

/**
 * ⚠️ A MARGEM É O QUE FAZ O CASO COMUM CUSTAR ZERO.
 *
 * O avatar é assinado por SETE DIAS (`salvarPerfilSocial`), e era re-assinado a
 * cada leitura — feed, busca, stories, atividade, salvos, lista de amigas. Uma
 * URL com seis dias pela frente era jogada fora e refeita ao custo de uma ida à
 * rede, para produzir outra idêntica em efeito.
 */
describe("a margem de renovação", () => {
  test("⚠️ é menor que a validade do avatar, senão nada é reaproveitado", () => {
    const validadeDoAvatar = 7 * 24 * 3600;
    expect(MARGEM_DE_RENOVACAO_SEG).toBeLessThan(validadeDoAvatar);
  });

  /* ⚠️ E é maior que a validade curta das fotos de post (1h): uma URL de uma
     hora NUNCA deve ser reaproveitada de uma leitura para a outra, ou a paciente
     abriria a tela com uma foto que vence no meio da sessão dela. */
  test("⚠️ é maior que a validade curta das fotos de post", () => {
    expect(MARGEM_DE_RENOVACAO_SEG).toBeGreaterThan(3600);
  });
});

/**
 * ⚠️ NENHUMA ASSINATURA UMA-A-UMA NOS CAMINHOS QUENTES.
 *
 * Esta é a catraca do conserto. `urlAssinada` (singular) continua existindo e
 * continua certa para o caso de UM arquivo — o upload do avatar, por exemplo.
 * O que não pode voltar é ela dentro de um `map` ou de um `for`, que é como a
 * lentidão nasceu.
 */
describe("os caminhos quentes não assinam um por um", () => {
  const semComentarios = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

  for (const arquivo of [
    "src/lib/rede-social.functions.ts",
    "src/lib/convite.functions.ts",
    "src/lib/amigas.functions.ts",
  ]) {
    test(`⚠️ ${arquivo} não tem assinatura dentro de laço`, () => {
      const fonte = semComentarios(readFileSync(arquivo, "utf8"));
      /* `await urlAssinada` dentro de um `.map(` ou de um `for` é o padrão que
         custava uma viagem por item. Assinatura solta (um upload) continua ok. */
      expect(fonte).not.toMatch(/\.map\([^)]*await urlAssinada/s);
      expect(fonte).not.toMatch(/for\s*\([^)]*\)\s*\{[^}]*await urlAssinada/s);
      expect(fonte).not.toMatch(/for\s*\([^)]*\)\s*[^{][^\n]*await renovarUrlAssinada/);
    });
  }

  /* ⚠️ E `perfisPorId` é o ponto único por onde passa o avatar de TODA a rede:
     feed, perfil, busca, stories, atividade e salvos. Se ele voltar a assinar
     um por um, a lentidão volta inteira, em seis telas de uma vez. */
  test("⚠️ `perfisPorId` renova em LOTE", () => {
    const fonte = semComentarios(readFileSync("src/lib/rede-social.functions.ts", "utf8"));
    const i = fonte.indexOf("async function perfisPorId");
    expect(i).toBeGreaterThan(-1);
    const corpo = fonte.slice(i, fonte.indexOf("\n}", i));
    expect(corpo).toContain("renovarUrlsAssinadas");
    expect(corpo).not.toContain("renovarUrlAssinada(");
  });
});
