/**
 * OS TEXTOS DA TELA "HOJE" (`componentes/jornada/hoje.tsx`) — em regra pura,
 * testada pelo bun.
 *
 * Os cinco momentos viram GESTOS, com o tempo que levam e para que servem: a
 * lista de tarefas ("Aula de hoje · 0/1") lia como dever de casa, e o dono
 * pediu "um cuidado diário, algo mais emocional".
 *
 * ⚠️ O nome do bebê vai SEM artigo ("Ler para Helena", e não "para a Helena"):
 * o artigo supõe o sexo. Sem nome, "o bebê".
 */

import { feito, type FlagsDoDia, type Momento } from "~/lib/jornada/momentos";

export type ChaveDoCuidado = "aula" | "movement" | "meditation" | "bonding" | "gratitude";

export const ORDEM_DOS_CUIDADOS: readonly ChaveDoCuidado[] = [
  "aula",
  "movement",
  "meditation",
  "bonding",
  "gratitude",
];

export type Cuidado = { chave: ChaveDoCuidado; titulo: string; sub: string; feito: boolean };

export function cuidadosDoDia(o: {
  flags: FlagsDoDia;
  semana: number;
  nomeDoBebe: string | null;
}): Cuidado[] {
  const nome = o.nomeDoBebe?.trim() || null;
  const para = nome ?? "o bebê";
  const textos: Record<ChaveDoCuidado, { titulo: string; sub: string }> = {
    aula: { titulo: `Aprender sobre a semana ${o.semana}`, sub: "2 min · uma lição e perguntas" },
    movement: { titulo: "Soltar o corpo", sub: "5 min · no ritmo do seu corpo" },
    meditation: { titulo: `Respirar com ${para}`, sub: "3 min · a mente desacelera junto" },
    bonding: {
      titulo: `Ler para ${para}`,
      sub: "1 min · uma história na sua voz",
    },
    gratitude: {
      titulo: "Guardar uma coisa boa",
      sub: `1 min · vira uma carta para ${para}`,
    },
  };
  return ORDEM_DOS_CUIDADOS.map((chave) => ({
    chave,
    ...textos[chave],
    feito: feito(o.flags, chave as Momento),
  }));
}

export function saudacao(hora: number, nome: string | null): string {
  const oi =
    hora >= 5 && hora < 12 ? "Bom dia" : hora >= 12 && hora < 18 ? "Boa tarde" : "Boa noite";
  return nome ? `${oi}, ${nome}` : oi;
}

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const MESES = [
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

export function dataDeHoje(d: Date): string {
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/** Quantos dias até as 40 semanas (280 dias); `null` depois delas. */
export function diasQueFaltam(totalDias: number): number | null {
  const f = 280 - Math.floor(totalDias);
  return f > 0 ? f : null;
}
