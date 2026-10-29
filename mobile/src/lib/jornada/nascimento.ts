/**
 * O NASCIMENTO QUE O SITE GUARDOU — a trilha do site declarava o parto só no
 * blob da jornada (`dc-path-birth = { date }`), sem nunca gravar o
 * `birth_date` do perfil. O app lê o perfil: a mãe que contou o nascimento no
 * site continuava grávida no app (e, passadas 42 semanas, via o alerta
 * médico). O app passa o valor para o perfil uma vez, e o ritual mantém os
 * dois em acordo dali em diante.
 * Sem react-native aqui: é testado pelo bun.
 */

import type { Blob } from "~/lib/jornada/momentos";

export const CHAVE_NASCIMENTO = "dc-path-birth";

/**
 * A data do nascimento declarada no site, quando ela é uma data de verdade e
 * já aconteceu (`hoje` em `AAAA-MM-DD`, o relógio do aparelho). O "desfazer"
 * do site grava `null` — e aí não há nascimento nenhum.
 */
export function nascimentoDoSite(blob: Blob, hoje: string): string | null {
  const v = blob[CHAVE_NASCIMENTO];
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const data = (v as { date?: unknown }).date;
  if (typeof data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  const d = new Date(`${data}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return data <= hoje ? data : null;
}
