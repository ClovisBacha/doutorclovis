/**
 * O AVISO DE CONTEÚDO SENSÍVEL.
 *
 * ⚠️ **QUEM MARCA É QUEM PUBLICA, e isso é o recurso inteiro.**
 *
 * O filtro de palavras já existe e resolve outro problema: ele exige que a
 * paciente ADIVINHE a palavra antes de doer. Funciona para quem já sabe o que
 * não aguenta ler — e não faz nada pela mulher que rola o feed às três da manhã
 * e encontra, sem aviso, o relato de uma perda.
 *
 * Aqui a proteção vem de quem escreveu, que é a única pessoa que sabe o que o
 * texto carrega. E ela protege OS DOIS LADOS: quem publica sobre uma perda
 * quase nunca quer emboscar ninguém.
 *
 * ⚠️ **NUNCA ESCONDE, e essa é a diferença que importa.** Esconder seria o app
 * decidindo que aquilo não deve ser lido — e a experiência de quem perdeu uma
 * gestação é exatamente o que esta comunidade não pode calar. O que ele faz é
 * dar UM SEGUNDO para a leitora decidir.
 */

/**
 * Os motivos que a autora pode marcar.
 *
 * ⚠️ **CATÁLOGO FECHADO, nunca campo livre.** Um campo aberto aqui vira o lugar
 * onde alguém escreve o diagnóstico de outra pessoa, ou o detalhe que o aviso
 * existia para poupar. E o rótulo é o que a leitora lê ANTES de decidir: ele
 * precisa dizer o assunto sem contar a história.
 */
export const MOTIVOS_SENSIVEIS = [
  { id: "perda", rotulo: "Perda gestacional" },
  { id: "internacao", rotulo: "Internação ou emergência" },
  { id: "procedimento", rotulo: "Procedimento ou cirurgia" },
  { id: "sangue", rotulo: "Imagem forte" },
] as const;

export type MotivoSensivel = (typeof MOTIVOS_SENSIVEIS)[number]["id"];

/** O rótulo do motivo, ou o genérico. Nunca devolve string vazia. */
export function rotuloDoMotivo(id: string | null | undefined): string {
  return MOTIVOS_SENSIVEIS.find((m) => m.id === id)?.rotulo ?? "Conteúdo sensível";
}

/**
 * A leitora deve ver o aviso em vez do conteúdo?
 *
 * ⚠️ **A AUTORA NUNCA VÊ O PRÓPRIO POST BORRADO.** Ela sabe o que escreveu, e
 * borrar a publicação dela seria o app tratando-a como quem precisa ser
 * protegida do que ela mesma decidiu contar. É a mesma razão pela qual o filtro
 * de palavras não se aplica ao que EU escrevi.
 *
 * ⚠️ **E "revelado" é POR LEITURA, nunca gravado.** Guardar que ela já revelou
 * faria o aviso valer uma vez só — e o segundo encontro com o mesmo post, numa
 * noite pior, chegaria sem aviso nenhum.
 */
export function deveBorrar(entrada: {
  sensivel: boolean;
  souAAutora: boolean;
  revelado: boolean;
}): boolean {
  if (!entrada.sensivel) return false;
  if (entrada.souAAutora) return false;
  return !entrada.revelado;
}

/**
 * ⚠️ **O MODO CUIDADO NÃO MARCA NADA SOZINHO.**
 *
 * A tentação é marcar automaticamente o que a régua clínica reconhece, ou
 * marcar todo post de quem está em luto. As duas seriam o app decidindo que a
 * história dela é sensível — e a segunda contaria o luto dela para quem visse a
 * marca. A marca é sempre um gesto da autora.
 */
/**
 * ⚠️ **POR QUE ESTE POST ESTÁ RECOLHIDO — e são DUAS razões, um véu só.**
 *
 * A primeira é a MARCA DA AUTORA (`sensivel`): ela avisou que aquilo é duro. A
 * segunda é o FILTRO DELA (`batePalavra`): ela escondeu uma palavra, e a
 * publicação a contém.
 *
 * O véu é o mesmo porque o gesto é o mesmo — uma caixa do tamanho da foto, sem
 * mídia nenhuma no DOM, e um toque para decidir. O que muda é o RÓTULO, e é ele
 * que ela lê antes de escolher.
 *
 * ⚠️ **A marca da autora VENCE quando as duas valem.** "Perda gestacional" diz
 * à leitora O QUE é; "você escondeu uma palavra" diz apenas que existe motivo.
 * O rótulo mais informativo é o que serve a decisão.
 *
 * ⚠️ **E a AUTORA nunca vê o próprio recolhido, por nenhuma das duas razões** —
 * ela sabe o que escreveu, e o filtro é sobre o que os OUTROS escrevem. É a
 * mesma linha do filtro nos comentários.
 */
export type RazaoDoVeu = "sensivel" | "palavra";

export function veuDoPost(entrada: {
  sensivel: boolean;
  batePalavra: boolean;
  souAAutora: boolean;
  revelado: boolean;
}): RazaoDoVeu | null {
  if (entrada.souAAutora) return null;
  if (entrada.revelado) return null;
  if (entrada.sensivel) return "sensivel";
  if (entrada.batePalavra) return "palavra";
  return null;
}

export const MARCA_AUTOMATICA = false;
