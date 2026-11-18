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
 * AS ATIVIDADES NO AMANHECER (18/11/2026, a vistoria: "quatro marcas de cor
 * quebram a sensação de produto único"). Antes cada atividade era pintada com
 * a paleta Tailwind do site, num degradê que terminava em branco puro, com o
 * título e o texto na cor dela. Agora todas moram na luz do app (`luz.base`,
 * tinta ameixa), e a cor do assunto é só ACENTO, como os anéis do Fitness:
 * - `luz`: o brilho no alto da tela, a ficha atrás de um ícone, a face clara
 *   do botão desligado;
 * - `acao`: o botão cheio, a escolha marcada, o rótulo e o contador. Branco
 *   sobre ela passa de 5:1 nas quatro (medido: 5,4 · 8,5 · 5,1 · 5,0), e ela
 *   sobre a névoa passa de 4,5:1.
 *
 * A Meditação tem um índigo próprio, e não o violeta do jogo (`cor.jogo`), que
 * fica com a aula e a trilha.
 */
export const corDaAtividade = {
  mexer: { luz: "#d4f5e6", acao: "#007a55" },
  meditar: { luz: "#ebe0ff", acao: "#4a3aa8" },
  carta: { luz: "#ffe0e7", acao: cor.primaria },
  gratidao: { luz: "#fff1c2", acao: "#b45309" },
} as const;

/**
 * A NOITE: "Para vocês dois", "Só sons, para dormir" e a história. Elas moram
 * no céu da noite do app (`CEUS.noite`, parado) com um véu de azul-noite por
 * cima, e não mais num degradê chapado de outro produto. Texto é branco a 60%
 * ou mais (6,5:1 sobre o véu); 40% e abaixo, só ícone, borda e trilho.
 */
export const corNoite = {
  /** O véu sobre o céu: deixa o céu aparecer no alto e fecha embaixo, onde mora o texto. */
  veu: ["rgba(14,18,38,0.25)", "rgba(14,18,38,0.62)", "rgba(14,18,38,0.85)"] as const,
  /** A história, que escurece a tela: quase preto. */
  historia: "#0b0f21",
  estrela: "#dfe6ff",
  texto: "#ffffff",
  textoForte: "rgba(255,255,255,0.92)",
  textoCorpo: "rgba(255,255,255,0.78)",
  /** O mínimo para texto no escuro. */
  textoApagado: "rgba(255,255,255,0.62)",
  /** Só ícone, trilho e borda. */
  icone: "rgba(255,255,255,0.45)",
  trilho: "rgba(255,255,255,0.16)",
  cartao: "rgba(255,255,255,0.08)",
  cartaoBorda: "rgba(255,255,255,0.12)",
  /** O "vidro" da noite (o tocador, o fechar): um material escuro, e não o vidro claro do sistema. */
  material: "rgba(30,34,72,0.72)",
  materialForte: "rgba(30,34,72,0.9)",
  materialBorda: "rgba(255,255,255,0.18)",
  /** O botão claro da noite: branco, com a letra na tinta da noite. */
  tintaDoBotao: "#1d1840",
  /* quem é o alvo da fala: rosa ela, azul quem acompanha, âmbar os dois */
  ela: { fundo: "rgba(255,32,86,0.2)", texto: "#ffccd3", borda: "rgba(255,99,126,0.3)" },
  par: { fundo: "rgba(0,166,244,0.2)", texto: "#b8e6fe", borda: "rgba(0,188,255,0.3)" },
  dois: { fundo: "rgba(254,154,0,0.2)", texto: "#fef3c6", borda: "rgba(255,185,0,0.3)" },
  alvoDaFigura: "#ffd230",
  /** O lilás da noite: a ficha dos gestos, o brilho atrás da arte. */
  lilas: "#b9a8ff",
  /* os sons para dormir: o cartão escolhido (índigo, mais claro que o resto) */
  escolhidoBorda: "rgba(163,179,255,0.7)",
  escolhidoFundo: "rgba(124,134,255,0.35)",
  onda: "#c6d2ff",
  tempo: "#aab6ff",
  tempoTexto: "#141a34",
} as const;
