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
  /**
   * Quanto tempo o compromisso ocupa, em minutos.
   *
   * Pedido do dono (ago/2026): "das 10h até as 11h, tem que ter o intervalo da
   * consulta" — marcar só o INÍCIO deixava o calendário sem saber até quando o
   * horário fica ocupado, e duas consultas próximas podiam ser marcadas sem o
   * sistema perceber que colidem.
   *
   * SEMPRE presente, mesmo quando a fonte não guarda duração nenhuma
   * (teleconsulta, particular, pedido antigo): cai em `DURACAO_PADRAO_MINUTOS`.
   * Um campo opcional espalharia `?? 30` por cada lugar que lê `duracaoMinutos`
   * — aqui a régua mora numa fonte só, na hora de montar o evento.
   */
  duracaoMinutos: number;
};

/**
 * A duração assumida quando a fonte não guarda uma.
 *
 * Mesma faixa da grade de horários do médico (`doctor_slots.slot_minutes`,
 * 5–240): 30 é o padrão de lá também, e as duas réguas concordarem evita que
 * "meia hora" signifique coisas diferentes em duas telas do mesmo produto.
 */
export const DURACAO_PADRAO_MINUTOS = 30;

/** As cores da legenda. Uma fonte só — a legenda e as bolinhas leem daqui. */
export const CORES_DO_TIPO: Record<TipoDeEvento, { ponto: string; rotulo: string }> = {
  /* VERDE para o que acontece no consultório, LARANJA para o que acontece por
     vídeo: a distinção que muda o que ele faz no dia (sair de casa ou não).
     Era azul e laranja; virou verde e laranja a pedido do dono (ago/2026), e a
     troca vale a pena por um motivo além do gosto — azul e roxo, lado a lado
     numa bolinha de 6px, são a mesma cor para muita gente. */
  presencial: { ponto: "bg-emerald-500", rotulo: "Presencial" },
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

/** `HH:MM` → minutos desde a meia-noite. Exportada porque a tela do dia usa a
    mesma conta para sugerir o "até" a partir do "das". */
export function minutosDesdeMeiaNoite(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Minutos desde a meia-noite → `HH:MM`, sempre com dois dígitos. */
export function horaDosMinutos(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * "10:00–10:30" — a faixa do compromisso, para quem já tem hora marcada.
 *
 * `null` sem hora: um evento sem hora não tem faixa nenhuma para mostrar, e
 * inventar uma a partir só da duração pintaria um horário que ninguém marcou.
 */
export function faixaHoraria(e: Pick<EventoDaAgenda, "hora" | "duracaoMinutos">): string | null {
  if (!e.hora) return null;
  return `${e.hora}–${horaDosMinutos(minutosDesdeMeiaNoite(e.hora) + e.duracaoMinutos)}`;
}

/**
 * Instante ISO → valor de um `<input type="datetime-local">`.
 *
 * O campo não tem fuso: ele mostra e devolve "hora de parede". Então o que entra
 * nele tem de ser a hora LOCAL do instante — `iso.slice(0, 16)` mostraria a hora
 * UTC, e o médico veria 17:30 onde combinou 14:30.
 */
export function paraCampoLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${diaLocal(d)}T${hh}:${mi}`;
}

/**
 * Valor de um `<input type="datetime-local">` → instante ISO com fuso.
 *
 * ─── ESTE É O DEFEITO DE TRÊS HORAS, EVITADO ────────────────────────────────
 *
 * Mandar "2026-08-20T14:30" cru para uma coluna `timestamptz` faz o Postgres
 * lê-lo como UTC — no Brasil, três horas de erro em toda consulta marcada. Já
 * aconteceu nesta base, na criação da teleconsulta.
 *
 * `new Date` de uma data-e-hora SEM fuso é interpretada como local (a regra do
 * ECMAScript; só a forma "só data" é UTC). O `toISOString()` depois carimba o
 * `Z`, que é o que o servidor exige.
 */
export function deCampoLocal(valor: string): string | null {
  const v = valor.trim();
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
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
  /** Em minutos. `null`/ausente = pedido antigo ou vindo da paciente, sem
      duração combinada — cai em `DURACAO_PADRAO_MINUTOS`. */
  duration_minutes?: number | null;
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
  /** O horário COMBINADO. `null` enquanto ninguém marcou. */
  scheduled_for?: string | null;
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
    duracaoMinutos:
      p.duration_minutes && p.duration_minutes > 0 ? p.duration_minutes : DURACAO_PADRAO_MINUTOS,
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
    /* A teleconsulta não guarda duração — a sala não tem hora de encerrar
       marcada antes de existir. Cai no padrão, só para efeito de colisão com
       o que for marcado por perto. */
    duracaoMinutos: DURACAO_PADRAO_MINUTOS,
  };
}

/**
 * Uma consulta particular vira evento.
 *
 * `scheduled_for` (ago/2026) é o horário COMBINADO; `preferred_dates` são as
 * preferências que ela mandou. Com o horário marcado a consulta vira compromisso
 * de verdade; sem ele, cai na primeira preferência com `firme: false` — porque
 * sumir seria pior: é justamente a consulta que ele já recebeu para dar.
 */
export function daParticular(c: ParticularBruta): EventoDaAgenda | null {
  const pago = c.status === "confirmado" || c.status === "realizado";
  const marcada = c.scheduled_for?.trim();

  /* ─── COMBINADA GANHA DA PREFERIDA ────────────────────────────────────────
     Mesma régua do pedido de consulta: o que ficou combinado manda sobre o que
     ela pediu. Com `scheduled_for`, a consulta particular vira compromisso de
     verdade — hora, ordenação e tudo. */
  if (marcada) {
    const d = new Date(marcada);
    if (!Number.isNaN(d.getTime())) {
      return {
        id: `part:${c.id}`,
        tipo: "particular",
        dia: diaLocal(d),
        hora: horaLocal(marcada),
        titulo: c.consult_type?.trim() || "Consulta particular",
        situacao: pago ? "Paga" : "Marcada · a pagar",
        firme: true,
        pago,
        duracaoMinutos: DURACAO_PADRAO_MINUTOS,
      };
    }
  }

  /* Sem horário combinado, cai na primeira preferência — marcada COMO
     preferência. Esconder sumiria justamente com a consulta pela qual ele já
     recebeu; pintar como compromisso o faria contar com uma hora que ninguém
     combinou. */
  const dia = (c.preferred_dates ?? []).map((d) => String(d).trim()).filter(Boolean)[0];
  if (!dia) return null;
  return {
    id: `part:${c.id}`,
    tipo: "particular",
    dia: dia.slice(0, 10),
    hora: null,
    titulo: c.consult_type?.trim() || "Consulta particular",
    situacao: pago
      ? "Paga · marcar horário"
      : c.status === "pagamento_enviado"
        ? "Conferir pagamento"
        : "Aguardando pagamento",
    firme: false,
    pago,
    duracaoMinutos: DURACAO_PADRAO_MINUTOS,
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

/* ────────────────────────────────────────────────────────────────────────────
   MARCAR NO DIA — a régua do formulário, longe do JSX.
   ──────────────────────────────────────────────────────────────────────────── */

export type NovaConsulta = {
  /**
   * `YYYY-MM-DD`. Vem DENTRO do objeto, e não de um estado que a tela de cima
   * guarda em paralelo: o dia e o resto do formulário são a mesma decisão, e
   * separá-los cria o par que se desencontra — o médico abre o dia 12, o pai
   * ainda tem o 10 no estado, e a consulta nasce no dia errado.
   */
  dia: string;
  tipo: "presencial" | "teleconsulta";
  nome: string;
  email: string;
  /** Livre — quem não tem conta é marcada por telefone tanto quanto por e-mail. */
  telefone: string;
  /** `HH:MM`. */
  hora: string;
  /** Em minutos — o "das X até Y" da tela vira isto. 5 a 240, mesma faixa da
      grade de horários do médico. */
  duracaoMinutos: number;
  /** Quando é paciente vinculada; `null` para quem só tem e-mail. */
  pacienteId: string | null;
};

/**
 * O que impede esta consulta de ser marcada — ou `null` se pode.
 *
 * ─── POR QUE VALIDAR AQUI E TAMBÉM NO SERVIDOR ──────────────────────────────
 *
 * O servidor é quem manda: ele tem o índice único do slot e é o único que não
 * dá para enganar. Isto aqui não substitui aquilo — existe para o médico
 * descobrir o choque de horário ANTES de mandar, com o nome de quem já está
 * naquele horário na frente dele. A ida ao servidor devolveria a mesma recusa
 * meio segundo depois, e sem o nome.
 *
 * A ordem das checagens é a ordem em que ele preenche: tipo, quem, quando.
 */
export function validarNovaConsulta(
  v: NovaConsulta,
  doDia: EventoDaAgenda[],
  /* Injetável para o teste — sem isto, "horário no passado" só poderia ser
     testado escrevendo uma data no passado toda vez que o arquivo rodasse,
     e o teste apodreceria sozinho. */
  agora: Date = new Date(),
): string | null {
  if (v.tipo === "teleconsulta" && !v.pacienteId) {
    /* A sala de vídeo pendura na conta dela: é a conta que recebe o aviso, abre
       a sala e guarda a gravação. Marcar teleconsulta para um e-mail avulso
       criaria uma sala sem dono do outro lado. */
    return "Teleconsulta só para paciente do app — escolha uma da lista ou marque como presencial.";
  }
  if (v.nome.trim().length < 2) return "Escreva o nome de quem vai ser atendida.";
  /* ─── E-MAIL EM BRANCO SÓ PASSA PARA PACIENTE DO APP ──────────────────────
     O e-mail dela mora em `auth.users`, que a tela não enxerga — quem resolve é
     o servidor. Exigir aqui obrigaria o médico a digitar de cabeça o e-mail de
     quem já está cadastrada, que é como se erra um caractere e se manda a
     confirmação para o vazio.
     Para quem NÃO tem conta, o e-mail é a única forma de avisar: aí é exigido.
     Régua propositalmente frouxa quando ele digita algo — o servidor tem o
     validador estrito, e barrar aqui um endereço válido de formato incomum
     seria impedir a consulta por causa de uma regex. */
  const emailEscrito = v.email.trim();
  if (!emailEscrito && !v.pacienteId) {
    return "Sem e-mail não dá para avisar — preencha, ou escolha uma paciente do app.";
  }
  if (emailEscrito && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailEscrito)) {
    return "Confira o e-mail — é por ele que o aviso vai.";
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v.hora.trim())) return "Escolha um horário válido.";
  if (!Number.isInteger(v.duracaoMinutos) || v.duracaoMinutos < 5 || v.duracaoMinutos > 240) {
    return "A duração precisa estar entre 5 minutos e 4 horas — confira o horário final.";
  }

  /* ─── NADA NO PASSADO ──────────────────────────────────────────────────────
     Comparar o INSTANTE (dia + hora), e não só o dia: um dia inteiro atrás tem
     toda hora dentro dele no passado, e HOJE só as horas depois de agora
     continuam livres — a mesma checagem cobre os dois casos.
     `new Date("YYYY-MM-DDTHH:MM:00")` é lido como hora LOCAL (a regra do
     ECMAScript; só a forma "só data" é UTC), então não há conversão de fuso
     escondida aqui. */
  const instante = new Date(`${v.dia}T${v.hora.trim()}:00`);
  if (!Number.isNaN(instante.getTime()) && instante.getTime() < agora.getTime()) {
    return "Esse horário já passou — escolha um horário a partir de agora.";
  }

  /* ─── O CHOQUE É DE FAIXA, NÃO DE INSTANTE ─────────────────────────────────
     Duas consultas de 30 minutos às 10:00 e 10:15 não têm o MESMO horário, e a
     checagem antiga (`e.hora === v.hora`) deixava passar — colidem mesmo
     assim, porque a segunda começa dentro da primeira. */
  const inicioNovo = minutosDesdeMeiaNoite(v.hora.trim());
  const fimNovo = inicioNovo + v.duracaoMinutos;
  const ocupado = doDia.find((e) => {
    if (!e.firme || !e.hora) return false;
    const inicioExistente = minutosDesdeMeiaNoite(e.hora);
    const fimExistente = inicioExistente + e.duracaoMinutos;
    return inicioNovo < fimExistente && inicioExistente < fimNovo;
  });
  if (ocupado) {
    return `Já tem ${ocupado.titulo} às ${faixaHoraria(ocupado)} nesse dia.`;
  }
  return null;
}

/**
 * O resumo do dia em uma frase — o que ele lê antes de abrir qualquer coisa.
 *
 * Conta só o que é COMPROMISSO (`firme`). Somar as preferências faria "4
 * consultas" para um dia com uma marcada e três "quem sabe" — e a frase existe
 * justamente para ele saber se o dia está cheio.
 */
export function resumoDoDia(doDia: EventoDaAgenda[]): string {
  const firmes = doDia.filter((e) => e.firme);
  if (firmes.length === 0)
    return doDia.length ? "Nada marcado — só pedidos sem hora." : "Dia livre";
  const presenciais = firmes.filter((e) => e.tipo === "presencial").length;
  const telas = firmes.filter((e) => e.tipo === "teleconsulta").length;
  const particulares = firmes.filter((e) => e.tipo === "particular").length;
  const partes: string[] = [];
  if (presenciais) partes.push(`${presenciais} no consultório`);
  if (telas) partes.push(`${telas} por vídeo`);
  if (particulares) partes.push(`${particulares} particular${particulares > 1 ? "es" : ""}`);
  return partes.join(" · ");
}
