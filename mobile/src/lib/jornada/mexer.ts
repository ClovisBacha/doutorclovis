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
import { TEXTO_REGRAVADO } from "~/lib/audio/regravadas-texto";

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

/**
 * ⚠️ OS TEXTOS DOS MOVIMENTOS COMO O APP OS DIZ (21/10/2026: o app não é
 * conselho médico). A régua do site promete remédio ("ajuda a circulação e o
 * inchaço", "alívio pra azia", "ajuda o encaixe", "o melhor remédio para a
 * câimbra", "é este que o parto pede"), lista sinal de alerta no "Pare se" ("se
 * uma panturrilha doer sozinha, quente ou inchada — avise o médico", "contração
 * que se repete") e manda para a consulta e a fisioterapeuta. Sinal de alerta
 * mora num lugar só: o SOS. O "Pare se" vira o que vale para qualquer corpo —
 * se incomodar, pare —, e o que deixava o exercício seguro vira instrução
 * ("fique de lado o tempo todo"), não orientação médica.
 *
 * A troca casa pelo texto EXATO do site, campo a campo; a catraca do teste
 * cobra que ele ainda seja o do site.
 */
type Troca = { site: string; app: string };
export const TEXTO_DO_MOVIMENTO_NO_APP: Readonly<
  Record<
    string,
    Partial<Record<"cue" | "sentir" | "parar", Troca>> & {
      passos?: Readonly<Record<number, Troca>>;
    }
  >
> = {
  tornozelo: {
    cue: {
      site: "Desenhe círculos lentos com o pé — ajuda a circulação e o inchaço.",
      app: "Desenhe círculos lentos com o pé, sem pressa nenhuma.",
    },
    parar: {
      site: "Se uma panturrilha doer sozinha, quente ou muito inchada — avise o médico.",
      app: "Se incomodar, pare e descanse.",
    },
  },
  pelve: {
    parar: {
      site: "Se sentir contração ou dor que não passa ao parar.",
      app: "Se incomodar, volte devagar e pare.",
    },
  },
  bracos: {
    sentir: {
      site: "As costelas e as laterais do tronco abrindo — alívio pra azia.",
      app: "As costelas e as laterais do tronco abrindo.",
    },
  },
  gatocamelo: {
    sentir: { site: "A lombar abrindo e aliviando.", app: "A coluna ondulando, no ritmo do ar." },
  },
  balanco: {
    cue: {
      site: "Leve o quadril pra trás e volte — alivia as costas e ajuda o encaixe.",
      app: "Leve o quadril pra trás e volte, no ritmo do ar.",
    },
    sentir: { site: "A lombar descomprimindo.", app: "As costas se alongando devagar." },
  },
  "assoalho-lento": {
    parar: {
      site: "Se doer, ou se você não conseguir soltar depois — vale procurar uma fisioterapeuta pélvica.",
      app: "Se doer, pare e descanse.",
    },
  },
  piriforme: {
    cue: {
      site: "Tornozelo em cima do joelho e o peito para a frente — é a dor que desce a perna.",
      app: "Tornozelo em cima do joelho e o peito para a frente, devagar.",
    },
    parar: {
      site: "Se a dor da perna PIORAR ou descer mais do que já descia.",
      app: "Se puxar demais, volte um pouco ou pare.",
    },
  },
  "travesseiro-entre-joelhos": {
    cue: {
      site: "Aperta e solta um travesseiro entre os joelhos — estabiliza a frente.",
      app: "Aperta e solta um travesseiro entre os joelhos, no ritmo do ar.",
    },
  },
  "panturrilha-parede": {
    passos: {
      3: {
        site: "Vinte segundos de cada lado. É o melhor remédio para a câimbra da noite.",
        app: "Vinte segundos de cada lado, respirando devagar.",
      },
    },
    parar: {
      site: "Se UMA panturrilha estiver dolorida, quente ou inchada sozinha — não alongue e avise o médico.",
      app: "Se puxar demais, diminua ou pare.",
    },
  },
  "punho-dedos": {
    cue: {
      site: "Abrir, fechar e girar — para a mão que acorda dormente.",
      app: "Abrir, fechar e girar — para soltar as mãos.",
    },
    sentir: {
      site: "A mão mais solta e o formigamento cedendo.",
      app: "As mãos mais soltas e leves.",
    },
    parar: {
      site: "Se a dormência não passar ou acordar você toda noite, conte na consulta.",
      app: "Se incomodar, pare e sacuda as mãos.",
    },
  },
  "assoalho-rapido": {
    cue: {
      site: "Fecha e solta rápido — é o que segura o xixi quando você tosse.",
      app: "Fecha e solta rápido, como uma piscadinha por dentro.",
    },
  },
  "assoalho-soltar": {
    cue: {
      site: "O contrário do exercício anterior — e é este que o parto pede.",
      app: "Soltar tudo por dentro, devagar, junto com o ar.",
    },
    passos: {
      2: {
        site: "Ao soltar o ar pela boca, imagine tudo lá embaixo se abrindo e amolecendo.",
        app: "Ao soltar o ar pela boca, deixe tudo lá embaixo amolecer.",
      },
    },
  },
  "pernas-elevadas": {
    passos: {
      0: {
        site: "Deite-se de lado, do lado ESQUERDO, com travesseiros sob as pernas.",
        app: "Deite-se de lado, com travesseiros sob as pernas.",
      },
      3: {
        site: "Depois da 20ª semana, evite ficar de barriga para cima nesta posição.",
        app: "Fique de lado o tempo todo; para levantar, sente-se primeiro, devagar.",
      },
    },
    sentir: {
      site: "As pernas mais leves, e o inchaço cedendo aos poucos.",
      app: "As pernas mais leves e o corpo descansando.",
    },
    parar: {
      site: "Se ficar tonta ou enjoada — vire mais para o lado esquerdo.",
      app: "Se ficar desconfortável, sente-se devagar.",
    },
  },
  "costelas-parede": {
    parar: {
      site: "Se der refluxo forte, saia da posição e fique em pé.",
      app: "Se incomodar, saia da posição e fique em pé.",
    },
  },
  "ativar-transverso": {
    parar: {
      site: "Se aparecer uma saliência no meio da barriga, diminua a força — e conte na consulta.",
      app: "Se incomodar, diminua a força ou pare.",
    },
  },
  "circulos-bola": {
    sentir: {
      site: "O quadril solto e o peso descendo.",
      app: "O quadril solto e o corpo pesando.",
    },
    parar: {
      site: "Se sentir tontura ou contração que se repete.",
      app: "Se ficar tonta ou desconfortável, pare e sente-se firme.",
    },
  },
  "respirar-para-baixo": {
    cue: {
      site: "A respiração que serve na contração: solta, longa, para baixo.",
      app: "Uma respiração solta, longa, para baixo.",
    },
    passos: {
      4: { site: "Seis respirações. É a que vale no dia.", app: "Seis respirações, sem pressa." },
    },
  },
  "agachamento-parede": {
    cue: {
      site: "Costas na parede, desce um pouco e sobe — abre a saída.",
      app: "Costas na parede, desce um pouco e sobe, sem pressa.",
    },
    sentir: {
      site: "As coxas trabalhando e o quadril abrindo embaixo.",
      app: "As coxas trabalhando e as pernas firmes.",
    },
    parar: {
      site: "Se sentir peso ou pressão lá embaixo que não passa ao levantar.",
      app: "Se o joelho reclamar ou cansar, pare.",
    },
  },
};

