/**
 * O LEMBRETE DIÁRIO DA MEDITAÇÃO — "Lembrar todo dia" do app antigo.
 *
 * No site ele era push do servidor, na hora que ela escolheu, e calado no dia
 * em que ela já tinha meditado. No app ele é uma notificação LOCAL: o próprio
 * iPhone agenda, sem servidor e sem conta de push. Como notificação repetida
 * não sabe pular um dia, o app agenda os próximos dias um a um — e reagenda
 * quando ela medita (hoje sai) e sempre que a tela abre.
 *
 * Se ela sumir por duas semanas, o lembrete para sozinho: um app que insiste
 * todo dia em quem não volta vira o app que ela silencia inteiro.
 * Sem react-native aqui: é testado pelo bun.
 */

/** Quantos dias ficam agendados à frente. */
export const DIAS_AGENDADOS = 14;

/** A hora que já vem marcada ao ligar — a do site. */
export const HORA_PADRAO = "21:00";

/** As horas que ela pode escolher: de meia em meia hora, das 6h às 23h30. */
export const HORARIOS: readonly string[] = Array.from({ length: 36 }, (_, i) => {
  const minutos = 6 * 60 + i * 30;
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
});

export function horaValida(hora: unknown): hora is string {
  return typeof hora === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(hora);
}

/**
 * Os próximos instantes do lembrete, no relógio do aparelho: um por dia, na
 * hora escolhida, só os que ainda vão acontecer — e hoje fica de fora se ela
 * já meditou.
 */
export function proximosLembretes(o: {
  hora: string;
  agora: Date;
  meditouHoje: boolean;
  dias?: number;
}): Date[] {
  if (!horaValida(o.hora)) return [];
  const [h, m] = o.hora.split(":").map(Number) as [number, number];
  const fora: Date[] = [];
  for (let d = 0; d < (o.dias ?? DIAS_AGENDADOS); d++) {
    if (d === 0 && o.meditouHoje) continue;
    const quando = new Date(
      o.agora.getFullYear(),
      o.agora.getMonth(),
      o.agora.getDate() + d,
      h,
      m,
      0,
      0,
    );
    if (quando.getTime() <= o.agora.getTime()) continue;
    fora.push(quando);
  }
  return fora;
}
