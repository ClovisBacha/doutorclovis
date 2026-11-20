import { HISTORIAS } from "@/lib/historias-para-dormir";
import { CARTAS } from "@/lib/cartas-do-bebe";
import { MOVIMENTOS } from "@/lib/exercicios";
import { trimesterForWeek } from "@/lib/gestacao";
import { paraYmd } from "~/lib/datas";
import { gestacaoDoPerfil } from "~/lib/gestacao";
import { diaDaJornada, idadeEmDias, semanaDoDia } from "~/lib/jornada/dia";
import { temasDisponiveis } from "~/lib/jornada/meditacao";
import { ROTULO_DO_SOM_NO_APP } from "~/lib/jornada/sons";
import type { Perfil } from "~/lib/sessao";
import type { Minutos, RespostasDoPlano } from "~/lib/plano/respostas";

/**
 * OS NÚMEROS DO PLANO — todos de VERDADE (20/11/2026).
 *
 * A referência que o dono mandou dizia "quem monta o enxoval com um plano
 * economiza pelo menos R$ 1.500" e "junte-se a 58.364 mães · 4,8 · 1.148
 * avaliações". O app não tem esses números, e inventá-los é propaganda
 * enganosa (CDC, art. 37) e motivo de recusa na Apple (diretrizes 2.3.1 e
 * 5.6). Aqui só entra o que se CONTA: os dias até a data provável que ela
 * digitou, as aulas que existem nesses dias, os minutos que ela escolheu, e o
 * conteúdo que está de fato no app. A catraca (`plano.test.ts`) confere cada
 * número contra a fonte.
 */

/** A semana 40: a régua da data provável (DUM + 280). */
const DIAS_ATE_A_DPP = 280;
/** O pós-parto do app: as 12 primeiras semanas de vida (D 7–90). */
const DIAS_DO_POS = 12 * 7;

export type LinhaDoTempo =
  | {
      modo: "gravida";
      /** Dias de gestação hoje. */
      totalDias: number;
      /** A semana da trilha (1 a 42), a mesma régua da revelação. */
      semana: number;
      trimestre: 1 | 2 | 3;
      /** Dias até a data provável (0 quando já passou). */
      diasAteADpp: number;
      /** 0 a 1, sobre 40 semanas. */
      fracao: number;
    }
  | {
      modo: "nasceu";
      idadeDias: number;
      /** Semanas completas de vida. */
      semanasDeVida: number;
      /** Dias até o fim das 12 primeiras semanas (0 quando já passou). */
      diasAte12Semanas: number;
    };

/** Onde ela está no tempo, a partir do que digitou. `null` se a data ainda não vale. */
export function linhaDoTempo(r: RespostasDoPlano, hoje = new Date()): LinhaDoTempo | null {
  const ymd = paraYmd(r.data);
  if (!ymd) return null;
  if (r.fase === "nasceu" || r.modo === "nasceu") {
    const idade = idadeEmDias(ymd, hoje);
    if (idade == null) return null;
    return {
      modo: "nasceu",
      idadeDias: idade,
      semanasDeVida: Math.floor(idade / 7),
      diasAte12Semanas: Math.max(0, DIAS_DO_POS - idade),
    };
  }
  const perfil: Perfil =
    r.modo === "us"
      ? {
          id: "",
          reference_date: ymd,
          reference_weeks: Number(r.semanasUs) || null,
          reference_days: Number(r.diasUs || 0),
        }
      : { id: "", lmp_date: ymd };
  const g = gestacaoDoPerfil(perfil, hoje);
  if (!g) return null;
  const semana = semanaDoDia(diaDaJornada(g.totalDays));
  return {
    modo: "gravida",
    totalDias: g.totalDays,
    semana,
    trimestre: trimesterForWeek(semana),
    diasAteADpp: Math.max(0, DIAS_ATE_A_DPP - g.totalDays),
    fracao: Math.max(0, Math.min(1, g.totalDays / DIAS_ATE_A_DPP)),
  };
}

/** Os dias que o plano cobre a partir de hoje (inclui hoje): até a data provável ou até as 12 semanas. */
export function diasDoPlano(t: LinhaDoTempo): number {
  return (t.modo === "gravida" ? t.diasAteADpp : t.diasAte12Semanas) + 1;
}

