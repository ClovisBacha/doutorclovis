/**
 * Meu Cantinho 🌱 — catálogo do "spend sink" das Sementinhas.
 *
 * Metáfora "cantinho que cresce" (jardim/ninho) — emocionalmente segura (ver
 * pesquisa): o berço é apenas UM item opcional, nunca o centro.
 *
 * Cada item tem um `type` que define ONDE aparece no Caminho:
 *  - fundo   → papel de parede (equipa 1)
 *  - ceu     → faixa do topo (sol/lua/estrelas...) — decoração acumulável,
 *              espalhada sozinha por `seedDecor` na faixa acima do 1º nó
 *  - planta  → laterais da trilha
 *  - objeto  → objetos aconchegantes ao longo do caminho
 *  - bicho   → criaturas que passeiam
 *  - luz     → luzinhas que acendem e apagam
 *  - agua    → coisas que boiam
 *  - especial→ peça de destaque, com halo
 *
 * `premium: true` → só quem assina o Premium compra (ainda paga com Sementinhas;
 * nunca dinheiro real por item = sem pay-to-win). Item comprado fica pra sempre.
 *
 * O PREÇO é a fonte da verdade no servidor: a compra valida o preço daqui.
 */

/**
 * `tema` é o único tipo que NÃO decora o Cantinho: veste o céu da home do app.
 * Vive aqui porque a loja, a carteira e a RPC de compra são as mesmas — o que
 * muda é só onde o item é aplicado.
 */
export type CantinhoType =
  | "fundo"
  | "ceu"
  | "planta"
  | "objeto"
  | "bicho"
  | "especial"
  | "tema"
  /** Pele das bolinhas do Caminho — três estados, ver `trilha-skins.ts`. */
  | "trilha"
  /**
   * Luzes — acendem e apagam devagar (`dcTwinkle`). Categoria nova, e ela só
   * existe porque TEM COMPORTAMENTO PRÓPRIO: um tipo que se comporta igual a
   * `objeto` seria só um rótulo a mais na loja.
   */
  | "luz"
  /** Águas — sobem e descem com um balanço curto (`dcRipple`). */
  | "agua";

export type CantinhoItem = {
  id: string;
  name: string;
  emoji: string;
  price: number; // em Sementinhas
  type: CantinhoType;
  premium: boolean;
};

export const CANTINHO_CATEGORIES: { key: CantinhoType; label: string }[] = [
  /* Primeira da lista: é a categoria que muda a tela que ela mais olha. */
  { key: "trilha", label: "Bolinhas" },
  { key: "tema", label: "Céu do app" },
  { key: "fundo", label: "Cenários" },
  { key: "ceu", label: "Céu" },
  { key: "planta", label: "Plantas" },
  { key: "luz", label: "Luzes" },
  { key: "agua", label: "Águas" },
  { key: "objeto", label: "Objetos" },
  { key: "bicho", label: "Bichinhos" },
  { key: "especial", label: "Especiais" },
];

