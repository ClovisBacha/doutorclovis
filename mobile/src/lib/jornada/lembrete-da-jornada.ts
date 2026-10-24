/**
 * OS LEMBRETES DA JORNADA — "pra pessoa lembrar do app", nas palavras do dono.
 *
 * Dois avisos, as duas cadências que o site já tinha por push do servidor:
 *
 *   · o CUIDADO DE HOJE, uma vez por dia na hora que ela escolheu — e calado
 *     no dia em que ela já fechou o dia (cinco cuidados na gestação, três no
 *     pós-parto). Hoje, o texto sabe onde ela está (a chama, quantos faltam);
 *     nos dias seguintes, ele fala do que o dia traz (a aula, o desafio);
 *   · a SEMANA NOVA, às 9h do dia em que ela começa ("Semana 25 começou! 🌱",
 *     o push semanal do site) — e, no pós-parto, cada semana de vida, com a
 *     orientação da semana.
 *
 * No app eles são notificações LOCAIS (o push do servidor depende da conta
 * Apple): o iPhone agenda os próximos 14 dias, e o app refaz a agenda sempre
 * que a tela Hoje abre. Se ela sumir por duas semanas, os avisos param
 * sozinhos — um app que insiste em quem não volta vira o app silenciado.
 *
 * ⚠️ MODO CUIDADO: nada de bebê, de semana, de chama nem de contagem. O
 * lembrete vira "um minuto para você", e a semana nova não existe.
 *
 * Sem react-native aqui: é testado pelo bun.
 */

import { bebeDaSemana } from "~/lib/bebe-da-semana";
import { orientacaoDoPos, ULTIMA_IDADE_DA_TRILHA } from "~/lib/jornada/pos-parto";

export const DIAS_AGENDADOS = 14;
/** A hora que já vem marcada no convite: de noite, ainda dá tempo de cuidar. */
export const HORA_PADRAO_DA_JORNADA = "20:00";
/** A semana nova chega de manhã: é uma notícia boa para começar o dia. */
export const HORA_DA_SEMANA_NOVA = 9;

export type PreferenciaDosLembretes = {
  /** "HH:MM" do cuidado de hoje, ou `null` (desligado). */
  hora: string | null;
  /** O aviso da semana nova. */
  semanaNova: boolean;
};

export type ModoDoLembrete = "gestacao" | "pos" | "cuidado" | "sem-data";

export type ContextoDoLembrete = {
  agora: Date;
  modo: ModoDoLembrete;
  /** O D de hoje (gestação: dia gestacional; pós-parto: idade + 7). */
  D: number | null;
  /** Gestação: semana e dia (0–6) de hoje, para achar a próxima semana nova. */
  semana?: number;
  diaNaSemana?: number;
  /** Pós-parto: a idade do bebê hoje, em dias. */
  idadeDias?: number;
  nomeDoBebe: string | null;
  chama: number;
  feitosHoje: number;
  totalDoDia: number;
  /** O desafio do dia D, como o app o mostra (`null` = não há). */
  desafio: (D: number) => string | null;
  /**
   * Gestação: o assunto da aula do dia D (`tituloCurtoDaAula`), quando já
   * se sabe — aí o aviso fala dela, e não do desafio. As aulas não seguem o
   * ritmo de temas por dia da semana: o assunto sai da própria lição.
   */
  aula?: (D: number) => string | null;
};

export type LembreteDaJornada = { id: string; quando: Date; titulo: string; corpo: string };

export function horaValida(hora: unknown): hora is string {
  return typeof hora === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(hora);
}

const dois = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;

function noDia(agora: Date, mais: number, h: number, m: number): Date {
  return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + mais, h, m, 0, 0);
}

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A primeira frase de um texto (a orientação da semana é longa para um aviso). */
export function primeiraFrase(texto: string): string {
  const m = /^(.+?[.!?])(\s|$)/.exec(texto.trim());
  return m ? m[1] : texto.trim();
}

const CUIDADO: readonly [string, string][] = [
  ["Um minuto para você 💜", "Respirar, mexer devagar ou escrever uma linha — no seu tempo."],
  ["Um momento seu 💜", "Sem placar e sem pressa. Só um momento seu."],
  ["Estou aqui 💜", "Hoje, cuidar de você já basta."],
];

