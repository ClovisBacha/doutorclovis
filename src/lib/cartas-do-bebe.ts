/**
 * A CARTA DE 1 MINUTO — texto e régua da atividade "Bebê".
 *
 * ─── O QUE HAVIA (ago/2026) ────────────────────────────────────────────────
 *
 * Dez cartas fixas (um comentário no componente dizia onze — estava errado:
 * a contagem automática pegou a própria declaração de tipo do array, que
 * também tem `title:`), giro `day % 10`, para 294 dias de gestação **e** 90
 * de pós-parto. Cada carta se repetia ~38 vezes na jornada inteira.
 *
 * ⚠️ E O DEFEITO MAIS SÉRIO NÃO ERA A REPETIÇÃO: `BondingBlock` nunca recebia
 * `posParto`, então as mesmas dez cartas — todas em tempo PRÉ-natal ("a gente
 * ainda não se viu", "quando você nascer, eu canto de novo") — eram lidas por
 * uma mãe com o bebê JÁ NO COLO. Ela leria em voz alta uma promessa sobre um
 * nascimento que já aconteceu.
 *
 * Também faltava: a bolha (o porta-voz do app) nunca aparecia nesta tela — a
 * única das quatro atividades sem ela —, o nome do bebê (buscado e passado
 * pro componente) nunca era usado nas cartas fixas, e nada guardava rastro de
 * qual carta já foi lida.
 *
 * ─── O QUE ESTE ARQUIVO É ──────────────────────────────────────────────────
 *
 * Texto e régua, sem JSX — mesma razão de `gratidao.ts` e `exercicios.ts`.
 *
 * ⚠️ A FASE DECIDE O TEMPO VERBAL, não só o assunto. Por isso o campo `fases`
 * funciona ao contrário do de `gratidao.ts`: lá, ausente = serve em qualquer
 * fase, incluindo pós-parto. Aqui, ausente = qualquer fase da GESTAÇÃO — uma
 * carta de pós-parto só entra na roda se for marcada `["pos"]` explicitamente.
 * Herdar por omissão faria uma carta pré-natal escapar pro pós-parto na
 * primeira vez que alguém esquecesse a marcação.
 */

import { faseDaGratidao, diasEntre, haQuantoTempo, type FaseGratidao } from "./gratidao";
import { type Periodo } from "./frases-do-mascote";

/**
 * Reaproveita o corte de semanas de `gratidao.ts` — t1 < 14, t2 14–27,
 * t3 ≥ 28, pos = pós-parto. É a mesma pergunta ("em que fase da jornada ela
 * está?") feita pela Gratidão; duas tabelas de corte divergiriam no primeiro
 * ajuste de uma delas.
 */
export type FaseCarta = FaseGratidao;

export type Carta = {
  /** Permanente: é o que guarda o rastro de leitura (`registrarLeitura`). */
  id: string;
  title: string;
  emoji: string;
  /** `{bebe}` é substituído pelo nome do bebê, ou por "meu amor" sem nome. */
  lines: string[];
  /** Ausente = qualquer fase da GESTAÇÃO (t1/t2/t3). Nunca herda pra "pos". */
  fases?: FaseCarta[];
};

/* ══════════════════════════════════════════════════════════════════════════
   AS CARTAS

   Gerais primeiro (valem a gestação inteira), depois por fase da gestação,
   depois pós-parto — sempre marcadas, nunca por omissão.
   ══════════════════════════════════════════════════════════════════════════ */

