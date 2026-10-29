import { CANTINHO_BY_ID } from "@/lib/cantinho";
import { TROFEUS_PARA } from "@/lib/trofeus";
import { conquistaNoApp } from "~/lib/jornada/conquistas";

/**
 * A ESCADA DOS TROFÉUS — para que eles servem, no app. A folha dizia só
 * "você tem N troféus": um número sem destino. O site mostrava a escada (o que
 * cada contagem abre) e quanto falta para o próximo degrau.
 *
 * No app os degraus são as três conquistas de troféu e o que o Cantinho do app
 * vende com troféu (a Borboleta; os outros dois itens de troféu são Premium e
 * ficaram fora da loja por fase).
 * Sem react-native aqui: é testado pelo bun.
 */

export type Degrau = { trofeus: number; rotulos: string[]; feito: boolean };

const CONQUISTAS_DE_TROFEU = ["trofeu_1", "trofeu_10", "trofeu_30"] as const;

export function escadaDosTrofeus(
  trofeus: number,
  itensDaLojaDoApp: ReadonlySet<string>,
): { degraus: Degrau[]; proximo: { trofeus: number; faltam: number } | null } {
  const porContagem = new Map<number, string[]>();
  const por = (n: number, rotulo: string) =>
    porContagem.set(n, [...(porContagem.get(n) ?? []), rotulo]);
  for (const k of CONQUISTAS_DE_TROFEU) {
    const def = conquistaNoApp(k);
    const n = Number(k.split("_")[1]);
    if (def) por(n, `A conquista ${def.title}`);
  }
  for (const [id, n] of Object.entries(TROFEUS_PARA)) {
    const item = CANTINHO_BY_ID[id];
    if (item && itensDaLojaDoApp.has(id)) por(n, `${item.name} no Cantinho`);
  }
  const t = Math.max(0, Math.floor(trofeus || 0));
  const degraus = [...porContagem.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([n, rotulos]) => ({ trofeus: n, rotulos, feito: t >= n }));
  const prox = degraus.find((d) => !d.feito);
  return { degraus, proximo: prox ? { trofeus: prox.trofeus, faltam: prox.trofeus - t } : null };
}
