import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { FIXADOS_MAX, ordenarComFixados, podeFixar } from "./rede-social";

/**
 * ⚠️ **FIXAR PUBLICAÇÃO — e a armadilha inteira é a PAGINAÇÃO.**
 *
 * A grade do perfil é paginada por cursor de `criado_em`. Ordenar a página que
 * chegou faz a fixada flutuar para o topo DA PÁGINA em que ela caiu, e não para
 * o topo da grade: uma foto fixada de abril apareceria no meio da rolagem, com
 * o pino, depois de duzentas outras — o oposto exato do recurso.
 */

const FONTE = readFileSync("src/lib/rede-social.functions.ts", "utf8");
/** ⚠️ Toda busca de texto passa por aqui — a prosa já fez teste mentir aqui. */
const semProsa = FONTE.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

function corpoDe(nome: string): string {
  const i = semProsa.indexOf(`export const ${nome} = createServerFn`);
  if (i < 0) throw new Error(`não achei ${nome}`);
  const j = semProsa.indexOf("\nexport const ", i + 10);
  return semProsa.slice(i, j < 0 ? undefined : j);
}

describe("a régua do teto", () => {
  test("⚠️ TRÊS, e o número é de LAYOUT antes de ser de produto", () => {
    /* A grade tem três colunas: com três fixadas, a primeira fileira inteira é
       o recorte dela e a segunda já é a ordem cronológica. Com quatro, sobra
       uma sozinha numa fileira nova e o recorte deixa de ser legível. */
    expect(FIXADOS_MAX).toBe(3);
  });

  test("abaixo do teto, pode", () => {
    expect(podeFixar({ jaFixados: 0, esteJaEstaFixado: false })).toBe(true);
    expect(podeFixar({ jaFixados: 2, esteJaEstaFixado: false })).toBe(true);
  });

  test("no teto, não pode mais uma", () => {
    expect(podeFixar({ jaFixados: 3, esteJaEstaFixado: false })).toBe(false);
  });

  test("⚠️ mas quem JÁ está fixada não conta como 'mais uma'", () => {
    /* Refixar o que já está fixado é um toque sem efeito. Recusá-lo com "você
       já tem três" seria o app respondendo a uma pergunta que ninguém fez. */
    expect(podeFixar({ jaFixados: 3, esteJaEstaFixado: true })).toBe(true);
  });
});

describe("a ordem da grade", () => {
  const p = (id: string, fixadoEm: string | null = null) => ({ id, fixadoEm });

  test("sem nenhuma fixada, a lista volta INTACTA", () => {
    const lista = [p("a"), p("b"), p("c")];
    expect(ordenarComFixados(lista)).toBe(lista);
  });

  test("fixadas na frente", () => {
    const r = ordenarComFixados([p("a"), p("b", "2026-08-01T00:00:00Z"), p("c")]);
    expect(r.map((x) => x.id)).toEqual(["b", "a", "c"]);
  });

  test("⚠️ entre as fixadas, a ordem é a de FIXAÇÃO — não a de publicação", () => {
    /* Fixar é um gesto de agora: quem acabou de fixar espera ver aquilo na
       frente. Ordenar as três por `criadoEm` faria a mais nova ir para o fim
       quando ela fixasse uma foto antiga — e não há como reordenar. */
    const r = ordenarComFixados([
      p("velha", "2026-01-01T00:00:00Z"),
      p("nova", "2026-08-01T00:00:00Z"),
      p("meio", "2026-05-01T00:00:00Z"),
    ]);
    expect(r.map((x) => x.id)).toEqual(["nova", "meio", "velha"]);
  });

  test("⚠️ e o RESTO não é reordenado — a paginação depende disso", () => {
    /* O que não é fixado chega do servidor já cronológico e já carregando a
       paginação. Reordenar aqui faria a segunda página aparecer embaralhada em
       relação à primeira. */
    const r = ordenarComFixados([p("x"), p("f", "2026-08-01T00:00:00Z"), p("y"), p("z")]);
    expect(r.map((x) => x.id)).toEqual(["f", "x", "y", "z"]);
  });
});

