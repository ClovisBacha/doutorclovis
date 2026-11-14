/**
 * "HOJE" É O DIA DELA, E O BANCO GUARDA INSTANTE.
 *
 * `started_at` é `timestamptz`, e o PostgREST devolve em UTC
 * (`2026-09-06T00:30:00+00:00`). Cortar os dez primeiros caracteres dessa
 * string dá a data em UTC, nunca a data no relógio da paciente.
 *
 * ⚠️ **E O ERRO CAI EXATAMENTE NO HORÁRIO QUE A TELA RECOMENDA.** Contar
 * movimentos é para se fazer à noite, deitada, depois de comer. Medido em São
 * Paulo (UTC−3): uma sessão às 21h30 do dia 5 é gravada como dia 6 em UTC —
 * então às 22h do MESMO dia o bloco não a reconhece como "hoje", nem como
 * "ontem" (que seria o dia 4), e o número desaparece da grade da Saúde.
 * Quem segue a recomendação é justamente quem nunca vê o próprio contador.
 *
 * ⚠️ E o mesmo vale para FILTRAR: mandar `"2026-09-05T00:00:00"` sem fuso ao
 * banco não é "meia-noite dela" — o Postgres lê no fuso da sessão dele, que é
 * UTC. Em São Paulo isso arrasta as contrações das 21h de ONTEM para dentro do
 * "hoje". `inicioDeHojeISO` manda o INSTANTE, com fuso, e não uma data solta.
 */

const DIA = 86_400_000;

/** `YYYY-MM-DD` no relógio de quem está olhando (o navegador dela). */
function diaLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * "hoje", "ontem" ou `null` — comparando o INSTANTE gravado com o relógio dela.
 *
 * ⚠️ Instante ilegível também vira `null`, e isso sai POR CONSTRUÇÃO: uma data
 * inválida faz `diaLocal` devolver `"NaN-NaN-NaN"`, que não casa com dia
 * nenhum. Um rótulo errado num contador clínico é pior que rótulo nenhum, e há
 * teste cobrando o contrato.
 *
 * ⚠️ **E aqui NÃO existe um `Number.isNaN(d.getTime())`.** Escrevi um, e a
 * mutação provou que ele era LINHA MORTA — apagá-lo não mudava nenhuma
 * resposta. Guarda que parece proteção e não é vira armadilha para quem ler
 * depois: ela sugere que sem ela o valor passaria.
 */
export function quandoFoi(
  instante: string | null | undefined,
  agora: Date,
): "hoje" | "ontem" | null {
  if (!instante) return null;
  const dia = diaLocal(new Date(instante));
  if (dia === diaLocal(agora)) return "hoje";
  const ontem = new Date(agora);
  ontem.setDate(ontem.getDate() - 1);
  return dia === diaLocal(ontem) ? "ontem" : null;
}

/**
 * A meia-noite DELA, como instante com fuso — pronta para um `.gte()`.
 *
 * ⚠️ `setHours(0,0,0,0)` e não uma string montada à mão: é ele que respeita o
 * fuso do aparelho, inclusive nas viradas de horário de verão.
 */
export function inicioDeHojeISO(agora: Date): string {
  const d = new Date(agora);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Quantos dias inteiros separam duas datas, pelo calendário local. */
export function diasEntre(quando: string, agora: Date): number {
  const d = new Date(quando);
  if (Number.isNaN(d.getTime())) return 0;
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const b = Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate());
  return Math.round((b - a) / DIA);
}

/**
 * "há um mês", "há uma semana", "ontem".
 *
 * Aproximado de propósito: a frase existe para dar a DISTÂNCIA, e "há 37 dias"
 * faz a paciente contar em vez de lembrar.
 */
export function haQuantoTempo(quando: string, agora: Date): string {
  const d = diasEntre(quando, agora);
  if (d <= 0) return "hoje";
  if (d === 1) return "ontem";
  if (d < 7) return `há ${d} dias`;
  if (d < 14) return "há uma semana";
  if (d < 30) return `há ${Math.round(d / 7)} semanas`;
  if (d < 45) return "há um mês";
  if (d < 365) return `há ${Math.round(d / 30)} meses`;
  return "há mais de um ano";
}
