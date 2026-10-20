/**
 * A AGENDA DO PRÉ-NATAL — as consultas, ultrassons e exames que ELA marca, com
 * lembrete no aparelho. O dono: "talvez só um agendamento de consulta, o
 * calendário pra pessoa lembrar do app". Não há médico na v1: a agenda é dela,
 * com quem quer que a acompanhe.
 *
 * ── Onde mora ──
 * No blob da jornada (`dc-path-agenda`, sincronizado com `journey_state`): a
 * agenda segue a conta para outro iPhone sem tabela nem SQL novo. Pela régua
 * de mescla, é estado mutável — a nuvem vence quando é mais nova que a marca
 * do aparelho, como as demais chaves que não são progresso.
 *
 * ── A hora ──
 * `quando` é a hora LOCAL ("2026-10-23T14:30"), sem fuso: a consulta é às
 * 14:30 de onde ela está, e um ISO em UTC viraria "17:30" na tela de quem
 * viajou. Nunca `toISOString()` aqui.
 *
 * Sem react-native aqui: é testado pelo bun.
 */

import { consultaForWeek } from "@/lib/gestacao";
import { orientacaoDoPos } from "~/lib/jornada/pos-parto";

export const CHAVE_AGENDA = "dc-path-agenda";

export type TipoDeCompromisso = "consulta" | "ultrassom" | "exame" | "vacina" | "outro";

export type Compromisso = {
  id: string;
  tipo: TipoDeCompromisso;
  /** Hora local, "AAAA-MM-DDTHH:mm". */
  quando: string;
  titulo?: string;
  onde?: string;
  nota?: string;
};

export const TIPOS: readonly { tipo: TipoDeCompromisso; rotulo: string; emoji: string }[] = [
  { tipo: "consulta", rotulo: "Consulta", emoji: "🩺" },
  { tipo: "ultrassom", rotulo: "Ultrassom", emoji: "🔍" },
  { tipo: "exame", rotulo: "Exame", emoji: "🧪" },
  { tipo: "vacina", rotulo: "Vacina", emoji: "💉" },
  { tipo: "outro", rotulo: "Outro", emoji: "📌" },
];

const NOME_PADRAO: Record<TipoDeCompromisso, string> = {
  consulta: "Consulta pré-natal",
  ultrassom: "Ultrassom",
  exame: "Exames",
  vacina: "Vacina",
  outro: "Compromisso",
};

export const emojiDo = (t: TipoDeCompromisso) => TIPOS.find((x) => x.tipo === t)?.emoji ?? "📌";
export const nomeDo = (c: Pick<Compromisso, "tipo" | "titulo">) =>
  c.titulo?.trim() || NOME_PADRAO[c.tipo];
export const nomePadrao = (t: TipoDeCompromisso) => NOME_PADRAO[t];

