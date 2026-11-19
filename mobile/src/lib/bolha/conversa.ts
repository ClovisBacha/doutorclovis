/**
 * A BOLHA GUIA — o que ela diz e o que ela oferece (19/11/2026).
 *
 * O dono: "o bebê bolha vai ser aquele personagem que vai conversar com a
 * mãe [...] ele tem que ser algo inteligente [...] esse aplicativo vai ser um
 * aplicativo de bem-estar materno [...] o conhecimento, a paz, os exercícios
 * [...] o bebê bolha será esse guia neste caminho."
 *
 * A "inteligência" aqui é a de um bom guia, e não a de um chat: a Bolha LÊ o
 * momento — a hora, a semana, a sequência, o que ela já fez hoje e como disse
 * que está — e escolhe a fala e as respostas certas. Tudo no aparelho, sem
 * servidor e sem dado saindo dele. É função pura (testada pelo bun), e a tela
 * só desenha (`componentes/bolha/conversa.tsx`).
 *
 * As regras que este arquivo guarda (a catraca está em `conversa.test.ts`):
 * - **nunca conduta**: a Bolha convida para o que o APP tem (a aula, respirar,
 *   se mexer, ler para o bebê, guardar uma coisa boa, os sons); não diz o que
 *   ela deve fazer pela saúde, não interpreta sintoma, não promete efeito;
 * - **o bebê sem gênero** ("ele/ela" nunca); sem nome, "o bebê";
 * - **a frase certa para o momento, nunca sorteada**: a variação sai do DIA
 *   (`D`), e é a mesma dentro do dia;
 * - **Modo Cuidado não tem Bolha guia** (a tela do luto é outra).
 *
 * No 4º TRIMESTRE (`modo: "pos"`) ela guia o dia do pós-parto: o humor (com o
 * "Triste", que abre o apoio), o desafio do dia, a leitura da semana ("O que
 * esperar com o bebê"), respirar, a carta para o bebê, a gratidão e os sons.
 * A voz cuida DELA sem conduta nenhuma: a régua das falas novas é a do
 * conteúdo do pós-parto (`CONDUTA_DO_POS`, sem sono, amamentação, corpo nem
 * recuperação). A gestação continua exatamente igual.
 */

import type { ChaveDoCuidado } from "~/lib/jornada/hoje";
import { desafioDoPos, HUMORES_DO_POS } from "~/lib/jornada/pos-parto";

/** As artes da Bolha (as poses de `ARTES`, em `componentes/movimento.tsx`). */
export type PoseDaBolha =
  | "feliz"
  | "comemorando"
  | "dormindo"
  | "estudiosa"
  | "exercicio"
  | "apaixonado"
  | "orgulhosa"
  | "surpresa";

/** Para onde uma resposta leva: um cuidado do dia, os sons, ou a trilha. */
export type Destino = ChaveDoCuidado | "dormir" | "trilha";

/** As duas tarefas do dia que só o 4º trimestre tem. */
export type TarefaDaBolhaNoPos = "desafio" | "leitura";

/** Para onde a Bolha leva no pós-parto (não há aula nem Mexer: ver `destinoNoPos`). */
export type DestinoNoPos = Exclude<Destino, "aula" | "movement"> | TarefaDaBolhaNoPos;

/**
 * A PONTE DO PÓS. O contrato da tela (`Destino`, que `ConversaComABolha` e a
 * aba do Bebê conhecem) é o da gestação. No 4º trimestre não há aula nem Mexer
 * (o Mexer saiu: o app não tem médico para liberar exercício no pós-parto), e
 * as duas chaves levam as duas tarefas que só existem lá: a leitura da semana
 * vai pela chave da aula (é a peça de aprender do pós) e o desafio, pela do
 * Mexer. Quem recebe um `Destino` no pós o lê por aqui, e nunca pela chave crua.
 */
const CHAVE_NO_POS: Record<TarefaDaBolhaNoPos, Destino> = { leitura: "aula", desafio: "movement" };

export function destinoNoPos(d: Destino): DestinoNoPos {
  if (d === "aula") return "leitura";
  if (d === "movement") return "desafio";
  return d;
}

function chaveNoPos(d: DestinoNoPos): Destino {
  return d === "leitura" || d === "desafio" ? CHAVE_NO_POS[d] : d;
}

