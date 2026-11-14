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
  /* ── O MEU CANTINHO ── */
  esmeralda300: "#5ee9b5",
  esmeralda500: "#00bc7d",
  esmeralda600: "#009966",
  /* a sanfona "Ganhe mais Sementinhas" (`bg-emerald-50/40`) */
  esmeralda50_40: "rgba(236,253,245,0.4)",
  /* a pílula do saldo (`bg-white/70`) e os materiais 3D (`.pill-3d`, `.btn-3d`) */
  branco70: "rgba(255,255,255,0.7)",
  branco86: "rgba(255,255,255,0.86)",
  branco50: "rgba(255,255,255,0.5)",
  branco42: "rgba(255,255,255,0.42)",
  branco16: "rgba(255,255,255,0.16)",
  branco0: "rgba(255,255,255,0)",
  preto10: "rgba(0,0,0,0.1)",
  /* a ficha de categoria não escolhida (`text-foreground/60`) */
  texto60: "rgba(41,20,19,0.6)",
  /* o botão de preço que ela ainda não alcança */
  ardosia100: "#f1f5f9",
  ardosia400: "#90a1b9",
  /* a Coroa da Coleção e o cadeado de troféus */
  ambar50: "#fffbeb",
  ambar100: "#fef3c6",
  ambar200: "#fee685",
  ambar200_85: "rgba(254,230,133,0.85)",
  ambar300: "#ffd230",
  ambar700: "#bb4d00",
  ambar700_70: "rgba(187,77,0,0.7)",
  ambar800: "#973c00",
  /* "Indique uma amiga" */
  rosa50: "#fdf2f8",
  rosa100: "#fce7f3",
  rosa200: "#fccee8",
  rosa500: "#f6339a",
  rosa600: "#e60076",
  rosa700: "#c6005c",
  rubi50: "#fff1f2",
  rubi100: "#ffe4e6",
  rubi500: "#ff2056",
  rubi600: "#ec003f",
  /* "Deixe seu depoimento" */
  violeta50: "#f5f3ff",
  violeta200: "#ddd6ff",
  violeta600: "#7f22fe",
  violeta700: "#7008e7",
  fucsia50: "#fdf4ff",
  /* "Veio pela indicação de alguém?" — o botão do site (`#c9316f`) */
  embaixadora: "#c9316f",
  /* o texto que traça o limite ético (`slate-600`) */
  ardosia600: "#45556c",
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
