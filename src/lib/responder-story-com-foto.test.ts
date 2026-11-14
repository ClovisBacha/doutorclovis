import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * ⚠️ **RESPONDER O STORY COM FOTO — o caminho existia inteiro e faltava a
 * tela.**
 *
 * A resposta ao story já era uma mensagem do direct, e a mensagem do direct já
 * aceitava foto (`imagemPath`). O visor mandava só texto: o seletor nunca foi
 * ligado. É a mesma família das sete funções de servidor que ficaram sem porta —
 * metade de um recurso funcionando e a outra metade sem como ser tocada.
 *
 * ⚠️ **ESTE ARQUIVO NÃO APAGA OS COMENTÁRIOS**, e a razão está medida em
 * `story-com-video.test.ts`: num `.tsx` os dois jeitos de fazer isso quebram
 * (`accept="image/*"` tem `/*` dentro de string; aspas aparecem como TEXTO em
 * JSX). O que serve é ancorar em texto que só existe no CÓDIGO — e por isso só
 * há asserção POSITIVA aqui.
 */
const TELA = readFileSync("src/components/rede-instagram.tsx", "utf8");
const CONVERSA = readFileSync("src/components/rede-conversa.tsx", "utf8");

const VISOR = (() => {
  const i = TELA.indexOf("export function VisorDeStory");
  return TELA.slice(i, TELA.indexOf("\nexport function ", i + 10));
})();

const RESPONDER = (() => {
  const i = TELA.indexOf("async function responderAoStory(");
  return TELA.slice(i, TELA.indexOf("\n  }", i));
})();

describe("⚠️ a foto sobe pelo caminho da CONVERSA, e não por um segundo", () => {
  test("as âncoras existem (senão o arquivo passa em vazio)", () => {
    expect(VISOR.length).toBeGreaterThan(2000);
    expect(RESPONDER.length).toBeGreaterThan(500);
  });

  test("⚠️ `subirFoto` é EXPORTADA e reusada — nunca uma cópia", () => {
    /* Uma segunda função de subir foto divergiria desta no primeiro ajuste, e a
       divergência apareceria como a foto indo para a PASTA errada — que é a
       trava que faz `fotoEhDeQuemMandou` valer alguma coisa. */
    expect(CONVERSA).toContain("export async function subirFoto(");
    expect(TELA).toContain('subirFoto } from "@/components/rede-conversa"');
    expect(RESPONDER).toContain("await subirFoto(t, abriu.id, foto)");
  });

  test("⚠️ ela sobe DEPOIS de a conversa existir", () => {
    /* O caminho no balde é conferido contra a conversa (`minhaConversa`): sem o
       id não há como pedir a URL assinada. */
    expect(RESPONDER.indexOf("abrirConversa(")).toBeLessThan(RESPONDER.indexOf("subirFoto("));
  });

  test("⚠️ foto que não sobe NÃO derruba a mensagem", () => {
    /* Perder o texto que ela escreveu por causa do anexo seria o pior desfecho,
       e o story some em 24 h. */
    const i = RESPONDER.indexOf("if (foto) {");
    const bloco = RESPONDER.slice(i, RESPONDER.indexOf("enviarMensagem", i));
    expect(bloco).toContain("else toast.error(");
    expect(bloco).not.toContain("return;");
  });

  test("⚠️ e o `imagemPath` chega ao servidor", () => {
    expect(RESPONDER).toContain("imagemPath,");
    /* Com o story anexado, que é o que dá contexto à conversa. */
    expect(RESPONDER).toContain('refTipo: "story"');
  });
});

describe("⚠️ o visor: a prévia, e o relógio", () => {
  test("⚠️ a PRÉVIA é obrigatória, e dá para desistir", () => {
    /* Sem ela, escolher a foto mandaria a mensagem às cegas: ela não veria o
       que anexou e não teria como voltar atrás. */
    expect(VISOR).toContain("Vai junto com a sua resposta");
    expect(VISOR).toContain('aria-label="Tirar a foto da resposta"');
    expect(VISOR).toContain("onClick={() => setFotoDaResposta(null)}");
    /* ⚠️ **`alt` NUNCA VAZIO.** `alt=""` faz o leitor de tela PULAR a imagem:
       quem navega assim não saberia que existe um anexo pendurado na resposta
       que está prestes a mandar. É a mesma regra do `alt` do post, e a mutação
       que esvaziava este passou verde na primeira versão deste teste. */
    expect(VISOR).toContain('alt="A foto que vai junto com a sua resposta"');
  });

  test("⚠️ o endereço local é REVOGADO", () => {
    /* Sem `revokeObjectURL` cada foto trocada deixa o arquivo inteiro preso na
       memória da aba até ela fechar o app — e numa fileira ela troca várias. */
    const i = VISOR.indexOf("const url = URL.createObjectURL(fotoDaResposta)");
    expect(i).toBeGreaterThan(-1);
    expect(VISOR.slice(i, i + 300)).toContain("URL.revokeObjectURL(url)");
  });

  test("⚠️ ANEXAR PARA O STORY — o relógio e a barrinha", () => {
    /**
     * ⚠️ Sem isto o story avança enquanto ela olha a prévia, e a foto sairia
     * grudada num story que ela já não está vendo: o `refId` da mensagem
     * apontaria para outra coisa, para sempre. Mesma razão da enquete e da
     * folha de "visto por".
     */
    const efeito = VISOR.slice(VISOR.indexOf("const enqueteEsperando"));
    const guarda = efeito.slice(0, efeito.indexOf("const duracao"));
    expect(guarda).toContain("fotoDaResposta");
    /* E a barrinha congela junto: correndo sozinha ela chega ao fim antes de a
       foto trocar, que lê como travamento. */
    const barra = VISOR.slice(VISOR.indexOf("animationPlayState:"));
    expect(barra.slice(0, 220)).toContain("fotoDaResposta");
  });

  test("⚠️ trocar de story LARGA a foto", () => {
    /* Ela a escolheu para AQUELE story: mantê-la faria o anexo seguir para o
       próximo. */
    const i = VISOR.indexOf("setDuracaoDoVideo(null);");
    expect(VISOR.slice(i, i + 400)).toContain("setFotoDaResposta(null)");
  });

  test("⚠️ a FOTO SOZINHA já é mensagem", () => {
    /* O servidor aceita corpo só com imagem (`temCorpo`). Exigir texto faria o
       anexo virar enfeite de uma frase obrigatória. */
    expect(VISOR).toContain("disabled={!resposta.trim() && !fotoDaResposta}");
    expect(VISOR).toContain("if (!t && !f) return;");
  });

  test("⚠️ o ícone é DESENHADO, e não 📷", () => {
    /* Emoji tem cor própria em cada sistema, e este fica sobre a foto de outra
       pessoa. Mesma lição do 📞, do 📅 e do pino. */
    const i = VISOR.indexOf('aria-label="Anexar uma foto à resposta"');
    expect(i).toBeGreaterThan(-1);
    expect(VISOR.slice(i, i + 900)).toContain("<svg");
  });

  test("⚠️ os três controles da barra têm alvo de 44px", () => {
    /* Medido no navegador a 393px: campo 231×44, Enviar 74×44, anexar 44×44. Os
       dois primeiros JÁ estavam em 40 antes deste recurso. */
    const i = VISOR.indexOf('aria-label="Anexar uma foto à resposta"');
    const barra = VISOR.slice(i, i + 3000);
    expect(barra).toContain("h-11 w-11 shrink-0");
    expect(barra).toContain("min-h-[44px] flex-1");
    expect(barra).toContain("press min-h-[44px] shrink-0");
  });
});
