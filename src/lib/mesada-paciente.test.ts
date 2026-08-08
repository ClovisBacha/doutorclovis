/**
 * O BOLSO DA PACIENTE QUE ASSINA — e as torneiras que ele não pode abrir.
 *
 * ─── O QUE ESTÁ EM JOGO ─────────────────────────────────────────────────────
 *
 * Sementinha não custa dinheiro, então nenhum defeito aqui aparece na fatura.
 * O que ele quebra é a ECONOMIA: `economia-sementinhas.ts` calibra a loja
 * grátis para ser zerada por volta do 15º dia, e é essa parede — moeda no bolso
 * e nada grátis para comprar — que faz a assinatura acontecer.
 *
 * Moeda entrando de graça por fora derruba a parede em silêncio. Ninguém
 * reclama, nada dá erro, e a conversão some sem que exista um número mostrando
 * por quê. Por isso as travas daqui são de economia, não de segurança.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  CUSTO_LOJA_GRATIS,
  MESADA_DA_ASSINANTE,
  PRESENTE_ENTRE_AMIGAS,
  PRESENTE_SUGERIDO,
  mesadaDoMedico,
} from "./economia-sementinhas";
import { ENTRADA_MENSAGENS } from "./planos-medico";

const semComentarios = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const fns = semComentarios("src/lib/mesada-paciente.functions.ts");
const tela = semComentarios("src/components/presentear-amigas.tsx");
const conta = semComentarios("src/routes/_authenticated/minha-conta.tsx");

describe("1. o bolso não derruba a parede dos quinze dias", () => {
  test("uma amiga presenteada NÃO ganha a loja grátis inteira", () => {
    /* Se um presente pagasse os 704 🌱 da loja, a amiga pularia a caminhada e
       chegaria ao fim sem nunca ter sentido falta de nada — que é o oposto do
       que o desenho quer. */
    expect(PRESENTE_ENTRE_AMIGAS).toBeLessThan(CUSTO_LOJA_GRATIS);
  });

  test("nem o bolso INTEIRO, se ela desse tudo a uma só", () => {
    /* O servidor limita um presente por amiga por ciclo, mas a conta precisa
       fechar mesmo no pior arranjo imaginável. */
    expect(MESADA_DA_ASSINANTE).toBeLessThan(CUSTO_LOJA_GRATIS);
  });

  test("o bolso dá para poucas amigas, e isso é o desenho", () => {
    /* Três presentes. Um bolso que desse para vinte transformaria a assinante
       numa fonte de moeda para o app inteiro. */
    const quantas = Math.floor(MESADA_DA_ASSINANTE / PRESENTE_ENTRE_AMIGAS);
    expect(quantas).toBeGreaterThanOrEqual(2);
    expect(quantas).toBeLessThanOrEqual(4);
  });
});

describe("2. a hierarquia entre quem dá", () => {
  test("a assinante presenteia MENOS que o médico de entrada", () => {
    /**
     * Quem paga R$ 19,90 não pode distribuir mais que o profissional que
     * sustenta a conta dela. Se isso inverter, o presente do médico — que é o
     * argumento de venda do plano dele — vira o menor da tela.
     */
    expect(MESADA_DA_ASSINANTE).toBeLessThan(mesadaDoMedico(ENTRADA_MENSAGENS));
  });

  test("mas cada presente dela é MAIOR que o dele, e há razão", () => {
    /* Ele presenteia dezenas de pacientes; ela, duas ou três amigas. Um
       presente pequeno entre pessoas que se conhecem soa como não ter dado
       nada. */
    expect(PRESENTE_ENTRE_AMIGAS).toBeGreaterThan(PRESENTE_SUGERIDO);
  });
});

describe("3. as quatro travas do servidor", () => {
  test("só quem ela REALMENTE indicou", () => {
    /* `referred_by` é fixado uma vez e nunca reescrito. Aceitar um id vindo do
       cliente deixaria presentear qualquer pessoa do app. */
    expect(fns).toContain('.eq("referred_by", uid)');
    expect(fns).toContain('error: "nao_indicada"');
  });

  test("nunca a si mesma — seria uma torneira mensal", () => {
    /* Sem isto, o bolso do Premium vira saldo próprio todo mês, e a assinatura
       passa a se pagar em moeda. */
    expect(fns).toContain("data.amigaId === uid");
    expect(fns).toContain('error: "voce_mesma"');
  });

  test("o teto é conferido ANTES da escrita", () => {
    const i = fns.indexOf("export const presentearAmiga");
    const corpo = fns.slice(i);
    const checa = corpo.indexOf("mesada_esgotada");
    const grava = corpo.indexOf("grantSementinhas");
    expect(checa).toBeGreaterThan(-1);
    expect(checa).toBeLessThan(grava);
  });

  test("uma amiga por ciclo, com a chave carregando o mês", () => {
    expect(fns).toContain("`amiga:${uid}:${data.amigaId}:${ciclo}`");
  });

  test("e o livro-caixa NÃO é apagado para desfazer nada", () => {
    /* A migration diz, por escrito, "o saldo NUNCA zera, nada é deletado". A
       mesada do médico já tentou reverter com `.delete()` e o verificador
       mostrou que numa corrida isso apaga o presente ANTERIOR, já gasto. */
    expect(fns).not.toContain(".delete()");
  });
});

