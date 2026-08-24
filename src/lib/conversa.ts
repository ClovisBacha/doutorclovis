/**
 * A MENSAGEM DIRETA — régua pura.
 *
 * O maior buraco estrutural da aba: duas pacientes podiam reagir uma ao post da
 * outra e não tinham como conversar. Nenhuma rede social existe sem isto, e é o
 * que transforma "seguir" em vínculo.
 *
 * ⚠️ **E É TAMBÉM O VETOR DE ASSÉDIO MAIS ÓBVIO QUE EXISTE.** Caixa de entrada
 * aberta a desconhecidos, numa base de gestantes de alto risco, é o desenho que
 * transforma um recurso de afeto numa porta de perseguição. As três travas
 * abaixo existem por isso, e nenhuma é enfeite.
 */

/** Quem pode PUXAR conversa com quem. */
export type PodeIniciar =
  | { pode: true; comoPedido: boolean }
  | { pode: false; motivo: "bloqueio" | "fora_de_alcance" | "eu_mesma" };

/**
 * ⚠️ **TRAVA 1 — SÓ QUEM ALCANÇA O PERFIL PODE ESCREVER.**
 *
 * É a MESMA régua de `alcancaOPerfil`, e de propósito: quem não consegue nem
 * abrir o perfil dela não pode aparecer na caixa de entrada dela. Uma régua
 * própria aqui divergiria da do perfil no primeiro ajuste, e a divergência
 * apareceria como mensagem de estranha chegando de um perfil que a paciente
 * fechou justamente para isso.
 *
 * ⚠️ **TRAVA 2 — SE ELA NÃO ME SEGUE, É PEDIDO.** A conversa nasce numa caixa
 * separada, e a paciente decide se aceita. Aceitar é o gesto que abre o canal;
 * sem ele, o canal não existe.
 */
export function podeIniciarConversa(v: {
  euId: string;
  alvoId: string;
  /** O alvo bloqueou você, ou você bloqueou o alvo. Vale nos dois sentidos. */
  temBloqueio: boolean;
  /** Você alcança o perfil do alvo? Ver `alcancaOPerfil`. */
  alcancaOPerfil: boolean;
  /** O ALVO segue VOCÊ. É isto que dispensa o pedido. */
  alvoMeSegue: boolean;
}): PodeIniciar {
  if (v.euId === v.alvoId) return { pode: false, motivo: "eu_mesma" };
  /* ⚠️ O bloqueio vem ANTES do alcance: quem bloqueou pode continuar tendo
     perfil público, e responder "fora de alcance" contaria a diferença. */
  if (v.temBloqueio) return { pode: false, motivo: "bloqueio" };
  if (!v.alcancaOPerfil) return { pode: false, motivo: "fora_de_alcance" };
  return { pode: true, comoPedido: !v.alvoMeSegue };
}

/**
 * ⚠️ **TRAVA 3 — UMA MENSAGEM ATÉ SER ACEITO. É a que o Instagram não tem.**
 *
 * Lá, quem manda pedido pode encher a caixa de solicitações com quantas
 * mensagens quiser, e a pessoa vê todas ao abrir. Aqui, quem pediu escreve UMA
 * e espera. Se a paciente não responder, o assunto morre ali.
 *
 * O custo é real e aceito: uma mensagem só às vezes não explica quem você é. O
 * benefício é que ninguém consegue despejar vinte mensagens em cima de alguém
 * que nunca respondeu — e essa é a diferença entre uma caixa de entrada e um
 * canal de perseguição.
 */
export const MENSAGENS_ANTES_DE_ACEITAR = 1;

export function podeEnviar(v: {
  souODono: boolean;
  /** A conversa já foi aceita pelo outro lado? */
  aceita: boolean;
  /** Sou eu quem pediu? */
  euIniciei: boolean;
  /** Quantas mensagens EU já mandei nesta conversa. */
  minhasMensagens: number;
  temBloqueio: boolean;
}): { pode: boolean; motivo?: "bloqueio" | "aguardando_aceite" | "nao_e_minha" } {
  if (!v.souODono) return { pode: false, motivo: "nao_e_minha" };
  if (v.temBloqueio) return { pode: false, motivo: "bloqueio" };
  if (v.aceita) return { pode: true };
  /**
   * ⚠️ **QUEM RECEBEU O PEDIDO PODE RESPONDER SEM "ACEITAR" FORMALMENTE.**
   * Responder É aceitar — obrigar dois toques (aceitar, depois escrever) faria
   * a paciente responder e a mensagem não sair, que é o pior desfecho possível
   * numa caixa de entrada.
   */
  if (!v.euIniciei) return { pode: true };
  if (v.minhasMensagens >= MENSAGENS_ANTES_DE_ACEITAR) {
    return { pode: false, motivo: "aguardando_aceite" };
  }
  return { pode: true };
}

/**
 * O par ordenado da conversa.
 *
 * ⚠️ Sem ele, (A,B) e (B,A) viram duas linhas: duas pessoas que se escrevem ao
 * mesmo tempo criam DUAS conversas, cada uma vê a sua, e as mensagens da outra
 * somem. Mesma lição de `duplas`.
 */
export function parOrdenado(x: string, y: string): { a: string; b: string } {
  return x < y ? { a: x, b: y } : { a: y, b: x };
}

/** Qual das duas colunas de "lido" é minha nesta conversa. */
export function minhaColunaDeLeitura(euId: string, aId: string): "lida_a" | "lida_b" {
  return euId === aId ? "lida_a" : "lida_b";
}

/**
 * Tem mensagem não lida?
 *
 * ⚠️ **A MINHA PRÓPRIA MENSAGEM NUNCA CONTA COMO NÃO LIDA.** Sem esta regra, o
 * emblema acende no instante em que ela manda — a conversa fica marcada como
 * "tem coisa nova" por causa do que ela mesma escreveu, e o número perde o
 * sentido na primeira mensagem enviada.
 */
export function temNaoLida(v: {
  ultimaEm: string | null;
  minhaLeitura: string | null;
  /** Quem escreveu a última mensagem. */
  ultimoAutor: string | null;
  euId: string;
}): boolean {
  if (!v.ultimaEm) return false;
  if (v.ultimoAutor && v.ultimoAutor === v.euId) return false;
  if (!v.minhaLeitura) return true;
  return new Date(v.ultimaEm).getTime() > new Date(v.minhaLeitura).getTime();
}

/** Teto do texto. Conversa não é redação; e o campo é entrada de terceiro. */
export const LIMITE_DA_MENSAGEM = 2000;

/**
 * Teto de mensagens por dia, por pessoa.
 *
 * ⚠️ É o freio contra o dedo preso e contra automação — nunca contra conversa
 * de verdade. Duzentas mensagens num dia é muito acima do que uma conversa
 * humana produz, e bem abaixo do que um roteiro produziria.
 */
export const MENSAGENS_POR_DIA = 200;

/**
 * O texto que aparece na lista, encurtado.
 *
 * ⚠️ **Mensagem apagada vira aviso, nunca some da lista.** Uma conversa que
 * perde a última linha e volta a mostrar a anterior faz a paciente achar que a
 * mensagem que ela viu chegar não existiu.
 */
export function previaDaMensagem(texto: string | null, apagada: boolean, limite = 60): string {
  if (apagada) return "Mensagem apagada";
  const t = (texto ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length <= limite ? t : `${t.slice(0, limite - 1)}…`;
}
