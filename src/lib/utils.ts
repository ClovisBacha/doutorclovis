import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Data em YYYY-MM-DD no fuso LOCAL do usuário. Nunca use
 * `new Date().toISOString().slice(0,10)` para "hoje": em BRT (UTC-3) o ISO
 * rola para o dia seguinte a partir das 21h e o app inteiro erra a data.
 */
export function ymdLocal(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Data em YYYY-MM-DD no fuso do CONSULTÓRIO — para carimbos feitos no SERVIDOR.
 *
 * `ymdLocal` não serve aqui: numa server function o "local" é o fuso da
 * máquina, e na Vercel isso é UTC. Foi o que fez `fetal_bpm_at` ser gravado
 * como 31/07 numa teleconsulta das 21h15 do dia 30 — e o cartão "ouvimos o
 * coração do seu bebê" simplesmente não aparecia para ela naquela noite, porque
 * o cliente calculava `days = -1` e a guarda exige `days >= 0`.
 *
 * O fuso é fixo em America/Sao_Paulo, e é uma decisão, não um descuido: este é
 * um produto brasileiro (CRM, CFM, pt-BR, Real), e um carimbo de DATA precisa
 * de um fuso definido — "o fuso do servidor" não é um. No dia em que houver
 * consultório fora do horário de Brasília, o fuso vira coluna do médico e este
 * é o único lugar a mudar.
 */
export function ymdBrasilia(d: Date = new Date()): string {
  /* `en-CA` porque devolve exatamente YYYY-MM-DD. Formatar e reler é mais
     confiável que somar offset na mão: o Intl conhece o histórico de horário de
     verão, e este país já mudou de regra várias vezes. */
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Quanto o horário de Brasília está à frente do UTC naquele instante, em ms. */
function offsetBrasilia(d: Date): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      /* `h23`, e não `hour12: false`: em várias versões do ICU o segundo produz
         "24" para a meia-noite, e `Date.UTC(..., 24, ...)` rola para o dia
         seguinte — o offset sairia errado por 24 horas uma vez por dia. */
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  const paredeComoUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return paredeComoUTC - d.getTime();
}

/**
 * "YYYY-MM-DD" + "HH:MM" do CONSULTÓRIO → o instante real (epoch em ms).
 *
 * `new Date("2026-08-01T09:00")` — sem offset — é interpretado no fuso da
 * MÁQUINA, e na Vercel isso é UTC. A fila de espera comparava o horário do slot
 * assim contra `Date.now()`, então uma vaga das 09:00 de Brasília era lida como
 * 09:00 UTC = 06:00 daqui: a partir das 06h da manhã ela já parecia ter
 * passado, e nenhuma vaga da manhã liberada no mesmo dia chegava a ser ofertada
 * a quem estava na fila.
 *
 * Duas passadas: primeiro trata a parede como se fosse UTC, depois desconta o
 * offset REAL daquele instante (que o Intl conhece, inclusive o histórico de
 * horário de verão — este país já mudou de regra várias vezes).
 */
export function instanteBrasilia(data: string, hora: string): number {
  const hm = /^(\d{2}):(\d{2})/.exec(hora);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !hm) return NaN;
  const ingenuo = Date.parse(`${data}T${hm[1]}:${hm[2]}:00Z`);
  if (Number.isNaN(ingenuo)) return NaN;
  return ingenuo - offsetBrasilia(new Date(ingenuo));
}