/** O texto do cuidado de hoje para o dia `mais` dias à frente (0 = hoje). */
export function textoDoCuidado(
  c: ContextoDoLembrete,
  mais: number,
): { titulo: string; corpo: string } {
  const quem = c.nomeDoBebe?.trim() || "o bebê";
  if (c.modo === "cuidado") {
    const [titulo, corpo] =
      CUIDADO[((((c.D ?? 0) + mais) % CUIDADO.length) + CUIDADO.length) % CUIDADO.length]!;
    return { titulo, corpo };
  }
  if (c.modo === "sem-data" || c.D == null) {
    return {
      titulo: "O cuidado de hoje 💜",
      corpo: "Um momento seu: respirar, mexer ou escrever uma linha.",
    };
  }
  const D = c.D + mais;
  const hoje = mais === 0;
  if (c.modo === "pos") {
    const idade = (c.idadeDias ?? c.D - 7) + mais;
    if (idade > ULTIMA_IDADE_DA_TRILHA) {
      return {
        titulo: "Um minuto para você 💜",
        corpo: `Respirar, um momento com ${quem} ou uma coisa boa — quando der.`,
      };
    }
    if (hoje && c.feitosHoje > 0) {
      return {
        titulo: "Falta pouco para fechar o dia ✨",
        corpo: `${c.feitosHoje} de ${c.totalDoDia} feitos. Sem pressa.`,
      };
    }
    if (hoje && c.chama >= 2) {
      return {
        titulo: `🔥 ${c.chama} dias seguidos`,
        corpo: "Um gesto de hoje mantém a chama acesa. No seu ritmo 💜",
      };
    }
    const desafio = c.desafio(D);
    return {
      titulo: "Como você está hoje? 💜",
      corpo: desafio
        ? `Desafio de hoje: ${desafio}`
        : "Três gestos, no seu ritmo: o check-in, o desafio e a leitura da semana.",
    };
  }
  /* Gestação. */
  if (hoje && c.feitosHoje > 0) {
    return {
      titulo: "Falta pouco para fechar o dia ✨",
      corpo: `${c.feitosHoje} de ${c.totalDoDia} cuidados feitos. Mais um gesto e o dia fecha.`,
    };
  }
  if (hoje && c.chama >= 2) {
    return {
      titulo: `🔥 ${c.chama} dias seguidos`,
      corpo: `Um cuidado de hoje mantém a chama acesa. ${maiuscula(quem)} agradece 💜`,
    };
  }
  const aula = c.aula?.(D);
  if (aula) {
    return {
      titulo: "O cuidado de hoje 💜",
      corpo: `Aula de hoje: ${aula}. Uns minutinhos para você e ${quem}.`,
    };
  }
  const desafio = c.desafio(D);
  return {
    titulo: "O cuidado de hoje 💜",
    corpo: desafio ? `Desafio de hoje: ${desafio}` : `5 minutinhos para você e ${quem}.`,
  };
}

/** O aviso da semana nova no dia `mais` dias à frente, ou `null` se ela não começa nesse dia. */
export function textoDaSemanaNova(
  c: ContextoDoLembrete,
  mais: number,
): { titulo: string; corpo: string } | null {
  if (c.modo === "gestacao" && c.semana != null && c.diaNaSemana != null) {
    const total = c.diaNaSemana + mais;
    if (total === 0 || total % 7 !== 0) return null;
    const semana = c.semana + total / 7;
    if (semana < 4 || semana > 42) return null;
    const bebe = bebeDaSemana(semana);
    const quem = c.nomeDoBebe?.trim() || "Seu bebê";
    return {
      titulo: `Semana ${semana} começou! 🌱`,
      corpo: `${quem} agora tem o tamanho de ${bebe.fruit.toLowerCase()}. ${bebe.desc}`,
    };
  }
  if (c.modo === "pos" && c.idadeDias != null) {
    const idade = c.idadeDias + mais;
    if (idade <= 0 || idade % 7 !== 0 || idade > ULTIMA_IDADE_DA_TRILHA + 1) return null;
    const semanas = idade / 7;
    const quem = c.nomeDoBebe?.trim() || "O bebê";
    const semanaDeVida = Math.min(12, semanas + 1);
    return {
      titulo: `${quem} completa ${semanas} ${semanas === 1 ? "semana" : "semanas"} 💜`,
      corpo: primeiraFrase(orientacaoDoPos(semanaDeVida)),
    };
  }
  return null;
}

/**
 * Todos os avisos a agendar, em ordem: o cuidado de cada dia (hoje fica de
 * fora se o dia já está completo ou se a hora já passou) e as semanas novas.
 */
export function lembretesDaJornada(
  pref: PreferenciaDosLembretes,
  c: ContextoDoLembrete,
  dias = DIAS_AGENDADOS,
): LembreteDaJornada[] {
  const fora: LembreteDaJornada[] = [];
  const diaCompleto = c.totalDoDia > 0 && c.feitosHoje >= c.totalDoDia;
  if (horaValida(pref.hora)) {
    const [h, m] = pref.hora.split(":").map(Number) as [number, number];
    for (let mais = 0; mais < dias; mais++) {
      if (mais === 0 && diaCompleto) continue;
      const quando = noDia(c.agora, mais, h, m);
      if (quando.getTime() <= c.agora.getTime()) continue;
      fora.push({ id: `jornada-${ymd(quando)}`, quando, ...textoDoCuidado(c, mais) });
    }
  }
  if (pref.semanaNova && c.modo !== "cuidado") {
    for (let mais = 0; mais < dias; mais++) {
      const t = textoDaSemanaNova(c, mais);
      if (!t) continue;
      const quando = noDia(c.agora, mais, HORA_DA_SEMANA_NOVA, 0);
      if (quando.getTime() <= c.agora.getTime()) continue;
      fora.push({ id: `semana-${ymd(quando)}`, quando, ...t });
    }
  }
  return fora.sort((a, b) => a.quando.getTime() - b.quando.getTime());
}

/** A preferência guardada, validada (o que não for hora vira desligado). */
export function lerPreferencia(v: unknown): PreferenciaDosLembretes & { dispensado: boolean } {
  const o = typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
  return {
    hora: horaValida(o.hora) ? o.hora : null,
    semanaNova: o.semanaNova === true,
    dispensado: o.dispensado === true,
  };
}