/**
 * As aulas (gestação) ou os desafios (pós-parto) que existem de hoje até o fim
 * do plano: um por dia, só nos dias em que o app tem conteúdo (D 7–300 na
 * gestação, D 7–90 no pós-parto).
 */
export function aulasDoPlano(t: LinhaDoTempo): number {
  if (t.modo === "gravida") {
    const de = Math.max(7, diaDaJornada(t.totalDias));
    /* Passou da data provável: ainda há a aula de hoje (o banco vai a D 300). */
    const ate = Math.min(300, Math.max(DIAS_ATE_A_DPP, de));
    return Math.max(0, ate - de + 1);
  }
  const de = Math.max(7, t.idadeDias + 7);
  return Math.max(0, 90 - de + 1);
}

/** Os minutos de cuidado que o plano soma, com os minutos que ela escolheu por dia. */
export function minutosDoPlano(t: LinhaDoTempo, minutos: Minutos): number {
  return diasDoPlano(t) * minutos;
}

/** "8 horas", "1 hora", "45 minutos": arredondado para baixo, nunca para cima. */
export function rotuloDoTempo(minutosTotais: number): string {
  if (minutosTotais < 60) return `${minutosTotais} ${minutosTotais === 1 ? "minuto" : "minutos"}`;
  const h = Math.floor(minutosTotais / 60);
  return `${h} ${h === 1 ? "hora" : "horas"}`;
}

/**
 * O conteúdo de bem-estar que está no app, contado das próprias listas que as
 * telas leem — se uma lista crescer, o número cresce junto.
 */
export function conteudoDoApp(o: { posParto: boolean }) {
  return {
    meditacoes: temasDisponiveis({ cuidado: false, posParto: o.posParto }).length,
    sons: Object.keys(ROTULO_DO_SOM_NO_APP).length,
    movimentos: MOVIMENTOS.length,
    cartas: CARTAS.length,
    historias: HISTORIAS.length,
  };
}

/** A curva do "um pouco por dia": os minutos somados em `pontos` marcos, de hoje ao fim do plano. */
export function curvaDoCuidado(t: LinhaDoTempo, minutos: Minutos, pontos = 6): number[] {
  const dias = diasDoPlano(t);
  return Array.from({ length: pontos }, (_, i) =>
    Math.round((dias * minutos * i) / Math.max(1, pontos - 1)),
  );
}

export type MarcoDaCurva = { rotulo: string; dias: number; minutos: number };

/**
 * Os marcos do gráfico do "um pouco por dia": hoje, até duas semanas redondas
 * no caminho (múltiplas de 4 na gestação; 4 e 8 semanas de vida no
 * pós-parto) e o fim do plano — cada um com os minutos somados até ele.
 */
export function marcosDaCurva(t: LinhaDoTempo, minutos: Minutos): MarcoDaCurva[] {
  const total = diasDoPlano(t) - 1;
  const marcos: MarcoDaCurva[] = [{ rotulo: "Hoje", dias: 0, minutos: 0 }];
  if (t.modo === "gravida") {
    const hojeEm = t.totalDias;
    const meio: number[] = [];
    for (let s = Math.floor(hojeEm / 7 / 4) * 4 + 4; s < 40 && meio.length < 2; s += 4) {
      const d = s * 7 - hojeEm;
      if (d > 7 && d < total - 7) meio.push(s);
    }
    for (const s of meio)
      marcos.push({
        rotulo: `Semana ${s}`,
        dias: s * 7 - hojeEm,
        minutos: (s * 7 - hojeEm + 1) * minutos,
      });
    if (total > 0)
      marcos.push({ rotulo: "Data provável", dias: total, minutos: (total + 1) * minutos });
  } else {
    for (const s of [4, 8]) {
      const d = s * 7 - t.idadeDias;
      if (d > 7 && d < total - 7)
        marcos.push({ rotulo: `${s} semanas`, dias: d, minutos: (d + 1) * minutos });
    }
    if (total > 0)
      marcos.push({ rotulo: "12 semanas", dias: total, minutos: (total + 1) * minutos });
  }
  return marcos;
}
