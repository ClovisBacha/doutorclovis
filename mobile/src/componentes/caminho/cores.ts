import { cor } from "~/tema";

/**
 * As cores do CAMINHO que o tema não tem — tiradas do site
 * (gestacao-path.tsx, na paleta do Tailwind 4 que ele usa). As cores de cada
 * SEMANA não moram aqui: saem das fórmulas de `~/lib/jornada/caminho`.
 *
 * ⚠️ Se a fundação ganhar estes tokens em `~/tema`, apague daqui e importe de lá.
 */
export const corCaminho = {
  branco: cor.branco,
  /** A cor das sombras suaves (a opacidade vem em cada uso). */
  sombra: "#000000",
  /* O anel de tarefas e a estrela do dia */
  anelVazio: "#e8dfdc",
  ouroClaro: "#ffe08a",
  ouro: "#fdc32f",
  ouroEscuro: "#f0a51c",
  ouroContorno: "#e0a92b",
  estrelaApagada: "rgba(255,255,255,0.5)",
  estrelaContorno: "rgba(120,90,120,0.28)",
  /* A faixa do topo */
  faixaFundo: "rgba(255,250,246,0.95)",
  divisor: "#e2e8f0",
  chamaApagada: "#cad5e2",
  numeroApagado: "#90a1b9",
  chamaAcesa: "#fe9a00",
  amigas: "#00a6f4",
  trofeus: "#8e51ff",
  sementinhas: "#00bc7d",
  /* O cartão do humor */
  humorFundo: "rgba(255,255,255,0.8)",
  humorOpcao: "#f8fafc",
  /* A faixa da fase */
  faixaRosa: "#f6339a",
  faixaAmbar: "#fe9a00",
  faixaVioleta: "#8e51ff",
  faixaTravada: "#cad5e2",
  faixaTravadaLabio: "#94a3b8",
  cadeado: "#90a1b9",
  textoClaro80: "rgba(255,255,255,0.8)",
  /* A barra da semana e o balão de hoje */
  textoForte: "#314158",
  textoMedio: "#62748e",
  pontoFuturo: "#dde5ee",
  balaoTexto: "#f6339a",
  /* Os botões flutuantes */
  lojaFundo: "#d0fae5",
  lojaAro: "#5ee9b5",
  lojaIcone: "#009966",
  lojaSaldo: "#007a55",
  lojaSaldoAro: "#a4f4cf",
  lojaBrilho: "#10b981",
  lapisFundo: "rgba(255,255,255,0.95)",
  lapisAro: "#e2e8f0",
  /* Os enfeites do Cantinho na trilha (`DecorSprite` e o modo Arrumar) */
  enfeiteSombra: "rgba(0,0,0,0.12)",
  haloOuro: "rgb(255,214,120)",
  selecaoAro: "#00d492",
  selecaoFundo: "rgba(236,253,245,0.4)",
  tirar: "#c70036",
  redimensionar: "#007a55",
  barraFundo: "rgba(255,255,255,0.95)",
  barraBorda: "#a4f4cf",
  barraTamanho: "#009966",
  barraTirar: "#ff2056",
  desfazerFundo: "#f1f5f9",
  desfazerTexto: "#314158",
  desfazerAro: "#e2e8f0",
  pronto: "#007a55",
  bandejaFundo: "#f1f5f9",
  bandejaAro: "#e2e8f0",
  /* A folha do dia ("Atividades de hoje") */
  diaFundo1: "#fff5f4",
  diaFundo2: "#ffeae7",
  diaFundo3: "#ffdfd8",
  diaFundo4: "#ffd4c9",
  tinta: "#4b3a55",
  tintaSec: "rgba(66,48,78,0.84)",
  vidroBase: "rgba(255,252,253,0.82)",
  vidroLuzForte: "rgba(255,255,255,0.55)",
  vidroLuzFraca: "rgba(255,255,255,0.3)",
  vidroBorda: "rgba(255,255,255,0.7)",
  vidroSombra: "#3c2846",
  feitoVerde: "#00d492",
  circuloVazio: "rgba(160,130,160,0.4)",
  setaFundo: "rgba(255,255,255,0.55)",
  seta: "#90a1b9",
  voltarFundo: "rgba(255,255,255,0.7)",
  voltarSeta: "#62748e",
  sementinhasTexto: "#7c3aed",
} as const;

/**
 * Cada atividade com a SUA cor (`WELLNESS_META` do site): tile pastel com o
 * glifo na cor cheia, e o título na mesma cor do glifo.
 */
export const META_DAS_ATIVIDADES = {
  aula: { titulo: "Aula de hoje", tile: "#dfe0fb", tileB: "#c9cbf7", tinta: "#3d34c4", desc: "" },
  movement: {
    titulo: "Movimento",
    tile: "#fde6bd",
    tileB: "#fbd79b",
    tinta: "#b2560c",
    desc: "3 movimentos leves, com a figura mostrando como fazer cada um.",
  },
  meditation: {
    titulo: "Meditar",
    tile: "#e9dcfa",
    tileB: "#dcc8f6",
    tinta: "#7434d4",
    desc: "Você escolhe o tempo, o que precisa e o som de fundo.",
  },
  bonding: {
    titulo: "Momento com o bebê",
    tile: "#fbd6e0",
    tileB: "#f8c2d2",
    tinta: "#c11a63",
    desc: "Uma carta de 1 minuto pra ler em voz alta pro bebê.",
  },
  gratitude: {
    titulo: "Gratidão",
    tile: "#d3ecdb",
    tileB: "#bce2c8",
    tinta: "#0f7538",
    desc: "Guarde uma coisa boa do seu dia no diário.",
  },
} as const;