/** Os humores do check-in ("Como você está hoje?"), os mesmos da trilha. */
export const HUMORES_DA_CONVERSA = ["Ótima", "Bem", "Normal", "Cansada", "Enjoada"] as const;
/** No pós-parto, "Enjoada" sai e entra "Triste" (os de `HUMORES_DO_POS`): é por ele que a tela oferece apoio. */
export const HUMORES_DA_CONVERSA_NO_POS = ["Ótima", "Bem", "Normal", "Cansada", "Triste"] as const;
export type HumorDela =
  | (typeof HUMORES_DA_CONVERSA)[number]
  | (typeof HUMORES_DA_CONVERSA_NO_POS)[number];

export type ContextoDaBolha = {
  /** A hora do aparelho (0–23). */
  hora: number;
  /** O dia da jornada: só para variar a frase de um dia para o outro. */
  D: number;
  modo: "gestacao" | "pos";
  nomeDela?: string | null;
  nomeDoBebe?: string | null;
  /** A semana da gestação (ou a semana de vida, no pós-parto). */
  semana: number | null;
  /** Os cuidados já feitos hoje. */
  feitos: readonly ChaveDoCuidado[];
  /** O humor que ela marcou hoje (se marcou). */
  humor?: string | null;
  /** Os dias seguidos da chama. */
  chama: number;
  /** Só no 4º trimestre: as tarefas do dia (o humor está em `humor`; respirar, a carta e a gratidão, em `feitos`). */
  doPos?: DiaDoPosNaConversa;
};

/** O dia do pós-parto como a Bolha o lê. */
export type DiaDoPosNaConversa = {
  /** O desafio de hoje, como a tela o escreve (`null` depois das 12 semanas). */
  desafio: string | null;
  desafioFeito: boolean;
  leituraFeita: boolean;
  /** As 12 semanas completas: a trilha do 4º trimestre terminou. */
  formou: boolean;
  /** O que ela acabou de fazer nesta tela: a Bolha comenta antes de seguir. */
  recem?: readonly DestinoNoPos[];
};

export type Resposta =
  | {
      id: string;
      rotulo: string;
      tipo: "humor";
      humor: HumorDela;
      /** O emoji do check-in (o do pós-parto tem "Triste", que o da gestação não tem). */
      emoji?: string;
    }
  | { id: string; rotulo: string; tipo: "abrir"; destino: Destino }
  | { id: string; rotulo: string; tipo: "menu" }
  | { id: string; rotulo: string; tipo: "depois" };

export type Fala = {
  /** O que a Bolha diz (uma ou duas frases curtas). */
  texto: string;
  pose: PoseDaBolha;
  respostas: readonly Resposta[];
};

/* ── As faixas do dia ─────────────────────────────────────────────────── */

export type Faixa = "madrugada" | "manha" | "tarde" | "noite";

export function faixaDa(hora: number): Faixa {
  const h = ((Math.floor(hora) % 24) + 24) % 24;
  if (h < 5) return "madrugada";
  if (h < 12) return "manha";
  if (h < 18) return "tarde";
  return "noite";
}

/** Um de `opcoes`, o mesmo o dia inteiro, outro no dia seguinte. */
function doDia<T>(opcoes: readonly T[], D: number, sal = 0): T {
  const i = (((D + sal * 7) % opcoes.length) + opcoes.length) % opcoes.length;
  return opcoes[i]!;
}

const primeiroNome = (s?: string | null) => s?.trim().split(/\s+/)[0] || null;

/* ── A saudação ───────────────────────────────────────────────────────── */

const SAUDACOES: Record<Faixa, readonly string[]> = {
  madrugada: [
    "Acordada a essa hora? Estou aqui com você.",
    "Madrugada quieta. Eu fico de companhia.",
  ],
  manha: ["Bom dia", "Bom dia, que bom te ver", "Bom dia! Começamos juntas?"],
  tarde: ["Boa tarde", "Oi, boa tarde", "Boa tarde! Passei para te ver"],
  noite: ["Boa noite", "Oi, boa noite", "Boa noite! O dia foi longo?"],
};

function saudacao(c: ContextoDaBolha): string {
  const faixa = faixaDa(c.hora);
  const base = doDia(SAUDACOES[faixa], c.D);
  const nome = primeiroNome(c.nomeDela);
  if (faixa === "madrugada") return base;
  /* "Bom dia, Marina." · "Bom dia! Começamos juntas?" fica sem o nome. */
  if (/[!?.]$/.test(base)) return base;
  return nome ? `${base}, ${nome}.` : `${base}.`;
}

/* ── Um comentário do momento (a semana, a chama) ─────────────────────── */

