/**
 * As cores da marca, convertidas dos tokens oklch de ../src/styles.css
 * (creme pêssego, vinho, rosé). Uma cor nova entra aqui, nunca solta numa tela.
 */
export const cor = {
  fundo: "#fffaf6",
  texto: "#291413",
  cartao: "#fffdfc",
  primaria: "#ab5e5c",
  primariaEscura: "#8f4b49",
  primariaSuave: "#d79d9a",
  rosaMarca: "#FEE2EA",
  apagado: "#f9eee8",
  textoApagado: "#6d5855",
  destaque: "#ffe2de",
  textoDestaque: "#581b1d",
  borda: "#ede0db",
  divisor: "#f3ece8",
  branco: "#ffffff",
  // Famílias (mesmas do site): a cor diz de que assunto é a tela.
  chutes: "#0369a1",
  chutesFundo: "#e0f2fe",
  contracoes: "#c2410c",
  contracoesFundo: "#ffedd5",
  saude: "#047857",
  saudeFundo: "#d1fae5",
  nutricao: "#4d7c0f",
  nutricaoFundo: "#ecfccb",
  jogo: "#6d28d9",
  jogoFundo: "#ede9fe",
  sementinha: "#15803d",
  // Gravidade clínica — só para o que a régua de sinais-clinicos devolve.
  urgente: "#b91c1c",
  urgenteFundo: "#fee2e2",
  urgenteBorda: "#fecaca",
  urgentePressionado: "#991b1b",
  atencao: "#b45309",
  atencaoFundo: "#fef3c7",
  ok: "#047857",
  okFundo: "#d1fae5",
} as const;

export const fonte = {
  normal: "Nunito_500Medium",
  media: "Nunito_600SemiBold",
  forte: "Nunito_700Bold",
  titulo: "Nunito_800ExtraBold",
} as const;

export const espaco = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const raio = { sm: 10, md: 16, lg: 24, pilula: 999 } as const;

/** Alvo de toque mínimo (Apple HIG: 44 pt). */
export const ALVO_MINIMO = 44;

export const sombra = {
  shadowColor: "#581b1d",
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;
