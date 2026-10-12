/**
 * A AULA DO DIA como máquina de estados — uma tentativa por pergunta.
 *
 *   lição → pergunta (escolhe) → Verificar → mostra certo/errado + porquê →
 *   Continuar → … → fim
 *
 * A correção é a do site (`isAnswerCorrect`): "marque todas" só vale com o
 * conjunto exato. Sem react-native aqui: é testado pelo bun.
 */

import { isAnswerCorrect, isMultiQuestion, type QuizQuestion } from "@/lib/daily-quizzes";

export type EstadoDaAula = {
  etapa: "licao" | "pergunta" | "fim";
  indice: number;
  /** A escolha atual: um índice (escolha única) ou vários ("marque todas"). */
  escolha: number[];
  /** Já verificou esta pergunta? (uma tentativa só) */
  verificada: boolean;
  acertou: boolean | null;
  acertos: number;
};

export const INICIO_DA_AULA: EstadoDaAula = {
  etapa: "licao",
  indice: 0,
  escolha: [],
  verificada: false,
  acertou: null,
  acertos: 0,
};

export function comecarPerguntas(e: EstadoDaAula): EstadoDaAula {
  return { ...e, etapa: "pergunta", indice: 0, escolha: [], verificada: false, acertou: null };
}

/** Toca numa alternativa. Depois de verificar, nada muda. */
export function escolher(e: EstadoDaAula, q: QuizQuestion, opcao: number): EstadoDaAula {
  if (e.etapa !== "pergunta" || e.verificada) return e;
  if (opcao < 0 || opcao >= q.o.length) return e;
  if (!isMultiQuestion(q)) return { ...e, escolha: [opcao] };
  const tem = e.escolha.includes(opcao);
  const escolha = tem ? e.escolha.filter((i) => i !== opcao) : [...e.escolha, opcao];
  return { ...e, escolha: escolha.sort((a, b) => a - b) };
}

export function podeVerificar(e: EstadoDaAula): boolean {
  return e.etapa === "pergunta" && !e.verificada && e.escolha.length > 0;
}

export function verificar(e: EstadoDaAula, q: QuizQuestion): EstadoDaAula {
  if (!podeVerificar(e)) return e;
  const resposta = isMultiQuestion(q) ? e.escolha : e.escolha[0];
  const acertou = isAnswerCorrect(q, resposta);
  return { ...e, verificada: true, acertou, acertos: e.acertos + (acertou ? 1 : 0) };
}

export function continuar(e: EstadoDaAula, total: number): EstadoDaAula {
  if (e.etapa !== "pergunta" || !e.verificada) return e;
  if (e.indice + 1 >= total) return { ...e, etapa: "fim", escolha: [], verificada: false };
  return { ...e, indice: e.indice + 1, escolha: [], verificada: false, acertou: null };
}

/** Os índices corretos de uma pergunta, sempre como lista. */
export function corretas(q: QuizQuestion): number[] {
  return Array.isArray(q.a) ? q.a : [q.a];
}

/** O que cada alternativa mostra depois de verificar. */
export function estadoDaOpcao(
  e: EstadoDaAula,
  q: QuizQuestion,
  opcao: number,
): "neutra" | "escolhida" | "certa" | "errada" | "faltou" {
  const marcada = e.escolha.includes(opcao);
  if (!e.verificada) return marcada ? "escolhida" : "neutra";
  const certa = corretas(q).includes(opcao);
  if (certa && marcada) return "certa";
  if (certa) return "faltou";
  if (marcada) return "errada";
  return "neutra";
}

/**
 * A lição em título + corpo: a primeira frase vira título quando é curta o
 * bastante para ser um; senão a lição vai inteira, sem título (repetir a
 * frase cortada no título e de novo no corpo lia como erro).
 */
export function dividirLicao(teach: string): { titulo: string | null; corpo: string } {
  const t = (teach ?? "").trim();
  const m = /^(.+?[.!?])(\s+|$)/.exec(t);
  if (!m || m[1].length > 90) return { titulo: null, corpo: t };
  const corpo = t.slice(m[0].length).trim();
  return corpo ? { titulo: m[1].trim(), corpo } : { titulo: null, corpo: t };
}

/** A primeira frase da lição vira o título da aula (o quiz não tem título). */
export function tituloDaLicao(teach: string): string {
  const t = (teach ?? "").trim();
  const m = /^(.+?[.!?])(\s|$)/.exec(t);
  const frase = (m ? m[1] : t).trim();
  return frase.length > 90 ? `${frase.slice(0, 87).trimEnd()}…` : frase;
}