export const CANTINHO_ITEMS: CantinhoItem[] = [
  /* ── Peles do Caminho ──────────────────────────────────────────────
     Preço alto (280) porque ela troca a tela inteira do jogo, não um canto
     dela — e porque é o tipo de item que a paciente vê a cada dia da jornada,
     não uma vez. Não é premium: quem junta Sementinhas alcança.
     As oito têm arte (ago/2026). Três são alcançáveis sem assinatura. */
  {
    id: "trilha-jardim",
    name: "Bolinhas Jardim",
    emoji: "🌱",
    price: 280,
    type: "trilha",
    premium: false,
  },
  // ── Grátis (1) — cenário inicial, já vem com a paciente ─────────────
  // "Sem graça de propósito": um fundo liso que só troca de cor com as
  // semanas. Serve de ponto de partida pra dar gostinho de personalizar antes
  // do 1º item comprado (a Suculenta, 30). Preço 0 => sempre possuído.
  {
    id: "fundo-simples",
    name: "Fundo Suave",
    emoji: "🎨",
    price: 0,
    type: "fundo",
    premium: false,
  },

  // ── Céu do app ─────────────────────────────────────────────────────
  // O céu original do app, de antes da arte por momento do dia. Guardado
  // aqui para quem gostava dele: compra uma vez e troca quando quiser.
  {
    id: "tema-ceu-v1",
    name: "Céu Clássico",
    emoji: "🌅",
    price: 150,
    type: "tema",
    premium: false,
  },

  // ── Loja normal (10) — só Sementinhas ──────────────────────────────
  {
    id: "planta-suculenta",
    name: "Suculenta",
    emoji: "🌱",
    price: 30,
    type: "planta",
    premium: false,
  },
  {
    id: "objeto-cestinho",
    name: "Cestinho",
    emoji: "🧺",
    price: 35,
    type: "objeto",
    premium: false,
  },
  {
    id: "ceu-estrelinhas",
    name: "Estrelinhas",
    emoji: "✨",
    price: 40,
    type: "ceu",
    premium: false,
  },
  { id: "ceu-nuvem", name: "Nuvem fofa", emoji: "☁️", price: 40, type: "ceu", premium: false },
  {
    id: "planta-vaso",
    name: "Vaso de flores",
    emoji: "🪴",
    price: 45,
    type: "planta",
    premium: false,
  },
  {
    id: "bicho-borboleta",
    name: "Borboleta",
    emoji: "🦋",
    price: 50,
    type: "bicho",
    premium: false,
  },
  {
    id: "objeto-tapete",
    name: "Tapetinho fofo",
    emoji: "🧶",
    price: 50,
    type: "objeto",
    premium: false,
  },
  {
    id: "planta-girassol",
    name: "Girassol",
    emoji: "🌻",
    price: 60,
    type: "planta",
    premium: false,
  },
  {
    id: "objeto-luminaria",
    name: "Luminária",
    emoji: "🪔",
    price: 60,
    type: "objeto",
    premium: false,
  },
  {
    id: "fundo-amanhecer",
    name: "Campo ao amanhecer",
    emoji: "🌅",
    price: 120,
    type: "fundo",
    premium: false,
  },

  // ── Premium (20) — exige assinatura ────────────────────────────────
  { id: "bicho-coelho", name: "Coelhinho", emoji: "🐰", price: 160, type: "bicho", premium: true },
  { id: "bicho-gato", name: "Gatinho", emoji: "🐈", price: 180, type: "bicho", premium: true },
  {
    id: "bicho-passaro",
    name: "Passarinho cantante",
    emoji: "🐦",
    price: 180,
    type: "bicho",
    premium: true,
  },
  {
    id: "especial-balao",
    name: "Balão de ar",
    emoji: "🎈",
    price: 200,
    type: "especial",
    premium: true,
  },
  {
    id: "especial-vagalume",
    name: "Vaga-lumes",
    emoji: "🪄",
    price: 220,
    type: "especial",
    premium: true,
  },
  {
    id: "objeto-mobile",
    name: "Móbile de estrelas",
    emoji: "🎐",
    price: 150,
    type: "objeto",
    premium: true,
  },
  {
    id: "objeto-poltrona",
    name: "Poltrona de amamentação",
    emoji: "🪑",
    price: 200,
    type: "objeto",
    premium: true,
  },
  {
    id: "objeto-berco",
    name: "Berço (opcional)",
    emoji: "🛏️",
    price: 250,
    type: "objeto",
    premium: true,
  },
  { id: "ceu-sol", name: "Sol radiante", emoji: "☀️", price: 120, type: "ceu", premium: true },
  { id: "ceu-arcoiris", name: "Arco-íris", emoji: "🌈", price: 150, type: "ceu", premium: true },
  { id: "ceu-lua", name: "Lua e estrelas", emoji: "🌙", price: 140, type: "ceu", premium: true },
  {
    id: "fundo-quartinho",
    name: "Quartinho aconchegante",
    emoji: "🧸",
    price: 220,
    type: "fundo",
    premium: true,
  },
  { id: "fundo-mar", name: "Ondas do mar", emoji: "🌊", price: 280, type: "fundo", premium: true },
  {
    id: "fundo-estrelas",
    name: "Chuva de estrelas",
    emoji: "🌠",
    price: 250,
    type: "fundo",
    premium: true,
  },
  {
    id: "fundo-aurora",
    name: "Aurora boreal",
    emoji: "🌌",
    price: 300,
    type: "fundo",
    premium: true,
  },
  {
    id: "especial-cascata",
    name: "Cascata",
    emoji: "💧",
    price: 300,
    type: "especial",
    premium: true,
  },
  {
    id: "especial-arvore",
    name: "Árvore que cresce",
    emoji: "🌳",
    price: 350,
    type: "especial",
    premium: true,
  },
  {
    id: "especial-dianoite",
    name: "Ciclo dia/noite",
    emoji: "🌗",
    price: 400,
    type: "especial",
    premium: true,
  },
  {
    id: "especial-outono",
    name: "Outono",
    emoji: "🍂",
    price: 160,
    type: "especial",
    premium: true,
  },
  { id: "especial-natal", name: "Natal", emoji: "🎄", price: 180, type: "especial", premium: true },

  /* ══════════════════════════════════════════════════════════════════════
     AMPLIAÇÃO — ago/2026

     Regra que vale para tudo daqui pra baixo: item novo só entra se APARECE.
     A auditoria da loja encontrou cinco itens de `ceu` que não apareciam em
     lugar nenhum até a paciente descobrir sozinha o modo Arrumar — dinheiro
     em troca de nada. Antes de somar item, `seedDecor` passou a espalhar o
     céu na faixa do alto, e as duas categorias novas ganharam animação
     própria. Nada aqui é rótulo sem comportamento.
     ══════════════════════════════════════════════════════════════════════ */

  // ── Peles do Caminho (+7) ──────────────────────────────────────────────
  // A arte das sete existia como prompt em `docs/prompts-skins.md` e parou por
  // falta de créditos, não por decisão. Agora existe. É o item de maior
  // impacto do catálogo: troca a tela que a paciente abre todo dia, e conta o
  // progresso na FORMA (dorme · desperta · floresce).
  {
    id: "trilha-lotus",
    name: "Bolinhas Lótus",
    emoji: "🪷",
    price: 300,
    type: "trilha",
    premium: false,
  },
  {
    id: "trilha-origami",
    name: "Bolinhas Origami",
    emoji: "🐦‍⬛",
    price: 320,
    type: "trilha",
    premium: false,
  },
  {
    id: "trilha-perolas",
    name: "Bolinhas Pérolas",
    emoji: "🦪",
    price: 340,
    type: "trilha",
    premium: true,
  },
  {
    id: "trilha-constelacao",
    name: "Bolinhas Constelação",
    emoji: "✨",
    price: 360,
    type: "trilha",
    premium: true,
  },
  {
    id: "trilha-cristais",
    name: "Bolinhas Cristais",
    emoji: "💎",
    price: 360,
    type: "trilha",
    premium: true,
  },
  {
    id: "trilha-planetas",
    name: "Bolinhas Planetas",
    emoji: "🪐",
    price: 380,
    type: "trilha",
    premium: true,
  },
  {
    id: "trilha-coracao",
    name: "Bolinhas Coração",
    emoji: "💗",
    price: 400,
    type: "trilha",
    premium: true,
  },

  // ── Luzes (+5) — categoria nova, animação `dcTwinkle` ──────────────────
  { id: "luz-vela", name: "Velinha", emoji: "🕯️", price: 45, type: "luz", premium: false },
  { id: "luz-lampiao", name: "Lampião", emoji: "🏮", price: 70, type: "luz", premium: false },
  { id: "luz-pisca", name: "Pisca-pisca", emoji: "🎇", price: 95, type: "luz", premium: false },
  { id: "luz-lanterna", name: "Lanterninha", emoji: "🔦", price: 110, type: "luz", premium: true },
  {
    id: "luz-estrela-cadente",
    name: "Estrela cadente",
    emoji: "🌠",
    price: 160,
    type: "luz",
    premium: true,
  },

  // ── Águas (+5) — categoria nova, animação `dcRipple` ───────────────────
  { id: "agua-poca", name: "Pocinha", emoji: "💧", price: 55, type: "agua", premium: false },
  { id: "agua-fonte", name: "Fontinha", emoji: "⛲", price: 90, type: "agua", premium: false },
  { id: "agua-peixinho", name: "Peixinho", emoji: "🐠", price: 120, type: "agua", premium: false },
  { id: "agua-concha", name: "Conchinha", emoji: "🐚", price: 140, type: "agua", premium: true },
  { id: "agua-golfinho", name: "Golfinho", emoji: "🐬", price: 180, type: "agua", premium: true },

  // ── Céu (+4) — agora eles APARECEM sozinhos, na faixa do alto ──────────
  {
    id: "ceu-passarinhos",
    name: "Bando de passarinhos",
    emoji: "🕊️",
    price: 60,
    type: "ceu",
    premium: false,
  },
  { id: "ceu-pipa", name: "Pipa", emoji: "🪁", price: 80, type: "ceu", premium: false },
  { id: "ceu-balao-ar", name: "Balãozinho", emoji: "🎈", price: 100, type: "ceu", premium: false },
  { id: "ceu-cometa", name: "Cometa", emoji: "☄️", price: 160, type: "ceu", premium: true },

  // ── Plantas (+4) ───────────────────────────────────────────────────────
  { id: "planta-trevo", name: "Trevo", emoji: "🍀", price: 35, type: "planta", premium: false },
  { id: "planta-tulipa", name: "Tulipa", emoji: "🌷", price: 50, type: "planta", premium: false },
  {
    id: "planta-cerejeira",
    name: "Cerejeira",
    emoji: "🌸",
    price: 75,
    type: "planta",
    premium: false,
  },
  { id: "planta-bonsai", name: "Bonsai", emoji: "🎍", price: 90, type: "planta", premium: true },

  // ── Objetos (+4) ───────────────────────────────────────────────────────
  {
    id: "objeto-livrinho",
    name: "Livrinho de história",
    emoji: "📖",
    price: 40,
    type: "objeto",
    premium: false,
  },
  {
    id: "objeto-chaleira",
    name: "Chá quentinho",
    emoji: "🫖",
    price: 55,
    type: "objeto",
    premium: false,
  },
  {
    id: "objeto-almofada",
    name: "Almofadinha",
    emoji: "🛋️",
    price: 70,
    type: "objeto",
    premium: false,
  },
  {
    id: "objeto-caixinha",
    name: "Caixinha de música",
    emoji: "🎵",
    price: 110,
    type: "objeto",
    premium: true,
  },

  // ── Bichinhos (+4) ─────────────────────────────────────────────────────
  { id: "bicho-joaninha", name: "Joaninha", emoji: "🐞", price: 45, type: "bicho", premium: false },
  { id: "bicho-abelha", name: "Abelhinha", emoji: "🐝", price: 55, type: "bicho", premium: false },
  {
    id: "bicho-tartaruga",
    name: "Tartaruguinha",
    emoji: "🐢",
    price: 90,
    type: "bicho",
    premium: false,
  },
  { id: "bicho-raposa", name: "Raposinha", emoji: "🦊", price: 200, type: "bicho", premium: true },

  // ── Cenários (+4) — cada um tem gradiente em CANTINHO_FUNDO_BG ─────────
  {
    id: "fundo-bosque",
    name: "Bosque tranquilo",
    emoji: "🌲",
    price: 140,
    type: "fundo",
    premium: false,
  },
  {
    id: "fundo-lavanda",
    name: "Campo de lavanda",
    emoji: "💜",
    price: 180,
    type: "fundo",
    premium: false,
  },
  {
    id: "fundo-deserto",
    name: "Fim de tarde no deserto",
    emoji: "🏜️",
    price: 240,
    type: "fundo",
    premium: true,
  },
  {
    id: "fundo-neve",
    name: "Manhã de neve",
    emoji: "❄️",
    price: 260,
    type: "fundo",
    premium: true,
  },

  // ── Especiais (+3) ─────────────────────────────────────────────────────
  /* Não-premium de propósito: era a única categoria sem NENHUM item pago
     alcançável sem assinatura, e isso deixava a Coroa fora do alcance de quem
     é do plano grátis — o defeito que esta ampliação veio corrigir. */
  {
    id: "especial-primavera",
    name: "Primavera",
    emoji: "🌺",
    price: 170,
    type: "especial",
    premium: false,
  },
  {
    id: "especial-chuva",
    name: "Chuva mansa",
    emoji: "🌧️",
    price: 200,
    type: "especial",
    premium: true,
  },
  {
    id: "especial-arcoiris-duplo",
    name: "Arco-íris duplo",
    emoji: "🌈",
    price: 320,
    type: "especial",
    premium: true,
  },

  // ── Troféu de coleção — NÃO se compra; desbloqueia sozinho.
  // O requisito está em CANTINHO_COMPLETION_REQUIRED, logo abaixo. ─────────
  {
    id: "especial-colecao",
    name: "Coroa da Coleção",
    emoji: "👑",
    price: 0,
    type: "especial",
    premium: false,
  },
];

