/**
 * OS EXERCÍCIOS — e o que estava errado com eles.
 *
 * ─── O QUE HAVIA (ago/2026) ─────────────────────────────────────────────────
 *
 * Nove movimentos, três por dia, escolhidos por `day % 9`. Cerca de cem
 * segundos no total. Uma gestante de 8 semanas e uma de 39 recebiam o mesmo
 * trio, e a única régua clínica era tirar os movimentos de chão depois da 37ª.
 *
 * Três buracos, e nenhum deles é de conteúdo — são de PERGUNTA:
 *
 *  1. **Ninguém abre um app de exercício "porque é terça".** Abre porque a
 *     lombar está doendo, porque a perna travou de câimbra às três da manhã,
 *     porque a azia não deixa deitar. O app não tinha onde ela dissesse isso.
 *  2. **Faltava o assoalho pélvico**, que é o exercício com melhor evidência
 *     da gestação inteira — e o único que muda um desfecho de verdade
 *     (incontinência urinária). Nove movimentos e nenhum era ele.
 *  3. **Não havia preparação para o parto.** Da 36ª semana em diante o corpo
 *     tem um trabalho específico a fazer, e o app continuava oferecendo
 *     "rolar os ombros".
 *
 * ─── O QUE ESTE ARQUIVO É ───────────────────────────────────────────────────
 *
 * Dados e régua, sem JSX — mesma razão de `frases-do-mascote.ts`: é isto que o
 * médico dono do app vai reler e corrigir, e texto enterrado em componente é
 * texto que ninguém revisa. O componente desenha; aqui está o que ele desenha.
 *
 * ⚠️ NADA AQUI É CONDUTA. É o mínimo de bom senso para não oferecer o
 * movimento errado no dia errado. Quem decide o que ela pode fazer é o
 * obstetra dela — e há uma tela de sinais de parada antes de tudo (ver
 * `SINAIS_DE_PARADA`).
 */

export type PoseKey = "pe" | "sentada" | "borboleta" | "quatro" | "deitada" | "parede";

/** O que está incomodando hoje. É por aqui que a sessão começa. */
export type Sintoma =
  | "lombar"
  | "ciatica"
  | "pubis"
  | "azia"
  | "inchaco"
  | "caimbra"
  | "punho"
  | "cansaco";

export type Fase = "t1" | "t2" | "t3" | "parto" | "pos";

export type Tipo = "alongamento" | "mobilidade" | "assoalho" | "respiracao" | "parto";

export type Movimento = {
  id: string;
  pose: PoseKey;
  emoji: string;
  name: string;
  cue: string;
  passos: string[];
  sentir: string;
  parar: string;
  secs: number;
  /** Para que serve. Vazio = serve para o corpo em geral. */
  alivia: Sintoma[];
  /** Em que fases ele é oferecido. */
  fases: Fase[];
  tipo: Tipo;
  /** Exige ir ao chão — sai perto do fim e no pós-parto recente. */
  chao: boolean;
};

export const SINTOMAS: { chave: Sintoma; emoji: string; rotulo: string }[] = [
  { chave: "lombar", emoji: "🪑", rotulo: "Dor nas costas" },
  { chave: "ciatica", emoji: "⚡", rotulo: "Dor que desce a perna" },
  { chave: "pubis", emoji: "🦴", rotulo: "Dor no osso da frente" },
  { chave: "azia", emoji: "🔥", rotulo: "Azia, falta de ar" },
  { chave: "inchaco", emoji: "🦶", rotulo: "Pés e pernas inchados" },
  { chave: "caimbra", emoji: "🌙", rotulo: "Câimbra à noite" },
  { chave: "punho", emoji: "✋", rotulo: "Mão dormente" },
  { chave: "cansaco", emoji: "😮‍💨", rotulo: "Só cansaço" },
];

/* ══════════════════════════════════════════════════════════════════════════
   OS MOVIMENTOS
   ══════════════════════════════════════════════════════════════════════════ */