function comentario(c: ContextoDaBolha): string | null {
  if (c.chama >= 2 && c.chama % 7 === 0)
    return `${c.chama} dias seguidos se cuidando. Isso é ser esperta.`;
  if (c.modo === "gestacao" && c.semana != null && c.semana >= 4 && c.D % 3 === 0) {
    const t = c.semana < 14 ? "primeiro" : c.semana < 28 ? "segundo" : "terceiro";
    return `Semana ${c.semana}, no ${t} trimestre. Cada semana tem a sua aula nova.`;
  }
  if (c.chama >= 3 && c.D % 3 === 1) return `A sua chama está em ${c.chama} dias.`;
  return null;
}

/* ── Os cuidados: como a Bolha os chama ───────────────────────────────── */

const PARA = (c: ContextoDaBolha) => primeiroNome(c.nomeDoBebe) ?? "o bebê";

/** O convite para cada cuidado, na voz da Bolha (o que o APP tem, nunca conduta). */
function convite(destino: Destino, c: ContextoDaBolha): { texto: string; rotulo: string } {
  const bebe = PARA(c);
  switch (destino) {
    case "aula":
      return {
        texto: doDia(
          [
            "Que tal começar pela aula de hoje? São dois minutos e cinco perguntas.",
            "A aula de hoje está esperando. Dois minutos e você já sabe mais da sua semana.",
            "Bora aprender uma coisa nova sobre a sua semana? É rapidinho.",
          ],
          c.D,
        ),
        rotulo: "Começar a aula",
      };
    case "movement":
      return {
        texto: doDia(
          [
            "Vamos soltar o corpo? Cinco minutos de movimentos leves, no seu ritmo.",
            "Que tal mexer o corpo comigo? Movimentos leves, e você pula o que quiser.",
          ],
          c.D,
        ),
        rotulo: "Mexer o corpo",
      };
    case "meditation":
      return {
        texto: doDia(
          [
            "Respira comigo? Três minutos para a cabeça desacelerar.",
            "Que tal uma pausa para respirar juntas? Eu conto o tempo.",
          ],
          c.D,
        ),
        rotulo: "Respirar comigo",
      };
    case "bonding":
      return {
        texto: `Quer ler uma história curtinha para ${bebe}? É um minuto, na sua voz.`,
        rotulo: `Ler para ${bebe}`,
      };
    case "gratitude":
      return {
        texto: "Guarda comigo uma coisa boa de hoje? Vira uma carta para depois.",
        rotulo: "Guardar uma coisa boa",
      };
    case "dormir":
      return {
        texto: "Hora de desacelerar. Quer um som de chuva ou de mar para a noite?",
        rotulo: "Sons para a noite",
      };
    case "trilha":
      return {
        texto: "Quer ver o caminho que você já fez? A trilha guarda cada dia.",
        rotulo: "Ver a trilha",
      };
  }
}

/** Os cuidados que faltam hoje, na ordem que a Bolha os sugere a esta hora. */
export function ordemDaSugestao(c: ContextoDaBolha): Destino[] {
  const faltam = (d: ChaveDoCuidado) => !c.feitos.includes(d);
  const faixa = faixaDa(c.hora);
  const humor = c.humor ?? null;
  let ordem: ChaveDoCuidado[];
  if (humor === "Cansada" || humor === "Enjoada")
    ordem = ["meditation", "bonding", "gratitude", "aula", "movement"];
  else if (faixa === "manha") ordem = ["aula", "movement", "meditation", "bonding", "gratitude"];
  else if (faixa === "tarde") ordem = ["aula", "movement", "bonding", "meditation", "gratitude"];
  else ordem = ["meditation", "bonding", "gratitude", "aula", "movement"];
  const lista: Destino[] = ordem.filter(faltam);
  /* À noite, os sons entram no fim (ou no lugar de tudo, com o dia cheio). */
  if (faixa === "noite" || faixa === "madrugada") lista.push("dormir");
  return lista;
}

/* ── As falas ─────────────────────────────────────────────────────────── */

const DEPOIS: Resposta = { id: "depois", rotulo: "Agora não", tipo: "depois" };
const MENU: Resposta = { id: "menu", rotulo: "Outra coisa", tipo: "menu" };

const abrir = (destino: Destino, c: ContextoDaBolha): Resposta => ({
  id: `abrir-${destino}`,
  rotulo: convite(destino, c).rotulo,
  tipo: "abrir",
  destino,
});