const GERAIS: Carta[] = [
  {
    id: "g-ainda-nao-vi",
    title: "Pra você, que eu ainda não vi",
    emoji: "💛",
    lines: [
      "Oi, {bebe}. Sou eu — a sua mãe.",
      "A gente ainda não se viu, mas eu já te conheço de cor.",
      "Sei quando você acorda, sei quando você dança aí dentro.",
      "Todo dia eu invento o seu rostinho de um jeito novo.",
      "E todos os jeitos são lindos, porque são você.",
      "Cresce tranquilo, que aqui fora já existe um amor te esperando.",
      "Um beijo, do tamanho do céu. 💛",
    ],
  },
  {
    id: "g-soubemos",
    title: "O dia em que soubemos de você",
    emoji: "🌱",
    lines: [
      "Deixa eu te contar uma história: o dia em que você começou.",
      "Foi um dia comum — e de repente virou o mais importante da minha vida.",
      "Duas listras rosas, e o mundo inteiro mudou de cor.",
      "Meu coração bateu tão forte que acho que você ouviu daí.",
      "Eu ri, chorei, e liguei pra quem eu mais amo.",
      "Essa é a nossa primeira história, {bebe}. Ainda vamos escrever mil. 🌱",
    ],
  },
  {
    id: "g-mundo",
    title: "O mundo que te espera",
    emoji: "🌍",
    lines: [
      "{bebe}, deixa eu te contar do mundo aqui fora.",
      "Tem sol que esquenta o rosto e chuva que canta no telhado.",
      "Tem cheiro de café de manhã e de terra molhada à tarde.",
      "Tem gente que já te ama sem nunca ter te visto.",
      "Tem música — ah, você vai amar música.",
      "Não precisa ter pressa. Mas saiba: é bonito aqui.",
      "E vai ficar mais bonito ainda quando você chegar. 🌍",
    ],
  },
  {
    id: "g-casa",
    title: "A sua casa",
    emoji: "🏠",
    lines: [
      "Hoje eu quero te contar da sua casa.",
      "Tem um cantinho que a gente arruma devagarinho pra você.",
      "Cada roupinha dobrada é um 'te espero' silencioso.",
      "As paredes já sabem o seu nome — eu falo dele todo dia.",
      "Sua casa não é feita de tijolo, é feita de espera boa.",
      "E o seu melhor lugar já está pronto faz tempo: é aqui, no meu colo, {bebe}. 🏠",
    ],
  },
  {
    id: "g-cancao",
    title: "Sua canção falada",
    emoji: "🎵",
    lines: [
      "Dizem que a minha voz é a sua música preferida, {bebe}.",
      "Então hoje eu vou te dar uma canção falada.",
      "Você é o meu sol de todo dia, mesmo quando chove.",
      "Você é o meu sonho mais corajoso.",
      "Você é a melhor parte de todos os meus planos.",
      "Guarda essa melodia aí no peito.",
      "Quando você nascer, eu canto de novo — bem baixinho, no seu ouvido. 🎵",
    ],
  },
  {
    id: "g-coragem",
    title: "Você é coragem",
    emoji: "🦁",
    lines: [
      "Sabia que você já me deixou mais corajosa, {bebe}?",
      "Antes de você, eu tinha medo de um monte de coisas.",
      "Agora eu tenho força que eu nem sabia que existia.",
      "É que amor grande faz a gente crescer por dentro.",
      "Se um dia você tiver medo, lembra: coragem corre no seu sangue.",
      "A gente já é um time, eu e você.",
      "E time que se ama não se solta. 🦁",
    ],
  },
  {
    id: "g-passeio",
    title: "O nosso primeiro passeio",
    emoji: "🌳",
    lines: [
      "Fecha os olhinhos, {bebe} — deixa eu te levar num sonho.",
      "No nosso primeiro passeio, vai ter sol peneirado entre as folhas.",
      "Eu vou te mostrar o céu e você vai piscar, encantado.",
      "Um cachorro vai latir longe, e eu vou dizer: 'olha, au-au!'",
      "Você vai dormir no meio do passeio, e tudo bem.",
      "O mundo pode esperar — eu vou estar ocupada te olhando.",
      "Já estou com saudade desse dia que ainda não aconteceu. 🌳",
    ],
  },
  {
    id: "g-obrigada",
    title: "Obrigada por me escolher",
    emoji: "🌷",
    lines: [
      "Hoje o recado é curto e é o mais verdadeiro de todos.",
      "De todos os lugares do universo, você veio parar aqui.",
      "Bem no meu colo, bem no meu peito, bem em mim.",
      "Obrigada por me escolher pra ser a sua mãe, {bebe}.",
      "Eu prometo errar tentando acertar, todos os dias.",
      "E te amar sem instruções, sem medida e sem fim.",
      "Você já é a melhor coisa que eu fiz. 🌷",
    ],
  },
  {
    id: "g-dificeis",
    title: "Pros dias difíceis",
    emoji: "🌧️",
    lines: [
      "{bebe}, nem todo dia aqui fora é fácil — e tudo bem.",
      "Hoje talvez a mamãe esteja cansada, e sabe o que me levanta?",
      "Você. Um chutinho seu vale por dez xícaras de café.",
      "Quando eu falo com você, o dia desamarra os nós.",
      "Então fica aí, quietinho, sendo o meu melhor motivo.",
      "A gente atravessa qualquer chuva juntos.",
      "Depois dela, eu te mostro o arco-íris. 🌧️→🌈",
    ],
  },
  {
    id: "g-ate-ja",
    title: "Até já, meu amor",
    emoji: "💌",
    lines: [
      "Essa cartinha é só pra dizer: até já.",
      "Cada dia que passa é um dia a menos pra eu te ver.",
      "Eu conto as semanas como quem conta estrelas.",
      "Você não tem ideia da festa que é você existir.",
      "Termina de crescer com calma — capricha nesse coração.",
      "Que aqui fora, o meu já é todo seu.",
      "Até já, {bebe}. Assinado: a mamãe. 💌",
    ],
  },
];

