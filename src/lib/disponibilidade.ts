/**
 * OS HORÁRIOS QUE O MÉDICO ABRE — e os que ele fecha.
 *
 * ─── O QUE FALTAVA ──────────────────────────────────────────────────────────
 *
 * A paciente pedia um horário no escuro ("terça de manhã?") e o médico
 * confirmava, recusava ou sugeria outro. Duas mensagens e uma espera para
 * marcar uma consulta — e ele recebendo pedidos para dias em que não atende.
 *
 * Existiu uma tabela `doctor_availability` que foi REVOGADA: nasceu sem
 * `doctor_id` (uma linha por dia da semana para o consultório inteiro), com RLS
 * que deixava qualquer pessoa logada — inclusive uma paciente — reescrever os
 * horários e apagar as férias, e nenhum fluxo a lia. Aqui nasce diferente: o
 * dono é obrigatório desde a primeira coluna e a leitura é sempre recortada.
 *
 * ─── POR QUE ISTO É UM MÓDULO SEM BANCO E SEM JSX ───────────────────────────
 *
 * A parte difícil não é guardar a grade: é subtrair dela os bloqueios e o que
 * já está marcado, sem errar as bordas. "Termina às 12:00" inclui a consulta
 * das 11:30 e exclui a das 12:00; um bloqueio das 14:00 às 16:00 come a das
 * 14:00 e a das 15:30, mas não a das 16:00. Cada uma dessas bordas é uma
 * consulta a mais ou a menos na agenda de alguém.
 *
 * ─── TUDO EM HORA DE PAREDE, DE PROPÓSITO ───────────────────────────────────
 *
 * A grade é `HH:MM` por dia da semana, e o resultado é `{dia, hora}` — o mesmo
 * formato que `appointment_requests` já guarda em `confirmed_date` e
 * `confirmed_time`. Nenhuma conversão de fuso acontece aqui.
 *
 * A ÚNICA fonte que chega em instante é a teleconsulta (`scheduled_for` é
 * `timestamptz`), e ela é convertida na fronteira por `paredeDaClinica` — num
 * lugar só, com o fuso declarado numa constante.
 */

/**
 * O fuso do consultório.
 *
 * Constante, e não coluna: o produto é pt-BR e todo médico dele atende no
 * Brasil. Uma coluna por médico seria um campo a mais no cadastro que ninguém
 * preenche — e um `null` ali viraria UTC silenciosamente, que é o erro de três
 * horas de novo. Quando existir médico fora do Brasil, é este ponto que muda.
 */
export const FUSO_DA_CLINICA = "America/Sao_Paulo";

/** Uma faixa de atendimento num dia da semana. */
export type RegraDaGrade = {
  /** 0 = domingo … 6 = sábado, igual a `Date#getDay`. */
  diaDaSemana: number;
  /** `HH:MM`. */
  inicio: string;
  /** `HH:MM` — exclusivo: uma consulta que COMEÇA aqui já é depois do fim. */
  fim: string;
  /** Duração de cada encaixe, em minutos. */
  minutos: number;
};

/** Um intervalo fechado pelo médico (férias, congresso, uma tarde). */
export type Bloqueio = {
  /** ISO com fuso. */
  inicio: string;
  fim: string;
  motivo?: string | null;
};

/** Um horário concreto, em hora de parede. */
export type HorarioLivre = { dia: string; hora: string };

const MIN_POR_DIA = 24 * 60;

