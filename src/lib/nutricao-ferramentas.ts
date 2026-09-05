/**
 * AS FERRAMENTAS DA NUTRICIONISTA — as perguntas que só ela recebe.
 *
 * Pedido do dono: a Nutrição estava "muito vibe codado" — um chat genérico com
 * quatro chips. O que separa uma nutricionista de um chat é o que se pergunta a
 * ela, e as três perguntas mais frequentes da gestação têm FORMA fixa:
 *
 *   "posso comer X?"      → a de segurança alimentar (sushi, queijo, café…)
 *   "o que eu como agora?" → a do prato da próxima refeição
 *   "estou com enjoo"      → a do alívio por alimentação
 *
 * As três viram botões que MONTAM a pergunta e a mandam para a MESMA conversa.
 * Nada aqui responde: quem responde é `/api/nutrition`, com a régua de Modo
 * Cuidado e a cota de sempre. O que este arquivo faz é escrever a pergunta
 * direito — e é por isso que ele é puro e testado.
 *
 * ⚠️ EM MODO CUIDADO NENHUM MODELO DIZ "GESTAÇÃO". A ferramenta continua
 * existindo (comer bem é dela, não do bebê), mas a frase que ela manda não
 * pode carregar a palavra que o Modo Cuidado existe para calar. Há teste.
 */

export const REFEICOES = ["Café da manhã", "Almoço", "Lanche", "Jantar"] as const;
export type Refeicao = (typeof REFEICOES)[number];

/** Rótulo do chip e a forma que entra na frase ("estou com sem apetite" não existe). */
export const ALIVIOS = [
  { rotulo: "Enjoo", frase: "enjoo" },
  { rotulo: "Azia", frase: "azia" },
  { rotulo: "Prisão de ventre", frase: "prisão de ventre" },
  { rotulo: "Sem apetite", frase: "pouco apetite" },
  { rotulo: "Vontade de doce", frase: "muita vontade de doce" },
] as const;

/** O que ela digita em "Posso comer?" entra numa frase — limpo e curto. */
export const ALIMENTO_MAX = 60;
export function limparAlimento(texto: string): string | null {
  const t = texto.replace(/\s+/g, " ").trim().slice(0, ALIMENTO_MAX);
  return t.length >= 2 ? t : null;
}

export function perguntaPossoComer(alimento: string, careMode: boolean): string {
  const onde = careMode ? "" : " na gestação";
  return `Posso comer ${alimento}${onde}? Se sim, como preparar e com que frequência; se não, por quê e o que colocar no lugar.`;
}

export function perguntaDoPrato(refeicao: Refeicao): string {
  return `Monte um ${refeicao.toLowerCase()} equilibrado para mim hoje, com as porções e uma opção simples de preparar.`;
}

export function perguntaDeAlivio(frase: string): string {
  return `Estou com ${frase}. O que comer e o que evitar para aliviar, e como distribuir as refeições ao longo do dia?`;
}

/* ─── A ÁGUA DO DIA ─────────────────────────────────────────────────────────
   Um contador, não uma meta clínica: 8 copos (~2 litros) é REFERÊNCIA, e a
   tela diz isso. Vive no `localStorage` do aparelho, UMA chave por dia local.
   ⚠️ Chave `dc-agua:`, NUNCA `dc-path-`: essa viaja no blob da jornada e
   dispara um push por escrita — oito toques por dia virariam oito pushes. E
   as chaves de outros dias são apagadas a cada escrita: neste app, estourar a
   cota do `localStorage` derruba a PRÓXIMA gravação de qualquer coisa. */
export const META_COPOS = 8;
export const PREFIXO_AGUA = "dc-agua:";
export function chaveDaAgua(diaLocal: string): string {
  return `${PREFIXO_AGUA}${diaLocal}`;
}
export function chavesDeAguaVencidas(chaves: readonly string[], diaLocal: string): string[] {
  const deHoje = chaveDaAgua(diaLocal);
  return chaves.filter((k) => k.startsWith(PREFIXO_AGUA) && k !== deHoje);
}