/* ── Primeiro trimestre ────────────────────────────────────────────────
   A fase em que quase nada aparece por fora e quase tudo pesa por dentro. */
const T1: Carta[] = [
  {
    id: "t1-segredo",
    title: "Nosso segredo, por enquanto",
    emoji: "🤫",
    fases: ["t1"],
    lines: [
      "{bebe}, por enquanto você é só nosso segredo.",
      "Ainda quase ninguém sabe — é só eu, você, e esse tanto de esperança guardada.",
      "Eu já mudei um monte de coisa por sua causa, e quase nada aparece por fora ainda.",
      "Às vezes eu boto a mão na barriga só pra confirmar que é real.",
      "Logo eu vou contar pro mundo. Mas hoje, esse segredo é só nosso.",
      "E ele já é o meu favorito. 🤫",
    ],
  },
  {
    id: "t1-sementinha",
    title: "Do tamanho de uma sementinha",
    emoji: "🌱",
    fases: ["t1"],
    lines: [
      "Sabe o que me impressiona, {bebe}? Que você já existe, e é tão pequenininho.",
      "Do tamanho de uma lentilha, de um grão de arroz, de uma sementinha.",
      "E mesmo assim, o seu coraçãozinho já bate — eu vi, no exame.",
      "É a coisa mais incrível que eu já testemunhei de perto.",
      "Cresce no seu tempo. Eu tenho toda a paciência do mundo.",
      "Sementinha, um dia você vai ser gigante pra mim. 🌱",
    ],
  },
  {
    id: "t1-enjoo",
    title: "Enjoo com propósito",
    emoji: "🍋",
    fases: ["t1"],
    lines: [
      "Hoje o enjoo apertou de novo, {bebe} — e eu quero que você saiba de uma coisa.",
      "Cada vez que meu estômago embrulha, eu lembro: é porque você está aqui, trabalhando forte.",
      "Então até o enjoo virou um jeito de eu sentir você, mesmo sem te ver ainda.",
      "Não é fácil, mas também não é à toa.",
      "Um dia eu vou rir contando essa parte da história.",
      "Hoje, eu só respiro fundo e sigo. Por você. 🍋",
    ],
  },
];

/* ── Segundo trimestre ─────────────────────────────────────────────────
   A fase em que ela sente, em que o quarto começa a existir de verdade. */