/** A abertura da conversa: a saudação, um comentário do momento e a pergunta certa. */
export function abrirConversa(c: ContextoDaBolha): Fala {
  if (c.modo === "pos") return abrirConversaNoPos(c);
  const ola = saudacao(c);
  const extra = comentario(c);
  /* Sem humor marcado hoje, a Bolha pergunta primeiro. */
  if (!c.humor) {
    return {
      texto: [ola, extra, "Como você está hoje?"].filter(Boolean).join(" "),
      pose: faixaDa(c.hora) === "madrugada" ? "dormindo" : "feliz",
      respostas: HUMORES_DA_CONVERSA.map((h) => ({
        id: `humor-${h}`,
        rotulo: h,
        tipo: "humor" as const,
        humor: h,
      })),
    };
  }
  return sugestao(c, [ola, extra].filter(Boolean).join(" "));
}

/** O que a Bolha diz quando ela conta como está. */
const REACOES: Record<(typeof HUMORES_DA_CONVERSA)[number], readonly string[]> = {
  Ótima: ["Que bom! Esse dia merece ser aproveitado.", "Adoro te ver assim. Vamos nessa?"],
  Bem: ["Que bom. Vamos fazer o dia render um pouquinho?", "Bom saber. Eu tenho uma ideia."],
  Normal: [
    "Dia normal também conta. Um cuidado pequeno já muda o tom.",
    "Entendi. Vamos de leve hoje.",
  ],
  Cansada: [
    "Dia puxado, né? Hoje a gente vai devagar, só o que couber.",
    "Cansaço pesa. Vamos com calma, e o que não der fica para amanhã.",
  ],
  Enjoada: [
    "Que dia chato. Hoje vale ir bem devagar.",
    "Poxa. Vamos com calma, e eu fico aqui com você.",
  ],
};

/** Depois do humor: a reação e a sugestão do momento. */
export function responderAoHumor(c: ContextoDaBolha, humor: HumorDela): Fala {
  if (c.modo === "pos") return responderAoHumorNoPos(c, humor);
  const reacoes = humor in REACOES ? REACOES[humor as keyof typeof REACOES] : REACOES.Normal;
  return sugestao({ ...c, humor }, doDia(reacoes, c.D));
}

/** A sugestão do momento: o próximo cuidado, ou a festa do dia cheio. */
export function sugestao(c: ContextoDaBolha, antes = ""): Fala {
  if (c.modo === "pos") return sugestaoNoPos(c, antes);
  const ordem = ordemDaSugestao(c);
  const cuidadosQueFaltam = ordem.filter((d) => d !== "dormir");
  const prefixo = antes ? `${antes} ` : "";
  if (!cuidadosQueFaltam.length) {
    const noite = ordem.includes("dormir");
    return {
      texto:
        prefixo +
        doDia(
          [
            "Você fez todos os cuidados de hoje. Isso é ser esperta.",
            "Dia completo! Cuidar de você é cuidar de vocês dois.",
          ],
          c.D,
        ) +
        (noite ? " Agora é desacelerar." : " Amanhã tem aula nova."),
      pose: "comemorando",
      respostas: noite ? [abrir("dormir", c), abrir("trilha", c)] : [abrir("trilha", c)],
    };
  }
  const primeiro = ordem[0]!;
  return {
    texto: prefixo + convite(primeiro, c).texto,
    pose: poseDe(primeiro),
    respostas: [abrir(primeiro, c), MENU, DEPOIS],
  };
}

/** "Outra coisa": a Bolha mostra tudo o que dá para fazer agora. */
export function menu(c: ContextoDaBolha): Fala {
  if (c.modo === "pos") return menuNoPos(c);
  const ordem = ordemDaSugestao(c).slice(0, 4);
  return {
    texto: "Escolhe comigo. Tudo é curtinho:",
    pose: "feliz",
    respostas: [...ordem.map((d) => abrir(d, c)), DEPOIS],
  };
}

/** "Agora não": a Bolha não insiste. */
export function depois(c: ContextoDaBolha): Fala {
  return {
    texto: doDia(
      [
        "Tudo bem. Eu fico por aqui quando você quiser.",
        "Combinado. É só tocar em mim que eu volto.",
      ],
      c.D,
    ),
    pose: "feliz",
    respostas: [],
  };
}

/** A próxima fala para uma resposta tocada (`null` quando a resposta leva a uma tela). */
export function responder(c: ContextoDaBolha, r: Resposta): Fala | null {
  switch (r.tipo) {
    case "humor":
      return responderAoHumor(c, r.humor);
    case "menu":
      return menu(c);
    case "depois":
      return depois(c);
    case "abrir":
      return null;
  }
}

