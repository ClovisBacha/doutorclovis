import { novoIdLocal } from "@/lib/fila-local";
import type { SessaoDeChutes } from "@/lib/serie-de-chutes";
import type { SessaoPendente } from "./fila";
import { inicioDoDia } from "./formato";

/**
 * A CONTAGEM DE MOVIMENTOS — o que não é desenho, puro.
 *
 * ⚠️ A sessão em curso mora no aparelho (`dc-chutes-sessao:<uid>`) e NADA vai
 * ao banco a cada toque: a linha nasce no encerramento. Linha aberta com
 * "0 movimentos" chegava ao prontuário como uma afirmação clínica que nunca
 * aconteceu.
 */

export type SessaoEmCurso = {
  /** ISO do início — ancora o relógio (diferença de horário, sobrevive ao segundo plano). */
  startedAt: string;
  count: number;
  /** 1|2|3; ausente = não marcou (a tela mostra o padrão). */
  forca?: number;
};

export const chaveDaSessaoDeChutes = (uid: string) => `dc-chutes-sessao:${uid}`;

/** Depois de 4 h a sessão é abandono, não pausa. */
export const VALIDADE_DA_SESSAO_MS = 4 * 3600000;

/** Saneia o que veio do disco: forma errada, vencida ou no futuro → null. */
export function sanearSessao(bruto: unknown, agora: number): SessaoEmCurso | null {
  if (!bruto || typeof bruto !== "object") return null;
  const s = bruto as Partial<SessaoEmCurso>;
  if (typeof s.startedAt !== "string" || typeof s.count !== "number") return null;
  const ini = new Date(s.startedAt).getTime();
  if (!Number.isFinite(ini)) return null;
  if (agora - ini > VALIDADE_DA_SESSAO_MS || ini > agora + 60000) return null;
  /* Força fora do catálogo vale "não marcou", nunca "Como sempre". */
  const f =
    typeof s.forca === "number" && s.forca >= 1 && s.forca <= 3 ? Math.floor(s.forca) : undefined;
  return { startedAt: s.startedAt, count: Math.max(0, Math.floor(s.count)), forca: f };
}

/** O pacote que entra na fila quando ela encerra. */
export function pacoteDaSessao(
  s: SessaoEmCurso,
  fim: number,
  forcaPadrao: number,
): SessaoPendente {
  return {
    id: novoIdLocal(new Date(s.startedAt).getTime()),
    started_at: s.startedAt,
    ended_at: new Date(fim).toISOString(),
    kick_count: s.count,
    strength: s.forca ?? forcaPadrao,
    tentativas: 0,
  };
}

/**
 * Encerrar sem nenhum movimento antes das duas horas é desistência (o dedo
 * tocou "começar" sem querer) e não vira linha. Zero em DUAS HORAS é dado
 * clínico e sobe.
 */
export function encerrarDescarta(s: SessaoEmCurso, agora: number): boolean {
  const min = (agora - new Date(s.startedAt).getTime()) / 60000;
  return s.count === 0 && min < 120;
}

/** Quantos movimentos foram contados nas sessões que COMEÇARAM hoje. */
export function chutesDeHoje(lista: readonly SessaoDeChutes[], agora: number): number {
  const hoje = inicioDoDia(agora);
  return lista
    .filter((s) => new Date(s.started_at).getTime() >= hoje)
    .reduce((n, s) => n + (Number.isFinite(s.kick_count) ? Math.max(0, s.kick_count) : 0), 0);
}

/**
 * O `started_at` do servidor volta como "…+00:00" e o do aparelho como "…Z":
 * normalizar antes de mesclar é o que impede a mesma contagem de aparecer
 * duas vezes no segundo em que ela sobe.
 */
export function isoNormal(iso: string): string {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? new Date(t).toISOString() : iso;
}