const T2: Carta[] = [
  {
    id: "t2-senti",
    title: "A primeira vez que te senti",
    emoji: "🦋",
    fases: ["t2"],
    lines: [
      "{bebe}, eu vou lembrar do dia que te senti mexer pelo resto da vida.",
      "Foi rápido, quase um espirro por dentro — e eu fiquei parada, sem acreditar.",
      "Foi você. A primeira prova de que tem alguém aí, além do exame e da barriga que cresce.",
      "Desde então eu fico esperando o próximo chutinho o dia inteiro.",
      "É a sua primeira forma de conversar comigo, e eu escuto toda vez.",
      "Continua falando comigo assim. Eu adoro. 🦋",
    ],
  },
  {
    id: "t2-quarto",
    title: "Seu quarto ganhando forma",
    emoji: "🧸",
    fases: ["t2"],
    lines: [
      "Hoje eu arrumei um cantinho pra você, {bebe}, e parei pra olhar.",
      "Uma prateleira, uma roupinha dobrada, um bichinho de pelúcia esperando.",
      "Cada coisinha ali tem um pouco de mim imaginando você.",
      "Eu ainda não sei direito o seu jeito, mas já sei que vai amar esse lugar.",
      "Não precisa estar pronto — só precisa estar cheio de carinho. E já está.",
      "Seu quarto já é feito de espera boa. 🧸",
    ],
  },
  {
    id: "t2-escuro",
    title: "Conversas no escuro",
    emoji: "🌙",
    fases: ["t2"],
    lines: [
      "À noite, quando a casa fica quieta, eu converso com você, {bebe}.",
      "Conto como foi o meu dia, dou risada sozinha, às vezes até canto baixinho.",
      "Não sei se você entende as palavras, mas acho que entende o carinho.",
      "É o nosso momento particular, só nosso, antes de dormir.",
      "Amanhã eu volto pra te contar mais.",
      "Boa noite, {bebe}. Durma bem aí dentro. 🌙",
    ],
  },
];

/* ── Terceiro trimestre ────────────────────────────────────────────────
   A reta final: corpo pesado, mala pronta, e uma coragem que não promete
   nada sobre o parto — só que ela vai atravessar. */
const T3: Carta[] = [
  {
    id: "t3-jaja",
    title: "Já, já",
    emoji: "⏳",
    fases: ["t3"],
    lines: [
      "{bebe}, olha só: falta pouco agora.",
      "Eu conto os dias como quem conta os últimos degraus de uma escada.",
      "O corpo está pesado, o sono é curto, e mesmo assim eu não troco por nada.",
      "Cada semana que passa é um pedacinho a mais de você pronto pra chegar.",
      "Eu não sei exatamente quando vai ser — mas sei que vai valer a espera inteira.",
      "Já, já a gente se vê de verdade. ⏳",
    ],
  },
  {
    id: "t3-mala",
    title: "Sua mala está pronta",
    emoji: "🎒",
    fases: ["t3"],
    lines: [
      "A sua mala já está pronta, {bebe}, do lado da porta.",
      "Roupinha pequena, meia que parece de boneca, uma manta macia.",
      "Toda vez que eu olho pra ela, meu coração aperta de um jeito bom.",
      "É a prova mais concreta que você está mesmo chegando.",
      "Eu arrumei com calma, pensando em cada detalhe pra te receber bem.",
      "Está tudo esperando por você. 🎒",
    ],
  },
  {
    id: "t3-vem-depois",
    title: "O que vem depois",
    emoji: "🌊",
    fases: ["t3"],
    lines: [
      "{bebe}, eu penso bastante no dia em que a gente vai se encontrar de verdade.",
      "Não sei exatamente como vai ser — ninguém sabe, de verdade, até acontecer.",
      "Mas eu sei de uma coisa: eu quero você tanto que vou atravessar esse dia com tudo que eu tiver.",
      "Meu time inteiro vai estar comigo, cuidando de nós dois.",
      "Você não precisa se apressar. Quando estiver pronto, eu estou pronta pra te receber.",
      "A gente se prepara junto, cada um do seu lado. 🌊",
    ],
  },
  {
    id: "t3-ultimas",
    title: "As últimas semanas de você só meu",
    emoji: "🤰",
    fases: ["t3"],
    lines: [
      "{bebe}, essas semanas finais são estranhas: eu já quero tanto te ver, e ainda quero guardar você só pra mim mais um pouco.",
      "Você mexe com menos espaço, mas mexe mais forte — eu sinto cada cotovelo, cada soluço.",
      "É a última vez que a gente vai estar assim, tão colados, o tempo inteiro.",
      "Eu tento guardar essa sensação, porque sei que não volta.",
      "Daqui a pouco o mundo inteiro vai poder te abraçar. Por enquanto, esse abraço ainda é só meu.",
      "E eu estou aproveitando cada segundo dele. 🤰",
    ],
  },
];