/** A pose da Bolha para cada convite. */
export function poseDe(d: Destino): PoseDaBolha {
  switch (d) {
    case "aula":
      return "estudiosa";
    case "movement":
      return "exercicio";
    case "meditation":
    case "dormir":
      return "dormindo";
    case "bonding":
      return "apaixonado";
    case "gratitude":
      return "orgulhosa";
    case "trilha":
      return "comemorando";
  }
}

/** Todas as frases que a Bolha pode dizer (para a catraca de conteúdo). */
export function todasAsFrases(): string[] {
  const c: ContextoDaBolha = {
    hora: 9,
    D: 0,
    modo: "gestacao",
    nomeDela: "Marina",
    nomeDoBebe: "Helena",
    semana: 24,
    feitos: [],
    chama: 14,
  };
  const destinos: Destino[] = [
    "aula",
    "movement",
    "meditation",
    "bonding",
    "gratitude",
    "dormir",
    "trilha",
  ];
  const frases = new Set<string>();
  for (let D = 0; D < 21; D++) {
    for (const hora of [2, 9, 15, 21]) {
      const k = { ...c, D, hora };
      for (const s of Object.values(SAUDACOES).flat()) frases.add(s);
      frases.add(abrirConversa(k).texto);
      for (const h of HUMORES_DA_CONVERSA) frases.add(responderAoHumor(k, h).texto);
      frases.add(menu(k).texto);
      frases.add(depois(k).texto);
      frases.add(
        sugestao({ ...k, feitos: ["aula", "movement", "meditation", "bonding", "gratitude"] })
          .texto,
      );
      for (const d of destinos) {
        frases.add(convite(d, k).texto);
        frases.add(convite(d, k).rotulo);
      }
    }
  }
  return [...frases];
}

/* ══════════════════════════════════════════════════════════════════════════
   O 4º TRIMESTRE — a Bolha guia no pós-parto
   ══════════════════════════════════════════════════════════════════════════ */

/*
 * O dia do pós tem TRÊS tarefas que fecham o dia e dão a figurinha da semana
 * de vida (o humor, o desafio e a leitura) e três cuidados "para quando sobrar
 * um minuto" (respirar, a carta para o bebê e a gratidão), mais os sons à
 * noite. A Bolha pergunta como ela está, leva à próxima tarefa e, com o dia
 * fechado, oferece um minuto só dela.
 *
 * A voz cuida DELA, e nunca do corpo dela: nada de sono, amamentação,
 * recuperação, peso ou "é normal" (`CONDUTA_DO_POS`, a régua do conteúdo do
 * pós-parto). "Triste" muda o tom: a Bolha acolhe, aponta o CVV (o cartão de
 * apoio da tela, logo abaixo dela) e só convida a respirar junto, sem jogo.
 */

type HumorDoPos = (typeof HUMORES_DA_CONVERSA_NO_POS)[number];

const EMOJI_DO_HUMOR_NO_POS: Readonly<Record<string, string>> = Object.fromEntries(
  HUMORES_DO_POS.map((h) => [h.label, h.emoji]),
);

/** "de Helena" ou "do bebê". */
const doBebe = (c: ContextoDaBolha) => {
  const n = primeiroNome(c.nomeDoBebe);
  return n ? `de ${n}` : "do bebê";
};

/** A primeira letra em minúscula (o desafio vem como frase solta: "Fotografe…"). */
const minuscula = (s: string) => s.charAt(0).toLocaleLowerCase("pt-BR") + s.slice(1);

const comPonto = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);

const tarefaFalta = (c: ContextoDaBolha, t: TarefaDaBolhaNoPos): boolean => {
  const p = c.doPos;
  if (!p || p.formou) return false;
  return t === "desafio" ? !!p.desafio && !p.desafioFeito : !p.leituraFeita;
};

function comentarioNoPos(c: ContextoDaBolha): string | null {
  if (c.doPos?.formou) return "As 12 semanas de vocês estão completas, e eu continuo por aqui.";
  if (c.chama >= 2 && c.chama % 7 === 0)
    return `${c.chama} dias seguidos se cuidando. Isso é ser esperta.`;
  if (c.semana != null && c.D % 3 === 0) {
    if (c.semana === 1) return `Primeira semana ${doBebe(c)} com você.`;
    return `Semana ${c.semana} de vida ${doBebe(c)}.`;
  }
  if (c.chama >= 3 && c.D % 3 === 1) return `A sua chama está em ${c.chama} dias.`;
  return null;
}

