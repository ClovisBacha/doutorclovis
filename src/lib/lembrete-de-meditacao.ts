/**
 * O LEMBRETE DIÁRIO DE MEDITAÇÃO — a régua, sem banco e sem rede.
 *
 * ─── POR QUE ISTO É O MAIOR GANHO DE RETENÇÃO DA ABA ────────────────────────
 *
 * O Headspace é tido como "mais gamificado" que o Calm por duas coisas, e uma
 * delas é esta: sequência + um empurrão no horário que a pessoa escolheu. Nós
 * já tínhamos a sequência (a chama) e o push próprio funcionando há meses; o
 * lembrete simplesmente não existia. A paciente decidia meditar todo dia às
 * nove e o app nunca lembrava dela.
 *
 * ─── AS DUAS ARMADILHAS DE FUSO, E COMO ELAS SÃO EVITADAS ───────────────────
 *
 * 1. O servidor não sabe em que fuso ela está. Por isso o horário é guardado em
 *    MINUTOS DEPOIS DA MEIA-NOITE UTC (`utcMin`) — o cron compara com o próprio
 *    relógio, sem tabela de fuso, sem biblioteca. E o deslocamento dela vai
 *    junto (`offset`) porque saber que dia é HOJE no quarto dela é outra
 *    pergunta, e ela decide se o lembrete é dispensável.
 *
 * 2. ⚠️ A REPETIÇÃO NÃO PODE SER CONTADA POR DIA DO CALENDÁRIO. Um lembrete às
 *    23:50 UTC dispara no dia A; a passada seguinte, às 00:10, já é o dia B —
 *    e mandaria de novo, vinte minutos depois. Por isso o registro é um
 *    INSTANTE e a regra é "faz menos de 20 h que mandei".
 *
 * A janela é ABERTA (70 min, um pouco mais que a cadência do cron): um cron
 * dez minutos atrasado ainda manda. O que ela não faz é mandar horas depois —
 * lembrete de meditação à meia-noite é o app perdendo o canal de notificação,
 * que é o mesmo por onde chega o aviso de emergência.
 */

export type Assinante = {
  id: string;
  /** Minutos depois da meia-noite UTC. `null` = não quer lembrete. */
  utcMin: number | null;
  /** Minutos a somar ao UTC para chegar na hora dela. São Paulo: −180. */
  offset: number;
  /** Quando o último lembrete saiu. */
  enviadoEm: Date | null;
  careMode: boolean;
};

export const JANELA_MIN = 70;
const DESCANSO_MS = 20 * 3600_000;

/** Minutos depois da meia-noite UTC. */
export function minutosUtc(agora: Date): number {
  return agora.getUTCHours() * 60 + agora.getUTCMinutes();
}

/** "21:00" a partir de minutos depois da meia-noite (de qualquer fuso). */
export function comoHora(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** "21:00" → 1260. Devolve `null` no que não for hora. */
export function deHora(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** A hora que ELA vê, a partir do que está guardado. */
export function horaLocal(utcMin: number, offset: number): string {
  return comoHora(utcMin + offset);
}

/** O que guardar quando ela escolhe um horário no aparelho dela. */
export function paraGuardar(
  hhmm: string,
  offsetMin: number,
): { utcMin: number; offset: number } | null {
  const local = deHora(hhmm);
  if (local === null) return null;
  return { utcMin: (((local - offsetMin) % 1440) + 1440) % 1440, offset: offsetMin };
}

/**
 * O deslocamento do navegador, em minutos a somar ao UTC.
 *
 * ⚠️ `getTimezoneOffset()` devolve o SINAL TROCADO (São Paulo dá +180), e é
 * assim há trinta anos. Ler direto é o erro de três horas que já custou caro
 * neste repositório — ver `deCampoLocal` na agenda.
 */
export function fusoDoNavegador(agora: Date = new Date()): number {
  return -agora.getTimezoneOffset();
}

/** O dia no calendário DELA (YYYY-MM-DD), no formato que a jornada grava. */
export function diaDela(agora: Date, offset: number): string {
  const d = new Date(agora.getTime() + offset * 60_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

/** A hora chegou (e não mandei há pouco)? */
export function estaNaHora(a: Assinante, agora: Date): boolean {
  if (a.careMode) return false;
  if (a.utcMin === null || !Number.isFinite(a.utcMin)) return false;
  const delta = (minutosUtc(agora) - a.utcMin + 1440) % 1440;
  if (delta >= JANELA_MIN) return false;
  if (a.enviadoEm && agora.getTime() - a.enviadoEm.getTime() < DESCANSO_MS) return false;
  return true;
}

/**
 * Ela já meditou hoje?
 *
 * ⚠️ Se já meditou, o lembrete NÃO sai. Pedir o que ela acabou de fazer é o
 * jeito mais rápido de ensinar que os avisos deste app não valem leitura — a
 * mesma regra que o pedido de pré-consulta segue.
 *
 * O `blob` é o `journey_state`, escrito pelo navegador DELA: nada aqui pode
 * supor formato. Qualquer coisa fora do esperado vira "não sei", e "não sei"
 * manda o lembrete — ficar em silêncio por não entender o blob apagaria o
 * recurso inteiro sem nenhum erro aparecer.
 */
export function meditouEm(blob: unknown, dia: string): boolean {
  if (!blob || typeof blob !== "object") return false;
  const log = (blob as Record<string, unknown>)["dc-path-med-log"];
  if (!log || typeof log !== "object") return false;
  const dias = (log as { dias?: unknown }).dias;
  return Array.isArray(dias) && dias.includes(dia);
}

/** O texto. Curto: ele é lido na tela de bloqueio, de olho apertado. */
export function textoDoLembrete(sequencia: number): { title: string; body: string } {
  if (sequencia >= 2) {
    return {
      title: `${sequencia} dias seguidos 🔥`,
      body: "Seus minutos de hoje estão te esperando.",
    };
  }
  return {
    title: "Um tempinho só seu 💜",
    body: "Três minutos já contam. Vamos respirar?",
  };
}