/* ── Pós-parto ─────────────────────────────────────────────────────────
   ⚠️ TEMPO PRESENTE, SEMPRE. O bebê já nasceu — nenhuma linha aqui promete
   um encontro futuro ou fala de "quando você nascer". */
const POS: Carta[] = [
  {
    id: "pos-cheiro",
    title: "Seu cheirinho",
    emoji: "👃",
    fases: ["pos"],
    lines: [
      "{bebe}, ninguém tinha me contado que bebê tem um cheiro desse jeito.",
      "Eu encosto o nariz na sua cabecinha e esqueço o resto do mundo por um segundo.",
      "É um cheiro que não existia antes de você nascer, e agora é o meu preferido do universo inteiro.",
      "Eu queria guardar esse cheirinho pra sempre, do jeitinho que é hoje.",
      "Você chegou há pouco tempo e já mudou o que eu sinto como conforto.",
      "Obrigada por trazer esse cheiro pra minha vida. 👃💛",
    ],
  },
  {
    id: "pos-primeira-noite",
    title: "A primeira noite",
    emoji: "🌙",
    fases: ["pos"],
    lines: [
      "{bebe}, a nossa primeira noite juntos eu nunca vou esquecer.",
      "Eu fiquei acordada só olhando você dormir, com medo de piscar e perder algum detalhe.",
      "O quarto estava escuro, mas eu sentia cada respiraçãozinha sua.",
      "Foi cansativo, foi emocionante, foi tudo ao mesmo tempo.",
      "E no meio da noite, quando você abriu o olho e me achou ali, meu coração disparou.",
      "Eu vou estar aqui em todas as noites que vierem. 🌙",
    ],
  },
  {
    id: "pos-choro",
    title: "Seu choro me chama",
    emoji: "🍼",
    fases: ["pos"],
    lines: [
      "{bebe}, o seu choro tem um jeito de me chamar que nenhum outro som tem.",
      "Às vezes eu ainda não sei bem o que você precisa — fome, colo, ou só companhia.",
      "Mas eu vou até você toda vez, e a gente vai aprendendo juntos.",
      "Um dia eu vou reconhecer cada choro seu de longe.",
      "Por enquanto, eu só sei que quando você chora, eu venho correndo.",
      "Sempre vou vir. 🍼",
    ],
  },
  {
    id: "pos-maozinhas",
    title: "Suas mãozinhas",
    emoji: "🤏",
    fases: ["pos"],
    lines: [
      "{bebe}, hoje você segurou o meu dedo com a sua mãozinha inteira.",
      "É incrível como algo tão pequeno consegue segurar tão forte.",
      "Eu fico olhando os seus deditos, as unhas minúsculas, cada detalhe que eu não tinha visto antes de você nascer.",
      "Você chegou com um corpo inteiro novo, pronto pra descobrir o mundo com essas mãos.",
      "E a primeira coisa que elas seguraram fui eu.",
      "Guarda essa mão na minha sempre que precisar. 🤏",
    ],
  },
  {
    id: "pos-banho",
    title: "O primeiro banho",
    emoji: "🛁",
    fases: ["pos"],
    lines: [
      "{bebe}, o seu primeiro banho me deixou mais nervosa do que eu esperava.",
      "Você chorou um pouquinho, eu segurei sua cabecinha com tanto cuidado que minha mão tremeu.",
      "E depois, enrolado na toalha, você ficou tão calminho no meu colo.",
      "Cada 'primeira vez' sua está sendo também uma primeira vez minha.",
      "A gente está aprendendo tudo isso junto, sem manual nenhum.",
      "E está dando certo, do nosso jeito. 🛁",
    ],
  },
  {
    id: "pos-peito",
    title: "Quando você dorme no meu peito",
    emoji: "💤",
    fases: ["pos"],
    lines: [
      "{bebe}, tem um jeito de você dormir encostado no meu peito que para o mundo inteiro.",
      "Eu sinto o seu peso, a sua respiração, o seu calorzinho — e não me mexo por nada.",
      "Podia ficar assim a tarde toda, mesmo com o braço dormente.",
      "É nesses minutos que eu entendo por que valeu tanto esperar por você.",
      "Você chegou, e trouxe esse tipo de quietude que eu nem sabia que existia.",
      "Dorme tranquilo. Eu seguro você. 💤",
    ],
  },
  {
    id: "pos-sorriso",
    title: "Seu primeiro sorriso",
    emoji: "😊",
    fases: ["pos"],
    lines: [
      "{bebe}, hoje eu jurei ter visto você sorrir pra mim.",
      "Pode ter sido gases, todo mundo avisou — mas eu escolho acreditar que foi por mim mesmo.",
      "Meu peito ficou quente na hora, um jeito de alegria que eu não sabia que cabia em mim.",
      "Eu vou passar semanas tentando fazer você sorrir de novo, desse jeito.",
      "E quando o sorriso vier de verdade, combinado, eu vou estar bem aqui, olhando.",
      "Só esperando por ele. 😊",
    ],
  },
  {
    id: "pos-sem-hora",
    title: "Nossos dias sem hora",
    emoji: "🕐",
    fases: ["pos"],
    lines: [
      "{bebe}, os nossos dias não têm mais hora certa desde que você chegou.",
      "Mamada, cochilo, troca de fralda, tudo se mistura, e o relógio quase não importa mais.",
      "Às vezes eu não sei nem que dia da semana é.",
      "Mas eu sei exatamente quando foi a última vez que você sorriu, ou dormiu bem, ou me olhou fundo.",
      "O tempo mudou de forma desde que você nasceu — e eu estou aprendendo a gostar dessa forma nova.",
      "Estamos nos encontrando, dia após dia, sem pressa nenhuma. 🕐",
    ],
  },
  {
    id: "pos-obrigada",
    title: "Obrigada por ter vindo",
    emoji: "🌷",
    fases: ["pos"],
    lines: [
      "{bebe}, eu passei meses te esperando, e agora você está aqui de verdade.",
      "Não é como eu imaginava — é melhor, e também mais cansativo do que qualquer imaginação.",
      "Cada coisa que você faz, mesmo as pequenas, me pega de surpresa de tão bonita.",
      "Obrigada por ter vindo, por ter escolhido chegar até aqui, até mim.",
      "Eu prometo continuar aprendendo a ser sua mãe, um dia de cada vez.",
      "Você já é a melhor coisa que já aconteceu comigo. 🌷",
    ],
  },
  {
    id: "pos-conhecendo",
    title: "Cada dia um pouco mais eu conheço você",
    emoji: "💗",
    fases: ["pos"],
    lines: [
      "{bebe}, todo dia eu descubro uma coisinha nova sobre você.",
      "Um jeito de espirrar, uma careta que só você faz, um som que eu nunca tinha ouvido antes.",
      "A gente ainda está se conhecendo — eu, que já te amava sem te ver, e agora aprendo quem você é de verdade.",
      "E cada dia que passa, eu gosto ainda mais do que estou descobrindo.",
      "Não tenho pressa nenhuma pra saber tudo de uma vez.",
      "Temos a vida inteira pela frente, você e eu. 💗",
    ],
  },
];