/**
 * A narração gravada lê o nome e a DICA (`cue`) do movimento. Onde a dica mudou,
 * a voz diria a frase antiga — e uma frase dita diferente da escrita seria pior
 * que o silêncio. Esses movimentos ficam sem narração até a regravação.
 */
export const NARRACAO_FORA_DO_APP: ReadonlySet<string> = new Set(
  Object.entries(TEXTO_DO_MOVIMENTO_NO_APP)
    .filter(([, t]) => !!t.cue)
    .map(([id]) => id),
);

/**
 * Qual narração o movimento toca: a regravada (`docs/regravacao`, que já diz o
 * nome e a dica do app), a do site, ou nenhuma — a dica mudou e a voz do site
 * diria a antiga.
 */
export function narracaoNoApp(
  id: string,
  regravadas: Readonly<Record<string, string>> = TEXTO_REGRAVADO,
): "regravada" | "site" | null {
  if (regravadas[`mov-${id}`] != null) return "regravada";
  return NARRACAO_FORA_DO_APP.has(id) ? null : "site";
}

export function movimentoNoApp(m: Movimento): Movimento {
  const t = TEXTO_DO_MOVIMENTO_NO_APP[m.id];
  if (!t) return m;
  const campo = (k: "cue" | "sentir" | "parar") => (t[k] && t[k]!.site === m[k] ? t[k]!.app : m[k]);
  return {
    ...m,
    cue: campo("cue"),
    sentir: campo("sentir"),
    parar: campo("parar"),
    passos: m.passos.map((p, i) => (t.passos?.[i]?.site === p ? t.passos[i]!.app : p)),
  };
}

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
  }).map(movimentoNoApp);
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