describe("⚠️ o servidor: o teto é dele, e a paginação é o que quase quebrou", () => {
  const C = corpoDe("fixarPost");

  test("só a AUTORA fixa, e a conferência vem antes da escrita", () => {
    const iDono = C.indexOf('.eq("id", data.postId)');
    const iUpdate = C.indexOf(".update(");
    expect(iDono).toBeGreaterThan(-1);
    expect(iUpdate).toBeGreaterThan(iDono);
    expect(C).toContain("autor_id !== eu");
    /* Cinto e suspensório: o `update` também filtra por autora. */
    expect(C.slice(iUpdate)).toContain('.eq("autor_id", eu)');
  });

  test("⚠️ o teto conta o que o BANCO tem, e não o que o cliente disse", () => {
    /* Entre a abertura da tela e o toque cabem outros aparelhos: ela fixa a
       terceira no celular e a quarta no computador. */
    expect(C).toContain('count: "exact"');
    expect(C).toContain("podeFixar(");
    expect(C).not.toContain("data.jaFixados");
  });

  test("⚠️ falha ao CONTAR recusa, nunca libera", () => {
    /* Liberar por não ter conseguido contar é como o teto deixa de existir — a
       mesma régua de `contarTrofeus`. */
    expect(C).toMatch(/erroConta \|\| typeof count !== "number"/);
  });

  test("arquivada não se fixa", () => {
    /* Ela não aparece na grade: o pino prometeria uma posição numa lista onde o
       post não está. */
    expect(C).toContain("arquivado_em");
  });

  test("⚠️ sem a coluna, a tela SABE — nunca um 'pronto' mudo", () => {
    expect(C).toContain('motivo: "sem_suporte"');
  });
});

describe("⚠️ a paginação da grade", () => {
  const V = corpoDe("verPerfil");

  test("as fixadas são uma consulta À PARTE", () => {
    /* Ordenar só a página faria a fixada de abril flutuar para o topo da página
       em que ela caiu, no meio da rolagem. */
    expect(V).toContain('.not("fixado_em", "is", null)');
    expect(V).toContain('.order("fixado_em", { ascending: false })');
  });

  test("⚠️ e elas são buscadas em TODA página, não só na primeira", () => {
    /**
     * Elas só são DESENHADAS no topo da primeira — mas precisam ser conhecidas
     * sempre, para sair da lista cronológica das seguintes. Sem isso, a foto
     * fixada de abril aparecia no topo da primeira tela E de novo no meio da
     * rolagem, quando a paginação chegasse à data dela: a mesma publicação duas
     * vezes, com a mesma chave de React.
     */
    const i = V.indexOf('.not("fixado_em", "is", null)');
    const antes = V.slice(Math.max(0, i - 400), i);
    expect(antes).not.toContain("data.antesDe ?");
  });

  test("⚠️ saem da lista cronológica, senão aparecem duas vezes na mesma tela", () => {
    /**
     * ⚠️ A primeira versão travava a grafia `porId.delete(f.id)` — e reprovou o
     * conserto obrigatório. A catraca de escritas do repositório casa `.delete(`
     * por TEXTO, então um `Map.delete` entra na conta de DELETEs de tabela, que
     * é justamente o que impede alguém de apagar dado de paciente sem ninguém
     * reparar. A remoção virou FILTRO, e o teste passou a cobrar a garantia: os
     * ids fixados saem da lista cronológica, de qualquer jeito que seja.
     */
    const ids = V.indexOf("idsFixados");
    expect(ids).toBeGreaterThan(-1);
    const bloco = V.slice(ids, ids + 300);
    expect(bloco).toMatch(/\.filter\(/);
    expect(bloco).toContain("idsFixados.has");
    /* E nunca por `Map.delete`, pela razão acima. */
    expect(V).not.toContain("porId.delete(");
  });

  test("⚠️ só são DESENHADAS na primeira página", () => {
    /* Repetir o bloco fixado no topo de cada leva faria a grade mostrar as
       mesmas três a cada rolagem. */
    expect(V).toMatch(/const brutos = data\.antesDe\s*\?\s*cronologicos/);
  });

  test("⚠️ a ordenação final é `ordenarComFixados`, e não só `ordenarFeed`", () => {
    /* `ordenarFeed` reordena TUDO por data, o que jogaria a fixada de abril de
       volta para o fim e desfaria a consulta à parte. */
    expect(V).toContain("ordenarComFixados(ordenarFeed(posts))");
  });

  test("⚠️ o cursor sai dos CRONOLÓGICOS — de `brutos` a paginação MORRE", () => {
    /**
     * `brutos` hoje é "as fixadas na frente + a página cronológica", então o
     * comprimento dele passa de `POSTS_POR_PAGINA` na primeira tela: a
     * comparação por igualdade daria `false`, o cursor viraria `null` e a grade
     * pararia depois da primeira página, em silêncio. E o último item dele
     * poderia ser uma fixada, cuja data mandaria a segunda página começar meses
     * atrás.
     *
     * ⚠️ Foi um defeito que EU introduzi ao pôr as fixadas na frente, e a
     * primeira versão deste teste (`toContain("brutos.length === ...")`)
     * passava verde sobre ele — porque descrevia o código antigo em vez da
     * garantia.
     */
    expect(V).toContain("cronologicos.length === POSTS_POR_PAGINA");
    expect(V).not.toContain("brutos.length === POSTS_POR_PAGINA");
    expect(V).toContain("cronologicos[cronologicos.length - 1].criado_em");
  });
});