/** `HH:MM` → minutos desde a meia-noite. `null` quando não é hora. */
export function emMinutos(hhmm: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Minutos desde a meia-noite → `HH:MM`. */
export function emHora(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** `YYYY-MM-DD` de uma data local. */
function diaDe(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Um instante (ISO) → o `{dia, hora}` que o RELÓGIO DO CONSULTÓRIO marca.
 *
 * `sv-SE` porque é o único locale que o `Intl` formata como `YYYY-MM-DD HH:MM`
 * — um formato que dá para fatiar sem montar a data de novo. Com `pt-BR` sairia
 * `20/08/2026`, e remontar isso à mão é onde se troca dia por mês.
 */
export function paredeDaClinica(iso: string, fuso: string = FUSO_DA_CLINICA): HorarioLivre | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const txt = d.toLocaleString("sv-SE", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  /* "2026-08-20 14:30" — o separador é espaço em `sv-SE`, mas alguns runtimes
     usam vírgula. Aceita os dois em vez de depender de um deles. */
  const m = /^(\d{4}-\d{2}-\d{2})[ ,T]+(\d{2}:\d{2})/.exec(txt);
  return m ? { dia: m[1], hora: m[2] } : null;
}

/**
 * A grade da semana virada em horários concretos, de `de` até `ate` (inclusive).
 *
 * Só olha para o dia da semana: um mesmo `RegraDaGrade` vale para todas as
 * terças do período.
 */
export function expandirGrade(regras: RegraDaGrade[], de: string, ate: string): HorarioLivre[] {
  const inicio = new Date(`${de}T12:00:00`);
  const fim = new Date(`${ate}T12:00:00`);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || inicio > fim) return [];

  const saida: HorarioLivre[] = [];
  /* Meio-dia como âncora, e não meia-noite: somar dias em cima de 00:00 pula ou
     repete um dia quando o fuso local tem horário de verão. Com 12:00 sobra
     meio dia de folga para qualquer salto de uma hora. */
  for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
    const dia = diaDe(d);
    const semana = d.getDay();
    for (const r of regras) {
      if (r.diaDaSemana !== semana) continue;
      const a = emMinutos(r.inicio);
      const b = emMinutos(r.fim);
      const passo = Math.trunc(r.minutos);
      /* Regra inválida é PULADA, não corrigida: passo zero ou negativo seria um
         laço infinito, e "consertar" para 30 minutos inventaria horários que o
         médico não abriu. */
      if (a === null || b === null || passo <= 0 || b <= a) continue;
      for (let t = a; t + passo <= b && t < MIN_POR_DIA; t += passo) {
        saida.push({ dia, hora: emHora(t) });
      }
    }
  }
  return ordenar(saida);
}

/** Ordena por dia e hora, e tira repetidos (duas regras que se sobrepõem). */
function ordenar(lista: HorarioLivre[]): HorarioLivre[] {
  const vistos = new Set<string>();
  const unicos: HorarioLivre[] = [];
  for (const h of lista) {
    const chave = `${h.dia}T${h.hora}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    unicos.push(h);
  }
  return unicos.sort((x, y) =>
    x.dia === y.dia ? (x.hora < y.hora ? -1 : x.hora > y.hora ? 1 : 0) : x.dia < y.dia ? -1 : 1,
  );
}

/**
 * Tira da lista o que cai dentro de um bloqueio.
 *
 * ─── AS BORDAS ──────────────────────────────────────────────────────────────
 *
 * Início INCLUSIVO, fim EXCLUSIVO. Um bloqueio das 14:00 às 16:00 come as 14:00
 * e as 15:30 e devolve as 16:00 — que é como as pessoas leem "das duas às
 * quatro". Trocar isso por fim inclusivo apaga um encaixe por bloqueio, todo
 * dia, sem ninguém perceber.
 */
export function removerBloqueios(
  livres: HorarioLivre[],
  bloqueios: Bloqueio[],
  fuso: string = FUSO_DA_CLINICA,
): HorarioLivre[] {
  const faixas = bloqueios
    .map((b) => {
      const i = paredeDaClinica(b.inicio, fuso);
      const f = paredeDaClinica(b.fim, fuso);
      if (!i || !f) return null;
      return { de: `${i.dia}T${i.hora}`, ate: `${f.dia}T${f.hora}` };
    })
    .filter((x): x is { de: string; ate: string } => x !== null);
  if (faixas.length === 0) return livres;

  return livres.filter((h) => {
    const ponto = `${h.dia}T${h.hora}`;
    return !faixas.some((f) => ponto >= f.de && ponto < f.ate);
  });
}

/** Tira da lista o que já tem alguém marcado. */
export function removerOcupados(livres: HorarioLivre[], ocupados: HorarioLivre[]): HorarioLivre[] {
  if (ocupados.length === 0) return livres;
  const tomados = new Set(ocupados.map((o) => `${o.dia}T${o.hora}`));
  return livres.filter((h) => !tomados.has(`${h.dia}T${h.hora}`));
}

/**
 * Tira o que já passou — e o que está perto demais para valer como opção.
 *
 * `antecedenciaHoras` existe porque um horário livre daqui a dez minutos é
 * livre no banco e impossível na vida: a paciente não chega, e o médico fica
 * com um buraco que parecia preenchido.
 */
export function removerPassado(
  livres: HorarioLivre[],
  agora: Date,
  antecedenciaHoras = 2,
  fuso: string = FUSO_DA_CLINICA,
): HorarioLivre[] {
  const limite = new Date(agora.getTime() + antecedenciaHoras * 3600_000);
  const p = paredeDaClinica(limite.toISOString(), fuso);
  if (!p) return livres;
  const corte = `${p.dia}T${p.hora}`;
  return livres.filter((h) => `${h.dia}T${h.hora}` >= corte);
}

/**
 * A conta inteira: a grade, menos os bloqueios, menos o que já está marcado,
 * menos o que já passou.
 *
 * A ordem importa só para o custo, não para o resultado — mas está escrita na
 * ordem em que se explica para uma pessoa.
 */
export function horariosLivres(opcoes: {
  regras: RegraDaGrade[];
  de: string;
  ate: string;
  bloqueios?: Bloqueio[];
  ocupados?: HorarioLivre[];
  agora?: Date;
  antecedenciaHoras?: number;
  fuso?: string;
}): HorarioLivre[] {
  const fuso = opcoes.fuso ?? FUSO_DA_CLINICA;
  let lista = expandirGrade(opcoes.regras, opcoes.de, opcoes.ate);
  lista = removerBloqueios(lista, opcoes.bloqueios ?? [], fuso);
  lista = removerOcupados(lista, opcoes.ocupados ?? []);
  if (opcoes.agora) {
    lista = removerPassado(lista, opcoes.agora, opcoes.antecedenciaHoras ?? 2, fuso);
  }
  return lista;
}

/** Agrupa por dia, que é como a tela mostra. */
export function livresPorDia(livres: HorarioLivre[]): { dia: string; horas: string[] }[] {
  const mapa = new Map<string, string[]>();
  for (const h of livres) {
    const atual = mapa.get(h.dia);
    if (atual) atual.push(h.hora);
    else mapa.set(h.dia, [h.hora]);
  }
  return [...mapa.entries()]
    .map(([dia, horas]) => ({ dia, horas }))
    .sort((a, b) => (a.dia < b.dia ? -1 : 1));
}

export const NOMES_DOS_DIAS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const;
