/**
 * A VOZ DA BOLHA NO JOGO (19/11/2026) — o que ela diz na trilha, na aula e na
 * festa do fim.
 *
 * O dono: "o bebê bolha vai ser aquele personagem que vai conversar com a mãe
 * [...] trabalhe isso em todas as telas possíveis". A conversa da aba do bebê
 * mora em `conversa.ts`; aqui ficam as falas CURTAS do resto do jogo: o balão
 * do nó de hoje, a pergunta do humor na trilha, a abertura e o veredito da
 * aula e o que ela diz quando a aula (ou o dia) termina. São o cromo do app,
 * nunca o conteúdo da aula (as lições e os porquês não mudam).
 *
 * As regras de `conversa.ts` valem aqui, e a catraca é a mesma
 * (`falas-do-jogo.test.ts`): primeira pessoa, curta, sem conduta, sem
 * promessa de efeito, sem "ele/ela" para o bebê, sem travessão, sem emoji, e
 * a mesma frase o dia inteiro (a variação sai do dia ou da pergunta, nunca de
 * um sorteio). No Modo Cuidado não há Bolha guia: quem chama estas funções
 * não as chama no luto.
 */

import type { PoseDaBolha } from "~/lib/bolha/conversa";

/** Um de `opcoes`, o mesmo para o mesmo `n` (o dia, a pergunta). */
function doDia<T>(opcoes: readonly T[], n: number): T {
  const i = ((Math.floor(n) % opcoes.length) + opcoes.length) % opcoes.length;
  return opcoes[i]!;
}

const perguntas = (n: number) => (n === 1 ? "uma pergunta" : `${n} perguntas`);

/* ── A trilha ─────────────────────────────────────────────────────────── */

/**
 * O balão do nó de hoje, dito pela Bolha (antes, "COMEÇAR", "CONTINUAR" e
 * "DIA COMPLETO", em maiúsculas de botão).
 */
export function falaDoNoDeHoje(o: { feitos: number; total: number; fechado: boolean }): {
  texto: string;
  pose: PoseDaBolha;
} {
  if (o.fechado || o.feitos >= o.total) return { texto: "Dia completo!", pose: "comemorando" };
  if (o.feitos <= 0) return { texto: "Vamos começar?", pose: "feliz" };
  if (o.total - o.feitos === 1) return { texto: "Falta só um!", pose: "orgulhosa" };
  return { texto: "Bora continuar?", pose: "feliz" };
}

/** A pergunta do check-in na trilha: a Bolha que pergunta. */
export const PERGUNTA_DO_HUMOR = "Me conta: como você está hoje?";

/**
 * O que a Bolha responde ao humor marcado na trilha, antes de a faixa sair.
 * Curto: a conversa inteira mora na aba do bebê (`conversa.ts`).
 */
export function reacaoAoHumor(humor: string): { texto: string; pose: PoseDaBolha } {
  switch (humor) {
    case "Ótima":
      return { texto: "Que bom! Anotei aqui.", pose: "comemorando" };
    case "Bem":
      return { texto: "Bom saber. Anotei aqui.", pose: "feliz" };
    case "Normal":
      return { texto: "Anotado. Dia normal também conta.", pose: "feliz" };
    case "Cansada":
      return { texto: "Anotei. Hoje a gente vai devagar.", pose: "feliz" };
    case "Enjoada":
      return { texto: "Poxa. Anotei, e vamos com calma.", pose: "feliz" };
    default:
      return { texto: "Anotei aqui. Obrigada por contar.", pose: "feliz" };
  }
}

/* ── A aula ───────────────────────────────────────────────────────────── */

/** O título da abertura da aula (1,5 s na cor da semana). */
export const ABERTURA_DA_AULA = "Dois minutinhos comigo?";

/** O que a Bolha diz em cima da lição. */
export function falaDaLicao(o: { D: number; total: number; semana: number | null }): string {
  const sua = o.semana ? `a sua semana ${o.semana}` : "a sua semana";
  return doDia(
    [
      `Separei esta leitura para ${sua}. Depois vêm ${perguntas(o.total)}, com uma chance em cada.`,
      `Lê comigo, sem pressa. No fim são ${perguntas(o.total)}, e você tem uma chance em cada.`,
      `Hoje eu trouxe um assunto bom. Depois da leitura, ${perguntas(o.total)}, uma chance em cada.`,
    ],
    o.D,
  );
}

