import type { PoseDaBolha } from "~/lib/bolha/conversa";
import { resumoDaData } from "~/lib/ritual";
import type {
  Amiga,
  Fase,
  Minutos,
  Momento,
  Pilar,
  Preocupacao,
  RespostasDoPlano,
  Sentir,
} from "~/lib/plano/respostas";

/**
 * OS PASSOS DO FUNIL "MONTAR O MEU PLANO" e o que a Bolha diz em cada um
 * (20/11/2026). A tela é `app/(entrada)/plano.tsx`; aqui mora o puro: a
 * ordem, as falas, as opções e o que libera o "Continuar".
 *
 * A ordem conta uma história, como a referência que o dono mandou: ela se
 * apresenta, vê a própria semana em letras grandes, conta como está e o que
 * quer, vê o plano sendo montado com os números DELA e só então salva (cria
 * a conta). Cada pergunta é uma fala da Bolha, e a resposta anterior aparece
 * do lado dela, como no ritual.
 *
 * As regras das falas (catraca em `plano.test.ts`, as mesmas do ritual):
 * nunca conduta nem promessa de efeito, o bebê sem gênero, sem travessão nem
 * emoji, e nada de número que não se conta.
 */

export type Passo =
  | "nome"
  | "prazer"
  | "fase"
  | "data"
  | "semana"
  | "bebe"
  | "primeira"
  | "sentir"
  | "preocupa"
  | "acolhe"
  | "cultivar"
  | "tempo"
  | "momento"
  | "horas"
  | "amiga"
  | "montando"
  | "diferenca"
  | "pronto"
  | "conta";

export const PASSOS: readonly Passo[] = [
  "nome",
  "prazer",
  "fase",
  "data",
  "semana",
  "bebe",
  "primeira",
  "sentir",
  "preocupa",
  "acolhe",
  "cultivar",
  "tempo",
  "momento",
  "horas",
  "amiga",
  "montando",
  "diferenca",
  "pronto",
  "conta",
];

/** Os passos que não têm voltar de verdade (a montagem anda sozinha). */
export const PASSOS_SEM_VOLTAR: ReadonlySet<Passo> = new Set(["montando"]);

export function ehPasso(v: unknown): v is Passo {
  return PASSOS.includes(v as Passo);
}

/** A fração da barra do alto: a conta e a montagem contam como quase no fim. */
export function progressoDoPasso(p: Passo): number {
  const i = PASSOS.indexOf(p);
  return Math.max(0.04, Math.min(1, (i + 1) / PASSOS.length));
}

const primeiroNome = (s: string) => s.trim().split(/\s+/)[0] || "";

/** "a Helena" quando há nome; "o bebê" quando não há. Para o meio da frase. */
export function oBebe(r: Pick<RespostasDoPlano, "bebe">): string {
  const n = primeiroNome(r.bebe);
  return n || "o bebê";
}

/* ── As opções ─────────────────────────────────────────────────────────── */

export type Opcao<T> = { valor: T; rotulo: string; sub?: string; icone: string };

export const OPCOES_DA_FASE: readonly Opcao<Fase>[] = [
  { valor: "gravida", rotulo: "Estou grávida", icone: "sprout" },
  { valor: "nasceu", rotulo: "Meu bebê já nasceu", icone: "baby" },
];

/** Como ela data a gestação (a DUM ou um ultrassom). */
export const OPCOES_DA_DATA: readonly Opcao<"dum" | "us">[] = [
  { valor: "dum", rotulo: "A da última menstruação", icone: "calendar" },
  { valor: "us", rotulo: "A de um ultrassom", icone: "baby" },
];

export const OPCOES_DO_SENTIR: readonly Opcao<Sentir>[] = [
  { valor: "tranquila", rotulo: "Tranquila", icone: "leaf" },
  { valor: "animada", rotulo: "Animada", icone: "sparkles" },
  { valor: "cansada", rotulo: "Cansada", icone: "moon" },
  { valor: "ansiosa", rotulo: "Ansiosa", icone: "wind" },
  { valor: "de-tudo", rotulo: "Um pouco de tudo", icone: "shuffle" },
];

