/**
 * A AGENDA, NUM LUGAR SÓ.
 *
 * ─── O QUE ESTAVA ACONTECENDO ───────────────────────────────────────────────
 *
 * O que o médico chama de "minha agenda" estava repartido em quatro telas:
 * Agendamentos (a lista de pedidos), Calendário (uma faixa de SETE dias),
 * Teleconsultas e Consultas Pagas. Nenhuma delas responde "como está a minha
 * semana", porque nenhuma sabe da existência das outras — ele via a consulta
 * presencial numa aba e a teleconsulta do mesmo dia noutra.
 *
 * Pedido do dono (ago/2026): um calendário só, do MÊS, com legenda por tipo, e
 * o estado de pagamento visível ao abrir a consulta.
 *
 * ─── POR QUE ISTO É UM MÓDULO SEM JSX ───────────────────────────────────────
 *
 * A parte difícil aqui não é desenhar a grade: é decidir EM QUE DIA cada coisa
 * cai, e as três fontes respondem isso de formas diferentes. Separado da tela,
 * isso vira função pura e testável — e é onde os erros de fuso e de "data que
 * não existe" aparecem.
 */

/** O que uma linha da agenda é, depois de normalizada. */
export type TipoDeEvento = "presencial" | "teleconsulta" | "particular";

export type EventoDaAgenda = {
  id: string;
  tipo: TipoDeEvento;
  /** `YYYY-MM-DD`, sempre. É a chave da célula do calendário. */
  dia: string;
  /** `HH:MM` quando existe. Teleconsulta sempre tem; pedido pode ser "manhã". */
  hora: string | null;
  /** O que aparece na célula. */
  titulo: string;
  /** Status da origem, já traduzido para o que a tela mostra. */
  situacao: string;
  /**
   * A data é FIRME ou é só a preferência dela?
   *
   * Isto não é detalhe de exibição. Um pedido ainda não confirmado e uma
   * consulta particular sem horário marcado aparecem no calendário para ele não
   * esquecer que existem — mas pintá-los como compromisso faria o médico contar
   * com uma hora que ninguém combinou.
   */
  firme: boolean;
  /** `null` quando não há cobrança nenhuma associada. */
  pago: boolean | null;
};

/** As cores da legenda. Uma fonte só — a legenda e as bolinhas leem daqui. */
export const CORES_DO_TIPO: Record<TipoDeEvento, { ponto: string; rotulo: string }> = {
  /* Azul para o que acontece no consultório, laranja para o que acontece por
     vídeo: a distinção que muda o que ele faz no dia (sair de casa ou não). */
  presencial: { ponto: "bg-sky-500", rotulo: "Presencial" },
  teleconsulta: { ponto: "bg-amber-500", rotulo: "Teleconsulta" },
  particular: { ponto: "bg-violet-500", rotulo: "Consulta particular" },
};