/** O troféu que coroa a coleção completa (concedido, nunca comprado). */
export const CANTINHO_COMPLETIONIST_ID = "especial-colecao";

/**
 * A Coroa pede UM item pago de CADA categoria — não o catálogo inteiro.
 *
 * Pedia todos os itens pagos. Com 32 itens isso já eram 5.350 🌱, uns 76 dias
 * de jogo perfeito; com os 40 novos passaria de 15.000, mais dias do que dura
 * uma gestação. Meta que não cabe na jornada da paciente não é meta, é enfeite
 * inalcançável — e ela ficava sinalizada por uma linha de 9px no último tile
 * de uma grade de 34.
 *
 * "Um de cada" também diz uma coisa melhor: você passeou pelo cantinho
 * inteiro. E escala sozinho — categoria nova entra na conta sem ninguém
 * lembrar de mexer aqui.
 *
 * Ninguém perde nada na troca: quem tinha a coleção antiga completa
 * necessariamente tem um de cada categoria, então continua com a coroa.
 *
 * Fica de fora o que tem preço 0 (grátis desde o primeiro acesso, exigir não
 * pediria esforço) e a própria coroa.
 */
export const CANTINHO_COMPLETION_CATEGORIES: CantinhoType[] = [
  ...new Set(
    CANTINHO_ITEMS.filter((i) => i.price > 0 && i.id !== CANTINHO_COMPLETIONIST_ID).map(
      (i) => i.type,
    ),
  ),
];

