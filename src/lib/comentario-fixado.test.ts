import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import {
  COMENTARIOS_FIXADOS_MAX,
  ordenarComentariosComFixado,
  podeFixarComentario,
} from "./comentarios";

/**
 * ⚠️ **O BLOCO D: fixar um comentário, e ver quem curtiu o meu.**
 *
 * As duas são pequenas e as duas mexem em quem manda na conversa embaixo da
 * foto — a primeira dá curadoria à dona do post, a segunda dá à autora do
 * comentário uma informação que ninguém mais pode ter.
 */

const FONTE = readFileSync("src/lib/comentarios.functions.ts", "utf8");
const TELA = readFileSync("src/components/rede-comentarios.tsx", "utf8");
/** ⚠️ A prosa cita o que ela proíbe — tira-se antes de procurar. */
const semProsa = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

function corpoDe(nome: string): string {
  const s = semProsa(FONTE);
  const i = s.indexOf(`export const ${nome} = createServerFn`);
  if (i < 0) throw new Error(`não achei ${nome}`);
  const j = s.indexOf("\nexport const ", i + 10);
  return s.slice(i, j < 0 ? undefined : j);
}

describe("a régua de fixar", () => {
  const base = { euId: "dona", donaDoPost: "dona", ehRaiz: true as boolean };

  test("⚠️ UM SÓ, e não os três do Instagram", () => {
    /* Três comentários grudados no topo de uma tela de 393px empurram a
       conversa de verdade para fora da dobra — e fixar é ENDOSSO num app que
       gastou a decisão de não ter comentário aberto por causa de conselho
       errado. Endossar um é escolha; endossar três é distribuir o endosso. */
    expect(COMENTARIOS_FIXADOS_MAX).toBe(1);
  });

  test("⚠️ só a DONA DO POST fixa", () => {
    /* Se a autora do comentário pudesse fixar o próprio, qualquer pessoa poria
       a própria opinião acima de todas as outras embaixo da foto de outra. */
    expect(podeFixarComentario(base)).toBe(true);
    expect(podeFixarComentario({ ...base, euId: "outra" })).toBe(false);
  });

  test("⚠️ RESPOSTA não se fixa", () => {
    /* Ela subiria sozinha ao topo citando um comentário que ficou lá embaixo. */
    expect(podeFixarComentario({ ...base, ehRaiz: false })).toBe(false);
  });

  test("⚠️ e comentário escondido também não", () => {
    /* Fixar é pôr no topo para todo mundo ler — sobre um texto que a régua
       acabou de esconder dos outros, a dona do post desfaria, sem saber, a
       restrição que ela mesma pôs. */
    expect(podeFixarComentario({ ...base, oculto: "restrito" })).toBe(false);
    expect(podeFixarComentario({ ...base, oculto: "palavra" })).toBe(false);
    expect(podeFixarComentario({ ...base, oculto: null })).toBe(true);
  });
});