export function opcoesDaPreocupacao(fase: Fase | null): readonly Opcao<Preocupacao>[] {
  if (fase === "nasceu")
    return [
      { valor: "mundo-do-bebe", rotulo: "Entender o mundo do bebê", icone: "book-heart" },
      { valor: "sono", rotulo: "Noites curtas e pouco descanso", icone: "moon" },
      { valor: "tempo", rotulo: "Não ter tempo para mim", icone: "clock" },
      { valor: "corpo", rotulo: "O meu corpo depois do parto", icone: "heart" },
      { valor: "sozinha", rotulo: "Me sentir sozinha nisso", icone: "users" },
      { valor: "nenhuma", rotulo: "Nada disso, estou bem", icone: "face-slightly-smiling" },
    ];
  return [
    { valor: "semanas", rotulo: "Não saber o que acontece em cada semana", icone: "calendar" },
    { valor: "ansiedade", rotulo: "Ficar agitada ou ansiosa", icone: "wind" },
    { valor: "tempo", rotulo: "Não ter tempo para mim", icone: "clock" },
    { valor: "corpo", rotulo: "As mudanças no meu corpo", icone: "heart" },
    { valor: "parto", rotulo: "O dia do parto", icone: "sunrise" },
    { valor: "sozinha", rotulo: "Me sentir sozinha nisso", icone: "users" },
    { valor: "nenhuma", rotulo: "Nada disso, estou bem", icone: "face-slightly-smiling" },
  ];
}

export const OPCOES_DO_PILAR: readonly Opcao<Pilar>[] = [
  { valor: "aprender", rotulo: "Aprender sobre cada semana", icone: "graduation-cap" },
  { valor: "calma", rotulo: "Momentos de calma", icone: "wind" },
  { valor: "mexer", rotulo: "Mexer o corpo com leveza", icone: "activity" },
  { valor: "vinculo", rotulo: "Criar vínculo com o bebê", icone: "heart-handshake" },
  { valor: "memorias", rotulo: "Guardar as memórias boas", icone: "book-heart" },
];

export const OPCOES_DO_TEMPO: readonly Opcao<Minutos>[] = [
  { valor: 3, rotulo: "3 minutos", sub: "Um respiro", icone: "feather" },
  { valor: 5, rotulo: "5 minutos", sub: "Leve", icone: "leaf" },
  { valor: 10, rotulo: "10 minutos", sub: "Com calma", icone: "flower" },
  { valor: 15, rotulo: "15 minutos", sub: "Um momento só meu", icone: "sparkles" },
];

export const OPCOES_DO_MOMENTO: readonly Opcao<Momento>[] = [
  { valor: "manha", rotulo: "Ao acordar", sub: "às 8h", icone: "sunrise" },
  { valor: "almoco", rotulo: "Na hora do almoço", sub: "às 12h30", icone: "sun" },
  { valor: "tarde", rotulo: "À tarde", sub: "às 16h", icone: "cloud-sun" },
  { valor: "noite", rotulo: "Antes de dormir", sub: "às 21h", icone: "moon" },
];

export const OPCOES_DA_AMIGA: readonly Opcao<Amiga>[] = [
  { valor: "codigo", rotulo: "Tenho o código de uma amiga", icone: "ticket" },
  { valor: "depois", rotulo: "Quero chamar uma amiga depois", icone: "user-plus" },
  { valor: "sozinha", rotulo: "Por enquanto, só eu", icone: "user" },
];

/** "no fim do dia", "ao acordar": o momento no meio de uma frase. */
export const MOMENTO_NA_FRASE: Readonly<Record<Momento, string>> = {
  manha: "ao acordar",
  almoco: "na hora do almoço",
  tarde: "à tarde",
  noite: "antes de dormir",
};

