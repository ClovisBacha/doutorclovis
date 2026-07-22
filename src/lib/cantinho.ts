/**
 * Meu Cantinho 🌱 — o "spend sink" das Sementinhas.
 *
 * Metáfora de um cantinho aconchegante que CRESCE (jardim/ninho), escolhida por
 * ser emocionalmente segura (ver pesquisa): em caso de perda gestacional, um
 * cantinho/jardim é muito menos doloroso que um "quarto do bebê" montado peça a
 * peça. O berço é apenas UM item opcional dentro do cantinho, não o centro.
 *
 * O catálogo é compartilhado (cliente + servidor). O PREÇO é a fonte da verdade
 * no servidor: a compra valida o preço daqui, nunca confia no valor do cliente.
 */

export type CantinhoCategory = "plantas" | "conforto" | "luz" | "decoracao" | "bebe";

export type CantinhoItem = {
  id: string;
  name: string;
  emoji: string;
  price: number; // em Sementinhas
  category: CantinhoCategory;
};

export const CANTINHO_CATEGORIES: { key: CantinhoCategory; label: string }[] = [
  { key: "plantas", label: "Plantas" },
  { key: "conforto", label: "Conforto" },
  { key: "luz", label: "Luz" },
  { key: "decoracao", label: "Decoração" },
  { key: "bebe", label: "Bebê" },
];

export const CANTINHO_ITEMS: CantinhoItem[] = [
  // Plantas — o coração da metáfora "que cresce"
  { id: "planta-suculenta", name: "Suculenta", emoji: "🌱", price: 30, category: "plantas" },
  { id: "planta-vaso", name: "Vaso de flores", emoji: "🪴", price: 45, category: "plantas" },
  { id: "planta-samambaia", name: "Samambaia", emoji: "🌿", price: 55, category: "plantas" },
  { id: "planta-girassol", name: "Girassol", emoji: "🌻", price: 60, category: "plantas" },
  // Conforto
  {
    id: "conforto-poltrona",
    name: "Poltrona de amamentação",
    emoji: "🪑",
    price: 120,
    category: "conforto",
  },
  { id: "conforto-tapete", name: "Tapetinho fofo", emoji: "🧶", price: 50, category: "conforto" },
  { id: "conforto-almofada", name: "Almofada", emoji: "🛋️", price: 45, category: "conforto" },
  { id: "conforto-cestinho", name: "Cestinho", emoji: "🧺", price: 35, category: "conforto" },
  // Luz
  { id: "luz-luminaria", name: "Luminária aconchegante", emoji: "🪔", price: 60, category: "luz" },
  { id: "luz-lua", name: "Luz noturna lua", emoji: "🌙", price: 55, category: "luz" },
  { id: "luz-velinha", name: "Velinha aromática", emoji: "🕯️", price: 40, category: "luz" },
  // Decoração
  { id: "deco-movel", name: "Móbile", emoji: "🎐", price: 70, category: "decoracao" },
  { id: "deco-quadro", name: "Quadrinho", emoji: "🖼️", price: 40, category: "decoracao" },
  { id: "deco-nuvem", name: "Nuvem fofa", emoji: "☁️", price: 45, category: "decoracao" },
  {
    id: "deco-arcoiris",
    name: "Arco-íris de parede",
    emoji: "🌈",
    price: 50,
    category: "decoracao",
  },
  { id: "deco-estrelas", name: "Estrelinhas", emoji: "✨", price: 40, category: "decoracao" },
  // Bebê — opcionais, nunca o centro da metáfora
  { id: "bebe-ursinho", name: "Ursinho de pelúcia", emoji: "🧸", price: 55, category: "bebe" },
  { id: "bebe-coelho", name: "Coelhinho", emoji: "🐰", price: 55, category: "bebe" },
  { id: "bebe-berco", name: "Berço (opcional)", emoji: "🛏️", price: 150, category: "bebe" },
];

export const CANTINHO_BY_ID: Record<string, CantinhoItem> = Object.fromEntries(
  CANTINHO_ITEMS.map((i) => [i.id, i]),
);
