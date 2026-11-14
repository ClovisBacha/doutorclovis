import { funcaoDoServidor } from "~/servidor/ponte";

/**
 * O Meu Cantinho — src/lib/cantinho.functions.ts. A loja de SEMENTINHAS (a
 * moeda que ela ganha cuidando de si): comprar um enfeite, equipar um cenário.
 * Nada aqui envolve dinheiro.
 */

export type LeituraDoCantinho =
  | {
      ok: true;
      balance: number;
      owned: string[];
      premium: boolean;
      equippedFundo: string | null;
      collectionComplete: boolean;
      collectionOwned: number;
      collectionTotal: number;
      trofeus: number;
      careMode?: boolean;
    }
  | { ok: false; error: string };

export const lerCantinho = funcaoDoServidor<Record<string, never>, LeituraDoCantinho>(
  "src/lib/cantinho.functions.ts",
  "getCantinho",
);

export type CompraDoCantinho =
  | {
      ok: true;
      balance: number;
      itemId: string;
      conjuntosFechados?: string[];
      conjuntosNovos?: string[];
      bonusNovo?: number;
    }
  | { ok: false; error: string; motivo?: string | null; balance?: number };

export const comprarDoCantinho = funcaoDoServidor<{ itemId: string }, CompraDoCantinho>(
  "src/lib/cantinho.functions.ts",
  "buyCantinhoItem",
);

export const equiparCenario = funcaoDoServidor<
  { fundoId: string | null },
  { ok: true; equippedFundo: string | null } | { ok: false; error: string }
>("src/lib/cantinho.functions.ts", "setCantinhoFundo");
