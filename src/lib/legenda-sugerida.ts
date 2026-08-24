/**
 * A LEGENDA SUGERIDA PELA IA — a partir da foto que ela acabou de escolher.
 *
 * Pedido do dono (ideia 9 da lista): "escrever algo" é a tela onde mais gente
 * desiste de publicar, e o cérebro já está pago e já conhece a semana dela.
 *
 * ─── O QUE MORA AQUI, E POR QUÊ ────────────────────────────────────────────
 *
 * Só a RÉGUA: o texto do prompt e a leitura da resposta. O endpoint
 * (`/api/legenda-da-foto`) faz a rede, e a tela desenha. É a mesma divisão de
 * `gratidao.ts` e `frases-do-mascote.ts`, e pela mesma razão: o prompt é o que
 * o dono relê e corrige, e prompt enterrado num endpoint é prompt que ninguém
 * revisa.
 */

import { LIMITE_DO_TEXTO } from "./rede-social";
import { semanaPublica, type EntradaDoSelo } from "./selo-do-perfil";

/** Quantas opções a tela oferece. */
export const SUGESTOES_MAX = 3;

/**
 * O lado maior da foto MANDADA PARA A IA.
 *
 * ⚠️ **Menor que os 1080 que vão para o post, e de propósito.** Duas razões, e
 * a segunda importa mais: 1080 em JPEG 0,8 são ~300 KB de 4G dela por toque
 * num botão opcional; e, sobretudo, **quanto menos foto sai do aparelho,
 * melhor** — esta é uma foto de gestação, às vezes uma ultrassom. 512px bastam
 * de sobra para o modelo dizer o que está na imagem.
 */
export const LADO_PARA_A_IA = 512;

/** Teto do corpo aceito pelo endpoint. Depois da redução, sobra folga enorme. */
export const LIMITE_DA_FOTO_BYTES = 1_500_000;

/** O contexto que a tela sabe e o modelo não. */
export type ContextoDaLegenda = {
  /**
   * A FRASE da semana ("28 semanas"), já passada pela régua única — ou `null`
   * quando não há o que dizer.
   *
   * ⚠️ **É `string | null`, e não um número ao lado de um booleano, porque dois
   * campos que precisam concordar um dia discordam.** A primeira versão levava
   * `semana: number` + `mostrarSemana: boolean` e checava só a chave: passavam
   * pelo prompt a paciente que **já pariu** (`computeGestation` conta para
   * sempre — duas semanas depois do parto o modelo escrevia na voz de uma
   * grávida de 41 semanas) e a de DUM corrigida acima de 42. Os dois silêncios
   * existem em `semanaPublica` desde o primeiro dia; o que faltava era esta
   * tela CHAMAR a régua em vez de reescrever metade dela.
   */
  semana: string | null;
  /** Nome do bebê, se ela cadastrou. */
  nomeDoBebe: string | null;
};

/**
 * A linha do perfil vira o contexto do prompt.
 *
 * ⚠️ **A MESMA `semanaPublica` do selo e do carimbo do story.** É ela que cala
 * em Modo Cuidado, depois do parto, sem DUM, acima de 42 semanas e com a chave
 * desligada — e é por morar num lugar só que a legenda não pode discordar do
 * perfil. `entradaDoSelo` faz o mapeamento; aqui é só a leitura.
 *
 * ⚠️ **O nome do bebê tem chave PRÓPRIA** (`mostrarBebe`), e por isso não é
 * governado pela da semana: são duas decisões dela. Mas os silêncios de LUTO e
 * de PARTO valem para os dois — `seloDoPerfil` já cala o nome no Modo Cuidado,
 * e uma legenda na voz de quem espera um bebê que já nasceu é o mesmo defeito
 * com outra palavra.
 */
export function contextoDaLegenda(e: EntradaDoSelo): ContextoDaLegenda {
  const podeFalarDoBebe = !e.emCuidado && !e.nasceu && e.mostrarBebe;
  return {
    semana: semanaPublica(e),
    nomeDoBebe: podeFalarDoBebe ? e.nomeDoBebe?.trim() || null : null,
  };
}

