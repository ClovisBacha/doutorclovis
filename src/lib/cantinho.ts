/**
 * Meu Cantinho 🌱 — catálogo do "spend sink" das Sementinhas.
 *
 * Metáfora "cantinho que cresce" (jardim/ninho) — emocionalmente segura (ver
 * pesquisa): o berço é apenas UM item opcional, nunca o centro.
 *
 * Cada item tem um `type` que define ONDE aparece no Caminho:
 *  - fundo   → papel de parede (equipa 1)
 *  - ceu     → faixa do topo (sol/lua/estrelas...) — decoração acumulável
 *  - planta  → laterais da trilha
 *  - objeto  → objetos aconchegantes ao longo do caminho
 *  - bicho   → criaturas que passeiam
 *  - especial→ peça central animada (premium)
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
export type CantinhoType = "fundo" | "ceu" | "planta" | "objeto" | "bicho" | "especial" | "tema";

export type CantinhoItem = {
  id: string;
  name: string;
  emoji: string;
  price: number; // em Sementinhas
  type: CantinhoType;
  premium: boolean;
};

export const CANTINHO_CATEGORIES: { key: CantinhoType; label: string }[] = [
  { key: "tema", label: "Céu do app" },
  { key: "fundo", label: "Cenários" },
  { key: "ceu", label: "Céu" },
  { key: "planta", label: "Plantas" },
  { key: "objeto", label: "Objetos" },
  { key: "bicho", label: "Bichinhos" },
  { key: "especial", label: "Especiais" },
];

export const CANTINHO_ITEMS: CantinhoItem[] = [
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
    price: 90,
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

  // ── Troféu de coleção — NÃO se compra; desbloqueia ao ter todos os itens
  // normais (os 10 da loja comum). Recompensa da paciente mais dedicada. ─────
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
 * Itens exigidos pra desbloquear o troféu: os da loja COMUM (preço > 0, não
 * premium). Reachable por qualquer paciente dedicada — o troféu premia
 * dedicação, não assinatura. Os premium seguem sendo extras opcionais.
 */
/*
 * `tema` fica FORA da coleção: o troféu é por decorar o Cantinho, e o céu da
 * home não decora nada aqui. Incluí-lo tiraria o troféu de quem já completou
 * a coleção — a exigência passaria a ter um item que ela nunca comprou.
 */
export const CANTINHO_COMPLETION_REQUIRED: string[] = CANTINHO_ITEMS.filter(
  (i) => i.price > 0 && !i.premium && i.type !== "tema" && i.id !== CANTINHO_COMPLETIONIST_ID,
).map((i) => i.id);

/** True quando a paciente possui todos os itens exigidos pra coleção. */
export function isCantinhoCollectionComplete(ownedIds: Iterable<string>): boolean {
  const owned = ownedIds instanceof Set ? ownedIds : new Set(ownedIds);
  return CANTINHO_COMPLETION_REQUIRED.every((id) => owned.has(id));
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
