/**
 * A HORA DE UM REGISTRO, ESCRITA UMA VEZ SÓ.
 *
 * ⚠️ **`toLocaleString` NO RENDER É MISMATCH DE HIDRATAÇÃO, e ele foi MEDIDO
 * nas duas telas clínicas.** O servidor deste app roda em UTC e o aparelho da
 * paciente em `America/Sao_Paulo`: a mesma sessão de chutes saía "05/09/2026,
 * 04:40" no HTML do servidor e "05/09/2026, 01:40" na primeira pintura do
 * cliente, e a mesma contração saía "17:20" contra "14:20". O React descarta a
 * árvore inteira quando isso acontece — é a classe de defeito que já deixou
 * este app SEM ABRIR.
 *
 * ⚠️ E o guarda `typeof window === "undefined"` NÃO resolve: ele evita o
 * CRASH no servidor e não evita a DIVERGÊNCIA, porque as duas execuções são
 * exatamente as que precisam concordar.
 *
 * ─── POR QUE O FUSO É CRAVADO, E NÃO O DO APARELHO ──────────────────────────
 *
 * Porque o horário de um registro clínico não é um relógio de parede: é a
 * marca que o obstetra vai ler no prontuário. `clinical_events` une
 * `kick_sessions` e `contraction_logs`, e o painel do médico monta a linha do
 * tempo dela no fuso do consultório. Com o fuso do aparelho, a paciente que
 * viaja veria "22:10" e o médico, "18:10" — a mesma contração, dois horários,
 * numa conversa em que o horário é o dado.
 *
 * Cravar o fuso resolve as duas coisas de uma vez: servidor e cliente
 * concordam por construção, e a tela dela concorda com a tela dele.
 *
 * ⚠️ Se um dia o app atender fora do Brasil, o conserto NÃO é voltar ao fuso do
 * aparelho — é o fuso do CONSULTÓRIO virar dado, e continuar sendo um só por
 * paciente.
 */

/** O fuso do consultório. Um lugar só — duas cópias divergem no primeiro ajuste. */
export const FUSO_DO_REGISTRO = "America/Sao_Paulo";

function emData(quando: string | number | Date): Date | null {
  const d = quando instanceof Date ? quando : new Date(quando);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** "14:20" — a hora de uma contração, de um toque, de um registro do dia. */
export function horaCurta(quando: string | number | Date): string {
  const d = emData(quando);
  if (!d) return "—";
  return d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: FUSO_DO_REGISTRO,
  });
}

/** "05/09/2026, 21:40" — quando a linha carrega dias diferentes. */
export function dataHoraCurta(quando: string | number | Date): string {
  const d = emData(quando);
  if (!d) return "—";
  return d.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: FUSO_DO_REGISTRO,
  });
}

/** "05/09" — o eixo de um gráfico, onde a hora não cabe e não importa. */
export function diaCurto(quando: string | number | Date): string {
  const d = emData(quando);
  if (!d) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: FUSO_DO_REGISTRO,
  });
}
