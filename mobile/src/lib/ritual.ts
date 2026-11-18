import { gestacaoDoPerfil } from "~/lib/gestacao";
import { diaDaJornada, semanaDoDia } from "~/lib/jornada/dia";
import type { Perfil } from "~/lib/sessao";

/**
 * AS REGRAS DO RITUAL de boas-vindas (`app/ritual.tsx`), em puro: que passos
 * ela vê, e quando o fim do ritual revela o bebê da semana.
 *
 * Os passos são numerados como sempre foram (0 o nome, 1 a data, 2 o bebê,
 * 3 o contato, 4 o médico, 5 a amiga), e a ordem vista pula os que não valem.
 */
export const PASSO_DO_CONTATO = 3;
export const PASSO_DO_MEDICO = 4;

/**
 * Os passos na ordem em que ela os vê. Com o SOS desligado (`SOS_NO_APP`),
 * o contato de emergência e o médico saem do ritual: eram dados do SOS, e
 * pedi-los no meio da entrada de um jogo assustava sem servir para nada. O
 * médico continua em "Seus dados", no Perfil.
 */
export function ordemDoRitual(total: number, sosNoApp: boolean): number[] {
  return Array.from({ length: total }, (_, i) => i).filter(
    (p) => sosNoApp || (p !== PASSO_DO_CONTATO && p !== PASSO_DO_MEDICO),
  );
}

export type ModoDaData = "dum" | "us" | "nasceu";

/**
 * A REVELAÇÃO (18/11/2026): no fim do PRIMEIRO ritual, o bebê da semana dela
 * entra no céu antes da primeira aba. Nunca corrigindo a data (`?editar=1`),
 * nunca depois do parto (o bebê está no colo, e a semana não é mais verdade),
 * e nunca no Modo Cuidado (o app não fala do bebê).
 */
export function revelaOBebe(o: { editar: boolean; modo: ModoDaData; cuidado: boolean }): boolean {
  return !o.editar && o.modo !== "nasceu" && !o.cuidado;
}

/**
 * A semana que a revelação mostra: a mesma régua da trilha (o dia da jornada
 * preso de 7 a 300, a semana de 1 a 42), a partir do que ela acabou de
 * digitar. `null` quando não há o que revelar.
 */
export function semanaDaRevelacao(
  o: { modo: ModoDaData; ymd: string | null; semanasUs?: number; diasUs?: number },
  hoje = new Date(),
): number | null {
  if (o.modo === "nasceu" || !o.ymd) return null;
  const perfil: Perfil =
    o.modo === "dum"
      ? { id: "", lmp_date: o.ymd }
      : {
          id: "",
          reference_date: o.ymd,
          reference_weeks: o.semanasUs ?? null,
          reference_days: o.diasUs ?? 0,
        };
  const g = gestacaoDoPerfil(perfil, hoje);
  if (!g) return null;
  return semanaDoDia(diaDaJornada(g.totalDays));
}
