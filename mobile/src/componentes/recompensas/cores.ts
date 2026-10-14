import type { Raridade } from "@/lib/conquistas";

/**
 * As cores das RECOMPENSAS (Meu Cantinho e Conquistas) que o tema não tem —
 * tiradas do site, na paleta do Tailwind 4 que ele usa. O dinheiro de mentira
 * (sementinhas) é verde-esmeralda em todo lugar; o resto segue o rosé da marca.
 *
 * ⚠️ Se a fundação ganhar estes tokens em `~/tema`, apague daqui e importe de lá.
 */
export const corRecompensas = {
  esmeralda50: "#ecfdf5",
  esmeralda100: "#d0fae5",
  esmeralda200: "#a4f4cf",
  esmeralda400: "#00d492",
  esmeralda700: "#007a55",
  esmeralda800: "#006045",
  esmeralda900: "#004f3b",
  lima50: "#f7fee7",
  /* textos com transparência sobre o verde */
  esmeralda700_80: "rgba(0,122,85,0.8)",
  esmeralda800_80: "rgba(0,96,69,0.8)",
  branco60: "rgba(255,255,255,0.6)",
  /* o cartão "Suas conquistas" e o anel da porcentagem */
  primaria20: "rgba(171,94,92,0.2)",
  secundaria: "#ffede7",
  /* o aviso de conquista nova */
  primaria25: "rgba(171,94,92,0.25)",
  primaria8: "rgba(171,94,92,0.08)",
  /* cartão bloqueado */
  secundaria20: "rgba(255,237,231,0.2)",
  apagado60: "rgba(109,88,85,0.6)",
  /* a sombra dos cartões (`--shadow-card`) */
  sombra: "#372a27",
  /* o véu do aviso de conquista */
  veu: "rgba(0,0,0,0.45)",
  /* PREMIUM — não aparece no app (v1 sem Premium); fica para quando existir. */
} as const;

/** O anel de cada raridade — `RARIDADES[r].anel` e `.texto` do site, em hex. */
export const quadroDaRaridade: Record<
  Raridade,
  { borda: string; fundo: string; texto: string; halo?: string }
> = {
  comum: { borda: "#cad5e2", fundo: "#f8fafc", texto: "#62748e" },
  raro: { borda: "#00bcff", fundo: "#f0f9ff", texto: "#0084d1" },
  epico: { borda: "#ffb900", fundo: "#fffbeb", texto: "#e17100", halo: "rgba(251,191,36,0.35)" },
};
