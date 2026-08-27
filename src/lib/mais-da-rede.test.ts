import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { veuDoPost } from "./conteudo-sensivel";
import {
  codigoDaPublicacao,
  codigoDaPublicacaoLimpo,
  linkDaPublicacao,
} from "./link-da-publicacao";

/**
 * ⚠️ **A LEVA PEDIDA PELO DONO — e o que cada peça não pode ser.**
 *
 * Ancorado em texto que só existe no CÓDIGO, e só com asserção POSITIVA onde a
 * prosa poderia mentir — ver a razão medida em `story-com-video.test.ts`.
 */
const SERVIDOR = readFileSync("src/lib/rede-social.functions.ts", "utf8");
const TELA = readFileSync("src/components/rede-instagram.tsx", "utf8");
const SQL = readFileSync("supabase/APLICAR_MAIS_DA_REDE.sql", "utf8");

const corpo = (fonte: string, abre: string) => {
  const i = fonte.indexOf(abre);
  if (i < 0) return "";
  const fins = [fonte.indexOf("\nexport const ", i + 10), fonte.indexOf("\n/**", i + 10)].filter(
    (n) => n > 0,
  );
  return fonte.slice(i, fins.length ? Math.min(...fins) : undefined);
};

describe("⚠️ o filtro de palavras alcança o FEED", () => {
  test("⚠️ ele NÃO alcançava — protegia comentário e direct, e o feed ficava de fora", () => {
    /* Ela escondia "perdi" e a palavra a atingia rolando, no lugar mais exposto
       do app. Era a maior incoerência do recurso. */
    expect(SERVIDOR).toContain("batePalavraMinha:");
    expect(SERVIDOR).toContain("temPalavraOculta(");
  });

  test("⚠️ a régua é a MESMA — casa PALAVRA INTEIRA, e não uma cópia", () => {
    /* Uma cópia divergente faria "parto" esconder "departamento" só no feed. */
    expect(SERVIDOR).toContain('from "@/lib/comentarios"');
    expect(SERVIDOR).toContain("limparPalavrasOcultas(");
  });

  test("⚠️ NUNCA no que ELA escreveu", () => {
    /* Ela sabe o que digitou, e recolher o próprio post seria tratá-la como
       quem precisa ser protegida da própria decisão. */
    expect(SERVIDOR).toContain("p.autor_id !== eu && palavrasDela.length");
  });

  test("⚠️ a lista dela NUNCA viaja — o que chega é um booleano", () => {
    /* "perdi", "aborto", o nome de um hospital: mandá-las de volta a cada
       página do feed seria pôr na rede exatamente o que ela pediu para não ler. */
    expect(SERVIDOR).toContain("palavrasOcultas: string[]");
    expect(TELA).not.toContain("post.palavrasOcultas");
  });

  test("⚠️ e o véu é UM SÓ, com duas razões — o rótulo é o que muda", () => {
    const base = { souAAutora: false, revelado: false };
    expect(veuDoPost({ ...base, sensivel: true, batePalavra: false })).toBe("sensivel");
    expect(veuDoPost({ ...base, sensivel: false, batePalavra: true })).toBe("palavra");
    /* A marca da AUTORA vence: "Perda gestacional" diz O QUE é; "você escondeu
       uma palavra" diz apenas que existe motivo. */
    expect(veuDoPost({ ...base, sensivel: true, batePalavra: true })).toBe("sensivel");
    expect(veuDoPost({ ...base, sensivel: false, batePalavra: false })).toBeNull();
    /* A AUTORA nunca vê o próprio recolhido, por nenhuma das duas razões. */
    expect(
      veuDoPost({ sensivel: true, batePalavra: true, souAAutora: true, revelado: false }),
    ).toBeNull();
    expect(veuDoPost({ ...base, sensivel: true, batePalavra: true, revelado: true })).toBeNull();
  });

  test("⚠️ e o rótulo NÃO diz QUAL palavra", () => {
    /* Ela escondeu aquilo de propósito: escrever a palavra no rótulo entregaria
       exatamente o que o filtro existe para não entregar. */
    expect(TELA).toContain('razao === "palavra" ? "Escondido pelo seu filtro de palavras"');
  });
});