const RE_QUANDO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** A data local de um `quando`, ou `null` se ele não for uma hora de verdade. */
export function paraData(quando: string): Date | null {
  const m = RE_QUANDO.exec(quando);
  if (!m) return null;
  const [a, me, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  if (h > 23 || mi > 59) return null;
  const data = new Date(a, me - 1, d, h, mi);
  /* 31/02 vira 03/03 no Date: recusa em vez de marcar outro dia. */
  if (data.getFullYear() !== a || data.getMonth() !== me - 1 || data.getDate() !== d) return null;
  return data;
}

const dois = (n: number) => String(n).padStart(2, "0");

export function montarQuando(ymd: string, hora: number, minuto: number): string {
  return `${ymd}T${dois(hora)}:${dois(minuto)}`;
}

export const ymdDe = (quando: string) => quando.slice(0, 10);

function ehTipo(t: unknown): t is TipoDeCompromisso {
  return TIPOS.some((x) => x.tipo === t);
}

const textoOpcional = (v: unknown, max: number) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;

/** A agenda do blob, validada e em ordem. Item estragado sai, não derruba a tela. */
export function lerAgenda(v: unknown): Compromisso[] {
  if (!Array.isArray(v)) return [];
  const fora: Compromisso[] = [];
  const ids = new Set<string>();
  for (const x of v) {
    if (typeof x !== "object" || x === null) continue;
    const o = x as Record<string, unknown>;
    if (typeof o.id !== "string" || !o.id || ids.has(o.id)) continue;
    if (!ehTipo(o.tipo) || typeof o.quando !== "string" || !paraData(o.quando)) continue;
    ids.add(o.id);
    fora.push({
      id: o.id,
      tipo: o.tipo,
      quando: o.quando,
      titulo: textoOpcional(o.titulo, 60),
      onde: textoOpcional(o.onde, 80),
      nota: textoOpcional(o.nota, 1000),
    });
  }
  return fora.sort((a, b) => a.quando.localeCompare(b.quando));
}

/** Grava (inclui ou troca pelo id) e devolve a lista nova, em ordem. */
export function comCompromisso(lista: readonly Compromisso[], c: Compromisso): Compromisso[] {
  return lerAgenda([...lista.filter((x) => x.id !== c.id), c]);
}

export function semCompromisso(lista: readonly Compromisso[], id: string): Compromisso[] {
  return lista.filter((x) => x.id !== id);
}

/** Uma consulta "ainda vem" até uma hora depois do horário marcado (a sala de espera). */
const AINDA_VALE_MS = 60 * 60_000;

export function separar(
  lista: readonly Compromisso[],
  agora: Date,
): { proximos: Compromisso[]; passados: Compromisso[] } {
  const proximos: Compromisso[] = [];
  const passados: Compromisso[] = [];
  for (const c of lista) {
    const t = paraData(c.quando)?.getTime();
    if (t == null) continue;
    (t + AINDA_VALE_MS > agora.getTime() ? proximos : passados).push(c);
  }
  return { proximos, passados: passados.reverse() };
}

export function proximo(lista: readonly Compromisso[], agora: Date): Compromisso | null {
  return separar(lista, agora).proximos[0] ?? null;
}

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export const nomeDoMes = (m: number) => MESES[m]!;

function meiaNoite(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Dias de calendário de `agora` até `d` (0 = hoje, 1 = amanhã, -1 = ontem). */
export function diasAte(d: Date, agora: Date): number {
  return Math.round((meiaNoite(d) - meiaNoite(agora)) / 86_400_000);
}

export const horaDe = (d: Date) => `${d.getHours()}:${dois(d.getMinutes())}`;

/** "Hoje, 14:30" · "Amanhã, 9:00" · "Quinta, 23 de outubro · 14:30". */
export function quandoPorExtenso(quando: string, agora: Date): string {
  const d = paraData(quando);
  if (!d) return "";
  const n = diasAte(d, agora);
  if (n === 0) return `Hoje, ${horaDe(d)}`;
  if (n === 1) return `Amanhã, ${horaDe(d)}`;
  if (n === -1) return `Ontem, ${horaDe(d)}`;
  const ano = d.getFullYear() !== agora.getFullYear() ? ` de ${d.getFullYear()}` : "";
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}${ano} · ${horaDe(d)}`;
}

/** "é hoje" · "amanhã" · "em 5 dias" · "em 3 semanas". */
export function faltaQuanto(quando: string, agora: Date): string {
  const d = paraData(quando);
  if (!d) return "";
  const n = diasAte(d, agora);
  if (n <= 0) return "é hoje";
  if (n === 1) return "amanhã";
  if (n < 14) return `em ${n} dias`;
  return `em ${Math.round(n / 7)} semanas`;
}

/* ── Os lembretes ─────────────────────────────────────────────────────────── */

export type Lembrete = { id: string; quando: Date; titulo: string; corpo: string };

/** A véspera às 19h e duas horas antes. */
export const HORA_DA_VESPERA = 19;
const ANTES_MS = 2 * 60 * 60_000;

const PREPARO: Record<TipoDeCompromisso, string> = {
  consulta: "Leve a caderneta da gestante e os últimos exames.",
  ultrassom: "Confira com a clínica se há algum preparo.",
  exame: "Confira com o laboratório se precisa de jejum.",
  vacina: "Leve a caderneta de vacinação.",
  outro: "",
};

function linhaDoLugar(c: Compromisso, d: Date): string {
  return c.onde ? `Às ${horaDe(d)} · ${c.onde}.` : `Às ${horaDe(d)}.`;
}

/** Os lembretes de um compromisso que ainda estão no futuro. */
export function lembretesDe(c: Compromisso, agora: Date): Lembrete[] {
  const d = paraData(c.quando);
  if (!d) return [];
  const nome = nomeDo(c);
  const fora: Lembrete[] = [];
  const vespera = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, HORA_DA_VESPERA, 0);
  if (vespera > agora) {
    fora.push({
      id: `${c.id}-vespera`,
      quando: vespera,
      titulo: `Amanhã: ${nome}`,
      corpo: [linhaDoLugar(c, d), PREPARO[c.tipo]].filter(Boolean).join(" "),
    });
  }
  const antes = new Date(d.getTime() - ANTES_MS);
  if (antes > agora) {
    fora.push({
      id: `${c.id}-antes`,
      quando: antes,
      titulo: `Daqui a pouco: ${nome}`,
      corpo: linhaDoLugar(c, d),
    });
  }
  return fora;
}

/**
 * Todos os lembretes a agendar, os mais próximos primeiro. O iOS guarda no
 * máximo 64 notificações locais por app, e elas são divididas: a meditação usa
 * até 14, a jornada até 16 (`lembrete-da-jornada`) e a agenda até 20 — 50 no
 * total. 20 bastam para os próximos dez compromissos, e a próxima abertura do
 * app completa.
 */
export function lembretesDaAgenda(lista: readonly Compromisso[], agora: Date, max = 20) {
  return lista
    .flatMap((c) => lembretesDe(c, agora))
    .sort((a, b) => a.quando.getTime() - b.quando.getTime())
    .slice(0, max);
}

/* ── O calendário do mês ──────────────────────────────────────────────────── */

/** As semanas do mês (domingo a sábado), com `null` nos dias de fora. */
export function semanasDoMes(ano: number, mes: number): (string | null)[][] {
  const primeiro = new Date(ano, mes, 1).getDay();
  const total = new Date(ano, mes + 1, 0).getDate();
  const celulas: (string | null)[] = Array.from({ length: primeiro }, () => null);
  for (let d = 1; d <= total; d++) celulas.push(`${ano}-${dois(mes + 1)}-${dois(d)}`);
  while (celulas.length % 7) celulas.push(null);
  const semanas: (string | null)[][] = [];
  for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7));
  return semanas;
}

/** Quantos compromissos há em cada dia (AAAA-MM-DD). */
export function contagemPorDia(lista: readonly Compromisso[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of lista) m.set(ymdDe(c.quando), (m.get(ymdDe(c.quando)) ?? 0) + 1);
  return m;
}

/* ── O que costuma vir nesta fase ─────────────────────────────────────────── */

/**
 * A dica da fase, do calendário de rotina do site (`consultaForWeek`) — o
 * mesmo texto que a aba Início já mostra — com o tipo que ela sugere marcar.
 */
export function sugestaoDaFase(semana: number): { texto: string; tipo: TipoDeCompromisso } {
  const texto = consultaForWeek(semana);
  const tipo: TipoDeCompromisso = /ultrassom|translucência/i.test(texto)
    ? "ultrassom"
    : /teste oral|glicose/i.test(texto)
      ? "exame"
      : "consulta";
  return { texto, tipo };
}

/**
 * O que marcar em cada semana de vida, tirado da orientação da semana do site:
 * a revisão pós-parto, a consulta puerperal e as vacinas do bebê. Nas outras
 * semanas a dica é só leitura — não há o que pôr na agenda.
 */
const AGENDA_DO_POS: Readonly<Record<number, { tipo: TipoDeCompromisso; titulo: string }>> = {
  1: { tipo: "consulta", titulo: "Revisão pós-parto" },
  4: { tipo: "consulta", titulo: "Consulta puerperal" },
  5: { tipo: "vacina", titulo: "Vacinas de 2 meses do bebê" },
  6: { tipo: "consulta", titulo: "Consulta puerperal" },
  8: { tipo: "vacina", titulo: "Vacinas de 2 meses do bebê" },
  12: { tipo: "vacina", titulo: "Vacina meningo C do bebê" },
};

export function sugestaoDoPosParto(semanaDeVida: number): {
  texto: string;
  tipo: TipoDeCompromisso | null;
  titulo: string | null;
} {
  const a = AGENDA_DO_POS[semanaDeVida];
  return { texto: orientacaoDoPos(semanaDeVida), tipo: a?.tipo ?? null, titulo: a?.titulo ?? null };
}

/** Id curto e único o bastante para a agenda de uma pessoa. */
export function novoId(agora = Date.now()): string {
  return `${agora.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}
