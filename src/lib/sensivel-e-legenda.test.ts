/**
 * O aviso de conteúdo sensível e a legenda do vídeo, ligados de ponta a ponta.
 *
 * A régua tem teste próprio (`conteudo-sensivel.test.ts`); aqui é a CORRENTE —
 * a parte que só ler o código inteiro pega, e que já falhou duas vezes nesta
 * base (o seletor de comentários e a lista de conversas fixadas).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const semProsa = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const TELA = semProsa(readFileSync("src/components/rede-instagram.tsx", "utf8"));
const SERV = semProsa(readFileSync("src/lib/rede-social.functions.ts", "utf8"));
const SQL = readFileSync("supabase/APLICAR_NOVE_DA_REDE.sql", "utf8");

describe("a corrente do conteúdo sensível", () => {
  test("o compositor manda, o servidor grava, a leitura devolve", () => {
    expect(TELA).toContain("sensivel,");
    expect(SERV).toContain("sensivel: !!data.sensivel");
    expect(SERV).toContain("sensivel: !!p.sensivel");
  });

  test("⚠️ a TELA decide borrar pela régua, nunca por um `if` local", () => {
    /**
     * Uma segunda régua faria a autora ver o próprio post borrado, ou um post
     * não marcado borrar — os dois defeitos que `deveBorrar` existe para
     * impedir.
     */
    expect(TELA).toContain("deveBorrar({");
    expect(TELA).toMatch(/souAAutora: !!post\.souAAutora/);
  });

  test("⚠️ o TEXTO também entra no véu, não só a mídia", () => {
    /**
     * Numa publicação sobre uma perda é a LEGENDA que carrega a notícia —
     * borrar a foto e deixar a frase à mostra entregaria exatamente o que o
     * aviso existe para poupar.
     */
    const i = TELA.indexOf("{post.texto && (");
    const bloco = TELA.slice(i, i + 900);
    expect(bloco).toContain("borrar ?");
    expect(bloco).toContain("toque para ler");
  });

  test("⚠️ o NOME de quem publicou fica FORA do véu", () => {
    /* Quem publicou não é a parte sensível, e esconder faria o post parecer
       anônimo. */
    const i = TELA.indexOf("{post.texto && (");
    const bloco = TELA.slice(i, i + 900);
    const nome = bloco.indexOf("{post.autorNome}");
    const veu = bloco.indexOf("borrar ?");
    expect(nome).toBeGreaterThan(0);
    expect(nome).toBeLessThan(veu);
  });

  test("⚠️ sob o véu NÃO há imagem no DOM — nem borrada", () => {
    /**
     * Borrar a foto de verdade com CSS ainda a BAIXA e a deixa no DOM: quem
     * quisesse a leria pelo inspetor, e o 4G dela pagaria por uma foto que ela
     * decidiu não ver. A garantia é que o ramo borrado NÃO monte o carrossel.
     */
    const i = TELA.indexOf("{post.imagemUrl && !post.videoUrl && borrar ?");
    expect(i).toBeGreaterThan(0);
    const ramo = TELA.slice(i, TELA.indexOf(") : null}", i));
    expect(ramo).not.toContain("<Carrossel");
    expect(ramo).not.toContain("post.imagemUrl}");
    /* E do mesmo tamanho: revelar não pode empurrar o feed e fazer ela perder
       o lugar onde estava lendo. */
    expect(ramo).toContain("aspect-[4/5]");
  });

  test("⚠️ e o vídeo sob o véu também não é montado", () => {
    const i = TELA.indexOf("{post.videoUrl &&");
    const ramo = TELA.slice(i, i + 400);
    expect(ramo).toContain("borrar ? (");
    const antesDoVideo = ramo.slice(0, ramo.indexOf("<video"));
    expect(antesDoVideo).toContain("<Sensivel");
  });

  test("⚠️ o motivo só é gravado com a marca LIGADA", () => {
    /* Senão fica um rótulo pendurado num post que não borra. */
    expect(SERV).toMatch(/motivo_sensivel: data\.sensivel \?/);
    expect(TELA).toMatch(/motivoSensivel: sensivel \?/);
  });

  test("⚠️ o motivo é catálogo fechado NA TELA também", () => {
    /* Um campo livre aqui vira o lugar onde alguém escreve o diagnóstico de
       outra pessoa. */
    expect(TELA).toContain("MOTIVOS_SENSIVEIS.map(");
    const i = TELA.indexOf("Marcar como conteúdo sensível");
    expect(TELA.slice(i - 900, i + 1400)).not.toMatch(/placeholder="[^"]*motivo/i);
  });

  test("⚠️ e o app NÃO marca sozinho — nada liga `sensivel` fora do toque dela", () => {
    /**
     * Marcar o que a régua clínica reconhece, ou todo post de quem está em
     * luto, seria o app decidindo que a história dela é sensível — e o segundo
     * contaria o luto dela para quem visse a marca.
     */
    expect(SERV).not.toMatch(/sensivel:\s*(true|desfecho|careMode|!!perfil)/);
    expect(TELA).not.toMatch(/setSensivel\((true|careMode)\)/);
  });
});

describe("a legenda do vídeo", () => {
  test("a corrente inteira existe", () => {
    expect(TELA).toContain("videoLegenda");
    expect(SERV).toContain("video_legenda: data.videoLegenda");
    expect(SERV).toContain("videoLegenda: ((p.video_legenda");
  });

  test("⚠️ é TEXTO no banco, e não um arquivo no balde", () => {
    /* Um `.vtt` exigiria segundo upload, segunda URL assinada e segunda
       varredura na exclusão de conta — três superfícies para uma frase. */
    expect(SQL).toContain("video_legenda text");
    expect(TELA).not.toMatch(/\.vtt|<track\s/);
  });

  test("⚠️ o campo só aparece com VÍDEO escolhido", () => {
    /* Um campo de legenda ao lado de uma foto promete o que o elemento não
       entrega — a mesma razão da descrição da foto. */
    expect(TELA).toContain("{temVideo && (");
  });

  test("⚠️ a legenda fica ABAIXO do vídeo, não sobreposta", () => {
    /* Sobreposta, ela cobre o centro do quadro — que num vídeo de barriga é o
       assunto. */
    const i = TELA.indexOf("{post.videoLegenda && (");
    expect(i).toBeGreaterThan(0);
    expect(TELA.slice(i, i + 300)).not.toContain("absolute");
  });
});

describe("o ciclo do carimbo", () => {
  test("⚠️ a expressão é UMA — a mesma do ledger", () => {
    /**
     * O CLAUDE.md já dizia: "se divergir, a contagem procura um ciclo que nunca
     * foi gravado e devolve zero". Nas memórias a divergência é pior: a foto de
     * uma gestação anterior voltaria como memória da de agora.
     */
    const SEM = semProsa(readFileSync("src/lib/sementinhas.functions.ts", "utf8"));
    expect(SEM).toContain("cicloDoPerfil(p)");
    expect(SEM).toContain('from "./ciclo-da-gestacao"');
    expect(SERV).toContain("cicloParaCarimbo(");
  });

  test("⚠️ falha ao ler o ciclo NÃO derruba a publicação", () => {
    const i = SERV.indexOf("let cicloDaPaciente");
    const bloco = SERV.slice(i, i + 700);
    expect(bloco).toContain("try {");
    expect(bloco).toContain("catch");
  });
});
