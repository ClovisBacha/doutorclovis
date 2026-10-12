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

export const corDaRaridade: Record<Raridade, { anel: string; fundo: string; texto: string; rotulo: string }> = {
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
