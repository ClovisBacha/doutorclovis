/**
 * A onda 6 — o que a conversa embaixo do post ganhou.
 *
 * Menção que vira link · ordenação por curtidas · rascunho por publicação.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  ORDEM_PADRAO,
  RASCUNHO_MINIMO,
  chaveDoRascunhoDeComentario,
  ehChaveDeRascunhoDeComentario,
  lerRascunhoGuardado,
  ordenarComentarios,
  serializarRascunho,
} from "./comentarios";

/** ⚠️ Tira a prosa antes de procurar: ela já quebrou teste nos dois sentidos. */
const semProsa = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const COMP = semProsa(readFileSync("src/components/rede-comentarios.tsx", "utf8"));
const SERV = semProsa(readFileSync("src/lib/comentarios.functions.ts", "utf8"));
const INSTA = semProsa(readFileSync("src/components/rede-instagram.tsx", "utf8"));

const em = (id: string, minutos: number, curtidas: number, fixado = false) => ({
  id,
  criadoEm: new Date(Date.UTC(2026, 7, 26, 12, minutos)).toISOString(),
  curtidas,
  fixadoEm: fixado ? new Date(Date.UTC(2026, 7, 26, 13, 0)).toISOString() : null,
  respondeA: null,
});

describe("22 · o @ do comentário vira link", () => {
  test("⚠️ é a MESMA implementação do post, exportada — nunca uma cópia", () => {
    /**
     * Duas implementações do mesmo `@` divergiriam no primeiro conserto, e a
     * divergência apareceria como a menção virando link num lugar e não no
     * outro — sem erro nenhum.
     */
    expect(INSTA).toContain("export function TextoComLinks(");
    expect(COMP).toContain('from "@/components/rede-instagram"');
    expect(COMP).toContain("<TextoComLinks");
  });

  test("⚠️ e o servidor já avisava a mencionada — era só a metade da tela que faltava", () => {
    /**
     * ⚠️ **COBRA A CHAMADA, nunca o nome.** Apagar a chamada deixa o nome no
     * `import`, e um `toContain("avisarMencionadas")` continua verde — a mesma
     * asserção vazia que a varredura da LGPD já pegou uma vez.
     */
    expect(SERV).toContain("await avisarMencionadas(sb, {");
    expect(SERV).toMatch(/avisarMencionadas\(sb, \{[^}]*postId: data\.postId/);
  });

  test("o texto do comentário passa pelo renderizador, e não sai cru", () => {
    /* A garantia: nenhum `{c.texto}` solto sobrou como conteúdo da linha. */
    expect(COMP).not.toContain(">{c.texto}<");
    expect(COMP).toMatch(/<TextoComLinks[\s\S]{0,200}texto=\{c\.texto\}/);
  });
});

describe("23 · a ordem da conversa", () => {
  test("⚠️ o padrão é o TEMPO — trocar o padrão embaralharia a leitura", () => {
    expect(ORDEM_PADRAO).toBe("recentes");
  });

  test('"relevantes" põe o mais curtido na frente', () => {
    const r = ordenarComentarios([em("a", 0, 1), em("b", 5, 9), em("c", 9, 4)], "relevantes");
    expect(r.map((c) => c.id)).toEqual(["b", "c", "a"]);
  });

  test('"recentes" ignora as curtidas', () => {
    const r = ordenarComentarios([em("a", 0, 1), em("b", 5, 9), em("c", 9, 4)], "recentes");
    expect(r.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  test("⚠️ empate desempata pelo TEMPO — lista que se mexe sozinha perde a leitora", () => {
    const uma = ordenarComentarios([em("a", 0, 3), em("b", 5, 3), em("c", 9, 3)], "relevantes");
    const outra = ordenarComentarios([em("c", 9, 3), em("b", 5, 3), em("a", 0, 3)], "relevantes");
    expect(uma.map((c) => c.id)).toEqual(["a", "b", "c"]);
    expect(outra.map((c) => c.id)).toEqual(uma.map((c) => c.id));
  });

  test("⚠️ o FIXADO fica no topo nas DUAS ordens", () => {
    /* Ele é curadoria explícita da dona; a ordenação não pode desfazê-la. */
    const lista = [em("a", 0, 50), em("fix", 5, 0, true), em("c", 9, 20)];
    expect(ordenarComentarios(lista, "recentes")[0]!.id).toBe("fix");
    expect(ordenarComentarios(lista, "relevantes")[0]!.id).toBe("fix");
  });

  test("⚠️ sem curtidas gravadas, a ordem NÃO explode — cai no tempo", () => {
    const sem = [
      { id: "a", criadoEm: "2026-08-26T12:00:00Z", respondeA: null },
      { id: "b", criadoEm: "2026-08-26T12:05:00Z", respondeA: null },
    ];
    expect(ordenarComentarios(sem, "relevantes").map((c) => c.id)).toEqual(["a", "b"]);
  });

  test("⚠️ não muta a lista que recebe", () => {
    const lista = [em("a", 0, 1), em("b", 5, 9)];
    ordenarComentarios(lista, "relevantes");
    expect(lista.map((c) => c.id)).toEqual(["a", "b"]);
  });

  test("⚠️ um valor estranho no pedido não derruba os comentários", () => {
    /* `.catch` no enum: a lista some por causa de um parâmetro de ordenação. */
    expect(SERV).toContain('z.enum(["recentes", "relevantes"]).catch("recentes")');
  });

  test("a tela recarrega ao trocar a ordem — quem ordena é o servidor", () => {
    expect(COMP).toMatch(/comentariosDoPost\(\{[^}]*ordem[^}]*\}/);
    expect(COMP).toMatch(/\}, \[bancada, postId, ordem\]\)/);
  });
});

describe("24 · o rascunho do comentário", () => {
  test("⚠️ a chave carrega a CONTA e a PUBLICAÇÃO", () => {
    /**
     * O post, porque o texto reaparecer noutra publicação faria ela mandar para
     * a pessoa errada. A conta, porque o aparelho é compartilhado.
     */
    const a = chaveDoRascunhoDeComentario("eu", "p1");
    expect(a).not.toBe(chaveDoRascunhoDeComentario("eu", "p2"));
    expect(a).not.toBe(chaveDoRascunhoDeComentario("outra", "p1"));
  });

  test("⚠️ uma letra não é rascunho", () => {
    expect(RASCUNHO_MINIMO).toBeGreaterThan(1);
  });

  test("⚠️ OFERECE, nunca preenche por cima do que ela já digitou", () => {
    expect(COMP).toContain("if (guardado && !texto.trim()) setTexto(guardado)");
  });

  test("⚠️ APAGA ANTES de limpar o campo — senão o publicado vira rascunho", () => {
    /**
     * O efeito de gravar tem atraso: limpando o campo primeiro, ele regravaria
     * o comentário RECÉM PUBLICADO, que reapareceria na próxima abertura.
     */
    /**
     * ⚠️ **A ORDEM É MEDIDA DENTRO DO BLOCO, nunca por `indexOf` no arquivo.**
     * `setTexto("")` aparece meia dúzia de vezes: procurar a partir do apagar
     * acha uma ocorrência LÁ NA FRENTE e o teste passa com a ordem invertida —
     * foi exatamente o que a mutação provou.
     */
    const bloco = COMP.slice(COMP.indexOf("esquecerRascunho();") - 40);
    const duas = /esquecerRascunho\(\);\s*setTexto\(""\);/.test(bloco);
    expect(duas).toBe(true);
  });

  test("⚠️ o modo EDIÇÃO fica de fora", () => {
    /**
     * Ali o campo já carrega o comentário que ela está corrigindo — gravar
     * aquilo como rascunho faria o texto de outra pessoa reaparecer no campo
     * dela na próxima abertura. A garantia é a guarda, não a sua grafia.
     */
    const efeito = COMP.slice(
      COMP.indexOf("const chave = chaveDoRascunhoDeComentario(euId, postId);") - 220,
    );
    expect(efeito).toMatch(/if \([^)]*editando\) return;/);
  });

  test("⚠️ storage indisponível não derruba a tela", () => {
    const trecho = COMP.slice(
      COMP.indexOf("chaveDoRascunhoDeComentario"),
      COMP.indexOf("const esquecerRascunho"),
    );
    expect(trecho).toContain("catch");
  });

  test("⚠️ o comentário não guarda FOTO nem resposta pendente", () => {
    /**
     * O comentário não tem anexo, e guardar `respondeA` faria o rascunho
     * reabrir apontando para um comentário que pode ter sido apagado — o texto
     * iria para a conversa errada.
     *
     * ⚠️ A primeira versão disto cobrava "grava texto CRU", que é a grafia e
     * não a garantia: quebrou no dia em que o rascunho ganhou validade. O que
     * importa é o que ESTÁ no pacote gravado — dois campos, e nada mais.
     */
    const pacote = JSON.parse(serializarRascunho("oi", new Date()));
    expect(Object.keys(pacote).sort()).toEqual(["quando", "texto"]);
  });

  test("⚠️ o rascunho VENCE — senão é uma chave por post, para sempre", () => {
    /**
     * Quem começa a escrever em quarenta posts e desiste deixa quarenta chaves.
     * O que quebra quando a cota do `localStorage` estoura é a PRÓXIMA gravação
     * de qualquer coisa, inclusive o `journey_state`.
     */
    const agora = new Date("2026-08-26T12:00:00Z");
    const velho = serializarRascunho("oi", new Date("2026-08-01T12:00:00Z"));
    const novo = serializarRascunho("oi", new Date("2026-08-25T12:00:00Z"));
    expect(lerRascunhoGuardado(velho, agora)).toBeNull();
    expect(lerRascunhoGuardado(novo, agora)).toBe("oi");
  });

  test("⚠️ e a validade é a MESMA do rascunho do post — um número só", () => {
    const R = semProsa(readFileSync("src/lib/comentarios.ts", "utf8"));
    expect(R).toContain('from "./rascunho-do-post"');
    expect(R).toContain("VALIDADE_DIAS");
  });

  test("⚠️ instante no FUTURO também vence", () => {
    /* Relógio adiantado e depois corrigido deixaria um rascunho eterno. */
    const agora = new Date("2026-08-26T12:00:00Z");
    const futuro = serializarRascunho("oi", new Date("2026-09-30T12:00:00Z"));
    expect(lerRascunhoGuardado(futuro, agora)).toBeNull();
  });

  test("lixo e formato antigo são descartados, nunca mostrados", () => {
    const agora = new Date();
    expect(lerRascunhoGuardado("texto cru da versão anterior", agora)).toBeNull();
    expect(lerRascunhoGuardado("{", agora)).toBeNull();
    expect(lerRascunhoGuardado(null, agora)).toBeNull();
    expect(lerRascunhoGuardado(JSON.stringify({ texto: "oi" }), agora)).toBeNull();
  });

  test("⚠️ a varredura NÃO reconhece chave que não é dela", () => {
    /**
     * ⚠️ **ESTA É A ASSERÇÃO PERIGOSA, e a mutação provou que faltava.** A
     * varredura apaga toda chave que ela reconhece e cujo pacote venceu. Com um
     * reconhecedor frouxo — e `return true` passava no teste anterior, que só
     * cobrava que a função fosse CHAMADA — ela varreria o `localStorage`
     * inteiro: as chaves `dc-path-` da jornada, o rascunho do story, o passo do
     * tutorial. Apagaria a jornada da paciente para limpar rascunho de
     * comentário.
     */
    expect(ehChaveDeRascunhoDeComentario(chaveDoRascunhoDeComentario("eu", "p1"))).toBe(true);
    for (const k of [
      "dc-path-day-12",
      "dc-path-med-log",
      "dc-rede-story-rascunho",
      "dc-path-comunidade-vista",
      "sb-auth-token",
      "",
    ]) {
      expect(ehChaveDeRascunhoDeComentario(k)).toBe(false);
    }
  });

  test("⚠️ a varredura limpa TODA chave vencida, não só a deste post", () => {
    /**
     * É o único momento em que já estamos no armazenamento — e a garantia é que
     * o corpo do laço REMOVA. A primeira versão cobrava só a existência do laço
     * e do reconhecedor: apagar a linha do `removeItem` deixava uma varredura
     * que percorre tudo e não limpa nada, e o teste ficava verde.
     */
    const inicio = COMP.search(/for \(let i = localStorage\.length - 1; i >= 0; i--\)/);
    expect(inicio).toBeGreaterThan(0);
    const corpo = COMP.slice(inicio, COMP.indexOf("\n      }", inicio));
    expect(corpo).toContain("ehChaveDeRascunhoDeComentario(k)");
    expect(corpo).toContain("lerRascunhoGuardado(localStorage.getItem(k), agora)");
    expect(corpo).toContain("localStorage.removeItem(k)");
  });
});