/**
 * Um id representativo por categoria — usado só pelo contador "X de Y" da
 * tela. O requisito de verdade é por CATEGORIA (ver a função abaixo).
 */
export const CANTINHO_COMPLETION_REQUIRED: string[] = CANTINHO_COMPLETION_CATEGORIES.map(
  (t) =>
    CANTINHO_ITEMS.find((i) => i.type === t && i.price > 0 && i.id !== CANTINHO_COMPLETIONIST_ID)!
      .id,
);

/**
 * Quantas categorias a Coroa exige.
 *
 * É um PISO fixo (8), não `CANTINHO_COMPLETION_CATEGORIES.length`, e a
 * diferença é a coisa mais importante deste arquivo:
 *
 * O app não pode tirar de volta um troféu que já deu. Se o requisito fosse
 * "todas as categorias", cada categoria nova revogaria a Coroa de quem já a
 * tinha — e Luzes e Águas nasceram nesta mesma ampliação, então a paciente
 * que fechou a coleção antiga abriria o app amanhã sem a coroa que conquistou
 * ontem. Nenhuma explicação conserta isso.
 *
 * Oito era o número de categorias quando a Coroa foi desenhada. Continua
 * pedindo passeio pelo cantinho inteiro (hoje são dez), e sobe só se um dia
 * alguém decidir, de propósito, que deve subir.
 */