describe("a ordem com o fixado", () => {
  const lista = [
    { id: "a", fixadoEm: null, respondeA: null },
    { id: "b", fixadoEm: "2026-08-20T10:00:00Z", respondeA: null },
    { id: "c", fixadoEm: null, respondeA: null },
  ];

  test("o fixado sobe, e o resto NÃO reordena", () => {
    /* A lista chega cronológica do servidor e já carrega a paginação; reordenar
       o resto faria a segunda página aparecer embaralhada em relação à
       primeira. */
    expect(ordenarComentariosComFixado(lista).map((c) => c.id)).toEqual(["b", "a", "c"]);
  });

  test("sem fixado, a lista volta EXATAMENTE como veio", () => {
    const sem = lista.map((c) => ({ ...c, fixadoEm: null }));
    expect(ordenarComentariosComFixado(sem).map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  test("⚠️ uma RESPOSTA com `fixadoEm` NÃO sobe", () => {
    /**
     * A régua do servidor recusa fixar resposta — mas uma linha gravada por uma
     * versão anterior, ou por um pedido montado à mão, não passou por lá. Se
     * ela subisse, apareceria no topo arrancada da conversa a que responde.
     */
    const comResposta = [
      { id: "raiz", fixadoEm: null, respondeA: null },
      { id: "resp", fixadoEm: "2026-08-20T10:00:00Z", respondeA: "raiz" },
    ];
    expect(ordenarComentariosComFixado(comResposta).map((c) => c.id)).toEqual(["raiz", "resp"]);
  });
});

describe("⚠️ o servidor: fixar", () => {
  const C = corpoDe("fixarComentario");

  test("o portão de DONO vem antes de qualquer escrita, e é o do POST", () => {
    const iDono = C.indexOf('.from("rede_posts")');
    const iEscrita = C.indexOf(".update(");
    expect(iDono).toBeGreaterThan(-1);
    expect(iEscrita).toBeGreaterThan(iDono);
    expect(C).toMatch(/\(post as any\)\.autor_id !== eu/);
  });

  test("⚠️ a régua pura roda no servidor — não há segunda decisão", () => {
    expect(C).toContain("podeFixarComentario({");
    expect(C).toContain('motivo: "so_raiz"');
  });

  test("⚠️ DESAFIXA o anterior ANTES de fixar o novo", () => {
    /**
     * A ordem é o oposto da do bloqueio, e de propósito: aqui o estado
     * intermediário ruim seria DOIS fixados (a tela mostraria dois topos).
     * Limpando primeiro, uma falha na segunda escrita deixa nenhum fixado —
     * reversível com um toque.
     */
    const iLimpa = C.indexOf('.not("fixado_em", "is", null)');
    const iFixa = C.indexOf("fixado_em: new Date().toISOString()");
    expect(iLimpa).toBeGreaterThan(-1);
    expect(iFixa).toBeGreaterThan(iLimpa);
  });

  test("⚠️ e a limpeza é recortada pelo POST", () => {
    /* Sem o recorte, fixar um comentário desafixaria os comentários fixados de
       TODAS as publicações da plataforma. */
    const i = C.indexOf('.not("fixado_em", "is", null)');
    expect(C.slice(Math.max(0, i - 400), i)).toContain('.eq("post_id"');
  });
});

describe("⚠️ o servidor: quem curtiu o comentário", () => {
  const C = corpoDe("quemCurtiuComentario");

  test("⚠️ a lista é de quem ESCREVEU, e não da dona do post", () => {
    /**
     * `quemReagiuAoPost` é da autora do post porque as reações são sobre a
     * publicação dela; aqui as curtidas são sobre a frase de quem comentou.
     * Dar a lista à dona do post transformaria a conversa embaixo das fotos
     * dela num painel de quem apoia quem.
     */
    expect(C).toMatch(/\(c as any\)\.autor_id !== eu/);
    expect(C).not.toContain('.from("rede_posts")');
  });

  test("o portão vem ANTES da leitura das curtidas", () => {
    const iPortao = C.indexOf('motivo: "indisponivel"');
    const iLista = C.indexOf('.from("rede_comentario_curtidas")');
    expect(iPortao).toBeGreaterThan(-1);
    expect(iLista).toBeGreaterThan(iPortao);
  });

  test("⚠️ falha de leitura devolve ERRO, e nunca lista vazia", () => {
    /* "Ninguém curtiu" sobre um comentário com o número 12 do lado é a tela se
       contradizendo. */
    expect(C).toContain('motivo: "banco"');
  });

  test("⚠️ quem ela bloqueou não aparece", () => {
    /* A curtida continua contando — o número é do comentário, não da lista —,
       mas ver o nome de quem ela bloqueou é o que bloquear existe para
       impedir. */
    expect(C).toContain("ctx.bloqueio.has(id)");
  });

  test("⚠️ o avatar vem de `perfisPorId`, que ASSINA", () => {
    /* Uma linha crua de `patient_profiles` devolveria o caminho do balde no
       lugar da URL, e a foto sairia quebrada sem erro nenhum. */
    expect(C).toContain("perfisPorId(sb, ids)");
    expect(C).toContain("naFileira(p)");
  });
});

describe("⚠️ a leitura entrega o que a tela precisa", () => {
  const C = corpoDe("comentariosDoPost");

  test("`possoFixar` e `souOAutor` vêm do SERVIDOR", () => {
    /* Uma segunda decisão na tela ofereceria "Fixar" numa resposta, e o
       servidor recusaria depois do toque. */
    expect(C).toContain("possoFixar: podeFixarComentario({");
    expect(C).toContain("souOAutor: c.autor_id === eu");
  });

  test("⚠️ a ORDEM sai do servidor, e passa pela régua", () => {
    /**
     * ⚠️ **A GARANTIA É "não devolve lista crua", nunca o nome da função.** A
     * primeira versão deste teste cobrava `ordenarComentariosComFixado(...)`
     * escrito à letra, e quebrou no dia em que a ordenação ganhou um segundo
     * modo — reprovando uma mudança correta. O que importa é que a lista
     * devolvida seja o RETORNO de uma ordenação vinda de `./comentarios`:
     * ordenar na tela faria a lista pular de lugar depois da primeira pintura.
     */
    const devolvida = /comentarios:\s*(\w+)\(/.exec(C);
    expect(devolvida).not.toBeNull();
    const ordenador = devolvida![1];
    expect(ordenador).toMatch(/^ordenarComentarios/);
    expect(C).toContain(`{ ${ordenador}`);
    expect(C).toContain('await import("./comentarios")');
  });

  test("⚠️ e o degrau desce UMA coluna por vez", () => {
    /**
     * `fixado_em` nasce no `APLICAR_DEZ_DA_REDE` e `responde_a` no
     * `APLICAR_COMENTARIOS_E_LIMITES` — dois arquivos, e existe um banco real
     * que rodou o segundo e não o primeiro. Um recuo de dois passos apagaria as
     * RESPOSTAS por causa de uma coluna de fixar: a conversa em árvore, que já
     * funciona, viraria uma lista plana em silêncio.
     */
    const comFixado = C.indexOf('"id, autor_id, texto, criado_em, responde_a, fixado_em"');
    /* ⚠️ E o degrau de cima é o de `editado_em`, que nasce noutro SQL. */
    const comEditado = C.indexOf(
      '"id, autor_id, texto, criado_em, responde_a, fixado_em, editado_em"',
    );
    expect(comEditado).toBeGreaterThan(-1);
    expect(comFixado).toBeGreaterThan(comEditado);
    const soResponde = C.indexOf('"id, autor_id, texto, criado_em, responde_a"');
    const minimo = C.indexOf('"id, autor_id, texto, criado_em"');
    expect(comFixado).toBeGreaterThan(-1);
    expect(soResponde).toBeGreaterThan(comFixado);
    expect(minimo).toBeGreaterThan(soResponde);
  });
});

describe("⚠️ a tela", () => {
  const T = semProsa(TELA);

  test("as duas funções têm PORTA", () => {
    expect(T).toContain("fixarComentario");
    expect(T).toContain("quemCurtiuComentario");
  });

  test("⚠️ 'Fixar' só aparece com `possoFixar`, e nunca numa resposta", () => {
    expect(T).toMatch(/aoFixar=\{raiz\.possoFixar \?/);
    /* A resposta não recebe a prop — nem opcional, nem `undefined` explícito:
       ela simplesmente não existe naquele ponto de uso. */
    const i = T.indexOf("aoResponder={abertos ? () => responderA(r, raiz) : undefined}");
    expect(i).toBeGreaterThan(-1);
    expect(T.slice(i, i + 400)).not.toContain("aoFixar");
  });

  test("⚠️ o número só vira BOTÃO para quem escreveu", () => {
    expect(T).toMatch(/aoVerCurtidas=\{raiz\.souOAutor \?/);
    expect(T).toMatch(/aoVerCurtidas=\{r\.souOAutor \?/);
  });

  test("⚠️ falha ao carregar a lista NÃO vira 'ninguém ainda'", () => {
    expect(T).toContain('"erro"');
    expect(T).toContain("Não deu para carregar agora.");
  });

  test("⚠️ e a tela relê depois de fixar — a ordem é do servidor", () => {
    const i = T.indexOf("async function fixar(");
    const corpo = T.slice(i, T.indexOf("\n  async function", i + 10));
    expect(corpo).toContain("void carregar()");
  });
});