describe("⚠️ a cadeia inteira — o defeito que só LER a tela pegou", () => {
  test("o componente NÃO desfaz a ordem escolhida", () => {
    /**
     * A montagem da conversa ordenava as raízes por `criadoEm` de forma
     * incondicional, DEPOIS do servidor. Com "mais curtidos", o seletor mudava
     * de cor e a lista ficava idêntica — controle que promete e não faz nada.
     * A garantia: a régua da ordem é aplicada na montagem, com a ordem escolhida
     * dentro, e o memo refaz quando ela muda.
     */
    expect(COMP).toMatch(/ordenarComentarios\(\s*saida\.map/);
    expect(COMP).toMatch(/\}, \[lista, ordem\]\)/);
  });

  test("⚠️ e a bancada mostra o seletor FUNCIONANDO, sem sessão", () => {
    /**
     * A ordenação acontece na montagem, então a bancada — que injeta a lista
     * pronta — reordena de verdade ao trocar o chip. Bancada com um controle
     * inerte ensina que os controles desta tela não valem.
     */
    const B = semProsa(readFileSync("src/routes/preview-instagram.tsx", "utf8"));
    expect(B).toContain("ordem: q.ordem == null");
    expect(B).toMatch(/ordem: ordem === "relevantes"/);
  });

  test("⚠️ a bancada escreve o rascunho ANTES de montar", () => {
    /* Gravado num efeito, o componente já teria lido o campo vazio. */
    const B = semProsa(readFileSync("src/routes/preview-instagram.tsx", "utf8"));
    const grava = B.indexOf("chaveDoRascunhoDeComentario(");
    const monta = B.indexOf("<Comentarios", grava);
    expect(grava).toBeGreaterThan(0);
    expect(monta).toBeGreaterThan(grava);
  });
});
