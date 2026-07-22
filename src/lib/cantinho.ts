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

export type CantinhoType = "fundo" | "ceu" | "planta" | "objeto" | "bicho" | "especial";

export type CantinhoItem = {
  id: string;
  name: string;
  emoji: string;
  price: number; // em Sementinhas
  type: CantinhoType;
  premium: boolean;
};

export const CANTINHO_CATEGORIES: { key: CantinhoType; label: string }[] = [
  { key: "fundo", label: "Cenários" },
  { key: "ceu", label: "Céu" },
  { key: "planta", label: "Plantas" },
  { key: "objeto", label: "Objetos" },
  { key: "bicho", label: "Bichinhos" },
  { key: "especial", label: "Especiais" },
];

export const CANTINHO_ITEMS: CantinhoItem[] = [
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
];

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