/** O convite para cada passo do pós, na voz da Bolha. */
function conviteNoPos(d: DestinoNoPos, c: ContextoDaBolha): { texto: string; rotulo: string } {
  const bebe = PARA(c);
  switch (d) {
    case "desafio": {
      const desafio = minuscula(comPonto(c.doPos?.desafio ?? ""));
      return {
        texto: doDia(
          [
            `O desafio de hoje: ${desafio} Quando fizer, me conta.`,
            `Tenho um desafio pequeno para hoje: ${desafio} Me conta quando fizer.`,
          ],
          c.D,
        ),
        rotulo: "Já fiz",
      };
    }
    case "leitura":
      return {
        texto: doDia(
          [
            `Tem leitura nova da semana ${c.semana ?? 1} de vida, sobre o mundo ${doBebe(c)}. Lê comigo?`,
            "Quer ler o que esperar com o bebê nesta semana? É um minuto.",
          ],
          c.D,
        ),
        rotulo: "Ler a semana",
      };
    case "meditation":
      return {
        texto: doDia(
          [
            "Respira comigo? Três minutos para desacelerar.",
            "Que tal uma pausa só sua? Eu conto o tempo enquanto você respira.",
          ],
          c.D,
        ),
        rotulo: "Respirar comigo",
      };
    case "bonding":
      return {
        texto: doDia(
          [
            `Quer ler uma carta curtinha para ${bebe}, olho no olho? É um minuto, na sua voz.`,
            `Que tal um momento com ${bebe}? Uma carta curtinha, lida em voz baixa.`,
          ],
          c.D,
        ),
        rotulo: `Ler para ${bebe}`,
      };
    case "gratitude":
      return {
        texto: doDia(
          [
            "Guarda comigo uma coisa boa de hoje? Pode ser bem pequena.",
            "Teve um momento bom hoje? Guarda comigo, e vira lembrança.",
          ],
          c.D,
        ),
        rotulo: "Guardar uma coisa boa",
      };
    case "dormir":
      return {
        texto: "Hora de desacelerar. Quer um som de chuva ou de mar para a noite?",
        rotulo: "Sons para a noite",
      };
    case "trilha":
      return {
        texto: "Quer ver o caminho de vocês? A trilha guarda cada dia das 12 semanas.",
        rotulo: "Ver a trilha",
      };
  }
}

/** A pose da Bolha para cada passo do pós. */
export function poseNoPos(d: DestinoNoPos): PoseDaBolha {
  if (d === "desafio") return "feliz";
  if (d === "leitura") return "estudiosa";
  return poseDe(d);
}

const abrirNoPos = (d: DestinoNoPos, c: ContextoDaBolha): Resposta => ({
  id: `abrir-${d}`,
  rotulo: conviteNoPos(d, c).rotulo,
  tipo: "abrir",
  destino: chaveNoPos(d),
});

/** O que falta hoje no pós, na ordem que a Bolha sugere a esta hora. */
export function ordemNoPos(c: ContextoDaBolha): DestinoNoPos[] {
  const faixa = faixaDa(c.hora);
  const humor = c.humor ?? null;
  let ordem: DestinoNoPos[];
  /* Cansada ou triste, o mais leve primeiro. */
  if (humor === "Cansada" || humor === "Triste")
    ordem = ["meditation", "leitura", "desafio", "gratitude", "bonding"];
  else if (faixa === "manha") ordem = ["desafio", "leitura", "bonding", "meditation", "gratitude"];
  else if (faixa === "tarde") ordem = ["desafio", "leitura", "meditation", "bonding", "gratitude"];
  else ordem = ["leitura", "desafio", "meditation", "gratitude", "bonding"];
  const lista = ordem.filter((d) =>
    d === "desafio" || d === "leitura"
      ? tarefaFalta(c, d)
      : !c.feitos.includes(d as ChaveDoCuidado),
  );
  if (faixa === "noite" || faixa === "madrugada") lista.push("dormir");
  return lista;
}

/** O humor, o desafio e a leitura feitos: o dia do pós fechou (e a figurinha veio). */
export function diaDoPosFechado(c: ContextoDaBolha): boolean {
  const p = c.doPos;
  if (!p || p.formou || !c.humor) return false;
  return !tarefaFalta(c, "desafio") && !tarefaFalta(c, "leitura");
}