export const CARTAS: Carta[] = [...GERAIS, ...T1, ...T2, ...T3, ...POS];

/* ══════════════════════════════════════════════════════════════════════════
   SELEÇÃO — por fase, nunca cruzando gestação com pós-parto
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * O poço de cartas de uma fase: as gerais (que valem a gestação inteira) +
 * as específicas dessa fase. No pós-parto, SÓ as marcadas `["pos"]" — as
 * gerais são pré-natais por natureza ("quando você nascer…") e vazariam o
 * mesmo defeito que este arquivo existe para consertar.
 */
export function poolDaFase(fase: FaseCarta): Carta[] {
  if (fase === "pos") return CARTAS.filter((c) => c.fases?.includes("pos"));
  return CARTAS.filter((c) => !c.fases || c.fases.includes(fase));
}

/**
 * A carta de hoje.
 *
 * ⚠️ A ROTAÇÃO É `dia % n`, nunca um passo fixo — mesma razão de sempre
 * (`perguntaDoDia`, a lista de manhã do mascote): um passo que não é
 * coprimo com o tamanho do poço repete sempre os mesmos itens.
 */
export function cartaDoDia(o: {
  /** Dia gestacional, ou a idade do bebê + 7 no pós-parto — qualquer
   *  contador estável que ande de um em um. */
  dia: number;
  semanas?: number | null;
  posParto?: boolean;
}): Carta {
  const fase = faseDaGratidao(o.semanas, o.posParto ?? false);
  const pool = poolDaFase(fase);
  const dia = Math.abs(Math.floor(o.dia));
  return pool[dia % pool.length];
}