/** A aula de hoje já feita (a revisão continua aberta). */
export const AULA_JA_FEITA = "Você já fez a aula de hoje. Amanhã eu trago outra.";

/**
 * O título do veredito, na folha que sobe com a Bolha. No acerto ela festeja;
 * no erro ela fica por perto, sem repreender. Varia de uma pergunta para a
 * outra (e de um dia para o outro).
 *
 * 23/11/2026, o dono: "não precisa colocar 'as certas estão em verde', isso é
 * óbvio; vamos deixar mais clean que nem o Duolingo". O título é só o
 * veredito; o porquê fica atrás do botão "Explicar o erro" (`aula.tsx`).
 */
export function tituloDoVeredito(o: {
  acertou: boolean;
  multi: boolean;
  indice: number;
  D: number;
}): string {
  const n = o.indice + o.D;
  if (o.acertou) {
    return doDia(
      o.multi
        ? ["Isso mesmo!", "Acertou todas!", "Eu sabia que você sabia.", "São essas!", "Boa!"]
        : ["Isso mesmo!", "Acertou!", "Eu sabia que você sabia.", "É essa!", "Boa!"],
      n,
    );
  }
  return doDia(["Quase!", "Essa engana.", "Eu também ia nessa."], n);
}

/**
 * O que a Bolha diz no fim da aula. Zerando, ela agradece e não comenta o
 * resultado (qualquer reação ali viraria nota).
 */
export function falaDoFimDaAula(o: { acertos: number; total: number; D: number }): string {
  if (o.total > 0 && o.acertos >= o.total)
    return doDia(["Quase estourei de orgulho.", "Fiquei toda colorida de orgulho."], o.D);
  if (o.acertos > 0 && o.acertos === o.total - 1) return "Só uma escapou. Amanhã eu trago mais.";
  if (o.acertos > 0)
    return doDia(
      [
        "Cada porquê que você leu fica com você. Amanhã tem mais.",
        "Hoje você saiu sabendo mais da sua semana.",
      ],
      o.D,
    );
  return "Obrigada por aprender comigo hoje. Amanhã eu trago outra aula.";
}

/* ── A festa do dia ───────────────────────────────────────────────────── */

/** O dia fechou: os cinco cuidados (a frase do dono no fim). */
export const FALA_DO_DIA_COMPLETO =
  "Os cinco cuidados de hoje, feitos. Cuidar de você é cuidar de vocês dois.";

/** Todas as falas deste arquivo (para a catraca de voz). */
export function todasAsFalasDoJogo(): string[] {
  const f = new Set<string>([
    PERGUNTA_DO_HUMOR,
    ABERTURA_DA_AULA,
    AULA_JA_FEITA,
    FALA_DO_DIA_COMPLETO,
  ]);
  for (const total of [3, 5]) {
    for (let feitos = 0; feitos <= total; feitos++) {
      f.add(falaDoNoDeHoje({ feitos, total, fechado: false }).texto);
      f.add(falaDoNoDeHoje({ feitos, total, fechado: true }).texto);
    }
  }
  for (const h of ["Ótima", "Bem", "Normal", "Cansada", "Enjoada", "?"])
    f.add(reacaoAoHumor(h).texto);
  for (let D = 0; D < 14; D++) {
    for (const total of [1, 3, 5]) {
      f.add(falaDaLicao({ D, total, semana: 24 }));
      f.add(falaDaLicao({ D, total, semana: null }));
      for (let acertos = 0; acertos <= total; acertos++)
        f.add(falaDoFimDaAula({ acertos, total, D }));
    }
    for (let indice = 0; indice < 5; indice++)
      for (const acertou of [true, false])
        for (const multi of [true, false]) f.add(tituloDoVeredito({ acertou, multi, indice, D }));
  }
  return [...f];
}