export const MOVIMENTOS: Movimento[] = [
  /* ── Os nove que já existiam ─────────────────────────────────────────── */
  {
    id: "ombros",
    pose: "pe",
    emoji: "💆",
    name: "Rolar os ombros",
    cue: "Gire os ombros para trás, devagar e amplo.",
    passos: [
      "Fique em pé ou sentada, pés afastados na largura do quadril.",
      "Solte os braços ao lado do corpo, sem travar os cotovelos.",
      "Suba os ombros na direção das orelhas, leve-os para trás e desça.",
      "Cada volta deve levar uns 4 segundos — quanto mais lento, melhor.",
    ],
    sentir: "Um alívio entre o pescoço e as escápulas.",
    parar: "Se der pontada no ombro ou formigar o braço.",
    secs: 30,
    alivia: ["cansaco"],
    fases: ["t1", "t2", "t3", "parto", "pos"],
    tipo: "mobilidade",
    chao: false,
  },
  {
    id: "pescoco",
    pose: "sentada",
    emoji: "🙆",
    name: "Alongar o pescoço",
    cue: "Incline a orelha em direção ao ombro; troque de lado sem forçar.",
    passos: [
      "Sente-se com as costas apoiadas e os dois pés no chão.",
      "Deixe o ombro direito pesado, como se ele puxasse o chão.",
      "Incline a orelha esquerda ao ombro esquerdo, sem girar o rosto.",
      "Fique 15 segundos respirando e troque de lado.",
    ],
    sentir: "Um estica suave na lateral do pescoço, nunca na garganta.",
    parar: "Se der tontura ou formigamento nas mãos.",
    secs: 30,
    alivia: ["cansaco", "punho"],
    fases: ["t1", "t2", "t3", "parto", "pos"],
    tipo: "alongamento",
    chao: false,
  },
  {
    id: "gatocamelo",
    pose: "quatro",
    emoji: "🐈",
    name: "Gato-camelo suave",
    cue: "De quatro apoios, arredonde a coluna e volte ao neutro com a respiração.",
    passos: [
      "De quatro apoios: mãos abaixo dos ombros, joelhos abaixo do quadril.",
      "Se o joelho incomodar, dobre uma toalha embaixo dele.",
      "Ao SOLTAR o ar, arredonde as costas e leve o queixo ao peito.",
      "Ao PUXAR o ar, volte a coluna ao neutro — sem afundar a lombar.",
      "Uma ida e volta por respiração.",
    ],
    sentir: "A lombar abrindo e aliviando.",
    parar: "Se doer o punho — apoie nos punhos fechados ou pare.",
    secs: 40,
    alivia: ["lombar", "azia"],
    fases: ["t1", "t2", "t3", "parto"],
    tipo: "mobilidade",
    chao: true,
  },
  {
    id: "quadril",
    pose: "borboleta",
    emoji: "🦋",
    name: "Abertura de quadril",
    cue: "Sentada, solas dos pés juntas, deixe os joelhos caírem suaves.",
    passos: [
      "Sente-se no chão ou na cama com as solas dos pés encostadas.",
      "Apoie as costas numa parede se for mais confortável.",
      "Segure os tornozelos e deixe os joelhos caírem pelo próprio peso.",
      "Não empurre os joelhos para baixo com as mãos.",
    ],
    sentir: "Um alongamento na parte interna das coxas.",
    parar: "Se doer a virilha ou o osso da frente do púbis.",
    secs: 30,
    alivia: [],
    fases: ["t1", "t2", "t3"],
    tipo: "alongamento",
    chao: true,
  },
  {
    id: "tornozelo",
    pose: "sentada",
    emoji: "🦶",
    name: "Círculos de tornozelo",
    cue: "Desenhe círculos lentos com o pé — ajuda a circulação e o inchaço.",
    passos: [
      "Sentada, estenda uma perna e apoie o calcanhar no chão ou num banquinho.",
      "Desenhe círculos lentos com o pé: 10 para cada lado.",
      "Troque de pé e repita.",
      "Termine puxando a ponta do pé na direção do joelho por 5 segundos.",
    ],
    sentir: "A panturrilha trabalhando e o pé mais leve.",
    parar: "Se uma panturrilha doer sozinha, quente ou muito inchada — avise o médico.",
    secs: 30,
    alivia: ["inchaco", "caimbra"],
    fases: ["t1", "t2", "t3", "parto", "pos"],
    tipo: "mobilidade",
    chao: false,
  },
  {
    id: "pelve",
    pose: "pe",
    emoji: "🧍",
    name: "Inclinação pélvica em pé",
    cue: "Em pé, gire a bacia para frente e para trás, bem devagar.",
    passos: [
      "Em pé, encoste as costas numa parede com os pés a um palmo dela.",
      "Puxe o ar e relaxe o corpo.",
      "Ao soltar o ar, gire a bacia para cima e cole a lombar na parede.",
      "Solte devagar e repita no ritmo da respiração.",
    ],
    sentir: "A lombar se soltando e o abdômen ativando de leve.",
    parar: "Se sentir contração ou dor que não passa ao parar.",
    secs: 30,
    alivia: ["lombar"],
    fases: ["t1", "t2", "t3", "parto", "pos"],
    tipo: "mobilidade",
    chao: false,
  },
  {
    id: "bracos",
    pose: "pe",
    emoji: "🙌",
    name: "Alongar os braços pro alto",
    cue: "Entrelace os dedos, vire as palmas pra cima e estique — respira fundo.",
    passos: [
      "Em pé ou sentada, entrelace os dedos à frente do peito.",
      "Vire as palmas para fora e estenda os braços.",
      "Suba os braços acima da cabeça enquanto puxa o ar.",
      "Desça devagar soltando o ar. Repita 5 vezes.",
    ],
    sentir: "As costelas e as laterais do tronco abrindo — alívio pra azia.",
    parar: "Se ficar tonta ao levantar os braços: desça e sente-se.",
    secs: 30,
    alivia: ["azia"],
    fases: ["t1", "t2", "t3", "parto", "pos"],
    tipo: "alongamento",
    chao: false,
  },
  {
    id: "torcao",
    pose: "sentada",
    emoji: "🪑",
    name: "Torção suave sentada",
    cue: "Sentada, gire o tronco devagar pra um lado, depois pro outro.",
    passos: [
      "Sente-se na beira da cadeira com os pés apoiados no chão.",
      "Mão direita no encosto, mão esquerda na coxa direita.",
      "Gire a partir do meio das costas, mantendo a barriga apontada pra frente.",
      "Fique 15 segundos respirando e troque de lado.",
    ],
    sentir: "A coluna girando — nunca um aperto na barriga.",
    parar: "Se a barriga apertar ou a respiração embolar.",
    secs: 30,
    alivia: ["lombar", "azia"],
    fases: ["t1", "t2", "t3", "pos"],
    tipo: "mobilidade",
    chao: false,
  },
  {
    id: "balanco",
    pose: "quatro",
    emoji: "🐾",
    name: "Balanço em quatro apoios",
    cue: "Leve o quadril pra trás e volte — alivia as costas e ajuda o encaixe.",
    passos: [
      "De quatro apoios, mãos abaixo dos ombros.",
      "Leve o quadril pra trás, na direção dos calcanhares, até onde for confortável.",
      "Volte devagar à posição inicial.",
      "Vá e volte no ritmo da respiração.",
    ],
    sentir: "A lombar descomprimindo.",
    parar: "Se o punho ou o joelho doerem.",
    secs: 40,
    alivia: ["lombar", "ciatica"],
    fases: ["t1", "t2", "t3", "parto"],
    tipo: "mobilidade",
    chao: true,
  },

  /* ── ASSOALHO PÉLVICO ────────────────────────────────────────────────────
     O que faltava, e o que mais importa. Treinar o assoalho pélvico na
     gestação reduz o risco de incontinência urinária — é o exercício com
     melhor evidência de toda a gestação, e o app tinha nove movimentos sem
     ele. Três, porque são três habilidades diferentes: segurar, responder
     rápido, e SOLTAR (esta última é a que ninguém ensina, e é a que o parto
     pede). */
  {
    id: "assoalho-lento",
    pose: "deitada",
    emoji: "🎈",
    name: "Segurar e soltar",
    cue: "Feche por dentro como quem segura o xixi, segure, e solte tudo.",
    passos: [
      "Deitada de lado ou sentada, com o corpo apoiado e o rosto relaxado.",
      "Feche por dentro como quem segura o xixi e um gás ao mesmo tempo.",
      "Segure enquanto conta até cinco, sem prender a respiração.",
      "SOLTE por completo e descanse outros cinco. O descanso é parte do exercício.",
      "Oito repetições. Bunda, coxa e barriga ficam quietas.",
    ],
    sentir: "Um fechar por dentro, sem a bunda apertar junto.",
    parar:
      "Se doer, ou se você não conseguir soltar depois — vale procurar uma fisioterapeuta pélvica.",
    secs: 80,
    alivia: [],
    fases: ["t1", "t2", "t3", "parto", "pos"],
    tipo: "assoalho",
    chao: false,
  },
  {
    id: "assoalho-rapido",
    pose: "sentada",
    emoji: "⚡",
    name: "Fechadas rápidas",
    cue: "Fecha e solta rápido — é o que segura o xixi quando você tosse.",
    passos: [
      "Sentada, com os pés no chão e as costas apoiadas.",
      "Feche por dentro e solte imediatamente, sem segurar.",
      "Dez vezes seguidas, no ritmo de um segundo cada.",
      "Descanse dez segundos e faça mais dez.",
    ],
    sentir: "Um fechar rápido, bem no fundo.",
    parar: "Se perder a coordenação, descanse — cansado ele não responde.",
    secs: 45,
    alivia: [],
    fases: ["t2", "t3", "pos"],
    tipo: "assoalho",
    chao: false,
  },
  {
    id: "assoalho-soltar",
    pose: "deitada",
    emoji: "🌬️",
    name: "Aprender a soltar",
    cue: "O contrário do exercício anterior — e é este que o parto pede.",
    passos: [
      "Deitada de lado, joelhos dobrados, um travesseiro entre eles.",
      "Puxe o ar pelo nariz deixando a barriga subir sozinha.",
      "Ao soltar o ar pela boca, imagine tudo lá embaixo se abrindo e amolecendo.",
      "Solte também o rosto: mandíbula frouxa, língua solta, lábios entreabertos.",
      "Boca solta e assoalho solto andam juntos — é assim mesmo.",
    ],
    sentir: "Um amolecer, e não um esforço.",
    parar: "Nada aqui deve doer. Se doer, pare.",
    secs: 60,
    alivia: [],
    fases: ["t2", "t3", "parto"],
    tipo: "assoalho",
    chao: false,
  },

  /* ── LOMBAR E CIÁTICA ───────────────────────────────────────────────────
     A queixa nº 1 da gestação, e a que mais tira a mulher da cama à noite. */
  {
    id: "piriforme",
    pose: "sentada",
    emoji: "🦵",
    name: "Alongar o glúteo profundo",
    cue: "Tornozelo em cima do joelho e o peito para a frente — é a dor que desce a perna.",
    passos: [
      "Sentada numa cadeira firme, apoie o tornozelo direito sobre o joelho esquerdo.",
      "Mantenha as costas retas e incline o peito para a frente a partir do quadril.",
      "Pare no primeiro puxão — não é para dobrar em cima da barriga.",
      "Vinte segundos de cada lado, respirando.",
    ],
    sentir: "Um alongamento fundo no meio da nádega.",
    parar: "Se a dor da perna PIORAR ou descer mais do que já descia.",
    secs: 50,
    alivia: ["ciatica", "lombar"],
    fases: ["t1", "t2", "t3", "pos"],
    tipo: "alongamento",
    chao: false,
  },
  {
    id: "joelho-ao-peito",
    pose: "deitada",
    emoji: "🛏️",
    name: "Joelho ao peito, deitada de lado",
    cue: "Um joelho de cada vez, sem esmagar a barriga.",
    passos: [
      "Deitada do lado esquerdo, com um travesseiro sob a cabeça.",
      "Traga o joelho de cima na direção do peito, por FORA da barriga.",
      "Segure a perna com a mão, sem puxar com força, e respire três vezes.",
      "Solte devagar e repita do outro lado.",
    ],
    sentir: "A lombar e o glúteo abrindo daquele lado.",
    parar: "Se a virilha ou o púbis reclamarem.",
    secs: 45,
    alivia: ["lombar", "ciatica"],
    fases: ["t1", "t2", "t3", "pos"],
    tipo: "alongamento",
    chao: true,
  },

  /* ── PÚBIS ──────────────────────────────────────────────────────────────
     Dor de sínfise púbica pede o CONTRÁRIO de abrir: pede estabilizar. */
  {
    id: "travesseiro-entre-joelhos",
    pose: "deitada",
    emoji: "🦴",
    name: "Apertar o travesseiro",
    cue: "Aperta e solta um travesseiro entre os joelhos — estabiliza a frente.",
    passos: [
      "Deitada de lado ou sentada, com um travesseiro firme entre os joelhos.",
      "Aperte o travesseiro com os joelhos, com metade da sua força.",
      "Segure enquanto conta até cinco e solte.",
      "Dez repetições, sem prender a respiração.",
    ],
    sentir: "A parte de dentro das coxas trabalhando, e a frente do quadril mais firme.",
    parar: "Se o osso da frente doer durante — diminua a força pela metade; se ainda doer, pare.",
    secs: 50,
    alivia: ["pubis"],
    fases: ["t2", "t3", "pos"],
    tipo: "mobilidade",
    chao: false,
  },

  /* ── INCHAÇO E CÂIMBRA ──────────────────────────────────────────────── */
  {
    id: "panturrilha-parede",
    pose: "parede",
    emoji: "🧗‍♀️",
    name: "Alongar a panturrilha",
    cue: "Mãos na parede, uma perna atrás, calcanhar no chão.",
    passos: [
      "Fique de frente para uma parede, mãos na altura dos ombros.",
      "Leve uma perna para trás e mantenha o calcanhar colado no chão.",
      "Dobre o joelho da frente até sentir a panturrilha de trás esticar.",
      "Vinte segundos de cada lado. É o melhor remédio para a câimbra da noite.",
    ],
    sentir: "A panturrilha da perna de trás esticando.",
    parar:
      "Se UMA panturrilha estiver dolorida, quente ou inchada sozinha — não alongue e avise o médico.",
    secs: 50,
    alivia: ["caimbra", "inchaco"],
    fases: ["t1", "t2", "t3", "parto", "pos"],
    tipo: "alongamento",
    chao: false,
  },
  {
    id: "pernas-elevadas",
    pose: "deitada",
    emoji: "🦶",
    name: "Pernas para cima",
    cue: "Deitada de lado com as pernas apoiadas mais alto que o coração.",
    passos: [
      "Deite-se de lado, do lado ESQUERDO, com travesseiros sob as pernas.",
      "Deixe os pés mais altos que o quadril — dois ou três travesseiros bastam.",
      "Fique aí respirando devagar, e mexa os dedos dos pés de vez em quando.",
      "Depois da 20ª semana, evite ficar de barriga para cima nesta posição.",
    ],
    sentir: "As pernas mais leves, e o inchaço cedendo aos poucos.",
    parar: "Se ficar tonta ou enjoada — vire mais para o lado esquerdo.",
    secs: 60,
    alivia: ["inchaco", "caimbra"],
    fases: ["t2", "t3", "parto", "pos"],
    tipo: "alongamento",
    chao: true,
  },

  /* ── PUNHO ─────────────────────────────────────────────────────────────
     Túnel do carpo na gestação é comum e quase ninguém sabe o nome. */
  {
    id: "punho-dedos",
    pose: "sentada",
    emoji: "✋",
    name: "Soltar punho e dedos",
    cue: "Abrir, fechar e girar — para a mão que acorda dormente.",
    passos: [
      "Estenda os dois braços à frente, palmas para baixo.",
      "Abra bem os dedos, segure três segundos, e feche em punho frouxo.",
      "Faça dez vezes e depois gire os punhos, dez para cada lado.",
      "Termine sacudindo as mãos soltas por dez segundos.",
    ],
    sentir: "A mão mais solta e o formigamento cedendo.",
    parar: "Se a dormência não passar ou acordar você toda noite, conte na consulta.",
    secs: 40,
    alivia: ["punho"],
    fases: ["t1", "t2", "t3", "pos"],
    tipo: "mobilidade",
    chao: false,
  },

  /* ── COSTELAS E AZIA ───────────────────────────────────────────────── */
  {
    id: "costelas-parede",
    pose: "parede",
    emoji: "🫁",
    name: "Abrir as costelas na parede",
    cue: "Braços na parede e o peito descendo entre eles — espaço para respirar.",
    passos: [
      "De frente para a parede, apoie os antebraços nela, acima da cabeça.",
      "Dê um passo para trás e deixe o peito descer entre os braços.",
      "Não force a lombar: a barriga fica leve, o esforço é nas costelas.",
      "Respire fundo cinco vezes ali.",
    ],
    sentir: "As costelas abrindo e o ar entrando mais fundo.",
    parar: "Se der refluxo forte, saia da posição e fique em pé.",
    secs: 45,
    alivia: ["azia", "cansaco"],
    fases: ["t2", "t3", "parto"],
    tipo: "alongamento",
    chao: false,
  },

  /* ── PREPARAÇÃO PARA O PARTO (≥ 36 semanas) ─────────────────────────────
     A partir daqui o corpo tem um trabalho específico, e o app oferecia
     "rolar os ombros". Estas três são as posições que a literatura de
     assistência ao parto usa para ajudar o encaixe e aliviar a dor. */
  {
    id: "agachamento-parede",
    pose: "parede",
    emoji: "🧎‍♀️",
    name: "Agachamento apoiado",
    cue: "Costas na parede, desce um pouco e sobe — abre a saída.",
    passos: [
      "Encoste as costas na parede, pés afastados e um pouco à frente.",
      "Deslize as costas descendo até onde for confortável — não precisa ir fundo.",
      "Segure cinco segundos respirando e suba empurrando os pés no chão.",
      "Cinco repetições. Se o joelho reclamar, desça menos.",
    ],
    sentir: "As coxas trabalhando e o quadril abrindo embaixo.",
    parar: "Se sentir peso ou pressão lá embaixo que não passa ao levantar.",
    secs: 50,
    alivia: ["lombar"],
    fases: ["parto"],
    tipo: "parto",
    chao: false,
  },
  {
    id: "circulos-bola",
    pose: "sentada",
    emoji: "⚪",
    name: "Círculos sentada na bola",
    cue: "Sentada na bola, desenhe círculos lentos com o quadril.",
    passos: [
      "Sente-se na bola com os pés bem afastados e firmes no chão.",
      "Desenhe círculos lentos com o quadril, dez para cada lado.",
      "Depois vá e volte de frente para trás, no ritmo da respiração.",
      "Se não tiver bola, faça o mesmo sentada na beira de uma cadeira.",
    ],
    sentir: "O quadril solto e o peso descendo.",
    parar: "Se sentir tontura ou contração que se repete.",
    secs: 50,
    alivia: ["lombar", "ciatica"],
    fases: ["t3", "parto"],
    tipo: "parto",
    chao: false,
  },
  {
    id: "respirar-para-baixo",
    pose: "deitada",
    emoji: "🌊",
    name: "Respirar para baixo",
    cue: "A respiração que serve na contração: solta, longa, para baixo.",
    passos: [
      "Sentada ou apoiada de lado, com o corpo pesado.",
      "Puxe o ar pelo nariz contando até quatro.",
      "Solte pela boca contando até OITO, com o som saindo grave, sem apertar.",
      "A cada expiração, deixe os ombros e a mandíbula descerem mais um pouco.",
      "Seis respirações. É a que vale no dia.",
    ],
    sentir: "O ar saindo mais longo do que entrou, e o corpo pesando.",
    parar: "Se ficar tonta, volte a respirar normalmente.",
    secs: 60,
    alivia: ["cansaco"],
    fases: ["t3", "parto"],
    tipo: "respiracao",
    chao: false,
  },

  /* ── PÓS-PARTO ─────────────────────────────────────────────────────────
     O abdômen volta de dentro para fora: primeiro o diafragma e o
     transverso, muito antes de qualquer abdominal. */
  {
    id: "respiracao-diafragma",
    pose: "deitada",
    emoji: "🫀",
    name: "Respiração do diafragma",
    cue: "A base de toda a recuperação — antes de qualquer abdominal.",
    passos: [
      "Deitada de lado ou sentada, uma mão na barriga e outra nas costelas.",
      "Puxe o ar deixando as COSTELAS abrirem para os lados, não a barriga estufar.",
      "Solte o ar devagar e sinta as costelas fecharem sozinhas.",
      "Dez respirações. É o primeiro exercício depois do parto, inclusive de cesárea.",
    ],
    sentir: "As costelas abrindo para os lados, e nada forçando na cicatriz.",
    parar: "Se puxar a cicatriz, respire mais raso.",
    secs: 60,
    alivia: ["cansaco"],
    fases: ["pos"],
    tipo: "respiracao",
    chao: false,
  },
  {
    id: "ativar-transverso",
    pose: "deitada",
    emoji: "🧵",
    name: "Fechar a barriga por dentro",
    cue: "Um puxar leve para dentro, ao soltar o ar. Nunca uma abdominal.",
    passos: [
      "Deitada de lado, joelhos dobrados, coluna em posição neutra.",
      "Ao SOLTAR o ar, traga o umbigo levemente para dentro e para cima.",
      "É um movimento pequeno: 30% da sua força, não mais.",
      "Segure cinco segundos respirando normal, e solte. Oito vezes.",
    ],
    sentir: "Uma cinta se fechando por dentro, bem no fundo.",
    parar: "Se aparecer uma saliência no meio da barriga, diminua a força — e conte na consulta.",
    secs: 55,
    /* ⚠️ SERVE NA GESTAÇÃO TAMBÉM, e não só depois.
       Ele nasceu marcado só como pós-parto, e um teste cobrou o buraco que
       isso deixava: "dor no osso da frente" ficava com UM movimento só. A
       estabilização profunda é primeira linha em dor de cintura pélvica, e é
       o par natural do travesseiro entre os joelhos — um segura por fora, o
       outro por dentro. */
    alivia: ["pubis"],
    fases: ["t2", "t3", "parto", "pos"],
    tipo: "assoalho",
    chao: false,
  },
];

