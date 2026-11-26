import type { MotivoDoBloqueio } from "@/lib/nutricao-premium";

/**
 * O QUE CADA RESPOSTA DO SERVIDOR QUER DIZER PARA ELA — a régua pura.
 *
 * Cada falha tem nome e recado próprio: "muitas" faz esperar, "sessão" faz
 * entrar de novo, "rede" faz tentar quando o sinal voltar. Uma frase só para
 * tudo faria ela repetir justamente o que não vai funcionar.
 */

export type DesfechoDoChat =
  | { tipo: "stream" }
  | { tipo: "bloqueio"; motivo: MotivoDoBloqueio }
  | { tipo: "aviso"; aviso: Aviso };

export type Aviso = "sessao" | "muitas" | "rede" | "falha";

export const RECADO_DO_AVISO: Record<Aviso, string> = {
  sessao: "Sua sessão expirou. Entre de novo para continuar a conversa.",
  muitas: "Muitas mensagens em pouco tempo. Espere um pouquinho e tente de novo.",
  rede: "Sem conexão agora. A sua pergunta voltou para o campo: é só mandar de novo quando o sinal voltar.",
  falha: "A nutricionista não conseguiu responder agora. A sua pergunta voltou para o campo: tente de novo daqui a pouco.",
};

/** O motivo do 402. Desconhecido vira "sem_premium", como no site. */
export function motivoDoBloqueio(bruto: unknown): MotivoDoBloqueio {
  const m = typeof bruto === "string" ? bruto.replace(/^bloqueado:/, "") : "";
  return m === "teto_diario" ? "teto_diario" : "sem_premium";
}

/** A resposta HTTP do `/api/nutrition` antes de ler o corpo. */
export function desfechoDoChat(status: number, corpo402?: unknown): DesfechoDoChat {
  if (status >= 200 && status < 300) return { tipo: "stream" };
  if (status === 401) return { tipo: "aviso", aviso: "sessao" };
  if (status === 402) {
    const motivo = (corpo402 as { motivo?: unknown } | null | undefined)?.motivo;
    return { tipo: "bloqueio", motivo: motivoDoBloqueio(motivo) };
  }
  if (status === 429) return { tipo: "aviso", aviso: "muitas" };
  return { tipo: "aviso", aviso: "falha" };
}

/* ─── A FOTO ───────────────────────────────────────────────────────────── */

export type RespostaDaFoto = {
  ok?: boolean;
  texto?: string;
  assinatura?: string;
  motivo?: string;
  restantesNaAmostra?: number | null;
};

export type DesfechoDaFoto =
  | { tipo: "ok"; texto: string; assinatura?: string; amostra: number | null }
  | { tipo: "bloqueio"; motivo: MotivoDoBloqueio }
  | { tipo: "sessao" }
  | { tipo: "recado"; texto: string };

/**
 * ⚠️ `{ ok: false }` decide, e não só o status: quem lê só o HTTP mostraria
 * "…" para sempre numa resposta que veio sem texto.
 */
export function desfechoDaFoto(status: number, r: RespostaDaFoto | null): DesfechoDaFoto {
  if (status === 401) return { tipo: "sessao" };
  if (status === 402 || (r?.motivo ?? "").startsWith("bloqueado:")) {
    return { tipo: "bloqueio", motivo: motivoDoBloqueio(r?.motivo) };
  }
  if (status >= 200 && status < 300 && r?.ok && r.texto?.trim()) {
    const n = r.restantesNaAmostra;
    return {
      tipo: "ok",
      texto: r.texto.trim(),
      ...(r.assinatura ? { assinatura: r.assinatura } : {}),
      amostra: typeof n === "number" && Number.isInteger(n) && n >= 0 ? n : null,
    };
  }
  return { tipo: "recado", texto: recadoDaFoto(r?.motivo ?? (status === 429 ? "muitas" : undefined)) };
}

/**
 * Cada motivo do `/api/prato` com o que FAZER a seguir. Os textos são os do
 * site (`nutricao-tab.tsx`), mais os que só o app produz (aparelho sem sinal,
 * foto que o aparelho não conseguiu preparar).
 */
export function recadoDaFoto(motivo?: string): string {
  switch (motivo) {
    case "muitas":
      return "Recebi bastante foto agora há pouco. Tente de novo em alguns minutos 💛";
    case "grande":
      return "Essa foto ficou pesada demais para eu abrir. Tente tirar outra.";
    case "formato":
      return "Não consegui abrir esse arquivo. Vale uma foto tirada agora pela câmera.";
    case "invalido":
    case "sem_foto":
    case "preparo":
      return "A foto não chegou inteira. Tente escolher de novo — ou me conte por escrito o que tem no prato.";
    case "vazio":
      return "Não consegui enxergar o que tem aí. Tente de novo com mais luz e a foto mais de perto.";
    case "bloqueada":
      return "Não consigo comentar essa foto. Se for do prato, tente uma foto só da comida, sem pessoas.";
    case "demorou":
      return "Demorei demais para ler essa foto e desisti. Tente uma vez mais — ou me conte por escrito o que tem no prato.";
    case "sem_ia":
      return "A leitura de fotos está indisponível neste momento. Me conte por escrito o que tem no prato que eu ajudo do mesmo jeito.";
    /* ⚠️ "rede" do SERVIDOR é o servidor sem falar com o Google — cai no
       genérico. "sem_sinal" é o APARELHO sem internet, e só o app produz. */
    case "sem_sinal":
      return "Sem conexão agora. Tente mandar a foto de novo quando o sinal voltar.";
    default:
      return "Não consegui ler essa foto agora. Tente de novo daqui a pouco — e, se preferir, me conte por escrito o que tem no prato.";
  }
}
