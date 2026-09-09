/**
 * A FOTO NA NUTRIÇÃO — o prato e o rótulo.
 *
 * Duas ferramentas, um endpoint e um gesto só: abrir a câmera. O que muda
 * entre elas é o PROMPT, e é por isso que os dois moram aqui, em régua pura,
 * longe do JSX e do servidor: são o texto que decide o que o modelo pode
 * afirmar sobre a comida de uma gestante de alto risco.
 *
 * ─── ⚠️ O QUE ESTA RÉGUA PROÍBE, E POR QUÊ ─────────────────────────────────
 *
 *  1. **CALORIA, NUNCA.** `nutricao-perfil.ts` cola a instrução "NUNCA
 *     proponha restrição calórica" logo depois do número do ganho de peso,
 *     porque solta no prompt o modelo transforma "acima da faixa" num plano de
 *     emagrecimento. Uma ferramenta que devolve "este prato tem 620 kcal"
 *     seria a porta dos fundos daquela decisão: o número faz a conta sozinho
 *     na cabeça de quem lê.
 *  2. **VEREDITO SOBRE O PRATO, NUNCA.** "Este prato está ruim" é julgamento
 *     sobre uma refeição que ela já comeu — e a pergunta que o produto faz é
 *     "o que poderia melhorar na PRÓXIMA".
 *  3. **DIAGNÓSTICO, NUNCA.** Conduta é do médico; isto é orientação
 *     alimentar, como o resto da aba.
 *
 * ─── ⚠️ POR QUE O RÓTULO É FOTOGRAFADO, E NÃO CONSULTADO NUM CATÁLOGO ──────
 *
 * A primeira ideia era buscar o produto pelo NOME num catálogo aberto (Open
 * Food Facts) e mostrar ingredientes e números. Medido antes de construir, com
 * quatro produtos brasileiros de verdade:
 *
 *   · "Leite Moça" voltou com **4,66 g de açúcar por 100 g**. Leite condensado
 *     tem ~55 — e os dois concorrentes na MESMA lista diziam 55. Erro de 12×,
 *     numa linha escrita por um desconhecido.
 *   · "Requeijão Cremoso Gordura Reduzida" voltou com **sódio 0**, ao lado de
 *     um requeijão igual com 0,54.
 *   · "biscoito maisena" devolveu um biscoito de CHOCOLATE em primeiro lugar.
 *   · Uma das quatro consultas não devolveu JSON nenhum.
 *
 * Numa paciente com diabetes gestacional, "Leite Moça: 4,66 g de açúcar" não é
 * um dado ruim — é o app afirmando o contrário do que é verdade sobre o
 * produto mais açucarado da prateleira. E um aviso embaixo do número não
 * desfaz a leitura do número. Pior ainda para ALERGIA, que é o uso que mais
 * justificaria a ferramenta: uma lista de ingredientes desatualizada falha
 * justamente por OMISSÃO.
 *
 * A foto do rótulo não tem nenhum desses problemas: o dado vem da embalagem
 * que está na mão dela, com a formulação de agora, do país certo. É
 * estritamente melhor em todos os eixos, e custa o mesmo endpoint.
 */

import { ABERTURA_DO_LUTO, REGRAS_NO_LUTO } from "@/lib/nutricao-no-luto";

/** Os tipos que a câmera do celular produz, e os únicos que o modelo lê. */
export const IMAGEM_TIPOS = ["image/jpeg", "image/png", "image/webp"] as const;

export function ehImagemAceita(tipo: string | null | undefined): boolean {
  if (!tipo) return false;
  const base = tipo.split(";")[0].trim().toLowerCase();
  return (IMAGEM_TIPOS as readonly string[]).includes(base);
}

/**
 * ⚠️ O teto do SERVIDOR é folgado de propósito: a tela reduz para 1024px antes
 * de subir (~120 KB), e este número existe só para barrar um corpo montado à
 * mão. Apertá-lo até o tamanho esperado faria a ferramenta quebrar no aparelho
 * cuja câmera devolve um arquivo maior do que a redução previu.
 */
export const FOTO_BYTES_MAX = 4 * 1024 * 1024;

/**
 * O lado maior da imagem que sobe.
 *
 * ⚠️ 1024, e não os 512 da legenda sugerida: ali o modelo descreve uma cena;
 * aqui ele precisa LER a tabela nutricional de um rótulo, que é texto miúdo. A
 * 512 a leitura falha — e uma leitura de rótulo que erra o número é o defeito
 * que esta ferramenta existe para não ter.
 */