/* ══════════════════════════════════════════════════════════════════════════
   AS RÉGUAS
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠️ ANTES DE QUALQUER MOVIMENTO.
 *
 * Não é papelada: são os motivos pelos quais uma gestante NÃO deve se
 * exercitar naquele dia, e todos eles pedem contato com o obstetra, não
 * alongamento. A tela mostra isso uma vez por sessão, com um caminho direto
 * para o SOS — não como um "li e aceito".
 */
export const SINAIS_DE_PARADA: string[] = [
  "Sangramento",
  "Perda de líquido",
  "Contrações que se repetem",
  "Dor de cabeça forte que não passa",
  "Falta de ar em repouso, dor no peito",
  "Tontura ou desmaio",
];

export function fasePara(semana: number | null | undefined, posParto: boolean): Fase {
  if (posParto) return "pos";
  if (semana == null || !Number.isFinite(semana)) return "t2";
  if (semana >= 36) return "parto";
  if (semana >= 28) return "t3";
  if (semana >= 14) return "t2";
  return "t1";
}

/**
 * ⚠️ A FASE "parto" NÃO SUBSTITUI a t3 — ela ACRESCENTA.
 *
 * Da 36ª semana em diante a preparação entra, mas alongar as costas continua
 * valendo. Uma fase que trocasse a lista inteira faria a mulher de 38 semanas
 * perder o alívio de lombar justamente quando ele mais dói.
 */
