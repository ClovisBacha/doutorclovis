/**
 * OS CINCO MOMENTOS DO DIA — e o formato em que eles moram.
 *
 * O formato é o do SITE, de propósito: a jornada é uma só e vale nos dois.
 *
 *   dc-path-day-<D>       = { desafio?, w_movement?, w_meditation?, w_bonding?, w_gratitude? }
 *   dc-path-done-days     = number[]   (dias com os cinco fechados)
 *   dc-path-stickers      = number[]   (semanas com figurinha — sai junto do dia fechado)
 *   dc-path-pos-day-<D>   = o mesmo, no pós-parto (D = idade do bebê + 7)
 *
 * `desafio` é o nome histórico do momento da AULA (ou do desafio, quando não há
 * aula): o site grava `desafio: true` nos dois casos.
 *
 * Sem react-native aqui: é testado pelo bun.
 */

import type { Atividade } from "~/servidor/economia";

export type Blob = Record<string, unknown>;
export type FlagsDoDia = Record<string, boolean>;

export const PREFIXO = "dc-path-";
export const CHAVE_FEITOS = "dc-path-done-days";
export const CHAVE_FIGURINHAS = "dc-path-stickers";
export const CHAVE_NOTAS_EXERCICIO = "dc-path-ex-notas";
export const CHAVE_LOG_MEDITACAO = "dc-path-med-log";
export const CHAVE_CARTAS_LIDAS = "dc-path-cartas-lidas";

export const PREFIXO_DIA = "dc-path-day-";
export const PREFIXO_DIA_POS = "dc-path-pos-day-";

export function chaveDoDia(D: number, pos = false): string {
  return `${pos ? PREFIXO_DIA_POS : PREFIXO_DIA}${D}`;
}

export function chaveDoPresente(quando: string): string {
  return `dc-path-presente-visto-${quando}`;
}

/** O momento como a tela o conhece. */
export type Momento = "aula" | Atividade;

export const ATIVIDADES: readonly Atividade[] = ["movement", "meditation", "bonding", "gratitude"];

export const TOTAL_DO_DIA = 5;

/** A chave da flag no blob do dia. */
export function flagDe(m: Momento): string {
  return m === "aula" ? "desafio" : `w_${m}`;
}

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function flagsDoDia(blob: Blob, D: number, pos = false): FlagsDoDia {
  const v = blob[chaveDoDia(D, pos)];
  if (!ehObjeto(v)) return {};
  const fora: FlagsDoDia = {};
  for (const [k, x] of Object.entries(v)) if (x === true) fora[k] = true;
  return fora;
}

export function feito(flags: FlagsDoDia, m: Momento): boolean {
  return flags[flagDe(m)] === true;
}

/** Quantos dos cinco momentos estão feitos (a aula + as quatro atividades). */
export function contarMomentos(flags: FlagsDoDia): number {
  return ATIVIDADES.filter((a) => flags[`w_${a}`]).length + (flags.desafio ? 1 : 0);
}

export function listaDeNumeros(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
}

export function diasFechados(blob: Blob): number[] {
  return listaDeNumeros(blob[CHAVE_FEITOS]);
}

export type ResultadoDaMarca = {
  blob: Blob;
  /** A flag já estava lá: nada mudou. */
  jaEstava: boolean;
  /** Esta marca fechou os cinco momentos do dia agora. */
  fechouAgora: boolean;
};

/**
 * Marca um momento num dia, devolvendo um blob NOVO (o antigo não é tocado:
 * a loja compara por referência).
 *
 * Na gestação, quando os cinco fecham, o dia entra em `dc-path-done-days` e a
 * semana ganha a figurinha — exatamente o que o `markDayTask` do site faz.
 * Uma atividade de bem-estar também acende o legado `bemestar` (o site ainda
 * o grava; o placar não o conta).
 */
export function marcarMomento(
  blob: Blob,
  D: number,
  m: Momento,
  opcoes: { pos?: boolean } = {},
): ResultadoDaMarca {
  const pos = opcoes.pos ?? false;
  const flags = flagsDoDia(blob, D, pos);
  const flag = flagDe(m);
  if (flags[flag]) return { blob, jaEstava: true, fechouAgora: false };
  const bruto = blob[chaveDoDia(D, pos)];
  const novoDia: Record<string, unknown> = { ...(ehObjeto(bruto) ? bruto : {}), [flag]: true };
  if (m !== "aula") novoDia.bemestar = true;
  const novo: Blob = { ...blob, [chaveDoDia(D, pos)]: novoDia };
  let fechouAgora = false;
  if (!pos && contarMomentos(novoDia as FlagsDoDia) >= TOTAL_DO_DIA) {
    const feitos = diasFechados(blob);
    if (!feitos.includes(D)) {
      fechouAgora = true;
      novo[CHAVE_FEITOS] = [...feitos, D].sort((a, b) => a - b);
      const semana = Math.floor(D / 7);
      const figurinhas = listaDeNumeros(blob[CHAVE_FIGURINHAS]);
      if (!figurinhas.includes(semana)) {
        novo[CHAVE_FIGURINHAS] = [...figurinhas, semana].sort((a, b) => a - b);
      }
    }
  }
  return { blob: novo, jaEstava: false, fechouAgora };
}

/**
 * Os dias em que ela fez ALGUMA coisa — é o que acende a chama (a mesma
 * pergunta de `diasComAlgumMomento` do site, sobre o blob já parseado).
 * O resto da chave tem de ser só dígitos.
 */
export function diasComAlgumMomento(blob: Blob, pos = false): number[] {
  const prefixo = pos ? PREFIXO_DIA_POS : PREFIXO_DIA;
  const dias: number[] = [];
  for (const [chave, v] of Object.entries(blob)) {
    if (!chave.startsWith(prefixo)) continue;
    const resto = chave.slice(prefixo.length);
    if (!/^\d+$/.test(resto)) continue;
    if (ehObjeto(v) && Object.values(v).some(Boolean)) dias.push(Number(resto));
  }
  return dias.sort((a, b) => a - b);
}

/** Quanto a tela PROMETE pela aula — a conta é do servidor (5 + 3 por acerto). */
export function sementesDaAula(acertos: number): number {
  return 5 + 3 * Math.max(0, Math.floor(acertos));
}