/* ── O que a Bolha diz ─────────────────────────────────────────────────── */

/**
 * A fala de um passo, no desenho de 21/11/2026 ("mais clean, de outro nível"):
 * a Bolha pequena com uma REAÇÃO curta (quando há o que reagir), e a PERGUNTA
 * grande, na serifada, como o título da tela. Antes era um balão só, com a
 * reação e a pergunta coladas, e a resposta anterior num balão do lado: muito
 * texto junto, e a pergunta se perdia.
 */
export type FalaDoPasso = {
  /** A pergunta do passo, o título da tela. Vazio nos passos de vitrine. */
  pergunta: string;
  /** O que a Bolha diz antes da pergunta (uma linha ou duas), ou `null`. */
  reacao: string | null;
  pose: PoseDaBolha;
  /** O apoio embaixo da pergunta ("Pode marcar mais de uma"). */
  apoio?: string;
};

const REACAO_AO_SENTIR: Readonly<Record<Sentir, string>> = {
  tranquila: "Que bom! Vamos cuidar para continuar assim.",
  animada: "Que delícia sentir isso!",
  cansada: "Obrigada por me contar. Vou pensar em momentos bem leves para você.",
  ansiosa: "Obrigada por me contar. Muitas mães se sentem assim, e você não está sozinha.",
  "de-tudo": "Faz sentido, é muita coisa acontecendo ao mesmo tempo.",
};

export function falaDoPasso(p: Passo, r: RespostasDoPlano): FalaDoPasso {
  const nome = primeiroNome(r.nome);
  const nasceu = r.fase === "nasceu";
  switch (p) {
    case "nome":
      return {
        reacao: "Oi! Eu sou a Bolha. Vou montar com você um plano de cuidado para cada dia.",
        pergunta: "Como você quer que eu te chame?",
        pose: "feliz",
      };
    case "fase":
      return {
        reacao: null,
        pergunta: nome ? `${nome}, em que fase você está?` : "Em que fase você está?",
        pose: "estudiosa",
      };
    case "data":
      return nasceu
        ? { reacao: "Que alegria!", pergunta: "Em que dia o bebê nasceu?", pose: "apaixonado" }
        : {
            reacao: "Para eu saber a sua semana.",
            pergunta: "Qual data você tem?",
            pose: "estudiosa",
          };
    case "bebe":
      return {
        reacao: null,
        pergunta: "Como vocês chamam o bebê?",
        apoio: "Pode ser o nome ou um apelido carinhoso.",
        pose: "apaixonado",
      };
    case "primeira": {
      const bebe = primeiroNome(r.bebe);
      return {
        reacao: bebe ? `${bebe}, que nome lindo!` : null,
        pergunta: nasceu ? "É o seu primeiro bebê?" : "É a sua primeira gestação?",
        pose: "feliz",
      };
    }
    case "sentir":
      return {
        reacao: null,
        pergunta: nasceu
          ? "E você, como tem se sentido nesses dias?"
          : "Como você tem se sentido nos últimos dias?",
        pose: "feliz",
      };
    case "preocupa":
      return {
        reacao: r.sentir ? REACAO_AO_SENTIR[r.sentir] : null,
        pergunta: "O que mais ocupa a sua cabeça agora?",
        apoio: "Pode marcar mais de uma.",
        pose: r.sentir === "ansiosa" || r.sentir === "cansada" ? "apaixonado" : "feliz",
      };
    case "cultivar":
      return {
        reacao: null,
        pergunta: nasceu
          ? "O que você quer cultivar nessas primeiras semanas?"
          : "O que você quer cultivar nesta fase?",
        apoio: "Pode marcar mais de uma.",
        pose: "estudiosa",
      };
    case "tempo":
      return {
        reacao: null,
        pergunta: "Quanto tempo por dia você quer para você?",
        apoio: "Dá para mudar quando quiser.",
        pose: "feliz",
      };
    case "momento":
      return {
        reacao: null,
        pergunta: "Qual é o melhor momento do seu dia?",
        apoio: "Eu posso te lembrar nessa hora.",
        pose: "feliz",
      };
    case "amiga":
      return {
        reacao: "Uma segura a chama da outra.",
        pergunta: "Quer fazer isso com uma amiga?",
        pose: "comemorando",
      };
    case "conta":
      return {
        reacao: nome ? `Pronto, ${nome}!` : "Pronto!",
        pergunta: "Agora é só salvar o seu plano.",
        pose: "comemorando",
      };
    default:
      /* Os passos de vitrine (prazer, semana, acolhe, horas, montando,
         diferenca, pronto) desenham o próprio texto. */
      return { reacao: null, pergunta: "", pose: "feliz" };
  }
}