export function elegiveis(
  fase: Fase,
  semana: number | null | undefined,
  posParto: boolean,
): Movimento[] {
  const fases: Fase[] = fase === "parto" ? ["t3", "parto"] : [fase];
  /* Chão sai perto do fim e no pós-parto recente: levantar do chão com 39
     semanas, ou três dias depois de uma cesárea, é o esforço — não o alívio. */
  const semChao = posParto || (semana != null && semana >= 37);
  return MOVIMENTOS.filter((m) => m.fases.some((f) => fases.includes(f)) && (!semChao || !m.chao));
}

/** Quantos movimentos cabem nos minutos pedidos (com 6 s de troca entre eles). */
export function quantosCabem(movimentos: Movimento[], minutos: number): number {
  const alvo = minutos * 60;
  let soma = 0;
  let n = 0;
  for (const m of movimentos) {
    const custo = m.secs + 6;
    if (soma + custo > alvo && n > 0) break;
    soma += custo;
    n++;
  }
  return Math.max(1, n);
}

/**
 * A SEQUÊNCIA DO DIA.
 *
 * Quando ela diz o que está incomodando, o que alivia AQUILO vem primeiro — e
 * o resto completa o tempo. Sem sintoma escolhido, gira pelo dia como antes,
 * para não dar a mesma sessão dois dias seguidos.
 *
 * ⚠️ O assoalho pélvico entra em TODA sessão de 5 minutos ou mais, mesmo sem
 * ela pedir. É o exercício com melhor evidência da gestação inteira, e ninguém
 * o escolhe espontaneamente numa lista — porque ninguém acorda com dor no
 * assoalho pélvico. Ele previne o que ainda não dói.
 */