/**
 * O PROMPT.
 *
 * ⚠️ **Três proibições que não são estilo — são o produto:**
 *
 * 1. **Nada clínico.** Nem "está tudo bem", nem "o bebê está saudável", nem
 *    tamanho, peso ou desenvolvimento. Uma legenda que afirma saúde a partir de
 *    uma FOTO é a coisa mais perigosa que este app poderia escrever, e o
 *    portão de `publicarPost` não é lugar de descobrir isso — a régua clínica
 *    roda ANTES de a sugestão ser oferecida (ver o endpoint).
 * 2. **Nada inventado.** Sem "primeira ultrassom", sem nome de hospital, sem
 *    "depois de tanto tempo esperando". O modelo não sabe nada disso, e uma
 *    legenda que erra a história dela é pior que campo vazio.
 * 3. **Sem hashtag.** Não existe hashtag neste app; sugerir uma ensinaria uma
 *    mecânica que a tela não tem.
 *
 * E três exigências de forma: primeira pessoa (é a voz DELA), curta (a legenda
 * vive embaixo da foto, não é um texto), e **três tons diferentes** — três
 * variações da mesma frase não são escolha nenhuma.
 */
export function promptDaLegenda(ctx: ContextoDaLegenda): string {
  const contexto: string[] = [];
  /* A semana já vem calada quando tem de vir — ver `contextoDaLegenda`. */
  if (ctx.semana) {
    contexto.push(`A pessoa está com ${ctx.semana} de gestação.`);
  }
  if (ctx.nomeDoBebe) contexto.push(`O bebê se chama ${ctx.nomeDoBebe}.`);

  return [
    "Você escreve legendas curtas para as fotos de uma gestante, na voz dela.",
    ...contexto,
    "",
    `Escreva ${SUGESTOES_MAX} legendas para a foto em anexo, uma por linha.`,
    "",
    "Regras:",
    "- Primeira pessoa, português do Brasil, tom natural e caloroso.",
    "- No máximo 120 caracteres cada.",
    "- Os três tons devem ser DIFERENTES entre si (por exemplo: afetivo, leve, direto).",
    "- NUNCA diga nada sobre saúde, desenvolvimento, tamanho, peso ou exame.",
    "- NUNCA afirme que está tudo bem nem tranquilize sobre o bebê.",
    "- NÃO invente fatos que a foto não mostra (ocasião, lugar, quem está junto).",
    "- Sem hashtag, sem aspas, sem numeração, sem markdown.",
    "- No máximo um emoji por legenda, e só se couber naturalmente.",
    "- Se a foto não tiver relação com gestação, escreva sobre o que ela mostra.",
    "",
    "Devolva SOMENTE as legendas, uma por linha.",
  ].join("\n");
}

/**
 * Lê a resposta do modelo e devolve as legendas limpas.
 *
 * ⚠️ **Tolerante de propósito.** Pedimos "uma por linha" e o modelo às vezes
 * numera, marca com traço, embrulha em aspas ou em bloco de código. Recusar
 * tudo isso devolveria lista vazia a quem tocou no botão — e a tela diria
 * "não consegui" sobre uma resposta perfeitamente boa.
 */
export function lerSugestoes(bruto: string): string[] {
  const vistas = new Set<string>();
  const saida: string[] = [];

  for (const linha of String(bruto ?? "").split("\n")) {
    const limpa = linha
      /* Cerca de bloco de código: some inteira. */
      .replace(/^```[a-z]*$|^```$/i, "")
      /* Marcador de lista ou numeração no começo. */
      .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")
      /* Aspas em volta da frase inteira. */
      .replace(/^\s*["'“”‘’]+|["'“”‘’]+\s*$/g, "")
      .trim();

    if (!limpa) continue;
    /* Uma legenda maior que o teto do post é uma legenda que ela não conseguiria
       publicar — e o botão não pode oferecer o que a tela recusa. */
    if (limpa.length > LIMITE_DO_TEXTO) continue;

    const chave = limpa.toLocaleLowerCase("pt-BR");
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    saida.push(limpa);
    if (saida.length >= SUGESTOES_MAX) break;
  }

  return saida;
}

/**
 * O texto que vai para o campo quando ela escolhe uma sugestão.
 *
 * ⚠️ **ACRESCENTA, nunca apaga.** É a mesma decisão da transcrição do diário: o
 * que volta é RASCUNHO, e apagar o que ela já tinha escrito por causa de um
 * toque num botão opcional é a pior troca possível. Com o campo vazio a
 * sugestão simplesmente vira o texto.
 */
export function aplicarSugestao(atual: string, sugestao: string): string {
  const base = atual.trim();
  if (!base) return sugestao;
  return `${base}\n${sugestao}`;
}