export const CANTINHO_COMPLETION_MIN = 8;

/** Quantas categorias já têm ao menos um item pago comprado. */
export function cantinhoCategoriasCompletas(ownedIds: Iterable<string>): number {
  const owned = ownedIds instanceof Set ? ownedIds : new Set(ownedIds);
  return CANTINHO_COMPLETION_CATEGORIES.filter((t) =>
    CANTINHO_ITEMS.some(
      (i) => i.type === t && i.price > 0 && i.id !== CANTINHO_COMPLETIONIST_ID && owned.has(i.id),
    ),
  ).length;
}

/** True quando a paciente tem item pago em pelo menos 8 categorias. */
export function isCantinhoCollectionComplete(ownedIds: Iterable<string>): boolean {
  return cantinhoCategoriasCompletas(ownedIds) >= CANTINHO_COMPLETION_MIN;
}

export const CANTINHO_BY_ID: Record<string, CantinhoItem> = Object.fromEntries(
  CANTINHO_ITEMS.map((i) => [i.id, i]),
);

/** Gradiente de fundo (papel de parede) por item `fundo`, aplicado no Caminho. */
export const CANTINHO_FUNDO_BG: Record<string, string> = {
  "fundo-amanhecer": "linear-gradient(180deg,#fde7c8 0%,#fbcfa0 40%,#f6e6cf 100%)",
  "fundo-quartinho": "linear-gradient(180deg,#f3e8ff 0%,#fde2e4 55%,#fff 100%)",
  "fundo-mar": "linear-gradient(180deg,#cdeffd 0%,#8fd3f4 55%,#e6f7ff 100%)",
  "fundo-estrelas": "linear-gradient(180deg,#1e2a5a 0%,#39306b 55%,#5b4b8a 100%)",
  "fundo-aurora": "linear-gradient(180deg,#0b2f3a 0%,#12664f 45%,#1f8a6b 80%,#0b2f3a 100%)",
  "fundo-bosque": "linear-gradient(180deg,#e8f3e6 0%,#bcd9b6 45%,#8fbf94 100%)",
  "fundo-lavanda": "linear-gradient(180deg,#f3eefc 0%,#d9c9f2 45%,#b9a3e3 100%)",
  "fundo-deserto": "linear-gradient(180deg,#ffd9a0 0%,#f2a765 45%,#c9714a 100%)",
  "fundo-neve": "linear-gradient(180deg,#eef5fb 0%,#d6e6f3 50%,#c2d6e8 100%)",
};

