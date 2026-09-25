import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { pedeSocorro, RESPOSTA_DO_SOCORRO } from "./socorro-na-nutricao";
import { triarTexto } from "./pergunta-clinica";
import { semComentarios } from "./sem-comentarios";

/**
 * ⚠️ A CONVERSA DA NUTRIÇÃO TEM CAMINHO DE SOCORRO.
 *
 * Era a única caixa de texto livre do app sem régua determinística nenhuma: a
 * segurança dela morava numa linha do prompt de sistema, ou seja, **a decisão
 * de mandar alguém procurar atendimento estava delegada a um modelo**.
 *
 * As razões de desenho estão em `socorro-na-nutricao.ts`. Aqui se cobra o que
 * quebraria em silêncio.
 */

/* As perguntas de nutrição de verdade — nenhuma pode acender. */
const NUTRICAO = [
  "posso comer sushi?",
  "quantos cafés eu posso tomar por dia?",
  "chá de camomila pode?",
  "estou com muito enjoo, o que eu como de manhã?",
  "vomitei o café da manhã hoje, o que faço?",
  "estou com azia toda noite, o que ajuda?",
  "minha glicemia deu 118, o que eu como?",
  "o médico passou ferro, posso tomar com café?",
  "estou com dor de cabeça de fome, o que belisco?",
  "posso tomar chá preto?",
  "amamentando, o que evito pra cólica do bebê?",
  "estou perdendo peso porque não consigo comer",
  "engordei 12 kg, está muito?",
  "estou com cãibra na perna, é falta de quê?",
];

/* As bandeiras — todas TÊM de acender, e nas formas em que ela escreve. */
const BANDEIRAS = [
  "estou sangrando",
  "estou com dor de cabeça forte e vendo pontinhos",
  "minha visão está embaçada desde ontem",
  "não paro de vomitar desde ontem",
  "o bebê não mexe desde ontem",
  "mexeu bem menos hoje",
  "perdi líquido agora de manhã",
  "minha pressão deu 16 por 10",
  "não quero mais viver",
];

const TAB = semComentarios(readFileSync("src/components/nutricao-tab.tsx", "utf8"));

/** O corpo de uma função, contando chaves — nunca uma janela de distância. */
function corpoDe(fonte: string, assinatura: string): string {
  const i = fonte.indexOf(assinatura);
  expect(i).toBeGreaterThan(-1);
  const j = fonte.indexOf("{", i + assinatura.length - 1);
  let n = 0;
  for (let k = j; k < fonte.length; k++) {
    if (fonte[k] === "{") n++;
    else if (fonte[k] === "}" && --n === 0) return fonte.slice(j, k + 1);
  }
  throw new Error(`corpo de ${assinatura} não fecha`);
}

describe("a régua do socorro", () => {
  test("as bandeiras acendem", () => {
    expect(BANDEIRAS.filter((t) => !pedeSocorro(t))).toEqual([]);
  });

  test("⚠️ e nenhuma pergunta de nutrição acende", () => {
    expect(NUTRICAO.filter((t) => pedeSocorro(t))).toEqual([]);
  });

  /**
   * ⚠️ O NÚMERO QUE DECIDIU A RÉGUA. `triarTexto` inteiro está CERTO para a
   * caixinha pública e seria desastroso aqui — ele acusa uma em cada cinco
   * perguntas de comida, e a paciente aprenderia em três dias que a aba não
   * responde. Se um dia alguém trocar a régua por `triarTexto`, este teste é o
   * que fica vermelho.
   */
  test("⚠️ `triarTexto` INTEIRO acusaria perguntas de comida — por isso não é ele", () => {
    const acusadas = NUTRICAO.filter((t) => triarTexto(t) !== "publicavel");
    expect(acusadas.length).toBeGreaterThanOrEqual(4);
    /* e a régua do socorro não acusa nenhuma dessas mesmas frases */
    expect(acusadas.filter((t) => pedeSocorro(t))).toEqual([]);
  });

  test("vazio não estoura e não acende", () => {
    expect(pedeSocorro("")).toBe(false);
    expect(pedeSocorro("   ")).toBe(false);
    expect(pedeSocorro(undefined as unknown as string)).toBe(false);
  });

  test("⚠️ `.test` não guarda estado — duas chamadas seguidas dão o mesmo", () => {
    /* Com a flag `g` nas regex de origem, a segunda daria `false`. */
    expect(pedeSocorro("estou sangrando")).toBe(true);
    expect(pedeSocorro("estou sangrando")).toBe(true);
  });

  test("a resposta não diagnostica e não tranquiliza", () => {
    const t = RESPOSTA_DO_SOCORRO.toLowerCase();
    for (const proibida of [
      "provavelmente não é nada",
      "deve ser normal",
      "fique calma",
      "não se preocupe",
      "pode ser só",
    ])
      expect(t).not.toContain(proibida);
    /* e ela DÁ o caminho */
    expect(t).toContain("192");
  });
});

