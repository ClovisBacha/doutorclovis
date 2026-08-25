import { describe, test, expect } from "bun:test";
import { postsCrus } from "./rede-social.functions";

/**
 * ⚠️ **A ESCADA DA LEITURA, RODADA DE VERDADE.**
 *
 * `postsCrus` é o único caminho de TODA leitura de post — seis chamadores
 * (`meuFeed`, `verPerfil`, `sugestoesDoFeed`, `verPost`, `meusSalvos`,
 * `postsDaTag`). Ela tinha DUAS posições e nada no meio: tudo, ou o piso de
 * sete colunas. Como `alt_texto` entrou no topo da lista e só existe no
 * `APLICAR_COMENTARIOS_E_LIMITES.sql` — que o dono ainda não rodou —, o banco
 * dele hoje derrubava ONZE colunas que ele TEM por causa de UMA que falta.
 *
 * ⚠️ E o dano passava de enfeite: post de vídeo tem `imagem_path` nulo, então
 * com `video_path` nulado junto a publicação renderiza SEM MÍDIA NENHUMA, e a
 * republicação sem texto próprio some inteira.
 *
 * Estes testes rodam a função contra um Supabase de mentira que conhece um
 * conjunto de colunas escolhido — é a única forma de provar a escada, porque o
 * defeito só existe num banco que rodou meio SQL.
 */

/** Um Supabase de mentira que só aceita as colunas que ele conhece. */
function bancoCom(conhecidas: string[]) {
  const pedidos: string[] = [];
  const linha: Record<string, unknown> = {};
  for (const c of conhecidas) linha[c] = `v:${c}`;
  return {
    pedidos,
    from() {
      return {
        select(cols: string) {
          pedidos.push(cols);
          const faltando = cols
            .split(",")
            .map((c) => c.trim())
            .filter((c) => !conhecidas.includes(c));
          /* ⚠️ O Postgres reprova o select INTEIRO por uma coluna que falta, e
             é isso que faz um recuo de dois passos apagar tudo. */
          if (faltando.length) {
            return { data: null, error: { code: "42703", message: `sem ${faltando[0]}` } };
          }
          return { data: [{ ...linha }], error: null };
        },
      };
    },
  };
}

const TODAS = [
  "id",
  "autor_id",
  "texto",
  "imagem_path",
  "imagens",
  "visibilidade",
  "criado_em",
  "enquete_opcoes",
  "aula",
  "pergunta",
  "comparacao_de",
  "editado_em",
  "miniatura_path",
  "marco_tipo",
  "marco_dias",
  "video_path",
  "repost_de",
  "alt_texto",
];

const ler = (sb: any) => postsCrus(sb, (b: any) => b);

describe("⚠️ postsCrus desce UM degrau por vez", () => {
  test("banco em dia devolve tudo, com UMA consulta só", async () => {
    const sb = bancoCom(TODAS);
    const r = await ler(sb);
    expect(sb.pedidos.length).toBe(1);
    expect(r[0].alt_texto).toBe("v:alt_texto");
  });

  test("⚠️ SEM `alt_texto` (o banco do dono hoje) as outras onze SOBREVIVEM", async () => {
    /* Este é o caso que motivou a escada. Com o recuo de dois passos, todas as
       linhas abaixo davam `null`. */
    const sb = bancoCom(TODAS.filter((c) => c !== "alt_texto"));
    const [p] = await ler(sb);
    expect(p.alt_texto).toBeNull();
    for (const c of [
      "video_path",
      "repost_de",
      "marco_tipo",
      "enquete_opcoes",
      "aula",
      "miniatura_path",
    ]) {
      expect(p[c]).toBe(`v:${c}`);
    }
  });

  test("⚠️ e o VÍDEO é o que dói: sem ele o post fica sem mídia nenhuma", async () => {
    /* Post de vídeo tem `imagem_path` nulo. Com `video_path` nulado junto, o
       carrossel e o player ficam os dois falsos. */
    const sb = bancoCom(TODAS.filter((c) => c !== "alt_texto"));
    const [p] = await ler(sb);
    expect(p.video_path).not.toBeNull();
    expect(p.repost_de).not.toBeNull();
  });

  test("sem vídeo/repost, o marco e a enquete sobrevivem", async () => {
    const sb = bancoCom(TODAS.filter((c) => !["alt_texto", "video_path", "repost_de"].includes(c)));
    const [p] = await ler(sb);
    expect(p.video_path).toBeNull();
    expect(p.marco_tipo).toBe("v:marco_tipo");
    expect(p.enquete_opcoes).toBe("v:enquete_opcoes");
  });

  test("banco só com as sete originais chega ao piso, e não quebra", async () => {
    const sb = bancoCom(TODAS.slice(0, 7));
    const [p] = await ler(sb);
    expect(p.id).toBe("v:id");
    for (const c of TODAS.slice(7)) expect(p[c]).toBeNull();
    /* Cinco tentativas: a lista cheia e os quatro degraus. */
    expect(sb.pedidos.length).toBe(5);
  });

  test("⚠️ nem o piso responde → lista VAZIA, nunca uma exceção", async () => {
    /* Aqui o banco não tem sequer as colunas originais. Estourar aqui deixaria
       a aba preta com um erro; lista vazia é a resposta honesta. */
    const sb = bancoCom(["id"]);
    expect(await ler(sb)).toEqual([]);
  });

  test("⚠️ nenhum degrau manda select com vírgula solta", async () => {
    /* A derivação é por remoção de texto: um `, ` sobrando faz o PostgREST
       recusar a consulta inteira, e o recuo passaria a falhar por sintaxe em
       vez de por coluna. */
    const sb = bancoCom(TODAS.slice(0, 7));
    await ler(sb);
    for (const p of sb.pedidos) {
      expect(p).not.toMatch(/,\s*,|,\s*$|^\s*,/);
      expect(p.split(",").every((c) => c.trim().length > 0)).toBe(true);
    }
  });
});
