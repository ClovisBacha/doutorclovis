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
      ? { texto: `Pedido enviado para ${r.nome ?? "ela"}. Ela escolhe se aceita.`, ok: true }
      : { texto: "Se esse e-mail for de alguém do app, ela recebe o seu pedido.", ok: true };
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

/* ── As amigas no Hoje (fase 3) ─────────────────────────────────────────── */

/** O primeiro nome, para as frases curtas do Hoje. */
export function primeiroNomeDaAmiga(nome: string | null | undefined): string {
  return (nome ?? "").trim().split(/\s+/)[0] || "sua amiga";
}

/**
 * Os rostos da faixa do Hoje: quem apareceu por último primeiro (é presença,
 * nunca "online"), até `max`, e quantas ficaram de fora.
 */
export function rostosDaFaixa<T extends { vistaEm: string | null }>(
  amigas: readonly T[],
  max = 5,
): { rostos: T[]; mais: number } {
  const quando = (a: T) => (a.vistaEm ? Date.parse(a.vistaEm) || 0 : 0);
  const ordem = [...amigas].sort((a, b) => quando(b) - quando(a));
  return { rostos: ordem.slice(0, max), mais: Math.max(0, ordem.length - max) };
}

/**
 * A linha da dupla na faixa do Hoje — `null` quando não há o que dizer. No
 * pós-parto a dupla não existe (decisão do dono: lá ela não acende). Em pausa,
 * diz o FATO, nunca o motivo. Sem emoji nem travessão: é a segunda linha de
 * uma lista (18/11/2026), e a chama desenhada já está no cartão da dupla.
 */
export function linhaDaDuplaNoHoje(
  dupla: {
    estado: string;
    nome: string | null;
    sequencia: number;
    recorde: number;
    paradaHa: number | null;
  } | null,
  temAmigas: boolean,
  pos: boolean,
): string | null {
  if (pos) return null;
  if (!dupla) return temAmigas ? "Chame uma amiga para a dupla" : null;
  const ela = primeiroNomeDaAmiga(dupla.nome);
  if (dupla.estado === "convite-recebido") return `${ela} te chamou para a dupla`;
  if (dupla.estado === "convite-enviado") return `Você chamou ${ela} para a dupla`;
  if (dupla.estado !== "ativa") return null;
  if (emPausa(dupla)) return `A dupla com ${ela} está em pausa`;
  if (dupla.sequencia > 0)
    return `${dupla.sequencia} ${dupla.sequencia === 1 ? "dia" : "dias"} juntas com ${ela}`;
  return dupla.recorde > 0
    ? `A chama com ${ela} espera vocês duas`
    : `A chama com ${ela} começa quando as duas aparecerem`;
}

/**
 * Os nomes da roda, para a segunda linha das amigas no Hoje quando não há
 * dupla a contar (o pós-parto, ou a dupla ainda por formar): "Juliana, Camila
 * e Marina", ou "Juliana, Camila e mais 3". Na ordem de quem apareceu por último.
 */
export function rodaDeAmigas(nomes: readonly string[]): string | null {
  const primeiros = nomes.map(primeiroNomeDaAmiga);
  if (primeiros.length === 0) return null;
  if (primeiros.length === 1) return primeiros[0]!;
  if (primeiros.length <= 3)
    return `${primeiros.slice(0, -1).join(", ")} e ${primeiros[primeiros.length - 1]}`;
  return `${primeiros.slice(0, 2).join(", ")} e mais ${primeiros.length - 2}`;
}

/** A dupla ativa como o cartão a desenha (`chamaDaDupla`). */
export type ChamaDaDuplaNaTela = {
  /** O número grande; `null` quando a chama está em zero e a frase ocupa o lugar dele. */
  numero: number | null;
  /** "dias juntas" (ou "dia juntas"), ao lado do número. */
  unidade: string;
  /** "com Juliana". */
  com: string;
  /** A frase da pausa ou do começo, no lugar do número. */
  frase: string | null;
  /** O recorde, quando ele passa a chama de hoje. */
  memoria: string | null;
  acesa: boolean;
};