/** O que a Bolha diz quando ela acabou de fazer alguma coisa nesta tela. */
const REACAO_AO_FEITO: Partial<Record<DestinoNoPos, readonly string[]>> = {
  desafio: [
    "Desafio feito. Que bom ter isso guardado.",
    "Feito. Gesto pequeno também vira lembrança.",
  ],
  leitura: ["Leitura feita.", "Lido. Agora você conhece mais um pedacinho do mundo do bebê."],
  meditation: [
    "Que bom que você parou para respirar.",
    "Pausa feita. Eu gostei de respirar junto.",
  ],
  bonding: [
    "Carta lida. Que momento bonito de vocês dois.",
    "Que bonito. Essa carta foi na sua voz.",
  ],
  gratitude: ["Coisa boa guardada.", "Guardei. Fica lá para quando você quiser reler."],
};

function reacaoAoFeito(c: ContextoDaBolha): string | null {
  const recem = c.doPos?.recem ?? [];
  if (!recem.length) return null;
  if (recem.length > 1) return "Mais coisas feitas por aqui.";
  const frases = REACAO_AO_FEITO[recem[0]!];
  return frases ? doDia(frases, c.D) : null;
}

const HUMORES_NO_POS: readonly Resposta[] = HUMORES_DA_CONVERSA_NO_POS.map((h) => ({
  id: `humor-${h}`,
  rotulo: h,
  tipo: "humor" as const,
  humor: h,
  emoji: EMOJI_DO_HUMOR_NO_POS[h],
}));

function abrirConversaNoPos(c: ContextoDaBolha): Fala {
  const feito = reacaoAoFeito(c);
  const madrugada = faixaDa(c.hora) === "madrugada";
  if (!c.humor) {
    const ola = feito ?? [saudacao(c), comentarioNoPos(c)].filter(Boolean).join(" ");
    return {
      texto: `${ola} Como você está hoje?`,
      pose: madrugada ? "apaixonado" : "feliz",
      respostas: HUMORES_NO_POS,
    };
  }
  if (feito) return sugestaoNoPos(c, feito);
  /* Ela contou que está triste: a Bolha volta mais quieta, sem comentário de jogo. */
  if (c.humor === "Triste") return sugestaoNoPos(c, `${saudacao(c)} Estou aqui com você.`);
  /* Com o dia fechado, a comemoração já é o comentário (a fala não cresce). */
  const extra = diaDoPosFechado(c) ? null : comentarioNoPos(c);
  return sugestaoNoPos(c, [saudacao(c), extra].filter(Boolean).join(" "));
}

const REACOES_NO_POS: Record<Exclude<HumorDoPos, "Triste">, readonly string[]> = {
  Ótima: ["Que bom ouvir isso.", "Adoro te ver assim."],
  Bem: ["Que bom. Tenho uma ideia para hoje.", "Bom saber, obrigada por contar."],
  Normal: ["Entendi. Hoje vamos de leve.", "Dia comum também conta. Um gesto pequeno já basta."],
  Cansada: [
    "Dia puxado, né? Hoje só o que couber.",
    "Cansaço pesa. Vamos com calma, e o que não der fica para amanhã.",
  ],
};

function responderAoHumorNoPos(c: ContextoDaBolha, humor: HumorDela): Fala {
  const k = { ...c, humor };
  if (humor === "Triste") {
    return {
      texto:
        doDia(
          [
            "Sinto muito que hoje esteja pesado. Você não está sozinha.",
            "Obrigada por me contar. Dias assim acontecem, e você não está sozinha.",
          ],
          c.D,
        ) + " O CVV escuta a qualquer hora, de graça. O número está aqui embaixo.",
      pose: "apaixonado",
      respostas: c.feitos.includes("meditation")
        ? [DEPOIS]
        : [{ ...abrirNoPos("meditation", k), rotulo: "Respirar junto" }, DEPOIS],
    };
  }
  const reacoes =
    humor in REACOES_NO_POS
      ? REACOES_NO_POS[humor as keyof typeof REACOES_NO_POS]
      : REACOES_NO_POS.Normal;
  return sugestaoNoPos(k, doDia(reacoes, c.D));
}

