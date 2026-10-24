/**
 * AS AMIGAS NO APP — as frases que dependem do que o servidor respondeu, em
 * puro (o servidor e as réguas são do site: `src/lib/amigas*.ts`).
 *
 * As três decisões do site valem aqui do mesmo jeito: nada clínico (o perfil
 * mostra o que ela CONSTRUIU), cooperativo e nunca placar (a dupla é uma chama
 * que as duas seguram), e só quem já se conhece (convite ou código, nunca
 * busca por nome).
 *
 * Sem react-native aqui: é testado pelo bun.
 */

/** Dias sem a outra aparecer até a dupla dizer "em pausa" (2 é fim de semana). */
export const DIAS_PARA_PAUSA = 4;

/** O bônus diário da dupla: cada uma ganha quando AS DUAS fecharam o dia. */
export { BONUS_DA_DUPLA } from "@/lib/economia-sementinhas";

export type RespostaDoPedido =
  | { ok: true; achou: true | null; nome: string | null }
  | { ok: false; error: string };

/**
 * A frase do "Enviar" do código ou e-mail. O e-mail tem a MESMA resposta com
 * e sem acerto (o servidor devolve `achou: null`): o campo não pode virar um
 * verificador de quem é paciente daqui.
 */
export function fraseDoPedido(r: RespostaDoPedido): { texto: string; ok: boolean } {
  if (r.ok) {
    return r.achou
      ? { texto: `Pedido enviado para ${r.nome ?? "ela"} 💛 Ela escolhe se aceita.`, ok: true }
      : { texto: "Se esse e-mail for de alguém do app, ela recebe o seu pedido 💛", ok: true };
  }
  switch (r.error) {
    case "muitos_convites":
      return { texto: "Você já mandou muitos pedidos hoje. Tente de novo amanhã.", ok: false };
    case "termo_curto":
      return { texto: "Esse código parece curto demais. Confira com ela.", ok: false };
    case "nao_encontrada":
      return { texto: "Não encontrei esse código. Confira as letras com ela.", ok: false };
    case "indisponivel":
      return { texto: "Não é possível agora.", ok: false };
    case "sessao":
      return { texto: "Entre de novo na sua conta e tente outra vez.", ok: false };
    default:
      return { texto: "Não deu agora. Tente de novo em instantes.", ok: false };
  }
}

/** A frase de uma ação da dupla que o servidor recusou. */
export function fraseDoErroDaDupla(error: string | undefined): string {
  if (error === "indisponivel") return "Não é possível agora.";
  if (error === "sem_vinculo") return "Vocês precisam estar conectadas como amigas.";
  return "Não deu agora. Tente de novo em instantes.";
}

/**
 * A dupla está em pausa? (Ativa, chama em zero, a outra sumida há dias.) A
 * tela diz o FATO — a chama está parada e nada se perdeu — e nunca o motivo:
 * o mais provável, numa gestação de alto risco, é o que ninguém pode insinuar.
 */
export function emPausa(d: {
  estado: string;
  sequencia: number;
  paradaHa: number | null;
}): boolean {
  return (
    d.estado === "ativa" && d.sequencia === 0 && d.paradaHa != null && d.paradaHa >= DIAS_PARA_PAUSA
  );
}

/** A linha embaixo de "Você + Fulana": a chama, ou a frase que explica o zero. */
export function linhaDaDupla(d: { sequencia: number; recorde: number }): string {
  if (d.sequencia > 0) return `🔥 ${d.sequencia} ${d.sequencia === 1 ? "dia" : "dias"} juntas`;
  return d.recorde > 0
    ? "a chama está esperando vocês duas"
    : "a chama começa quando as duas aparecerem";
}

/** "🏅 A melhor de vocês foi 12 dias seguidos" — só quando o recorde passa a chama de hoje. */
export function memoriaDaDupla(d: {
  sequencia: number;
  recorde: number;
  juntas: number;
}): string | null {
  if (d.recorde <= d.sequencia) return null;
  return `🏅 A melhor de vocês foi ${d.recorde} dias seguidos${d.juntas > d.recorde ? ` · ${d.juntas} dias juntas no total` : ""}`;
}

/**
 * A cor do pontinho de "vista há 2h", a mesma régua do site: verde só para a
 * última hora (é um fato, e o texto ao lado diz qual), âmbar para hoje e
 * cinza para o resto. Nunca verde para "ontem": verde é o sinal universal de
 * "está aqui agora".
 */
export function corDaUltimaVez(texto: string): string {
  if (texto === "agora mesmo") return "#22c55e";
  if (texto.startsWith("há ") && texto.endsWith("h")) return "#f59e0b";
  return "#a8a29e";
}
