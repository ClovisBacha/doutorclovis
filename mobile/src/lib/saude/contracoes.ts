import { novoIdLocal } from "@/lib/fila-local";
import { INTENSIDADE_PADRAO, nivelDeIntensidade } from "@/lib/intensidade-da-contracao";
import type { ContracaoPendente } from "./fila";
import { horaCurta, inicioDoDia } from "./formato";

/**
 * O CRONÔMETRO DE CONTRAÇÕES — o que não é desenho, puro: nasce, fecha e se
 * desenha a lista. Não há análise clínica no app (21/10/2026): o cronômetro
 * não diz quando ligar.
 */

export type ContracaoDaTela = {
  id: string;
  started_at: string;
  ended_at: string | null;
  intensity: number | null;
};

/** Começo registrado NO APARELHO: o dedo manda no relógio, não o servidor. */
export function novaContracao(agora: number, intensidade = INTENSIDADE_PADRAO): ContracaoPendente {
  return {
    id: novoIdLocal(agora),
    started_at: new Date(agora).toISOString(),
    ended_at: null,
    intensity: intensidade,
    tentativas: 0,
  };
}

export function fecharContracao(
  c: ContracaoPendente,
  agora: number,
  intensidade: number,
): ContracaoPendente {
  return { ...c, ended_at: new Date(agora).toISOString(), intensity: intensidade };
}

export type LinhaDaLista = {
  id: string;
  hora: string;
  /** Segundos; null na que ficou sem fim. */
  duracaoSeg: number | null;
  /** Do INÍCIO da anterior ao início desta, em segundos; null na primeira. */
  intervaloSeg: number | null;
  intensidade: string | null;
  valorIntensidade: number | null;
};

/**
 * As linhas, da mais recente para a mais antiga.
 *
 * ⚠️ O intervalo é de INÍCIO a INÍCIO, como se mede contração: medir do fim
 * de uma ao começo da outra encurta o número.
 */
export function linhasDaLista(lista: readonly ContracaoDaTela[]): LinhaDaLista[] {
  const cresc = [...lista].sort(
    (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
  );
  const linhas = cresc.map((c, i) => {
    const ini = new Date(c.started_at).getTime();
    const fim = c.ended_at ? new Date(c.ended_at).getTime() : NaN;
    const ant = i > 0 ? new Date(cresc[i - 1].started_at).getTime() : NaN;
    const nivel = nivelDeIntensidade(c.intensity);
    return {
      id: c.id,
      hora: horaCurta(c.started_at),
      duracaoSeg: Number.isFinite(fim) && fim >= ini ? Math.round((fim - ini) / 1000) : null,
      intervaloSeg: Number.isFinite(ant) ? Math.round((ini - ant) / 1000) : null,
      intensidade: nivel?.chip ?? null,
      valorIntensidade: nivel?.valor ?? null,
    };
  });
  return linhas.reverse();
}

/** "3 hoje · última às 14:20" — ou null quando nenhuma começou hoje. */
export function resumoDeContracoes(
  lista: readonly ContracaoDaTela[],
  agora: number,
): string | null {
  const hoje = inicioDoDia(agora);
  const deHoje = lista
    .map((c) => new Date(c.started_at).getTime())
    .filter((t) => Number.isFinite(t) && t >= hoje && t <= agora + 60000)
    .sort((a, b) => b - a);
  if (!deHoje.length) return null;
  return `${deHoje.length} hoje · última às ${horaCurta(new Date(deHoje[0]).toISOString())}`;
}

/** A pergunta da confirmação, dizendo qual contração vai sumir. */
export function perguntaParaApagarContracao(l: LinhaDaLista): string {
  const dur =
    l.duracaoSeg != null
      ? `, de ${l.duracaoSeg < 60 ? `${l.duracaoSeg} s` : `${Math.floor(l.duracaoSeg / 60)} min ${String(l.duracaoSeg % 60).padStart(2, "0")} s`}`
      : "";
  return `Apagar a contração das ${l.hora}${dur}? Isso não tem volta.`;
}