/**
 * Tons "sem graça" do Fundo Suave (grátis). Trocam com a semana pra dar a
 * sensação de que "às vezes muda de cor", sem competir com os cenários pagos.
 */
const FUNDO_SIMPLES_TONS = [
  "linear-gradient(180deg,#f6f7fb 0%,#eef1f7 100%)",
  "linear-gradient(180deg,#f4f8f5 0%,#e8f1ec 100%)",
  "linear-gradient(180deg,#fbf6f4 0%,#f3e9e5 100%)",
  "linear-gradient(180deg,#f5f4fb 0%,#ebe9f5 100%)",
  "linear-gradient(180deg,#f8f6f1 0%,#efeadf 100%)",
  "linear-gradient(180deg,#f2f8fb 0%,#e4eff5 100%)",
];

/**
 * Fundo aplicado no Caminho para um item `fundo`. O Fundo Suave (grátis) troca
 * de tom pela semana; os demais usam o gradiente fixo do catálogo. `week` é a
 * semana gestacional (opcional). Devolve null quando não há cenário.
 */
export function fundoBgFor(id: string | null | undefined, week?: number | null): string | null {
  if (!id) return null;
  if (id === "fundo-simples") {
    const w = Number.isFinite(week) ? Math.max(0, Math.floor(week as number)) : 0;
    return FUNDO_SIMPLES_TONS[w % FUNDO_SIMPLES_TONS.length];
  }
  return CANTINHO_FUNDO_BG[id] ?? null;
}