describe("⚠️ o caminho no componente", () => {
  const send = corpoDe(TAB, "async function send(text?: string)");

  test("o socorro é decidido ANTES do `fetch` — e antes de tudo mais", () => {
    const iSocorro = send.indexOf("pedeSocorro(msg)");
    const iFetch = send.indexOf("fetch(");
    expect(iSocorro).toBeGreaterThan(-1);
    expect(iFetch).toBeGreaterThan(-1);
    expect(iSocorro).toBeLessThan(iFetch);
  });

  test("⚠️ e o ramo do socorro SAI — nada abaixo dele roda", () => {
    const ramo = send.slice(send.indexOf("pedeSocorro(msg)"), send.indexOf("const next"));
    expect(ramo).toContain("return");
    /* ⚠️ A CONSTANTE, e nunca uma segunda redação: duas versões do mesmo texto
       divergiriam no primeiro ajuste, e a que divergisse seria a que a paciente
       lê. É a mesma lei de `linkDeIndicacao` e de `nutricao-no-luto`. */
    expect(ramo).toContain("RESPOSTA_DO_SOCORRO");
    expect(ramo).not.toContain("192");
  });

  /**
   * ⚠️ A CONDIÇÃO DO PORTÃO É **SÓ A RÉGUA**, e este é o teste que morde a
   * família inteira de mutações.
   *
   * Os testes nomeados abaixo pegam `careMode` e `bloqueio` — e uma medição por
   * mutação mostrou que **`if (false && pedeSocorro(msg))` passava verde nos
   * dois**: neutralizar a guarda não acrescenta nenhuma das palavras que eles
   * procuram, e o caminho de socorro simplesmente deixa de existir. Aqui se
   * cobra a CONDIÇÃO inteira: um termo a mais, qualquer que seja, reprova.
   */
  test("⚠️ a condição do portão não tem NENHUM outro termo", () => {
    const i = send.indexOf("pedeSocorro(");
    const abre = send.lastIndexOf("if (", i);
    const fecha = send.indexOf(") {", i);
    expect(abre).toBeGreaterThan(-1);
    expect(fecha).toBeGreaterThan(abre);
    const condicao = send.slice(abre + 4, fecha).trim();
    expect(condicao).toMatch(/^pedeSocorro\([a-zA-Z]+\)$/);
  });

  test("⚠️ NÃO é gateado por Modo Cuidado nem pelo bloqueio do Premium", () => {
    const ate = send.slice(0, send.indexOf("pedeSocorro(msg)"));
    expect(ate).not.toContain("careMode");
    expect(ate).not.toContain("bloqueio");
    const ramo = send.slice(send.indexOf("pedeSocorro(msg)"), send.indexOf("const next"));
    expect(ramo).not.toContain("careMode");
    expect(ramo).not.toContain("bloqueio");
  });

  test("⚠️ o par do socorro NÃO entra no histórico que sobe", () => {
    const monta = send.slice(send.indexOf("const uiMessages"), send.indexOf("await supabase"));
    expect(monta).toMatch(/filter\(\(_, i\) => !socorros\.has\(i\)\)/);
  });

  test("⚠️ o 👎 não é oferecido na resposta do socorro", () => {
    /* Ele enfileira a pergunta para o médico ler DEPOIS — trocar socorro agora
       por leitura amanhã é o defeito que este portão impede. */
    expect(TAB).toContain('m.role === "assistant" && i > 0 && m.content && !socorro && (');
  });

  test("o 192 NÃO depende de `onAbrirSOS`", () => {
    const cartao = TAB.slice(TAB.indexOf("{socorro && ("), TAB.indexOf("{socorro && (") + 1800);
    const iBotao = cartao.indexOf("{onAbrirSOS && (");
    const iTel = cartao.indexOf('href="tel:192"');
    expect(iTel).toBeGreaterThan(-1);
    /* o telefone vive FORA do `&&` do botão: o bloco do botão fecha antes dele */
    expect(cartao.slice(iBotao, iTel)).toContain(")}");
  });

  test("a Central abre pela MESMA folha da barra, por prop", () => {
    const conta = semComentarios(readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8"));
    const mount = conta.slice(conta.indexOf("<NutricaoTab"), conta.indexOf("<NutricaoTab") + 1400);
    expect(mount).toContain("onAbrirSOS={() => setEmergencyOpen(true)}");
  });
});