describe("⚠️ esconder o story de pessoas específicas", () => {
  const C = corpo(SERVIDOR, "export const esconderStoryDe");

  test("a âncora existe (senão o describe passa em vazio)", () => {
    expect(C.length).toBeGreaterThan(500);
  });

  test("⚠️ esconder de SI MESMA não existe", () => {
    /* Uma linha assim tiraria a fileira dela da tela dela. */
    expect(C).toContain('if (data.alvoId === eu) return { ok: false as const, motivo: "eu_mesma"');
  });

  test("⚠️ o portão do desfazer é `quem_id = eu`", () => {
    /* Sem ele, um id no corpo do pedido desfaria o esconder de OUTRA. */
    expect(C).toContain('.eq("quem_id", eu)');
    expect(C).toContain('.eq("escondido_id", data.alvoId)');
  });

  test("⚠️ quem escondeu de mim sai ANTES da leitura dos stories", () => {
    /**
     * Filtrar depois de ler traria a foto e a URL ASSINADA de um story que ela
     * escondeu de mim — o arquivo já teria saído do servidor, que é o defeito
     * exato que o véu do conteúdo sensível existe para não cometer.
     */
    const f = corpo(SERVIDOR, "export const storiesDoFeed");
    expect(f.indexOf("escondeuDeMim")).toBeLessThan(f.indexOf("storiesCrus(sb"));
    expect(f).toContain('.eq("escondido_id", eu)');
    /* E nem o esconder nem o bloqueio tiram a AUTORA da própria fileira. */
    expect(f).toContain("id === eu ||");
  });

  test("⚠️ e quem ela escondeu NÃO recebe o push do story", () => {
    /**
     * Ela escondeu o story da sogra; a sogra a favoritou. Sem este recorte o
     * push chegaria com o nome dela na tela de bloqueio da sogra, anunciando um
     * story que a sogra não pode abrir — o esconder falhando pelo caminho mais
     * visível possível.
     */
    const a = SERVIDOR.slice(SERVIDOR.indexOf("async function avisarQuemMeFavoritou"));
    const f = a.slice(0, a.indexOf("\n}"));
    expect(f).toContain('especie === "story"');
    expect(f).toContain("if (escondidos.has(id)) return;");
  });

  test("⚠️ e a lista de escondidos existe — senão é um beco sem saída", () => {
    /* Esconder é CALADO e a pessoa some da fileira: desfazer exigiria lembrar
       de quem foi. É o defeito que o bloqueio teve até ganhar a lista. */
    const l = corpo(SERVIDOR, "export const meusEscondidosDoStory");
    expect(l).toContain('motivo: "instavel"');
    expect(TELA).toContain('onde.t === "escondidos"');
  });
});

describe("⚠️ o push do story de favorita", () => {
  test("⚠️ é a MESMA função do post, e não uma cópia", () => {
    /* Duas versões divergiriam no primeiro conserto, com a divergência
       aparecendo como push chegando em quem bloqueou. */
    expect((SERVIDOR.match(/async function avisarQuemMeFavoritou/g) ?? []).length).toBe(1);
    expect(SERVIDOR).toContain('await avisarQuemMeFavoritou(sb, eu, camada, "story")');
  });

  test("⚠️ sai DEPOIS de gravar, e a camada `amigas` não avisa ninguém", () => {
    const p = corpo(SERVIDOR, "export const publicarStory");
    expect(p.indexOf("inserirDescendo")).toBeLessThan(p.indexOf("avisarQuemMeFavoritou"));
    const a = SERVIDOR.slice(SERVIDOR.indexOf("async function avisarQuemMeFavoritou"));
    expect(a.slice(0, 900)).toContain('if (visibilidade === "amigas") return;');
  });
});

