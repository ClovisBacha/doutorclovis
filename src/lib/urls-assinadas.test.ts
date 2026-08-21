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
import { describe, expect, mock, test } from "bun:test";

/**
 * ⚠️ O STORAGE DE MENTIRA, para o lote ser testado POR COMPORTAMENTO.
 *
 * Sem ele, tudo que dava para provar era que a string "renovarUrlsAssinadas"
 * aparece no fonte — e teste que procura palavra é teste que mente (a lição
 * está escrita em `caixinha.ts` e custou dez asserções falsas nesta base). Com
 * o dublê, dá para provar as três coisas que importam: a ordem, o lote e o
 * silêncio quando nada precisa ser renovado.
 */
const chamadas: string[][] = [];
mock.module("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    storage: {
      from: (balde: string) => ({
        createSignedUrls: async (paths: string[]) => {
          chamadas.push(paths);
          return {
            data: paths.map((p) => ({ error: null, path: p, signedUrl: `NOVA:${balde}/${p}` })),
            error: null,
          };
        },
      }),
    },
  },
}));

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
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
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

describe("o lote, por comportamento", () => {
  /**
   * ⚠️ A ORDEM É O INVARIANTE, e é o que separa este conserto de um acidente.
   *
   * Quem chama casa por índice (`linhas.map((p, i) => …urls[i])`). Uma saída
   * fora de ordem trocaria o rosto de uma paciente pelo de outra, em silêncio,
   * no feed inteiro. A entrada aqui é de propósito a pior possível: assinada
   * vencendo, data URL, nulo, assinada vencendo, assinada fresca e link
   * externo — tudo misturado.
   */
  test("⚠️ preserva a ORDEM com a entrada toda misturada", async () => {
    chamadas.length = 0;
    const entrada = [
      velha("a.jpg"),
      "data:image/jpeg;base64,ZZZ",
      null,
      velha("b.jpg"),
      fresca("ok.jpg"),
      "https://externo/x.png",
    ];
    const saida = await renovarUrlsAssinadas(entrada);
    expect(saida).toHaveLength(entrada.length);
    expect(saida[0]).toBe("NOVA:rede/a.jpg");
    /* data URL passa intacta — é o que o `campo-foto` e o ritual gravam. */
    expect(saida[1]).toBe("data:image/jpeg;base64,ZZZ");
    expect(saida[2]).toBeNull();
    expect(saida[3]).toBe("NOVA:rede/b.jpg");
    /* A fresca volta IGUAL, sem passar pela rede. */
    expect(saida[4]).toBe(entrada[4]);
    expect(saida[5]).toBe("https://externo/x.png");
  });

  test("⚠️ UMA requisição para o lote inteiro, não uma por item", async () => {
    chamadas.length = 0;
    await renovarUrlsAssinadas([velha("1.jpg"), velha("2.jpg"), velha("3.jpg"), velha("4.jpg")]);
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]).toHaveLength(4);
  });

  /* ⚠️ O caso COMUM: o avatar é assinado por sete dias, então quase toda
     leitura da rede não precisa renovar nada. Antes, toda leitura renovava
     tudo. */
  test("⚠️ NENHUMA requisição quando tudo ainda está fresco", async () => {
    chamadas.length = 0;
    const r = await renovarUrlsAssinadas([fresca("1.jpg"), fresca("2.jpg")]);
    expect(chamadas).toHaveLength(0);
    expect(r[0]).toContain("token=");
  });

  /* ⚠️ O mesmo caminho repetido (duas pacientes com a mesma foto, ou o mesmo
     post citado duas vezes) não vira duas entradas no pedido. */
  test("caminho repetido entra uma vez só no pedido", async () => {
    chamadas.length = 0;
    const saida = await renovarUrlsAssinadas([velha("x.jpg"), velha("x.jpg")]);
    expect(chamadas[0]).toHaveLength(1);
    expect(saida[0]).toBe("NOVA:rede/x.jpg");
    expect(saida[1]).toBe("NOVA:rede/x.jpg");
  });
});
