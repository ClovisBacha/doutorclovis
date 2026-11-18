import { comAlfa } from "~/lib/cor";
import { cor, ouro } from "~/tema";

/**
 * As cores do CAMINHO, apontadas para o tema (18/11/2026, a vistoria: o placar
 * ainda tinha a paleta Tailwind do site — laranja, azul e verde a 2–2,7:1
 * sobre o vidro, abaixo do AA até para texto grande). Cada papel aqui é um
 * token do tema (ou um branco translúcido, o material sobre o céu); nenhuma
 * cor nova nasce neste arquivo. As cores de cada
 * SEMANA não moram aqui: saem das fórmulas de `~/lib/jornada/caminho`.
 */
export const corCaminho = {
  branco: cor.branco,
  /* A estrela e o anel */
  anelVazio: cor.trilho,
  ouroClaro: ouro.claro,
  ouro: ouro.medio,
  ouroEscuro: ouro.escuro,
  /* O placar */
  divisor: cor.borda,
  chamaApagada: cor.chevron,
  numeroApagado: cor.textoApagado,
  chamaAcesa: cor.atencao,
  amigas: cor.chutes,
  trofeus: cor.jogo,
  sementinhas: cor.sementinha,
  /** O ponto de "não conseguimos ler" no placar. */
  falhou: cor.atencao,
  /** O selo das conquistas para resgatar. */
  resgatar: cor.primaria,
  /* As barras da semana: a passada e a que vem são material claro sobre o céu
     (a atual é o cartão branco do tema). */
  barraPassada: "rgba(255,255,255,0.74)",
  barraFutura: "rgba(255,255,255,0.56)",
  barraBorda: "rgba(255,255,255,0.9)",
  pontoFuturo: cor.trilho,
  textoForte: cor.texto,
  textoMedio: cor.textoApagado,
  /** O traço que liga os nós: o andado, e o que vem (pontilhado). */
  tracoAndado: "rgba(255,255,255,0.45)",
  tracoPorVir: "rgba(255,255,255,0.28)",
  /** O texto de um balão sobre o branco (a vitrine da entrada); na trilha o balão é framboesa. */
  balaoTexto: cor.primaria,
  /* A sementinha da vitrine da entrada */
  lojaIcone: cor.sementinha,
  lojaSaldo: cor.sementinha,
  /* Os enfeites do Cantinho na trilha (`DecorSprite` e o modo Arrumar) */
  enfeiteSombra: comAlfa(cor.texto, 0.18),
  haloOuro: ouro.claro,
  selecaoAro: cor.primaria,
  selecaoFundo: comAlfa(cor.primaria, 0.06),
  tirar: cor.urgente,
  redimensionar: cor.texto,
} as const;

/**
 * O nome e a frase de cada atividade da folha do dia (o `WELLNESS_META` do
 * site). A cor de cada uma mora na ficha da aba do bebê (`FICHA`), e a arte,
 * no objeto 3D (`ARTE`).
 */
export const META_DAS_ATIVIDADES = {
  aula: { titulo: "Aula de hoje", desc: "" },
  movement: {
    titulo: "Movimento",
    desc: "Três movimentos leves, com a figura mostrando como fazer cada um.",
  },
  meditation: {
    titulo: "Meditar",
    desc: "Você escolhe o tempo, o que precisa e o som de fundo.",
  },
  bonding: {
    titulo: "Momento com o bebê",
    desc: "Uma carta curta para ler em voz alta para o bebê.",
  },
  gratitude: {
    titulo: "Gratidão",
    desc: "Guarde no diário uma coisa boa do seu dia.",
  },
} as const;