describe("⚠️ o rascunho no servidor", () => {
  const C = corpo(SERVIDOR, "export const salvarRascunho");

  test("⚠️ rascunho vazio APAGA — nunca uma linha em branco", () => {
    /* Senão a próxima abertura ofereceria "você tinha um rascunho" para
       devolver nada. */
    expect(C).toContain("if (!texto) {");
    expect(C).toContain('.from("rede_rascunhos").delete().eq("autor_id", eu)');
  });

  test("⚠️ AS FOTOS ficam de fora", () => {
    /* Subir a foto de um rascunho poria no balde um arquivo que talvez nunca
       seja publicado, sem nada que o apague. */
    for (const proibido of ["imagem", "foto", "imagens"]) {
      expect(C.toLowerCase()).not.toContain(`${proibido}:`);
    }
  });

  test("⚠️ o do APARELHO vence — o do servidor só entra quando não há nenhum", () => {
    /**
     * O do servidor pode ser de meia hora atrás, escrito no outro celular;
     * sobrepô-lo ao que ela acabou de digitar aqui seria trocar o texto de
     * agora pelo de antes, sem ela pedir.
     */
    const i = TELA.indexOf("doAparelho = lerRascunho(");
    const bloco = TELA.slice(i, TELA.indexOf("}, [onde.t, euId]);", i));
    expect(bloco).toContain("if (doAparelho) return;");
    expect(bloco).toContain("meuRascunho({ data: { accessToken: t } })");
  });

  test("⚠️ e a falha do servidor NÃO fala com ela", () => {
    /* O texto já está guardado no aparelho e escrito na frente dela: um erro
       sobre uma rede de segurança faria ela achar que perdeu o que está vendo. */
    const i = TELA.indexOf("const { salvarRascunho } = await import");
    expect(i).toBeGreaterThan(-1);
    const bloco = TELA.slice(i - 400, i + 400);
    expect(bloco).not.toContain("toast.error");
  });
});

describe("⚠️ o desfecho da denúncia volta a quem denunciou", () => {
  const C = corpo(SERVIDOR, "export const meusDesfechos");

  test("⚠️ o recorte é `quem_id = eu` — e nada mais", () => {
    /* Sem ele, esta função devolveria os desfechos das denúncias de todo mundo. */
    expect(C).toContain('.eq("quem_id", eu)');
  });

  test("⚠️ NADA que volta nomeia a pessoa denunciada", () => {
    /**
     * Nem o nome, nem o id, nem o texto. Devolver quem foi transformaria a
     * denúncia num canal de confronto — e a denúncia é justamente o caminho de
     * quem NÃO quer confrontar. O `select` não pede: o que não é lido não vaza.
     */
    const sel = C.slice(C.indexOf(".select("), C.indexOf(")", C.indexOf(".select(")));
    expect(sel).not.toContain("alvo_id");
    expect(sel).not.toContain("trecho");
    expect(sel).not.toContain("quem_id");
  });

  test("⚠️ o desfecho é CATÁLOGO FECHADO", () => {
    /* Campo livre é onde alguém escreve o nome da denunciada, ou um detalhe do
       caso, num texto que volta para quem denunciou. */
    const r = corpo(SERVIDOR, "export const resolverDenunciaDaRede");
    expect(r).toContain('z.enum(["removido", "avisado", "sem_acao"])');
  });

  test("⚠️ e a coluna nova tem DEGRAU — resolver não pode parar de funcionar", () => {
    const r = corpo(SERVIDOR, "export const resolverDenunciaDaRede");
    expect(r).toContain("APLICAR_MAIS_DA_REDE.sql");
    expect(r).toContain("update({ resolvido_em: agora })");
  });
});

