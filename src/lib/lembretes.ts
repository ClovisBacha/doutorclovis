/**
 * OS LEMBRETES DE CONSULTA — 24 horas antes e 4 horas antes.
 *
 * ─── POR QUE ISTO EXISTE ────────────────────────────────────────────────────
 *
 * Falta em consultório de alto risco é vaga perdida duas vezes: para o médico,
 * que fica com o buraco, e para quem estava na fila de espera e não foi
 * chamada. A paciente marcou há três semanas e esqueceu.
 *
 * ─── O RISCO NÃO É ESQUECER DE MANDAR. É MANDAR DUAS VEZES ──────────────────
 *
 * Um cron que roda de hora em hora passa MUITAS vezes pela mesma consulta. Sem
 * memória do que já foi enviado, a paciente recebe "sua consulta é amanhã" a
 * cada hora, das 24h até a hora da consulta — e desliga as notificações do app,
 * que é o pior desfecho possível para um produto que também avisa emergência.
 *
 * Por isso a decisão é uma função PURA de três coisas: o instante de agora, os
 * compromissos, e o conjunto do que já foi enviado. O que grava esse conjunto é
 * o chamador; o que decide é isto aqui, e dá para testar sem banco.
 *
 * ─── A JANELA É ABERTA, E NÃO UMA FAIXA ESTREITA ────────────────────────────
 *
 * "Mandar quando faltar exatamente 24h" perde a consulta toda vez que o cron
 * atrasa, cai, ou o servidor dorme — e ninguém percebe, porque a ausência de um
 * lembrete não deixa rastro. A régua aqui é "faltam 24h OU MENOS e ainda não
 * mandei": um cron atrasado manda tarde, que é infinitamente melhor que não
 * mandar. O `jaEnviados` é o que impede a repetição.
 */

export type Compromisso = {
  /** Identidade da linha na origem — é o que vai para o registro de enviados. */
  id: string;
  fonte: "consulta" | "teleconsulta";
  /** Instante de início, ISO com fuso. */
  quando: string;
  /** Para quem avisar. */
  email: string | null;
  /** Conta no app, quando existe — o push vai por aqui. */
  userId: string | null;
  nome: string | null;
};

export type Especie = "24h" | "4h";

export type LembreteAEnviar = {
  compromisso: Compromisso;
  especie: Especie;
  /** Quantos minutos faltam, no instante da decisão. Vai para o texto. */
  faltamMinutos: number;
};

export const HORAS_DA_ESPECIE: Record<Especie, number> = { "24h": 24, "4h": 4 };

/** A chave que o registro de enviados guarda. Uma por (compromisso, espécie). */
export function chaveDoLembrete(c: Pick<Compromisso, "fonte" | "id">, e: Especie): string {
  return `${c.fonte}:${c.id}:${e}`;
}

/**
 * Quais lembretes estão vencidos AGORA.
 *
 * ─── A ORDEM DAS DUAS ESPÉCIES ──────────────────────────────────────────────
 *
 * Faltando 3 horas, tecnicamente "faltam 24h ou menos" também é verdade. Se as
 * duas espécies fossem avaliadas soltas, uma consulta marcada de véspera —
 * criada quando já faltavam 3 horas — dispararia as DUAS de uma vez: dois
 * avisos no mesmo minuto dizendo a mesma coisa.
 *
 * Por isso a de 24h só vale enquanto ainda faltam MAIS de 4 horas. Passado esse
 * ponto, quem fala é a de 4h — uma só, e a mais útil das duas.
 */
export function lembretesVencidos(
  compromissos: Compromisso[],
  agora: Date,
  jaEnviados: Set<string>,
): LembreteAEnviar[] {
  const saida: LembreteAEnviar[] = [];
  const t0 = agora.getTime();

  for (const c of compromissos) {
    const t = new Date(c.quando).getTime();
    /* Data podre não vira lembrete. `NaN` em comparação é sempre falso, o que
       já a excluiria — mas silenciosamente, e este `continue` diz que é de
       propósito. */
    if (Number.isNaN(t)) continue;

    const faltamMin = Math.round((t - t0) / 60000);
    /* Consulta que já começou não recebe lembrete. Chegar "sua consulta é em
       -20 minutos" é pior que não chegar nada. */
    if (faltamMin <= 0) continue;

    /* Sem nenhum canal não há o que enviar — e criar o registro de "enviado"
       para quem não recebeu nada faria o lembrete nunca sair, nem depois de ela
       cadastrar o e-mail. */
    if (!c.email && !c.userId) continue;

    const especie: Especie | null =
      faltamMin <= HORAS_DA_ESPECIE["4h"] * 60
        ? "4h"
        : faltamMin <= HORAS_DA_ESPECIE["24h"] * 60
          ? "24h"
          : null;
    if (!especie) continue;

    if (jaEnviados.has(chaveDoLembrete(c, especie))) continue;
    saida.push({ compromisso: c, especie, faltamMinutos: faltamMin });
  }

  /* Os mais urgentes primeiro: se o lote for cortado por tempo de execução, o
     que sobra para a próxima rodada é o menos urgente. */
  return saida.sort((a, b) => a.faltamMinutos - b.faltamMinutos);
}

/**
 * "amanhã às 14:30" / "hoje às 14:30" / "daqui a pouco".
 *
 * ─── TRÊS FORMAS, E NÃO QUATRO ──────────────────────────────────────────────
 *
 * A primeira versão tinha um "em cerca de N h" no meio, e ele era quase código
 * morto: só aparecia entre 75 e 90 minutos, uma faixa de quinze minutos.
 * Pior, era menos útil que a hora do relógio — "em cerca de 3 h" obriga a
 * paciente a fazer a conta que a notificação deveria ter feito.
 *
 * Perto demais para o relógio ajudar ("daqui a pouco"), ou a hora exata. O
 * corte em 90 minutos é onde "às 14:30" para de ser informação e vira pressa.
 */
export function comoDizerQuando(faltamMinutos: number, horaLocal: string): string {
  if (faltamMinutos <= 90) return "daqui a pouco";
  return faltamMinutos <= 12 * 60 ? `hoje às ${horaLocal}` : `amanhã às ${horaLocal}`;
}

/** O texto do aviso. Curto: é notificação, não carta. */
export function textoDoLembrete(
  l: LembreteAEnviar,
  horaLocal: string,
): { titulo: string; corpo: string } {
  const primeiro = (l.compromisso.nome ?? "").trim().split(/\s+/)[0] || "Tudo certo";
  const onde = l.compromisso.fonte === "teleconsulta" ? "sua teleconsulta" : "sua consulta";
  const quando = comoDizerQuando(l.faltamMinutos, horaLocal);
  return l.especie === "24h"
    ? {
        titulo: "Consulta amanhã 📅",
        corpo: `${primeiro}, ${onde} é ${quando}. Confirme no app se estiver tudo certo.`,
      }
    : {
        titulo:
          l.compromisso.fonte === "teleconsulta" ? "Teleconsulta hoje 🎥" : "Consulta hoje 🕐",
        corpo:
          l.compromisso.fonte === "teleconsulta"
            ? `${primeiro}, ${onde} é ${quando}. O link abre no app.`
            : `${primeiro}, ${onde} é ${quando}.`,
      };
}