export const FOTO_LADO_MAX = 1024;

export type AssuntoDaFoto = "prato" | "rotulo";

/** O que a tela escreve na conversa no lugar da foto. */
export function tituloDaFoto(assunto: AssuntoDaFoto): string {
  return assunto === "prato" ? "📷 Foto do meu prato" : "📷 Foto de um rótulo";
}

/**
 * ⚠️ `careMode` DECIDE A ÚLTIMA LINHA, e é por isso que ele é PARÂMETRO e não
 * um `if` num canto: a linha do "JÁ TEVE O BEBÊ" fala de amamentação e de
 * estar grávida — as duas coisas que `REGRAS_NO_LUTO` proíbe. Sem a troca, a
 * paciente em luto recebia a instrução de falar do pós-parto dela.
 */
function comum(careMode: boolean): string {
  return [
    "Você é a nutricionista deste app, falando com a paciente em português do Brasil.",
    ...(careMode ? [ABERTURA_DO_LUTO] : []),
    "Regras absolutas:",
    /* ⚠️ As três proibições do cabeçalho, escritas para o modelo. */
    "- NUNCA estime calorias, e não fale em emagrecer, cortar, dieta, déficit ou restrição.",
    "- NUNCA dê diagnóstico nem prescreva dose de nada: isso é do médico dela.",
    "- Não julgue o que ela comeu. Ninguém precisa de nota pela refeição de ontem.",
    "- Frases curtas, tom de quem está do lado dela. Sem markdown pesado, sem tabela.",
    "- Se a foto não mostrar o que foi pedido, diga isso em uma linha e peça outra foto.",
    ...(careMode
      ? REGRAS_NO_LUTO
      : [
          "- Se o que você sabe dela disser que ela JÁ TEVE O BEBÊ, fale para o pós-parto (e para a amamentação só se ela amamentar), nunca como se ainda estivesse grávida.",
        ]),
  ].join("\n");
}

/**
 * ⚠️ O PRATO PERGUNTA PELA PRÓXIMA REFEIÇÃO, e não pela que está na foto.
 * "O que faltou aqui" lê como cobrança sobre uma comida que ela já comeu; "o
 * que deixaria a próxima melhor" é a mesma informação virada para a frente.
 */
export function promptDoPrato(careMode: boolean): string {
  return [
    comum(careMode),
    "",
    "A paciente fotografou o prato dela. Faça, nesta ordem:",
    "1. Diga em uma frase o que você está vendo no prato.",
    "2. Aponte o que já está bom ali — sempre há alguma coisa.",
    "3. Sugira ATÉ DUAS coisas que deixariam a PRÓXIMA refeição melhor, com alimentos comuns e baratos. Nunca mais de duas.",
    "4. Se algo no prato exigir cuidado pelo que você sabe dela (alergia, orientação do médico), diga em uma linha, com calma.",
  ].join("\n");
}

/**
 * ⚠️ O RÓTULO LÊ, NUNCA DECIDE. "Pode comer isto?" é a pergunta da ferramenta
 * `Posso comer?`, que passa pela conversa inteira com o histórico dela. Aqui a
 * resposta é o que ESTÁ ESCRITO na embalagem, mais o que daquilo importa para
 * ela — um veredito sobre o produto inteiro seria prescrição a partir de uma
 * foto, e ela pode ter fotografado só metade do rótulo.
 */
export function promptDoRotulo(careMode: boolean): string {
  return [
    comum(careMode),
    "",
    "A paciente fotografou o rótulo de um produto. Faça, nesta ordem:",
    "1. Diga qual produto parece ser, se der para ver.",
    "2. Liste os ingredientes que aparecem na foto e que importam para ela — em especial os que batem com alguma alergia ou restrição que você conheça dela. Se houver um, diga ISSO PRIMEIRO e com todas as letras.",
    "3. Comente no máximo dois pontos da tabela nutricional que a foto mostrar (por exemplo sódio ou açúcar altos), sempre citando o valor que está escrito na embalagem.",
    "4. Termine dizendo que você leu o que aparece na foto, e que a embalagem na mão dela é a fonte.",
    "",
    "NUNCA diga simplesmente 'pode comer' ou 'não pode comer' sobre o produto inteiro.",
    "Se algum número estiver ilegível na foto, diga que não deu para ler — nunca chute um valor.",
  ].join("\n");
}

export function promptDaFoto(assunto: AssuntoDaFoto, careMode: boolean): string {
  return assunto === "prato" ? promptDoPrato(careMode) : promptDoRotulo(careMode);
}