function sugestaoNoPos(c: ContextoDaBolha, antes = ""): Fala {
  const ordem = ordemNoPos(c);
  const prefixo = antes ? `${antes} ` : "";
  const cuidados = ordem.filter((d) => d !== "dormir");
  const noite = ordem.includes("dormir");
  if (!cuidados.length) {
    return {
      texto:
        prefixo +
        doDia(
          [
            "Você fez tudo o que tinha hoje. Isso é ser esperta.",
            "Tudo feito hoje. Cuidar de você é cuidar de vocês dois.",
          ],
          c.D,
        ) +
        (noite ? " Agora é desacelerar." : " Amanhã tem desafio novo."),
      pose: "comemorando",
      respostas: noite
        ? [abrirNoPos("dormir", c), abrirNoPos("trilha", c)]
        : [abrirNoPos("trilha", c)],
    };
  }
  const primeiro = cuidados[0]!;
  /* As três tarefas fecharam: a Bolha comemora e oferece um minuto só dela. */
  if (diaDoPosFechado(c)) {
    return {
      texto: `${prefixo}Dia completo: a figurinha da semana ${c.semana ?? 1} de vida é sua. Sobrou um minuto?`,
      pose: "comemorando",
      respostas: [abrirNoPos(primeiro, c), MENU, DEPOIS],
    };
  }
  return {
    texto: prefixo + conviteNoPos(primeiro, c).texto,
    pose: poseNoPos(primeiro),
    respostas: [abrirNoPos(primeiro, c), MENU, DEPOIS],
  };
}

function menuNoPos(c: ContextoDaBolha): Fala {
  const ordem = ordemNoPos(c).slice(0, 4);
  const lista: DestinoNoPos[] = ordem.length ? ordem : ["trilha"];
  return {
    texto: "Escolhe comigo. Tudo é curtinho:",
    pose: "feliz",
    respostas: [...lista.map((d) => abrirNoPos(d, c)), DEPOIS],
  };
}

/* ── O álbum ──────────────────────────────────────────────────────────── */

/** O que a Bolha diz na capa do álbum (a régua de conteúdo é a mesma das falas). */
export function falaDoAlbum(o: { ganhas: number; pos: boolean }): string {
  if (o.pos)
    return "A gestação inteira e as 12 primeiras semanas de vida, num lugar só. Toque numa semana para relembrar.";
  if (o.ganhas === 0)
    return "Feche um dia completo e a figurinha da semana vem para cá. Eu guardo cada uma.";
  return "Cada semana com um dia completo ganha a sua figurinha. A semana que passou sem figurinha fica tracejada, sem cobrança.";
}

/* ── A catraca do pós ─────────────────────────────────────────────────── */

/** Todas as frases e botões da Bolha no pós-parto (para a catraca de conteúdo). */
export function todasAsFrasesDoPos(): string[] {
  const frases = new Set<string>();
  const destinos: DestinoNoPos[] = [
    "desafio",
    "leitura",
    "meditation",
    "bonding",
    "gratitude",
    "dormir",
    "trilha",
  ];
  const juntar = (f: Fala) => {
    frases.add(f.texto);
    for (const r of f.respostas) if (r.tipo !== "humor") frases.add(r.rotulo);
  };
  for (let D = 7; D <= 90; D++) {
    const desafio = desafioDoPos(D)?.label ?? null;
    for (const hora of [2, 9, 15, 21]) {
      for (const nomeDoBebe of ["Helena", null]) {
        for (const formou of [false, true]) {
          const base: ContextoDaBolha = {
            hora,
            D,
            modo: "pos",
            nomeDela: "Marina",
            nomeDoBebe,
            semana: Math.max(1, Math.min(12, Math.floor(D / 7))),
            feitos: [],
            chama: D % 15,
            doPos: { desafio, desafioFeito: false, leituraFeita: false, formou },
          };
          juntar(abrirConversa(base));
          for (const h of HUMORES_DA_CONVERSA_NO_POS) {
            juntar(responderAoHumor(base, h));
            juntar(abrirConversa({ ...base, humor: h }));
          }
          const comHumor = { ...base, humor: "Bem" };
          juntar(menu(comHumor));
          juntar(depois(comHumor));
          for (const d of destinos) {
            const t = conviteNoPos(d, comHumor);
            frases.add(t.texto);
            frases.add(t.rotulo);
            juntar(abrirConversa({ ...comHumor, doPos: { ...comHumor.doPos!, recem: [d] } }));
          }
          juntar(
            abrirConversa({
              ...comHumor,
              doPos: { ...comHumor.doPos!, recem: ["desafio", "leitura"] },
            }),
          );
          const fechado = {
            ...comHumor,
            doPos: { ...comHumor.doPos!, desafioFeito: true, leituraFeita: true },
          };
          juntar(sugestao(fechado));
          juntar(sugestao({ ...fechado, feitos: ["meditation", "bonding", "gratitude"] }));
        }
      }
    }
  }
  for (const ganhas of [0, 3])
    for (const pos of [false, true]) frases.add(falaDoAlbum({ ganhas, pos }));
  return [...frases];
}