/**
 * A DUPLA ATIVA NO CARTÃO (18/11/2026): a chama de vocês é o número grande, e
 * não uma pílula embaixo de uma explicação. Em zero, a frase toma o lugar do
 * número, com a chama apagada; em pausa, diz o fato e que nada se perdeu,
 * nunca o motivo. `linhaDaDupla` e `memoriaDaDupla` ficam como estão (o
 * texto delas é o do site); este é o desenho do app, sem emoji.
 */
export function chamaDaDupla(d: {
  estado: string;
  nome: string | null;
  sequencia: number;
  recorde: number;
  juntas: number;
  paradaHa: number | null;
}): ChamaDaDuplaNaTela {
  const ela = primeiroNomeDaAmiga(d.nome);
  const memoria =
    d.recorde > d.sequencia
      ? `A melhor de vocês foi ${d.recorde} dias seguidos${d.juntas > d.recorde ? ` · ${d.juntas} dias juntas no total` : ""}`
      : null;
  if (d.sequencia > 0) {
    return {
      numero: d.sequencia,
      unidade: d.sequencia === 1 ? "dia juntas" : "dias juntas",
      com: `com ${ela}`,
      frase: null,
      memoria,
      acesa: true,
    };
  }
  const frase = emPausa(d)
    ? "A chama de vocês está parada há uns dias. Ela volta a contar no dia em que as duas aparecerem, e nada do que vocês fizeram se perdeu."
    : d.recorde > 0
      ? `A chama espera você e ${ela}. Ela volta a contar no dia em que as duas aparecerem.`
      : `A chama começa no dia em que você e ${ela} aparecerem.`;
  return { numero: null, unidade: "", com: `com ${ela}`, frase, memoria, acesa: false };
}

/* ── O convite e o código da amiga (fase 3) ─────────────────────────────── */

/** O resultado de ligar-se à amiga pelo código dela, como a tela o lê. */
export type ResultadoDaIndicacao = "ligou" | "nao-encontrou" | "depois" | "falhou";

export function lerResultadoDaIndicacao(
  r: { ok: true; attributed: boolean; retry?: boolean } | { ok: false; error?: string },
): ResultadoDaIndicacao {
  if (!r.ok) return "falhou";
  if (r.attributed) return "ligou";
  return r.retry ? "depois" : "nao-encontrou";
}

/**
 * A frase de cada resultado. "Não encontrou" cobre também quem já entrou pelo
 * convite de outra pessoa (o servidor fixa uma vez só e não distingue), e
 * diz as duas coisas em vez de afirmar a errada.
 */
export function fraseDaIndicacao(r: ResultadoDaIndicacao, bonus: number): string {
  switch (r) {
    case "ligou":
      return `Pronto: vocês agora são amigas 💛 Ela ganhou ${bonus} sementinhas e aparece nas suas Amigas.`;
    case "nao-encontrou":
      return "Não encontrei esse código — ou você já entrou pelo convite de outra amiga. Confira as letras com ela.";
    case "depois":
      return "Guardei o código: assim que a sua conta terminar de ficar pronta, eu ligo vocês.";
    default:
      return "Não deu agora. Depois, nas Amigas, dá para pedir a amizade dela pelo código.";
  }
}

/** O código como o servidor o guarda: letras e números, em maiúsculas. */
export function codigoLimpo(t: string): string {
  return t.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

/**
 * O texto do convite DO APP: com o código escrito, porque quem baixa o app não
 * passa pelo link (o link é do site, que captura o código sozinho). Primeira
 * pessoa, sem promessa clínica.
 */
export function mensagemDeConviteDoApp(codigo: string, link: string | null): string {
  const base = `Estou usando o app Mãe Esperta e queria você comigo lá 💛 No cadastro, use o meu código ${codigo}: a gente vira amiga lá dentro.`;
  return link ? `${base} ${link}` : base;
}