describe("4. o bolso só existe para quem assina", () => {
  test("sem Premium, não há bolso", () => {
    expect(fns).toContain('.select("quiz_premium")');
    expect(fns).toContain("SEM_BOLSO");
    expect(fns).toContain('error: "sem_premium"');
  });

  test("falha de leitura tira o bolso, nunca dá", () => {
    /* Errar para o lado de não presentear é chato; errar para o outro entrega
       o benefício do Premium a quem não assinou. */
    const i = fns.indexOf("export async function lerMesadaDaAmiga");
    const corpo = fns.slice(i, i + 900);
    expect(corpo).toContain("if (profErr || !prof?.quiz_premium) return SEM_BOLSO;");
  });

  test("e a leitura do gasto falhando zera o restante, não o enche", () => {
    const i = fns.indexOf("export async function lerMesadaDaAmiga");
    const corpo = fns.slice(i, i + 1600);
    expect(corpo).toContain("restante: 0");
  });
});

describe("5. Modo Cuidado vale para os dois lados", () => {
  test("quem RECEBE é conferido", () => {
    /* Presentear com moedinhas de decoração quem acabou de perder a gestação é
       o oposto do cuidado. */
    expect(fns).toContain("isCareModeActive(supabaseAdmin as never, data.amigaId)");
    expect(fns).toContain('error: "modo_cuidado"');
  });

  test("e a condição SAI quando é verdade, não o contrário", () => {
    /* A mutação mais grave que já passou verde nesta base foi inverter uma
       condição destas: o app pagava Sementinhas SÓ para quem tinha perdido o
       bebê. */
    expect(fns).not.toContain("!(await isCareModeActive");
  });
});

describe("6. a tela existe e conta a mesma história", () => {
  test("o cartão está montado no app da paciente", () => {
    /* `getMesada`/`presentearPaciente` do médico ficaram semanas sem chamador
       nenhum. Função sem botão é coluna gravada e nunca lida. */
    expect(conta).toContain("<PresentearAmigas />");
  });

  test("e chama as duas funções do servidor", () => {
    expect(tela).toContain("getMesadaDaAmiga");
    expect(tela).toContain("presentearAmiga");
  });

  test("some inteiro para quem não assina", () => {
    /* Um cartão cinza com cadeado ensina que existe algo que ela não pode ter,
       e a assinatura já tem vitrine própria — os 57 itens do Cantinho. */
    expect(tela).toContain("!mesada?.assinante) return null");
  });

  test("a recusa por Modo Cuidado NÃO conta nada sobre a amiga", () => {
    /**
     * ─── UMA MUTAÇÃO SOBREVIVEU AQUI, E ERA A PIOR DA NOITE ────────────────
     *
     * A frase era: "{nome} está passando por um momento delicado — o app não
     * envia presentes agora."
     *
     * Modo Cuidado é perda gestacional. Aquilo contava a UMA usuária a perda de
     * OUTRA, numa tela de presente, sem que ninguém tivesse escolhido contar —
     * e a amiga que lesse aquilo saberia exatamente o que aconteceu.
     *
     * Do lado do MÉDICO a frase explícita continua, e está certa: ele é o
     * obstetra dela, a informação é clínica e é dele por dever de ofício. Entre
     * amigas, não.
     *
     * O servidor precisa recusar; a tela não precisa explicar.
     */
    const i = tela.indexOf('res.error === "modo_cuidado"');
    expect(i).toBeGreaterThan(-1);
    /* A janela do ramo, até o ternário seguinte. */
    const ramo = tela.slice(i, tela.indexOf('res.error === "nao_indicada"', i));

    /* Só o TEXTO que ela lê — a condição do ramo contém a palavra "cuidado"
       por construção, e cobrar isso seria o teste batendo no próprio andaime
       em vez de na frase. */
    const frase = (ramo.match(/"([^"]{15,})"/) ?? ["", ""])[1].toLowerCase();
    expect(frase.length).toBeGreaterThan(15);
    expect(ramo).not.toContain("amiga.nome");
    for (const palavra of ["delicado", "momento", "perda", "luto", "gesta"]) {
      expect(frase).not.toContain(palavra);
    }
  });

  test("mas o MÉDICO continua vendo o motivo — é informação clínica dele", () => {
    const painel = semComentarios("src/components/mesada-do-medico.tsx");
    expect(painel).toContain("Modo Cuidado");
  });

  test("cada recusa tem frase própria", () => {
    for (const motivo of ["ja_presenteada", "mesada_esgotada", "modo_cuidado", "nao_indicada"]) {
      expect(tela).toContain(motivo);
    }
  });

  test("o valor do presente vem da fonte única, não digitado", () => {
    expect(tela).toContain("PRESENTE_ENTRE_AMIGAS");
    expect(tela).not.toMatch(/\b100 Sementinhas\b/);
  });
});