/* ── O que libera o "Continuar" ────────────────────────────────────────── */

/**
 * Se o passo já tem o que precisa. A data é conferida na tela (com as mesmas
 * recusas do ritual), não aqui. O nome do bebê, a amiga e o código podem
 * ficar em branco.
 */
export function passoPronto(p: Passo, r: RespostasDoPlano): boolean {
  switch (p) {
    case "nome":
      return primeiroNome(r.nome).length >= 2;
    case "fase":
      return r.fase != null;
    case "data":
      return /^\d{2}\/\d{2}\/\d{4}$/.test(r.data.trim());
    case "primeira":
      return r.primeira != null;
    case "sentir":
      return r.sentir != null;
    case "preocupa":
      return r.preocupacoes.length > 0;
    case "cultivar":
      return r.pilares.length > 0;
    case "tempo":
      return r.minutos != null;
    case "momento":
      return r.momento != null;
    case "amiga":
      return r.amiga != null;
    default:
      return true;
  }
}

/* ── O "você não está sozinha": cada preocupação, o que o app tem ───────── */

/**
 * A resposta do app para cada preocupação: o que EXISTE no app, nunca o efeito
 * ("pausas para respirar", e nunca "para a ansiedade passar").
 */
export const O_QUE_O_APP_TEM: Readonly<Record<Exclude<Preocupacao, "nenhuma">, string>> = {
  semanas: "Todo dia, uma aula curtinha sobre a semana em que você está.",
  ansiedade: "Pausas guiadas para respirar, de 1 a 10 minutos, quando você quiser.",
  tempo: "Um plano que cabe em poucos minutos, no momento que você escolher.",
  corpo: "Movimentos leves, no seu ritmo, e você pula o que quiser.",
  parto: "A reta final contada aos poucos, uma aula por dia, no tempo certo.",
  sozinha: "As Amigas: chame uma amiga e formem uma dupla para manter a chama.",
  "mundo-do-bebe": "A cada semana, um pouco do mundo do bebê, para ler com calma.",
  sono: "Sons para a noite, como chuva e mar, para descansar quando der.",
};

/** As linhas do "você não está sozinha", na ordem em que ela marcou. */
export function linhasDoAcolhimento(r: RespostasDoPlano): { de: string; app: string }[] {
  const opcoes = opcoesDaPreocupacao(r.fase);
  const marcadas = r.preocupacoes.filter((p) => p !== "nenhuma");
  if (!marcadas.length)
    return [
      {
        de: "Seguir bem, um dia de cada vez",
        app: "Um passo pequeno por dia, sem pressa, com a trilha guardando o caminho.",
      },
    ];
  return marcadas.map((p) => ({
    de: opcoes.find((o) => o.valor === p)?.rotulo ?? "",
    app: O_QUE_O_APP_TEM[p as Exclude<Preocupacao, "nenhuma">],
  }));
}

/** A resposta da data, como ela diria (para o balão do passo seguinte). */
export function resumoDaDataDoPlano(r: RespostasDoPlano): string | null {
  return resumoDaData({
    modo: r.fase === "nasceu" ? "nasceu" : r.modo,
    data: r.data,
    semanasUs: r.semanasUs,
    diasUs: r.diasUs,
  });
}
