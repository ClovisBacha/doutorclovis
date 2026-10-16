/**
 * A SESSÃO CURTA DE MEXER — montada pela régua do site (`@/lib/exercicios`).
 *
 * O que escolhe os movimentos, corta pelo tempo e ordena numa descida só é
 * `sessaoDoDia`; aqui só se decide a fase e se desenha a linha do tempo.
 * Sem react-native aqui: é testado pelo bun.
 */

import {
  DURACOES_EXERCICIO,
  elegiveis,
  fasePara,
  sessaoDoDia,
  type Movimento,
  type NotasDoCorpo,
  type Sintoma,
} from "@/lib/exercicios";

/** As durações do app antigo (`DURACOES_EXERCICIO`): 2, 5 ou 10 minutos. */
export const DURACOES_MEXER = DURACOES_EXERCICIO;
export type DuracaoMexer = (typeof DURACOES_MEXER)[number];
/** O tempo que já vem marcado, como no app antigo. */
export const DURACAO_PADRAO: DuracaoMexer = 5;

/**
 * O respiro entre um movimento e o seguinte. ZERO, como no app antigo: lá a
 * troca era imediata e a voz lia o movimento seguinte ao entrar nele. Os 6 s de
 * "Prepare-se" que o app tinha mudavam o ritmo de toda sessão (e esticavam a de
 * 10 min em quase um minuto) — o dono pediu as atividades como eram.
 * O caminho da troca continua na linha do tempo para quem quiser religá-lo.
 */
export const TROCA_SEGUNDOS = 0;

export function montarSessao(o: {
  D: number;
  minutos: DuracaoMexer;
  semana: number | null;
  posParto: boolean;
  /** Modo Cuidado: o corpo passou por uma gestação e não há bebê — a régua
   *  do pós-parto (sem chão, sem preparação para o parto) é a que serve. */
  cuidado: boolean;
  sintoma: Sintoma | null;
  /** "Hoje eu não desço ao chão": cama, sofá ou de pé, sem tapete. */
  semChao?: boolean;
  notas?: NotasDoCorpo;
}): Movimento[] {
  return sessaoDoDia({
    dia: o.D,
    minutos: o.minutos,
    semana: o.cuidado ? null : o.semana,
    posParto: o.posParto || o.cuidado,
    sintoma: o.sintoma,
    semChao: o.semChao ?? false,
    notas: o.notas ?? {},
  });
}

/**
 * Há movimento de chão para tirar nesta fase? A partir da 37ª semana, no
 * pós-parto e no Modo Cuidado a régua já tirou o chão sozinha — e um botão que
 * não muda nada ensina que os botões da tela não valem. Então ele some.
 */
export function temChaoParaTirar(o: {
  semana: number | null;
  posParto: boolean;
  cuidado: boolean;
}): boolean {
  const semana = o.cuidado ? null : o.semana;
  const posParto = o.posParto || o.cuidado;
  return elegiveis(fasePara(semana, posParto), semana, posParto).some((m) => m.chao);
}

export type Trecho = {
  indice: number;
  movimento: Movimento;
  inicio: number;
  fim: number;
};

/** A linha do tempo: cada movimento com a sua janela, com a troca entre eles. */
export function linhaDoTempo(seq: Movimento[]): { trechos: Trecho[]; total: number } {
  const trechos: Trecho[] = [];
  let t = 0;
  seq.forEach((m, i) => {
    if (i > 0) t += TROCA_SEGUNDOS;
    trechos.push({ indice: i, movimento: m, inicio: t, fim: t + m.secs });
    t += m.secs;
  });
  return { trechos, total: t };
}

export type Posicao =
  | { tipo: "movimento"; trecho: Trecho; restante: number }
  | { tipo: "troca"; proximo: Trecho; restante: number }
  | { tipo: "fim" };

/** Onde a sessão está no segundo t. */
export function posicaoNoTempo(trechos: Trecho[], t: number): Posicao {
  for (const tr of trechos) {
    if (t < tr.inicio) return { tipo: "troca", proximo: tr, restante: Math.ceil(tr.inicio - t) };
    if (t < tr.fim) return { tipo: "movimento", trecho: tr, restante: Math.ceil(tr.fim - t) };
  }
  return { tipo: "fim" };
}

/** Pular para o próximo movimento: o instante em que ele começa. */
export function inicioDoProximo(trechos: Trecho[], t: number): number {
  const prox = trechos.find((tr) => tr.inicio > t);
  if (prox) return prox.inicio;
  const ultimo = trechos[trechos.length - 1];
  return ultimo ? ultimo.fim : 0;
}

export function minutosAproximados(total: number): string {
  const m = Math.max(1, Math.round(total / 60));
  return m === 1 ? "cerca de 1 minuto" : `cerca de ${m} minutos`;
}