/* ══════════════════════════════════════════════════════════════════════════
   O NOME DO BEBÊ NAS CARTAS
   ══════════════════════════════════════════════════════════════════════════ */

/** `{bebe}` vira o nome dela, ou "meu amor" sem nome cadastrado. */
export function comNome(texto: string, nome?: string | null): string {
  const n = (nome ?? "").trim();
  return texto.replace(/\{bebe\}/g, n || "meu amor");
}

export function cartaComNome(carta: Carta, nome?: string | null): Carta {
  return {
    ...carta,
    title: comNome(carta.title, nome),
    lines: carta.lines.map((l) => comNome(l, nome)),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   O RASTRO DE LEITURA

   Sem isto, a repetição inevitável (30 cartas para até 384 dias) era
   invisível — ela relia sem saber que estava relendo. `registrarLeitura`
   guarda o INSTANTE anterior antes de sobrescrever, porque é ele que a tela
   de abertura mostra: "você leu esta carta há 2 semanas" só faz sentido
   antes de marcar a leitura de hoje, não depois.
   ══════════════════════════════════════════════════════════════════════════ */

export type LeiturasDeCartas = Record<string, string>;

/** O instante em que esta carta foi lida da última vez — ou `null`, na primeira. */
export function ultimaLeitura(leituras: LeiturasDeCartas, id: string): string | null {
  return leituras[id] ?? null;
}

export function registrarLeitura(
  leituras: LeiturasDeCartas,
  id: string,
  agora: Date,
): LeiturasDeCartas {
  return { ...leituras, [id]: agora.toISOString() };
}

/** "Você leu esta carta há 2 semanas." — ou `null`, se nunca leu antes. */
export function fraseDeUltimaLeitura(quando: string | null, agora: Date): string | null {
  if (!quando) return null;
  const d = diasEntre(quando, agora);
  if (d <= 0) return null;
  return `Você leu esta carta ${haQuantoTempo(quando, agora)}.`;
}

/* ══════════════════════════════════════════════════════════════════════════
   A BOLHA NESTA TELA

   Era a única das quatro atividades sem o porta-voz. As mesmas quatro regras
   de sempre valem: nunca cobra, convida, não promete clínica (nada sobre
   como o parto vai ser), fala com uma pessoa.
   ══════════════════════════════════════════════════════════════════════════ */

export type TelaDaCarta = "intro" | "done";

export function falaDaBolhaNaCarta(o: {
  tela: TelaDaCarta;
  /** Frase de "há quanto tempo leu" — ver `fraseDeUltimaLeitura`. Só a
   *  tela de abertura usa. */
  fraseDeLeitura?: string | null;
  /** A tela de escrita própria (lendo as gratidões dela) tem fala diferente
   *  — a atenção já vai pro conteúdo dela, não para o convite padrão. */
  lendoAsDelas?: boolean;
  periodo?: Periodo;
}): string {
  if (o.tela === "done") return "Guardei esse minuto com você. 💛";

  if (o.lendoAsDelas) return "Essas palavras são suas. Lê pra ele com calma.";

  if (o.fraseDeLeitura) return `${o.fraseDeLeitura} Bora ler de novo?`;

  if (o.periodo === "madrugada") return "Ele também gosta de ouvir sua voz de madrugada.";
  if (o.periodo === "noite") return "Antes de dormir, que tal ler pra ele?";
  return "Toda vez que você lê, ele reconhece a sua voz.";
}