describe("⚠️ o link público da publicação", () => {
  const C = corpo(SERVIDOR, "export const linkPublicoDoPost");
  const P = corpo(SERVIDOR, "export const postPublicoPorCodigo");

  test("⚠️ o código é SORTEADO, e nunca o uuid do post", () => {
    /**
     * O uuid viaja em toda reação, todo salvo, toda marcação e toda linha da
     * caixa ♡: transformá-lo em endereço público faria qualquer pessoa que já o
     * tenha visto abrir a publicação FORA do app, sem conta, para sempre.
     */
    expect(C).toContain("codigoDaPublicacao()");
    expect(linkDaPublicacao("ABCDEFGHJK")).toBe("https://www.obstetrica.com.br/pub/ABCDEFGHJK");
    /* Dez caracteres num alfabeto de 32 ≈ 10^15 — um código curto seria
       varrível, e o conteúdo aqui é foto de barriga e de ultrassom. */
    expect(codigoDaPublicacao().length).toBe(10);
    expect(codigoDaPublicacaoLimpo("abcdefghjk")).toBe("ABCDEFGHJK");
    expect(codigoDaPublicacaoLimpo("ABC")).toBeNull();
    /* Sem `I`, `O`, `0` nem `1`: o código é lido em voz alta e digitado à mão. */
    for (const c of "IO01") expect(codigoDaPublicacao().includes(c)).toBe(false);
  });

  test("⚠️ sem código o link é `null`, e nunca um endereço quebrado", () => {
    /* Um link que abre "publicação indisponível" é pior que nenhum: ela manda
       para trinta pessoas antes de descobrir. */
    expect(linkDaPublicacao(null)).toBeNull();
    expect(linkDaPublicacao("")).toBeNull();
  });

  test("⚠️ SÓ a autora, SÓ camada `publico`, e nunca arquivado", () => {
    /* Um link para um post `amigas` seria a porta dos fundos da visibilidade. */
    expect(C).toContain("(post as any).autor_id !== eu");
    expect(C).toContain('(post as any).visibilidade !== "publico"');
    expect(C).toContain("(post as any).arquivado_em");
  });

  test("⚠️ e FECHAR é possível — um link que não se desfaz é um link que ela não abre", () => {
    expect(C).toContain("if (!data.abrir)");
    expect(C).toContain("update({ codigo_publico: null })");
  });

  test("⚠️ a LEITURA reconfere a camada — ela pode ter fechado depois", () => {
    /* O código continuaria gravado. */
    expect(P).toContain('(cru as any).visibilidade !== "publico"');
    expect(P).toContain("foraDaRede(dono)");
    expect(P).toContain('.is("arquivado_em", null)');
  });

  test("⚠️ UM `null` só para todos os motivos", () => {
    /* Distinguir contaria, a quem colou o link no grupo da família, que ali
       existe alguém. */
    expect((P.match(/post: null/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  test("⚠️ e a página não indexa, nem põe a legenda no cartão", () => {
    /* O cartão de prévia é COPIADO e fica no histórico da conversa muito depois
       de ela fechar o link. */
    const rota = readFileSync("src/routes/pub.$codigo.tsx", "utf8");
    expect(rota).toContain('{ name: "robots", content: "noindex" }');
    expect(rota).toContain('const titulo = "Uma publicação no Obstétrica"');
    const meta = rota.slice(rota.indexOf("function metaDaPublicacao"));
    expect(meta.slice(0, 800)).not.toContain("post.texto");
  });
});

describe("⚠️ o que eu reagi", () => {
  const C = corpo(SERVIDOR, "export const meusCurtidos");

  test("⚠️ é PRIVADA — não existe alvo", () => {
    /* Saber no que outra pessoa reagiu é uma leitura de comportamento que o app
       inteiro decidiu não ter. */
    expect(C).not.toContain("alvoId");
    expect(C).toContain('.eq("quem_id", eu)');
  });

  test("⚠️ passa pela régua de visibilidade DE NOVO", () => {
    /* Ela pode ter reagido e a autora ter fechado o perfil depois. Reação é
       marcador, não cópia. */
    expect(C).toContain("montarPosts(sb, eu, crus, ctx)");
    expect(C).toContain('.is("arquivado_em", null)');
  });

  test("⚠️ a ordem é a das REAÇÕES, e não a do banco", () => {
    /* `in()` devolve na ordem que quiser: sem isto a lista sairia embaralhada a
       cada abertura, e o que ela acabou de curtir não estaria no topo. */
    expect(C).toContain("const ordem = new Map(ids.map((id, n) => [id, n]))");
  });

  test("⚠️ falha vira ERRO, e nunca lista vazia", () => {
    expect(C).toContain('motivo: "instavel"');
  });
});

describe("⚠️ o SQL", () => {
  test("⚠️ colunas por ALTER, tabelas por CREATE IF NOT EXISTS", () => {
    /* Num `CREATE TABLE IF NOT EXISTS` de tabela que já existe, a coluna nova
       NUNCA nasce — e rodar de novo não conserta. */
    expect(SQL).toContain("ALTER TABLE public.rede_denuncias ADD COLUMN IF NOT EXISTS desfecho");
    expect(SQL).toContain("ALTER TABLE public.rede_posts ADD COLUMN IF NOT EXISTS codigo_publico");
    for (const bloco of SQL.split("CREATE TABLE").slice(1)) {
      const corpoDaTabela = bloco.slice(0, bloco.indexOf(");"));
      expect(corpoDaTabela).not.toContain("desfecho");
      expect(corpoDaTabela).not.toContain("codigo_publico");
    }
  });

  test("⚠️ as duas tabelas novas são REVOGADAS do `authenticated`", () => {
    /**
     * Sem policy e sem grant: quem lê é só o servidor. Uma policy de LINHA daria
     * à paciente a própria linha — e saber que ELA está na lista de alguém é
     * exatamente o que o esconder não pode contar.
     */
    expect(SQL).toContain("REVOKE ALL ON public.rede_story_escondido FROM anon, authenticated");
    expect(SQL).toContain("REVOKE ALL ON public.rede_rascunhos FROM anon, authenticated");
  });

  test("⚠️ o código público tem índice ÚNICO", () => {
    /* É ele que faz o recuo por colisão ter sentido. */
    expect(SQL).toContain("CREATE UNIQUE INDEX IF NOT EXISTS rede_posts_codigo_publico");
  });
});

/**
 * ⚠️ **O ⋯ DO PERFIL NÃO PODE SER GATEADO POR `bloquear`.**
 *
 * Ele era — e por isso "Story escondido de…", que é a lista sobre os MEUS
 * stories, morava dentro de um menu que só existe no perfil DOS OUTROS: no meu,
 * onde ela é oferecida, não havia ⋯ nenhum. Recurso escrito, testado, e
 * alcançável em zero telas.
 *
 * ⚠️ Nem `tsc`, nem o lint, nem `rede-tem-porta.test.ts` tinham como pegar: o
 * botão É renderizado no código — ele só nunca aparece onde é oferecido. Quem
 * pegou foi a bancada, aberta num navegador.
 *
 * ⚠️ **E a confirmação de BLOQUEIO continua exigindo `bloquear`** — abrir o
 * painel no meu próprio perfil não pode me oferecer bloquear a mim mesma.
 */
describe("⚠️ o menu ⋯ existe onde ele é oferecido", () => {
  const TELA = readFileSync("src/components/rede-instagram.tsx", "utf8");
  /** ⚠️ A prosa deste arquivo cita o que ele proíbe — some antes de procurar. */
  const semProsa = TELA.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "");

  test("o botão e o painel saem de `temOpcoes`, nunca de `bloquear`", () => {
    const botao = semProsa.slice(
      semProsa.indexOf('aria-label="Opções deste perfil"') - 400,
      semProsa.indexOf('aria-label="Opções deste perfil"'),
    );
    expect(botao).toContain("{temOpcoes && (");
    expect(botao).not.toContain("{bloquear && (");
    expect(semProsa).toContain("{confirmandoBloqueio && temOpcoes && (");
    expect(semProsa).not.toContain("{confirmandoBloqueio && bloquear && (");
  });

  test("`temOpcoes` conhece as opções que são MINHAS", () => {
    const i = semProsa.indexOf("const temOpcoes");
    expect(i).toBeGreaterThan(0);
    const corpo = semProsa.slice(i, semProsa.indexOf(");", i));
    // ⚠️ As duas do meu próprio perfil — se qualquer uma sair daqui, o ⋯
    // volta a não existir para ela.
    expect(corpo).toContain("aoAbrirEscondidos");
    expect(corpo).toContain("aoEsconderStory");
    expect(corpo).toContain("bloquear");
  });

  test("⚠️ a confirmação de bloqueio continua exigindo `bloquear`", () => {
    const i = semProsa.indexOf("{confirmandoBloqueio && temOpcoes && (");
    const corpo = semProsa.slice(i, i + 1600);
    const pergunta = corpo.indexOf("Bloquear {perfil.nome}?");
    expect(pergunta).toBeGreaterThan(0);
    // O `{bloquear && (` tem de vir ANTES da pergunta, e não depois.
    const portao = corpo.indexOf("{bloquear && (");
    expect(portao).toBeGreaterThan(0);
    expect(portao).toBeLessThan(pergunta);
  });

  test("⚠️ a lista de escondidos NÃO herda a explicação do BLOQUEIO", () => {
    // Quem está nela continua vendo o perfil e as publicações — perde só o
    // story. A frase padrão ("não vê você na Comunidade") mentiria.
    const i = semProsa.indexOf('titulo="Story escondido de"');
    expect(i).toBeGreaterThan(0);
    const corpo = semProsa.slice(i, i + 700);
    expect(corpo).toContain("explicacao=");
    expect(corpo).not.toContain("não vê você na Comunidade");
  });

  test("⚠️ a bancada passa as props, senão ela aprova a tela sem os controles", () => {
    const B = readFileSync("src/routes/preview-instagram.tsx", "utf8").replace(
      /\{?\/\*[\s\S]*?\*\/\}?/g,
      "",
    );
    // ⚠️ Fronteira de palavra, nunca `toContain`: `x_aoAbrirCurtidos=` contém
    // `aoAbrirCurtidos=`, e foi assim que uma mutação minha sobreviveu. É a
    // mesma armadilha de substring de `minhaColuna`/`minhaColunaDeLeitura`.
    for (const prop of ["aoAbrirCurtidos", "aoAbrirEscondidos", "aoEsconderStory", "aoFavoritar"])
      expect(B).toMatch(new RegExp("\\b" + prop + "=\\{"));
    // E as três telas novas têm rota própria na bancada.
    for (const t of ["escondidos", "curtidos", "desfechos"]) expect(B).toContain(`tela === "${t}"`);
  });
});

/**
 * ⚠️ A BARRINHA DO STORY NÃO MISTURA ATALHO COM LONGHAND.
 *
 * `animation` (atalho) e `animationPlayState` no MESMO objeto de estilo fazem o
 * React avisar — e o aviso é sobre um defeito real: numa repintura o atalho
 * REESCREVE o `animation-play-state`, e a barra volta a correr sozinha enquanto
 * o dedo a segura. Era exatamente o travamento que o comentário do bloco diz
 * impedir: a barra chega ao fim antes de a foto trocar.
 *
 * ⚠️ Achado varrendo a Comunidade com INTERAÇÃO (tocar nos controles), não só
 * com carga — a varredura de bancadas abre e lê o console, e este aviso só
 * aparece na REPINTURA que o toque provoca.
 */
describe("⚠️ a barrinha do story", () => {
  const T = readFileSync("src/components/rede-instagram.tsx", "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
  const i = T.indexOf("animationPlayState");
  const bloco = T.slice(Math.max(0, i - 700), i + 400);

  test("usa longhands, e nunca o atalho `animation`", () => {
    expect(i).toBeGreaterThan(0);
    expect(bloco).toContain("animationName:");
    expect(bloco).toContain("animationDuration:");
    expect(bloco).toContain("animationFillMode:");
    /* O atalho reescreveria o play-state na repintura. */
    expect(bloco).not.toMatch(/\n\s*animation:/);
  });

  test("⚠️ e o pausar continua ligado ao relógio", () => {
    expect(bloco).toContain('"paused"');
    expect(bloco).toContain("pausado");
  });
});
