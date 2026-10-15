import type { Raridade } from "@/lib/conquistas";
import { cor } from "~/tema";

/**
 * As cores da Jornada que o tema ainda não tem. A família é o roxo do jogo
 * (`cor.jogo`); aqui entram só os tons de apoio e as três molduras de
 * raridade que o dono pediu (comum cinza, raro azul, épico dourado).
 *
 * ⚠️ Se a fundação ganhar estes tokens em `~/tema`, apague daqui e importe de lá.
 */
export const corJornada = {
  roxo: cor.jogo,
  roxoEscuro: "#4c1d95",
  roxoMedio: "#8b5cf6",
  roxoClaro: "#c4b5fd",
  roxoFundo: cor.jogoFundo,
  roxoNevoa: "#f5f3ff",
  estrela: "#f59e0b",
  estrelaApagada: "#e4dcf5",
  chama: "#ea580c",
  chamaFundo: "#ffedd5",
  trofeu: "#b7791f",
  trofeuFundo: "#fef3c7",
  sementinha: cor.sementinha,
  sementinhaFundo: "#dcfce7",
  feito: "#16a34a",
  feitoFundo: "#dcfce7",
} as const;

export const corDaRaridade: Record<
  Raridade,
  { anel: string; fundo: string; texto: string; rotulo: string }
> = {
  comum: { anel: "#94a3b8", fundo: "#f8fafc", texto: "#475569", rotulo: "Comum" },
  raro: { anel: "#2563eb", fundo: "#eff6ff", texto: "#1d4ed8", rotulo: "Rara" },
  epico: { anel: "#d4a017", fundo: "#fffbeb", texto: "#92400e", rotulo: "Épica" },
};

export const CORES_DO_CONFETE = [
  cor.jogo,
  "#8b5cf6",
  "#f59e0b",
  "#ec4899",
  "#22c55e",
  "#38bdf8",
  "#f97316",
] as const;

/**
 * O MOVIMENTO é verde-esmeralda, como no app antigo (`MovementBlock` do site):
 * a sessão inteira num degradê de emerald-100 → teal-50 → branco, o anel que
 * conta o tempo e a figura em emerald-700. Tailwind 4, como o site — menos os
 * dois verdes do anel, que o site escreveu à mão no SVG.
 */
export const corMovimento = {
  fundoTopo: "#d0fae5",
  fundoMeio: "#f0fdfa",
  fundoBase: "#ffffff",
  anelTrilho: "#a7f3d0",
  anel: "#10b981",
  forte: "#007a55",
  forteFundo: "#ecfdf5",
  titulo: "#004f3b",
  dica: "rgba(0,96,69,0.8)",
  aviso: "rgba(0,122,85,0.7)",
  contagem: "#00bc7d",
  passoFundo: "#d0fae5",
  passoTexto: "rgba(0,79,59,0.9)",
  sentirFundo: "#ecfdf5",
  sentirTexto: "#006045",
  pararFundo: "#fffbeb",
  pararTexto: "#7b3306",
  feito: "#00bc7d",
  atual: "rgba(0,212,146,0.7)",
  porVir: "#a4f4cf",
  borda: "#a4f4cf",
  bordaForte: "#5ee9b5",
  vidro: "rgba(255,255,255,0.7)",
  fechar: "#45556c",
  secao: "#009966",
  discreto: "rgba(0,122,85,0.6)",
  branco80: "rgba(255,255,255,0.8)",
  /* o balão da bolha (`BolhaComBalao`): âmbar, como a fala do porta-voz */
  balaoFundo: "rgba(255,255,255,0.85)",
  balaoBorda: "#fee685",
  balaoTexto: "#7b3306",
} as const;