export function sessaoDoDia(opts: {
  dia: number;
  minutos: number;
  semana?: number | null;
  posParto?: boolean;
  sintoma?: Sintoma | null;
}): Movimento[] {
  const { dia, minutos, semana = null, posParto = false, sintoma = null } = opts;
  const fase = fasePara(semana, posParto);
  const pool = elegiveis(fase, semana, posParto);
  if (!pool.length) return [];

  const escolhidos: Movimento[] = [];
  const usar = (m: Movimento) => {
    if (!escolhidos.some((x) => x.id === m.id)) escolhidos.push(m);
  };

  if (sintoma) for (const m of pool.filter((m) => m.alivia.includes(sintoma))) usar(m);

  if (minutos >= 5) {
    const assoalho = pool.filter((m) => m.tipo === "assoalho");
    if (assoalho.length) usar(assoalho[dia % assoalho.length]);
  }

  /* O resto entra girando pelo dia: duas sessões seguidas não são iguais. */
  const resto = pool.filter((m) => !escolhidos.some((x) => x.id === m.id));
  for (let k = 0; k < resto.length; k++) usar(resto[(dia + k) % resto.length]);

  return escolhidos.slice(0, quantosCabem(escolhidos, minutos));
}

/** As durações oferecidas, no mesmo desenho da meditação. */
export const DURACOES_EXERCICIO = [2, 5, 10] as const;
export type DuracaoExercicio = (typeof DURACOES_EXERCICIO)[number];
