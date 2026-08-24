/**
 * O CARD DA TELA BLOQUEADA — e por que ele importa numa meditação.
 *
 * Enquanto ela medita de olhos fechados, o aparelho é uma caixa preta: se a
 * tela apagar, o único jeito de pausar era desbloquear, achar o app e achar o
 * botão. Com `mediaSession` o sistema operacional passa a saber o que está
 * tocando e quem pausa — o mesmo card do Spotify, com o título da sessão.
 *
 * ─── O QUE ISTO NÃO FAZ ─────────────────────────────────────────────────────
 *
 * Não faz o áudio sobreviver ao bloqueio de tela por si só. Quem toca decide
 * isso: um `<audio>` de arquivo continua tocando com a tela apagada (é o caso
 * dos Sons para dormir); som sintetizado no Web Audio é SUSPENSO pelo iOS
 * (é o caso do fundo da meditação, que por isso pausa e espera). O card serve
 * aos dois — no segundo caso, ele é o botão de voltar.
 *
 * ─── POR QUE INJETÁVEL ──────────────────────────────────────────────────────
 *
 * A API é global e opcional, e um teste que dependesse do `navigator` de
 * verdade não rodaria no `bun test`. Quem chama passa nada; o teste passa um de
 * mentira e confere o que foi anunciado.
 */

export type AcoesDeMidia = {
  titulo: string;
  /** Linha de baixo do card. Padrão: o nome do app. */
  artista?: string;
  aoPausar?: () => void;
  aoTocar?: () => void;
  aoParar?: () => void;
};

/** O pedacinho de `navigator.mediaSession` que usamos. */
export type SessaoDeMidia = {
  metadata: unknown;
  playbackState?: "none" | "paused" | "playing";
  setActionHandler: (acao: string, fn: (() => void) | null) => void;
};

type ConstrutorDeMetadados = new (init: {
  title: string;
  artist: string;
  artwork: { src: string; sizes: string; type: string }[];
}) => unknown;

/** Devolve a sessão do navegador, ou `null` onde a API não existe. */
export function midiaDoNavegador(): SessaoDeMidia | null {
  if (typeof navigator === "undefined") return null;
  const ms = (navigator as unknown as { mediaSession?: SessaoDeMidia }).mediaSession;
  return ms && typeof ms.setActionHandler === "function" ? ms : null;
}

const ACOES = ["pause", "play", "stop"] as const;

/**
 * Anuncia o que está tocando e devolve a função que desfaz.
 *
 * ⚠️ Desfazer é obrigatório. Os `setActionHandler` são GLOBAIS: um handler de
 * pausa deixado para trás faz o botão do fone pausar uma sessão que já acabou
 * — ou, pior, chamar um `setState` de componente desmontado.
 */
export function anunciarMidia(acoes: AcoesDeMidia, ms = midiaDoNavegador()): () => void {
  if (!ms) return () => {};

  try {
    const Meta = (globalThis as unknown as { MediaMetadata?: ConstrutorDeMetadados }).MediaMetadata;
    if (Meta) {
      ms.metadata = new Meta({
        title: acoes.titulo,
        artist: acoes.artista ?? "obstetrica.com.br",
        artwork: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      });
    }
    ms.setActionHandler("pause", acoes.aoPausar ?? null);
    ms.setActionHandler("play", acoes.aoTocar ?? null);
    ms.setActionHandler("stop", acoes.aoParar ?? null);
  } catch {
    /* Navegador que anuncia a API e recusa a ação: seguir sem o card. */
  }

  return () => {
    try {
      for (const a of ACOES) ms.setActionHandler(a, null);
      ms.metadata = null;
      ms.playbackState = "none";
    } catch {
      /* ignore */
    }
  };
}

/** Mantém o card em dia: é o que troca ▶︎ por ⏸ na tela bloqueada. */
export function estadoDaMidia(
  estado: "playing" | "paused" | "none",
  ms = midiaDoNavegador(),
): void {
  if (!ms) return;
  try {
    ms.playbackState = estado;
  } catch {
    /* ignore */
  }
}
