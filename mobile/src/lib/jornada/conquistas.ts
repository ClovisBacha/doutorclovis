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

/**
 * As seções da aba, NA ORDEM E COM OS EMOJIS DO SITE (conquistas-tab.tsx). Os
 * cartões ficam na ordem do catálogo, sem reordenar: as do pós-parto aparecem
 * no fim da categoria delas, e a nota do resumo explica que elas esperam o
 * nascimento.
 */
export const SECOES: readonly { chave: CategoriaConquista; rotulo: string; emoji: string }[] = [
  { chave: "bebe", rotulo: "Bebê", emoji: "👶" },
  { chave: "saude", rotulo: "Saúde", emoji: "❤️" },
  { chave: "diario", rotulo: "Diário", emoji: "📝" },
  { chave: "educacao", rotulo: "Educação", emoji: "🎓" },
  { chave: "familia", rotulo: "Família", emoji: "👨‍👩‍👧" },
];

export function secoes(
  grade: readonly Cartao[],
): { chave: CategoriaConquista; rotulo: string; emoji: string; cartoes: Cartao[] }[] {
  return SECOES.map((s) => ({
    ...s,
    cartoes: grade.filter((c) => c.def.category === s.chave),
  })).filter((s) => s.cartoes.length > 0);
}

/**
 * O cartão "Suas conquistas" do site: X de TODAS (as 39, com as do pós-parto),
 * a porcentagem, e a nota "N destas só acontecem depois que o bebê nascer"
 * enquanto nenhuma do pós-parto foi desbloqueada.
 */
export function resumo(grade: readonly Cartao[]) {
  const feitas = grade.filter((c) => c.estado !== "bloqueada").length;
  const total = grade.length;
  const posPartoTotal = grade.filter((c) => c.def.posParto).length;
  const posPartoFeitas = grade.filter((c) => c.def.posParto && c.estado !== "bloqueada").length;
  return {
    feitas,
    total,
    pct: total ? Math.round((feitas / total) * 100) : 0,
    posPartoTotal,
    mostrarNotaDoNascimento: posPartoFeitas === 0 && posPartoTotal > 0,
  };
}

/** "12 de 37" — o teto da gestante não conta as do pós-parto. */
export function placar(
  grade: readonly Cartao[],
  posParto: boolean,
): { feitas: number; total: number } {
  const daFase = grade.filter((c) => posParto || !c.def.posParto);
  return { feitas: daFase.filter((c) => c.estado !== "bloqueada").length, total: daFase.length };
}
