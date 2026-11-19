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
 */

import type { ChaveDoCuidado } from "~/lib/jornada/hoje";

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

/** Os humores do check-in ("Como você está hoje?"), os mesmos da trilha. */
export const HUMORES_DA_CONVERSA = ["Ótima", "Bem", "Normal", "Cansada", "Enjoada"] as const;
export type HumorDela = (typeof HUMORES_DA_CONVERSA)[number];

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
};

export type Resposta =
  | { id: string; rotulo: string; tipo: "humor"; humor: HumorDela }
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
const REACOES: Record<HumorDela, readonly string[]> = {
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
  return sugestao({ ...c, humor }, doDia(REACOES[humor], c.D));
}

/** A sugestão do momento: o próximo cuidado, ou a festa do dia cheio. */
export function sugestao(c: ContextoDaBolha, antes = ""): Fala {
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