/** `YYYY-MM-DD` de uma data local, sem passar por UTC. */
export function diaLocal(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * `HH:MM` de um timestamp — no fuso de quem olha.
 *
 * `scheduled_for` é `timestamptz` e chega em UTC. Formatar com `slice(11,16)`
 * mostraria a hora UTC, que é o mesmo erro de três horas que a criação da
 * teleconsulta já teve.
 */
export function horaLocal(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

type PedidoBruto = {
  id: string;
  patient_name?: string | null;
  preferred_date?: string | null;
  preferred_time?: string | null;
  confirmed_date?: string | null;
  confirmed_time?: string | null;
  status?: string | null;
  payment_status?: string | null;
  reason?: string | null;
};

type TeleBruta = {
  id: string;
  patient_name?: string | null;
  scheduled_for?: string | null;
  status?: string | null;
};

type ParticularBruta = {
  id: string;
  consult_type?: string | null;
  preferred_dates?: string[] | null;
  status?: string | null;
  amount_cents?: number | null;
};

const SITUACAO_PEDIDO: Record<string, string> = {
  pending: "Aguardando você",
  confirmed: "Confirmada",
  counter_proposed: "Horário sugerido",
  declined: "Recusada",
  cancelled: "Cancelada",
  done: "Realizada",
};

/**
 * Um pedido de consulta vira evento.
 *
 * ─── A DATA CONFIRMADA GANHA DA PREFERIDA ───────────────────────────────────
 *
 * `preferred_date` é o que ela PEDIU; `confirmed_date` é o que ficou combinado.
 * Uma auditoria encontrou o Painel e o Calendário discordando exatamente aqui —
 * um contava pela preferida, o outro pela confirmada, e a mesma consulta
 * aparecia em dois dias diferentes do produto.
 */
export function doPedido(p: PedidoBruto): EventoDaAgenda | null {
  const confirmada = p.confirmed_date?.trim();
  const dia = confirmada || p.preferred_date?.trim();
  if (!dia) return null;
  const hora = (confirmada ? p.confirmed_time : p.preferred_time)?.trim() || null;
  return {
    id: `ped:${p.id}`,
    tipo: "presencial",
    dia,
    /* "manhã" e "tarde" não são hora — deixar passar poria "manhã:00" na
       célula. Só `HH:MM` vira hora; o resto entra no título. */
    hora: hora && /^\d{1,2}:\d{2}$/.test(hora) ? hora : null,
    titulo: p.patient_name?.trim() || "Paciente",
    situacao:
      SITUACAO_PEDIDO[String(p.status ?? "")] ??
      (hora && !/^\d{1,2}:\d{2}$/.test(hora) ? hora : "Pedido"),
    firme: !!confirmada,
    pago: p.payment_status ? p.payment_status === "pago" : null,
  };
}

/** Uma teleconsulta vira evento. Sem `scheduled_for` ela não tem lugar no mês. */
export function daTeleconsulta(t: TeleBruta): EventoDaAgenda | null {
  const iso = t.scheduled_for?.trim();
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return {
    id: `tele:${t.id}`,
    tipo: "teleconsulta",
    dia: diaLocal(d),
    hora: horaLocal(iso),
    titulo: t.patient_name?.trim() || "Paciente",
    situacao:
      t.status === "sala_aberta"
        ? "Sala aberta"
        : t.status === "encerrada"
          ? "Encerrada"
          : "Agendada",
    /* Teleconsulta nasce com data e hora marcadas — é o único dos três que
       sempre tem compromisso de verdade. */
    firme: true,
    pago: null,
  };
}

/**
 * Uma consulta particular vira evento — e aqui há uma limitação a declarar.
 *
 * `private_consultations` NÃO guarda data marcada: guarda `preferred_dates`, as
 * preferências que ela mandou. Então o calendário a coloca na primeira
 * preferência e marca `firme: false`. Sem isso, ela sumiria do mês — e é
 * justamente a consulta que ele já recebeu dinheiro para dar.
 *
 * A saída definitiva é o banco ganhar uma data combinada; enquanto não ganha,
 * mostrar a preferência marcada como preferência é mais honesto que esconder.
 */
export function daParticular(c: ParticularBruta): EventoDaAgenda | null {
  const dia = (c.preferred_dates ?? []).map((d) => String(d).trim()).filter(Boolean)[0];
  if (!dia) return null;
  const pago = c.status === "confirmado" || c.status === "realizado";
  return {
    id: `part:${c.id}`,
    tipo: "particular",
    dia: dia.slice(0, 10),
    hora: null,
    titulo: c.consult_type?.trim() || "Consulta particular",
    situacao: pago
      ? "Paga"
      : c.status === "pagamento_enviado"
        ? "Conferir pagamento"
        : "Aguardando pagamento",
    firme: false,
    pago,
  };
}

/** As três fontes viram uma lista só, ordenada por dia e hora. */
export function montarAgenda(fontes: {
  pedidos?: PedidoBruto[];
  teleconsultas?: TeleBruta[];
  particulares?: ParticularBruta[];
}): EventoDaAgenda[] {
  const eventos = [
    ...(fontes.pedidos ?? []).map(doPedido),
    ...(fontes.teleconsultas ?? []).map(daTeleconsulta),
    ...(fontes.particulares ?? []).map(daParticular),
  ].filter((e): e is EventoDaAgenda => e !== null);

  return eventos.sort((a, b) => {
    if (a.dia !== b.dia) return a.dia < b.dia ? -1 : 1;
    /* Sem hora vai para o fim do dia: é o que ainda não tem lugar marcado. */
    if (a.hora === b.hora) return 0;
    if (!a.hora) return 1;
    if (!b.hora) return -1;
    return a.hora < b.hora ? -1 : 1;
  });
}

/** Agrupado por dia, para a grade do mês consultar em O(1). */
export function porDia(eventos: EventoDaAgenda[]): Map<string, EventoDaAgenda[]> {
  const m = new Map<string, EventoDaAgenda[]>();
  for (const e of eventos) {
    const lista = m.get(e.dia);
    if (lista) lista.push(e);
    else m.set(e.dia, [e]);
  }
  return m;
}

/**
 * As celas do mês, incluindo a cauda do mês anterior e a cabeça do seguinte.
 *
 * Sempre semanas inteiras (múltiplo de 7), começando no domingo — senão a grade
 * fica com buracos e as colunas deixam de corresponder aos dias da semana.
 */
export function celasDoMes(ano: number, mes: number): { data: Date; doMes: boolean }[] {
  const primeiro = new Date(ano, mes, 1);
  const inicio = new Date(primeiro);
  inicio.setDate(1 - primeiro.getDay());
  const celas: { data: Date; doMes: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    celas.push({ data: d, doMes: d.getMonth() === mes });
    /* Para em 35 quando a sexta semana seria inteira do mês seguinte: seis
       linhas de grade num mês que cabe em cinco é uma faixa vazia na tela. */
    if (i === 34 && new Date(inicio.getTime() + 35 * 86400000).getMonth() !== mes) break;
  }
  return celas;
}
