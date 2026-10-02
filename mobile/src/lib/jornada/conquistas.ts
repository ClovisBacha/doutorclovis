/**
 * A GRADE DE CONQUISTAS — que estado cada cartão mostra.
 *
 * Como no Duolingo: o servidor DESBLOQUEIA (`checkAndAwardAchievements`), e a
 * conquista ESPERA o toque para pagar (`resgatarConquista`).
 *
 * ⚠️ `resgatadas: null` é FALHA DE LEITURA, não "nenhuma resgatada". Mostrar
 * "Resgatar" em tudo nesse caso convidaria a resgatar de novo o que já foi
 * pago — e o servidor diria "repetido" a cada toque. O estado é neutro.
 * Sem react-native aqui: é testado pelo bun.
 */

import {
  CONQUISTAS,
  RARIDADES,
  type CategoriaConquista,
  type ConquistaDef,
  type Raridade,
} from "@/lib/conquistas";
import type { ConquistaDesbloqueada } from "~/servidor/economia";

export type EstadoDaConquista = "bloqueada" | "resgatar" | "resgatada" | "desbloqueada";

export type Cartao = {
  def: ConquistaDef;
  estado: EstadoDaConquista;
  quando: string | null;
  sementinhas: number;
};

export function estadoDe(
  key: string,
  desbloqueadas: Map<string, string>,
  resgatadas: Set<string> | null,
): EstadoDaConquista {
  if (!desbloqueadas.has(key)) return "bloqueada";
  if (resgatadas === null) return "desbloqueada";
  return resgatadas.has(key) ? "resgatada" : "resgatar";
}

export function montarGrade(
  unlocked: readonly ConquistaDesbloqueada[],
  resgatadas: readonly string[] | null,
  catalogo: readonly ConquistaDef[] = CONQUISTAS,
): Cartao[] {
  const mapa = new Map(unlocked.map((u) => [u.achievement_key, u.unlocked_at] as const));
  const res = resgatadas === null ? null : new Set(resgatadas);
  return catalogo.map((def) => ({
    def,
    estado: estadoDe(def.key, mapa, res),
    quando: mapa.get(def.key) ?? null,
    sementinhas: RARIDADES[def.raridade].sementinhas,
  }));
}

export function paraResgatar(grade: readonly Cartao[]): number {
  return grade.filter((c) => c.estado === "resgatar").length;
}

export const CATEGORIAS: readonly { chave: CategoriaConquista; rotulo: string }[] = [
  { chave: "educacao", rotulo: "Aprender" },
  { chave: "saude", rotulo: "Cuidar da saúde" },
  { chave: "diario", rotulo: "Diário" },
  { chave: "bebe", rotulo: "Bebê" },
  { chave: "familia", rotulo: "Família" },
];

/**
 * As prateleiras: o que já pode ser resgatado vem primeiro (é o que pede o
 * toque), depois por categoria; as do pós-parto ficam numa prateleira própria
 * — sem isso a gestante leria "3 de 42" contra um teto que ainda nem existe.
 */
export function prateleiras(
  grade: readonly Cartao[],
  posParto: boolean,
): { titulo: string; cartoes: Cartao[] }[] {
  const daFase = grade.filter((c) => posParto || !c.def.posParto);
  const fora: { titulo: string; cartoes: Cartao[] }[] = [];
  for (const cat of CATEGORIAS) {
    const cartoes = daFase
      .filter((c) => c.def.category === cat.chave && (posParto || !c.def.posParto))
      .sort(ordemDentro);
    if (cartoes.length) fora.push({ titulo: cat.rotulo, cartoes });
  }
  if (!posParto) {
    const depois = grade.filter((c) => c.def.posParto).sort(ordemDentro);
    if (depois.length) fora.push({ titulo: "Depois do nascimento", cartoes: depois });
  }
  return fora;
}

const PESO_ESTADO: Record<EstadoDaConquista, number> = {
  resgatar: 0,
  desbloqueada: 1,
  resgatada: 1,
  bloqueada: 2,
};
const PESO_RARIDADE: Record<Raridade, number> = { comum: 0, raro: 1, epico: 2 };

function ordemDentro(a: Cartao, b: Cartao): number {
  const e = PESO_ESTADO[a.estado] - PESO_ESTADO[b.estado];
  if (e) return e;
  return PESO_RARIDADE[a.def.raridade] - PESO_RARIDADE[b.def.raridade];
}

/** "12 de 37" — o teto da gestante não conta as do pós-parto. */
export function placar(grade: readonly Cartao[], posParto: boolean): { feitas: number; total: number } {
  const daFase = grade.filter((c) => posParto || !c.def.posParto);
  return { feitas: daFase.filter((c) => c.estado !== "bloqueada").length, total: daFase.length };
}
