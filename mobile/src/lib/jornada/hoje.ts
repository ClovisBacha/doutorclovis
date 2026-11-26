/**
 * OS TEXTOS DA TELA "HOJE" (`componentes/jornada/hoje.tsx`) — em regra pura,
 * testada pelo bun.
 *
 * Os cinco momentos viram GESTOS, com o tempo que levam e para que servem: a
 * lista de tarefas ("Aula de hoje · 0/1") lia como dever de casa, e o dono
 * pediu "um cuidado diário, algo mais emocional".
 *
 * A VOZ DO BEM-ESTAR (19/11/2026, o dono: "ser esperta também é cuidar da
 * saúde [...] um aplicativo de bem-estar materno"): aprender, mexer, respirar,
 * ler para o bebê e guardar uma coisa boa. A linha de baixo diz o que ELA
 * ganha naquele momento (calma, o corpo mais solto, um momento só de vocês),
 * e nunca um efeito de saúde: nada de "reduz", "melhora", "alivia" ou "faz bem
 * para o bebê" (`bolha-nos-cuidados.test.ts` cobra). Os mesmos nomes valem na
 * aba do Bebê e na folha do dia (`app/jornada/dia.tsx`).
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
  /** O assunto da aula de hoje (`tituloCurtoDaAula`): a tela diz o que ela
   * aprende hoje, e não só "uma lição". */
  assuntoDaAula?: string | null;
}): Cuidado[] {
  const nome = o.nomeDoBebe?.trim() || null;
  const para = nome ?? "o bebê";
  const textos: Record<ChaveDoCuidado, { titulo: string; sub: string }> = {
    aula: {
      titulo: `Aprender sobre a semana ${o.semana}`,
      sub: o.assuntoDaAula?.trim()
        ? `2 min · ${o.assuntoDaAula.trim()}`
        : "2 min · uma lição e perguntas",
    },
    movement: { titulo: "Mexer o corpo", sub: "5 min · o corpo mais solto, no seu ritmo" },
    meditation: { titulo: `Respirar com ${para}`, sub: "3 min · um momento de calma" },
    bonding: { titulo: `Ler para ${para}`, sub: "1 min · um momento só de vocês dois" },
    gratitude: { titulo: "Guardar uma coisa boa", sub: "1 min · o que foi bom fica guardado" },
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
