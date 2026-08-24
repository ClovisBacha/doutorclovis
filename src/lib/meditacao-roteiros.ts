/**
 * OS ROTEIROS DA MEDITAÇÃO — cada fala é um arquivo de áudio.
 *
 * ─── POR QUE TRECHOS, E NÃO UMA FAIXA POR TEMA ─────────────────────────────
 *
 * As faixas de hoje têm 30 a 37 segundos e são UMA por tema. Numa sessão de
 * dez minutos isso cobre 5,5% do tempo; o resto são três palavras repetidas 47
 * vezes. E gravar faixas longas não resolveria: a tela oferece 1, 2, 5 e 10
 * minutos, então uma faixa de dez minutos seria cortada no meio da frase em
 * três das quatro durações — e, como as palavras da respiração só entram
 * depois que a guia termina, nessas três a paciente ficaria sem nada.
 *
 * Em trechos, o MESMO banco serve as quatro durações: a sessão curta toca as
 * falas de peso alto, a longa toca todas. Custa o mesmo (paga-se por
 * caractere), regravar uma frase não obriga a refazer os dez minutos, e cada
 * linha da tela passa a ter a sua própria deixa de áudio — que é o conserto
 * estrutural da dessincronia entre o que ela lê e o que ela ouve.
 *
 * ─── AS QUATRO REGRAS DE ESCRITA ───────────────────────────────────────────
 *
 * São as mesmas do bebê bolha, e valem mais aqui, porque ela está de olhos
 * fechados e sozinha:
 *
 *  1. **Nunca cobra.** Não existe "você não fez", "faltou", "devia".
 *  2. **Convida, não manda.** "Se der", "quando quiser", "sem pressa".
 *  3. **Não promete clínica.** Não diz que está tudo bem, não opina sobre
 *     sintoma, não tranquiliza sobre o parto. Quem faz isso é o médico.
 *  4. **Fala com uma pessoa, não com uma plateia.** Segunda pessoa, presente,
 *     frases curtas. Uma ideia por fala — é uma fala, um arquivo.
 *
 * ⚠️ O `id` vira o NOME DO ARQUIVO e é permanente. Renomear um id órfã o
 * áudio já gerado, e áudio gerado custa crédito. Trocar o TEXTO de um id
 * obriga a regravar aquele arquivo — e só aquele.
 */

import { FALAS_DO_PROGRAMA } from "./meditacao-programa";

/** Fase da gestação. O 3 começa na 28ª semana. */
export type Trimestre = 1 | 2 | 3;

/**
 * Onde a fala entra no arco da sessão.
 *
 * O arco é o do gênero — abertura, ancoragem, corpo, silêncio, volta,
 * fechamento —, e é o mesmo que o Headspace usa há uma década. O que muda
 * entre uma sessão de 1 e uma de 10 minutos não é o arco: é quantas falas
 * cabem dentro dele.
 */
export type Momento = "acolhimento" | "ancoragem" | "corpo" | "silencio" | "volta" | "fechamento";

/**
 * Quanto a fala é essencial.
 *
 * 3 = o esqueleto, entra até na sessão de um minuto.
 * 2 = entra a partir de cinco minutos.
 * 1 = só nas de dez, quando há silêncio de sobra para preencher.
 *
 * É o que faz um banco só servir quatro durações sem uma linha de conteúdo
 * duplicada.
 */
export type Peso = 1 | 2 | 3;

export type Fala = {
  /** Vira o nome do `.mp3`. Permanente — ver o aviso no topo. */
  id: string;
  texto: string;
  momento: Momento;
  peso: Peso;
  /** Só nas falas de corpo: o tema exato de `MEDITACOES`. */
  tema?: string;
  /** Só nas falas de corpo: qual das três leituras do tema. */
  variacao?: 1 | 2 | 3;
  /** Só nos acolhimentos de fase: a partir de qual trimestre ela serve. */
  trimestre?: Trimestre;
};

/* ══════════════════════════════════════════════════════════════════════════
   ACOLHIMENTO — os primeiros quarenta segundos

   O trabalho desta parte é um só: tirar dela a sensação de que precisa fazer
   alguma coisa certa. É onde a maioria desiste, e desiste por achar que está
   meditando errado.
   ══════════════════════════════════════════════════════════════════════════ */

const ACOLHIMENTO: Fala[] = [
  {
    id: "ac-1",
    texto:
      "Se acomode do jeito que for mais confortável agora. Não existe posição certa — existe a que o seu corpo pede hoje.",
    momento: "acolhimento",
    peso: 3,
  },
  {
    id: "ac-2",
    texto:
      "Você não precisa fazer nada nos próximos minutos. Só ficar aqui já é o exercício inteiro.",
    momento: "acolhimento",
    peso: 3,
  },
  {
    id: "ac-3",
    texto:
      "Se puder, feche os olhos. Se não quiser fechar, deixe o olhar cair num ponto qualquer e amoleça.",
    momento: "acolhimento",
    peso: 3,
  },
];

/* ══════════════════════════════════════════════════════════════════════════
   ACOLHIMENTO POR FASE DA GESTAÇÃO — o que nenhum concorrente pode dizer

   O Calm e o Headspace falam com uma pessoa genérica, porque não sabem nada
   sobre quem está do outro lado. Este app sabe em que semana ela está, e essas
   seis falas são o lugar mais barato de usar isso: entram logo depois do
   acolhimento comum, sem tema, sem depender de nada.

   ⚠️ Nenhuma delas afirma sintoma. "Você deve estar enjoada" é errado para
   metade das mulheres do primeiro trimestre, e uma frase que erra sobre o
   corpo dela derruba a confiança na voz inteira. Elas RECONHECEM sem afirmar.
   ══════════════════════════════════════════════════════════════════════════ */

const FASE: Fala[] = [
  {
    id: "fase-1a",
    texto:
      "O começo da gestação cansa de um jeito que ninguém vê por fora. Este cansaço é trabalho — o seu corpo está construindo alguém.",
    momento: "acolhimento",
    peso: 2,
    trimestre: 1,
  },
  {
    id: "fase-1b",
    texto:
      "Ainda é cedo, e talvez você quase não sinta nada acontecendo. Está acontecendo. Não precisa sentir para ser verdade.",
    momento: "acolhimento",
    peso: 2,
    trimestre: 1,
  },
  {
    id: "fase-2a",
    texto:
      "Você chegou no meio do caminho. É a fase em que muita mulher volta a respirar — e é uma boa hora para aprender a fazer isso de propósito.",
    momento: "acolhimento",
    peso: 2,
    trimestre: 2,
  },
  {
    id: "fase-2b",
    texto:
      "Seu corpo mudou de forma nas últimas semanas, e ele ainda está aprendendo o tamanho novo. Dê a ele um instante de sossego.",
    momento: "acolhimento",
    peso: 2,
    trimestre: 2,
  },
  {
    id: "fase-3a",
    texto:
      "A reta final é pesada, e é normal que seja. Nos próximos minutos você não precisa carregar nada — nem o peso, nem a espera.",
    momento: "acolhimento",
    peso: 2,
    trimestre: 3,
  },
  {
    id: "fase-3b",
    texto:
      "Falta pouco, e a cabeça costuma correr na frente nesta fase. Deixe ela correr. A gente fica aqui, só neste minuto.",
    momento: "acolhimento",
    peso: 2,
    trimestre: 3,
  },
];

/* ══════════════════════════════════════════════════════════════════════════
   ANCORAGEM — ensinar o ritmo sem parecer aula

   Estas seis são comuns a todos os temas. Elas entram nos dois primeiros
   minutos, enquanto o desenho ainda está ensinando o compasso, e depois
   somem — a paciente já aprendeu, e repetir a instrução vira ruído.
   ══════════════════════════════════════════════════════════════════════════ */

const ANCORAGEM: Fala[] = [
  {
    id: "an-1",
    texto: "Deixe o ar entrar pelo nariz, sem forçar. E deixe ele sair devagar, pela boca.",
    momento: "ancoragem",
    peso: 3,
  },
  {
    id: "an-2",
    texto:
      "Acompanhe o desenho na tela quando quiser. Ele cresce quando você puxa e murcha quando você solta.",
    momento: "ancoragem",
    peso: 3,
  },
  {
    id: "an-3",
    texto:
      "A saída do ar pode ser mais longa que a entrada. É ela que avisa o corpo de que pode desligar.",
    momento: "ancoragem",
    peso: 2,
  },
  {
    id: "an-4",
    texto: "Solte os ombros. Solte a mandíbula. Deixe a língua descansar no fundo da boca.",
    momento: "ancoragem",
    peso: 2,
  },
  {
    id: "an-5",
    texto:
      "Se o ritmo do desenho não servir pra você, respire no seu. Ele é um convite, não uma regra.",
    momento: "ancoragem",
    peso: 1,
  },
  {
    id: "an-6",
    texto: "Repare que o corpo já foi ficando mais lento sozinho. Você não precisou mandar.",
    momento: "ancoragem",
    peso: 1,
  },
];

/* ══════════════════════════════════════════════════════════════════════════
   CORPO — as três leituras de cada tema

   ⚠️ As três variações são CAMINHOS DIFERENTES, nunca sinônimos.
   A queixa número dois dos usuários de Calm e Headspace é repetição de
   conteúdo: quem assina por muito tempo bate no teto. Três versões que dizem
   a mesma coisa com outras palavras não adiam esse teto — só o disfarçam por
   uma semana. Cada variação abaixo entra no tema por uma porta própria
   (o corpo, a cabeça, o vínculo), e é isso que faz a segunda sessão parecer
   outra sessão.
   ══════════════════════════════════════════════════════════════════════════ */

const CORPO: Fala[] = [
  // ── Calma ───────────────────────────────────────────────────────────────
  // v1 · pelo corpo: soltar de fora para dentro
  {
    id: "calma-1-1",
    tema: "Calma",
    variacao: 1,
    momento: "corpo",
    peso: 3,
    texto: "Comece pelas mãos. Abra os dedos, depois deixe eles caírem soltos.",
  },
  {
    id: "calma-1-2",
    tema: "Calma",
    variacao: 1,
    momento: "corpo",
    peso: 3,
    texto: "Suba pelos braços e solte os ombros mais um pouco. Sempre dá pra soltar mais um pouco.",
  },
  {
    id: "calma-1-3",
    tema: "Calma",
    variacao: 1,
    momento: "corpo",
    peso: 2,
    texto: "Agora a testa. É onde o dia inteiro fica guardado sem a gente perceber.",
  },
  {
    id: "calma-1-4",
    tema: "Calma",
    variacao: 1,
    momento: "corpo",
    peso: 2,
    texto: "Deixe o corpo pesar. Como se você afundasse um pouquinho no que está embaixo de você.",
  },
  {
    id: "calma-1-5",
    tema: "Calma",
    variacao: 1,
    momento: "corpo",
    peso: 1,
    texto: "Cada vez que o ar sai, um pedaço da tensão sai junto. Não precisa ajudar.",
  },
  // v2 · pela cabeça: o que ficou pendente
  {
    id: "calma-2-1",
    tema: "Calma",
    variacao: 2,
    momento: "corpo",
    peso: 3,
    texto: "Alguma coisa ficou pendente hoje. Ela vai continuar lá daqui a dez minutos.",
  },
  {
    id: "calma-2-2",
    tema: "Calma",
    variacao: 2,
    momento: "corpo",
    peso: 3,
    texto: "Não precisa parar de pensar. Só não precisa resolver nada agora.",
  },
  {
    id: "calma-2-3",
    tema: "Calma",
    variacao: 2,
    momento: "corpo",
    peso: 2,
    texto: "Quando a cabeça sair correndo, repare que ela saiu. Só isso — reparar já é voltar.",
  },
  {
    id: "calma-2-4",
    tema: "Calma",
    variacao: 2,
    momento: "corpo",
    peso: 2,
    texto: "A respiração está sempre aqui. É o lugar pra onde voltar, quantas vezes precisar.",
  },
  {
    id: "calma-2-5",
    tema: "Calma",
    variacao: 2,
    momento: "corpo",
    peso: 1,
    texto: "Ninguém medita sem se distrair. Quem medita é quem volta.",
  },
  // v3 · pelo lugar: estar em segurança agora
  {
    id: "calma-3-1",
    tema: "Calma",
    variacao: 3,
    momento: "corpo",
    peso: 3,
    texto: "Repare no lugar onde você está. Neste minuto, aqui, você está em segurança.",
  },
  {
    id: "calma-3-2",
    tema: "Calma",
    variacao: 3,
    momento: "corpo",
    peso: 3,
    texto: "Sinta o que está sustentando o seu corpo — a cadeira, a cama, o chão.",
  },
  {
    id: "calma-3-3",
    tema: "Calma",
    variacao: 3,
    momento: "corpo",
    peso: 2,
    texto: "Não precisa segurar nada. O que está embaixo de você segura.",
  },
  {
    id: "calma-3-4",
    tema: "Calma",
    variacao: 3,
    momento: "corpo",
    peso: 2,
    texto: "O seu bebê está aqui dentro, neste mesmo lugar seguro que você.",
  },
  {
    id: "calma-3-5",
    tema: "Calma",
    variacao: 3,
    momento: "corpo",
    peso: 1,
    texto: "Guarde a sensação deste minuto. Ela cabe no bolso e serve pro resto do dia.",
  },

  // ── Conexão com o bebê ──────────────────────────────────────────────────
  {
    id: "conexao-1-1",
    tema: "Conexão com o bebê",
    variacao: 1,
    momento: "corpo",
    peso: 3,
    texto: "Leve uma das mãos até a barriga, sem apertar. Só apoiar.",
  },
  {
    id: "conexao-1-2",
    tema: "Conexão com o bebê",
    variacao: 1,
    momento: "corpo",
    peso: 3,
    texto: "Deixe a mão subir e descer com a respiração. É o primeiro embalo que ele conhece.",
  },
  {
    id: "conexao-1-3",
    tema: "Conexão com o bebê",
    variacao: 1,
    momento: "corpo",
    peso: 2,
    texto: "O calor da sua mão atravessa. Ele sente que tem alguém do outro lado.",
  },
  {
    id: "conexao-1-4",
    tema: "Conexão com o bebê",
    variacao: 1,
    momento: "corpo",
    peso: 2,
    texto: "Não precisa dizer nada. Ficar com a mão ali já é conversa.",
  },
  {
    id: "conexao-1-5",
    tema: "Conexão com o bebê",
    variacao: 1,
    momento: "corpo",
    peso: 1,
    texto: "Se você quiser tirar a mão, tudo bem. Ele continua aí.",
  },
  {
    id: "conexao-2-1",
    tema: "Conexão com o bebê",
    variacao: 2,
    momento: "corpo",
    peso: 3,
    texto: "Por dentro, sem falar alto, mande um oi pra ele.",
  },
  {
    id: "conexao-2-2",
    tema: "Conexão com o bebê",
    variacao: 2,
    momento: "corpo",
    peso: 3,
    texto: "Conte uma coisa boa do seu dia. Pode ser bobagem — ele não julga.",
  },
  {
    id: "conexao-2-3",
    tema: "Conexão com o bebê",
    variacao: 2,
    momento: "corpo",
    peso: 2,
    texto: "A sua voz chega até ele pelo corpo, antes de chegar pelo ouvido.",
  },
  {
    id: "conexao-2-4",
    tema: "Conexão com o bebê",
    variacao: 2,
    momento: "corpo",
    peso: 2,
    texto: "Se não vier nada pra dizer, fique calada com ele. Também vale.",
  },
  {
    id: "conexao-2-5",
    tema: "Conexão com o bebê",
    variacao: 2,
    momento: "corpo",
    peso: 1,
    texto: "Ele vai reconhecer essa voz do lado de fora. Você está ensaiando com ele.",
  },
  {
    id: "conexao-3-1",
    tema: "Conexão com o bebê",
    variacao: 3,
    momento: "corpo",
    peso: 3,
    texto: "Vocês dois estão respirando do mesmo ar, agora.",
  },
  {
    id: "conexao-3-2",
    tema: "Conexão com o bebê",
    variacao: 3,
    momento: "corpo",
    peso: 3,
    texto: "Cada vez que você desacelera, o corpo dele desacelera junto.",
  },
  {
    id: "conexao-3-3",
    tema: "Conexão com o bebê",
    variacao: 3,
    momento: "corpo",
    peso: 2,
    texto: "Este minuto de sossego é seu, e é dele também. Cuidar de você é cuidar dos dois.",
  },
  {
    id: "conexao-3-4",
    tema: "Conexão com o bebê",
    variacao: 3,
    momento: "corpo",
    peso: 2,
    texto:
      "Você não precisa estar bem o tempo todo pra ser boa mãe. Só precisa estar aqui às vezes.",
  },
  {
    id: "conexao-3-5",
    tema: "Conexão com o bebê",
    variacao: 3,
    momento: "corpo",
    peso: 1,
    texto: "Guarde essa sensação de estar acompanhada por dentro.",
  },

  // ── Descanso ────────────────────────────────────────────────────────────
  {
    id: "descanso-1-1",
    tema: "Descanso",
    variacao: 1,
    momento: "corpo",
    peso: 3,
    texto: "Imagine um lugar tranquilo. Pode ser real, pode ser inventado — desde que seja seu.",
  },
  {
    id: "descanso-1-2",
    tema: "Descanso",
    variacao: 1,
    momento: "corpo",
    peso: 3,
    texto: "Repare na luz desse lugar. E na temperatura.",
  },
  {
    id: "descanso-1-3",
    tema: "Descanso",
    variacao: 1,
    momento: "corpo",
    peso: 2,
    texto: "Nesse lugar ninguém precisa de você agora.",
  },
  {
    id: "descanso-1-4",
    tema: "Descanso",
    variacao: 1,
    momento: "corpo",
    peso: 2,
    texto: "Fique mais um pouco. Ele não vai a lugar nenhum.",
  },
  {
    id: "descanso-1-5",
    tema: "Descanso",
    variacao: 1,
    momento: "corpo",
    peso: 1,
    texto: "Você pode voltar aqui em qualquer fila, em qualquer sala de espera.",
  },
  {
    id: "descanso-2-1",
    tema: "Descanso",
    variacao: 2,
    momento: "corpo",
    peso: 3,
    texto: "Comece pelos pés e vá soltando de baixo pra cima, sem pressa.",
  },
  {
    id: "descanso-2-2",
    tema: "Descanso",
    variacao: 2,
    momento: "corpo",
    peso: 3,
    texto: "Pernas. Quadril. Deixe o peso todo cair pra baixo.",
  },
  {
    id: "descanso-2-3",
    tema: "Descanso",
    variacao: 2,
    momento: "corpo",
    peso: 2,
    texto: "Costas, ombros, pescoço. Onde estiver duro, respire pra dentro dali.",
  },
  {
    id: "descanso-2-4",
    tema: "Descanso",
    variacao: 2,
    momento: "corpo",
    peso: 2,
    texto: "Rosto. Testa lisa, queixo solto, olhos pesados.",
  },
  {
    id: "descanso-2-5",
    tema: "Descanso",
    variacao: 2,
    momento: "corpo",
    peso: 1,
    texto: "O corpo inteiro entregue. Nada pra segurar.",
  },
  {
    id: "descanso-3-1",
    tema: "Descanso",
    variacao: 3,
    momento: "corpo",
    peso: 3,
    texto: "Descansar não é preguiça. É parte do trabalho que você está fazendo.",
  },
  {
    id: "descanso-3-2",
    tema: "Descanso",
    variacao: 3,
    momento: "corpo",
    peso: 3,
    texto: "Você tem permissão pra não fazer nada nos próximos minutos. Está dada.",
  },
  {
    id: "descanso-3-3",
    tema: "Descanso",
    variacao: 3,
    momento: "corpo",
    peso: 2,
    texto: "A lista de coisas vai continuar existindo. Ela espera.",
  },
  {
    id: "descanso-3-4",
    tema: "Descanso",
    variacao: 3,
    momento: "corpo",
    peso: 2,
    texto: "Se bater culpa, repare nela e deixe passar. Culpa não é instrução.",
  },
  {
    id: "descanso-3-5",
    tema: "Descanso",
    variacao: 3,
    momento: "corpo",
    peso: 1,
    texto: "Cansaço na gestação não é fraqueza. É conta que o corpo está pagando.",
  },

  // ── Gratidão ────────────────────────────────────────────────────────────
  {
    id: "gratidao-1-1",
    tema: "Gratidão",
    variacao: 1,
    momento: "corpo",
    peso: 3,
    texto: "Pense numa coisa pequena e boa que aconteceu hoje.",
  },
  {
    id: "gratidao-1-2",
    tema: "Gratidão",
    variacao: 1,
    momento: "corpo",
    peso: 3,
    texto: "Pequena mesmo. Um cheiro, um gole de água gelada, uma mensagem.",
  },
  {
    id: "gratidao-1-3",
    tema: "Gratidão",
    variacao: 1,
    momento: "corpo",
    peso: 2,
    texto: "Fique com ela por um instante, como se estivesse acontecendo de novo.",
  },
  {
    id: "gratidao-1-4",
    tema: "Gratidão",
    variacao: 1,
    momento: "corpo",
    peso: 2,
    texto: "Se hoje foi difícil e não vier nada, tudo bem. Dias assim existem.",
  },
  {
    id: "gratidao-1-5",
    tema: "Gratidão",
    variacao: 1,
    momento: "corpo",
    peso: 1,
    texto: "Amanhã você repara de novo. É treino, não é teste.",
  },
  {
    id: "gratidao-2-1",
    tema: "Gratidão",
    variacao: 2,
    momento: "corpo",
    peso: 3,
    texto: "O seu corpo está fazendo uma coisa enorme sem você precisar mandar.",
  },
  {
    id: "gratidao-2-2",
    tema: "Gratidão",
    variacao: 2,
    momento: "corpo",
    peso: 3,
    texto: "O coração está batendo por dois. Não pedimos, e ele faz.",
  },
  {
    id: "gratidao-2-3",
    tema: "Gratidão",
    variacao: 2,
    momento: "corpo",
    peso: 2,
    texto: "Agradeça a ele do jeito que der. Nem que seja só reparando.",
  },
  {
    id: "gratidao-2-4",
    tema: "Gratidão",
    variacao: 2,
    momento: "corpo",
    peso: 2,
    texto: "Você pode não gostar do corpo hoje e ainda assim reconhecer o trabalho dele.",
  },
  {
    id: "gratidao-2-5",
    tema: "Gratidão",
    variacao: 2,
    momento: "corpo",
    peso: 1,
    texto: "Ele mudou pra caber alguém. Isso é o contrário de estragado.",
  },
  {
    id: "gratidao-3-1",
    tema: "Gratidão",
    variacao: 3,
    momento: "corpo",
    peso: 3,
    texto: "Pense em alguém que cuidou de você esta semana.",
  },
  {
    id: "gratidao-3-2",
    tema: "Gratidão",
    variacao: 3,
    momento: "corpo",
    peso: 3,
    texto: "Pode ter sido uma coisa mínima. Alguém que perguntou como você estava.",
  },
  {
    id: "gratidao-3-3",
    tema: "Gratidão",
    variacao: 3,
    momento: "corpo",
    peso: 2,
    texto: "Mande pra essa pessoa, por dentro, um obrigada que ela não vai ouvir.",
  },
  {
    id: "gratidao-3-4",
    tema: "Gratidão",
    variacao: 3,
    momento: "corpo",
    peso: 2,
    texto: "E se você quiser mandar de verdade depois, também vale.",
  },
  {
    id: "gratidao-3-5",
    tema: "Gratidão",
    variacao: 3,
    momento: "corpo",
    peso: 1,
    texto: "Ninguém atravessa isto sozinha. Nem precisa.",
  },

  // ── Sono tranquilo ──────────────────────────────────────────────────────
  {
    id: "sono-1-1",
    tema: "Sono tranquilo",
    variacao: 1,
    momento: "corpo",
    peso: 3,
    texto: "A partir de agora, não precisa mais acompanhar o desenho. Só o ar.",
  },
  {
    id: "sono-1-2",
    tema: "Sono tranquilo",
    variacao: 1,
    momento: "corpo",
    peso: 3,
    texto: "A cada saída de ar, conte pra trás, começando em dez.",
  },
  {
    id: "sono-1-3",
    tema: "Sono tranquilo",
    variacao: 1,
    momento: "corpo",
    peso: 2,
    texto: "Se perder a conta, comece de onde achar que estava. Não importa.",
  },
  {
    id: "sono-1-4",
    tema: "Sono tranquilo",
    variacao: 1,
    momento: "corpo",
    peso: 2,
    texto: "Os números vão ficando mais lentos. Deixe.",
  },
  {
    id: "sono-1-5",
    tema: "Sono tranquilo",
    variacao: 1,
    momento: "corpo",
    peso: 1,
    texto: "Se o sono chegar antes do fim, deixe ele chegar.",
  },
  {
    id: "sono-2-1",
    tema: "Sono tranquilo",
    variacao: 2,
    momento: "corpo",
    peso: 3,
    texto: "Repare no escuro atrás das suas pálpebras. Ele é confortável.",
  },
  {
    id: "sono-2-2",
    tema: "Sono tranquilo",
    variacao: 2,
    momento: "corpo",
    peso: 3,
    texto: "Sinta o travesseiro, o lençol, o peso do cobertor.",
  },
  {
    id: "sono-2-3",
    tema: "Sono tranquilo",
    variacao: 2,
    momento: "corpo",
    peso: 2,
    texto: "Se precisar mudar de posição, mude. Dormir grávida é uma negociação.",
  },
  {
    id: "sono-2-4",
    tema: "Sono tranquilo",
    variacao: 2,
    momento: "corpo",
    peso: 2,
    texto: "O quarto está escuro e a noite é comprida. Não há pressa.",
  },
  {
    id: "sono-2-5",
    tema: "Sono tranquilo",
    variacao: 2,
    momento: "corpo",
    peso: 1,
    texto: "Acordar de madrugada não é sinal de nada. Acontece, e passa.",
  },
  {
    id: "sono-3-1",
    tema: "Sono tranquilo",
    variacao: 3,
    momento: "corpo",
    peso: 3,
    texto: "O dia acabou. Acabou mesmo, com o que deu e o que não deu.",
  },
  {
    id: "sono-3-2",
    tema: "Sono tranquilo",
    variacao: 3,
    momento: "corpo",
    peso: 3,
    texto: "Deixe ele ir embora, do jeito que ele foi.",
  },
  {
    id: "sono-3-3",
    tema: "Sono tranquilo",
    variacao: 3,
    momento: "corpo",
    peso: 2,
    texto: "Amanhã tem outro, e ele começa sem você precisar preparar nada agora.",
  },
  {
    id: "sono-3-4",
    tema: "Sono tranquilo",
    variacao: 3,
    momento: "corpo",
    peso: 2,
    texto: "Se a cabeça começar a listar coisas, ela pode. Você não precisa ir junto.",
  },
  {
    id: "sono-3-5",
    tema: "Sono tranquilo",
    variacao: 3,
    momento: "corpo",
    peso: 1,
    texto: "Nada do que você resolver agora vai ser melhor do que resolver amanhã.",
  },

  // ── Coragem pro parto ───────────────────────────────────────────────────
  // ⚠️ Nenhuma destas prevê como será o parto dela, promete que vai dar certo
  //    ou opina sobre via de nascimento. Elas trabalham a capacidade dela de
  //    atravessar, não o desfecho — que é do médico, e não de uma gravação.
  {
    id: "coragem-1-1",
    tema: "Coragem pro parto",
    variacao: 1,
    momento: "corpo",
    peso: 3,
    texto: "O seu corpo sabe fazer coisas que você nunca precisou aprender.",
  },
  {
    id: "coragem-1-2",
    tema: "Coragem pro parto",
    variacao: 1,
    momento: "corpo",
    peso: 3,
    texto: "Ele já vem fazendo há meses, sem instrução nenhuma.",
  },
  {
    id: "coragem-1-3",
    tema: "Coragem pro parto",
    variacao: 1,
    momento: "corpo",
    peso: 2,
    texto: "Você não precisa ter coragem agora. Só precisa ter no dia, e no dia ela vem.",
  },
  {
    id: "coragem-1-4",
    tema: "Coragem pro parto",
    variacao: 1,
    momento: "corpo",
    peso: 2,
    texto: "Medo e preparo cabem juntos. Um não anula o outro.",
  },
  {
    id: "coragem-1-5",
    tema: "Coragem pro parto",
    variacao: 1,
    momento: "corpo",
    peso: 1,
    texto: "Respirar assim é treino. No dia, o corpo lembra.",
  },
  {
    id: "coragem-2-1",
    tema: "Coragem pro parto",
    variacao: 2,
    momento: "corpo",
    peso: 3,
    texto: "Nada acontece tudo de uma vez. Acontece uma onda de cada vez.",
  },
  {
    id: "coragem-2-2",
    tema: "Coragem pro parto",
    variacao: 2,
    momento: "corpo",
    peso: 3,
    texto: "Entre uma e outra existe pausa. É nela que se descansa.",
  },
  {
    id: "coragem-2-3",
    tema: "Coragem pro parto",
    variacao: 2,
    momento: "corpo",
    peso: 2,
    texto: "Você não precisa dar conta do todo. Só da que estiver acontecendo.",
  },
  {
    id: "coragem-2-4",
    tema: "Coragem pro parto",
    variacao: 2,
    momento: "corpo",
    peso: 2,
    texto: "Soltar o ar comprido é o que mais ajuda. Comprido, sem apressar.",
  },
  {
    id: "coragem-2-5",
    tema: "Coragem pro parto",
    variacao: 2,
    momento: "corpo",
    peso: 1,
    texto: "Uma de cada vez, e elas acabam. Todas acabam.",
  },
  {
    id: "coragem-3-1",
    tema: "Coragem pro parto",
    variacao: 3,
    momento: "corpo",
    peso: 3,
    texto: "Pense em quem vai estar com você naquele dia.",
  },
  {
    id: "coragem-3-2",
    tema: "Coragem pro parto",
    variacao: 3,
    momento: "corpo",
    peso: 3,
    texto: "Você não vai atravessar isso sozinha. Tem gente do seu lado, e tem gente cuidando.",
  },
  {
    id: "coragem-3-3",
    tema: "Coragem pro parto",
    variacao: 3,
    momento: "corpo",
    peso: 2,
    texto: "Se você tiver dúvida, ela cabe na consulta. Perguntar é parte do preparo.",
  },
  {
    id: "coragem-3-4",
    tema: "Coragem pro parto",
    variacao: 3,
    momento: "corpo",
    peso: 2,
    texto: "Não existe jeito certo de sentir sobre o parto. O seu jeito serve.",
  },
  {
    id: "coragem-3-5",
    tema: "Coragem pro parto",
    variacao: 3,
    momento: "corpo",
    peso: 1,
    texto: "Do outro lado desse dia tem alguém que você vai conhecer.",
  },

  // ── Aqui e agora ────────────────────────────────────────────────────────
  {
    id: "agora-1-1",
    tema: "Aqui e agora",
    variacao: 1,
    momento: "corpo",
    peso: 3,
    texto: "Sem abrir os olhos, escute o som mais longe que você conseguir.",
  },
  {
    id: "agora-1-2",
    tema: "Aqui e agora",
    variacao: 1,
    momento: "corpo",
    peso: 3,
    texto: "Agora o mais perto. Talvez seja a sua própria respiração.",
  },
  {
    id: "agora-1-3",
    tema: "Aqui e agora",
    variacao: 1,
    momento: "corpo",
    peso: 2,
    texto: "Repare no cheiro do lugar onde você está. Ele estava aí esse tempo todo.",
  },
  {
    id: "agora-1-4",
    tema: "Aqui e agora",
    variacao: 1,
    momento: "corpo",
    peso: 2,
    texto: "Sinta a temperatura do ar na pele do rosto.",
  },
  {
    id: "agora-1-5",
    tema: "Aqui e agora",
    variacao: 1,
    momento: "corpo",
    peso: 1,
    texto: "Tudo isso está acontecendo agora, e só agora.",
  },
  {
    id: "agora-2-1",
    tema: "Aqui e agora",
    variacao: 2,
    momento: "corpo",
    peso: 3,
    texto: "Este minuto é a única coisa que existe de verdade neste momento.",
  },
  {
    id: "agora-2-2",
    tema: "Aqui e agora",
    variacao: 2,
    momento: "corpo",
    peso: 3,
    texto: "O que passou já foi. O que vem ainda não chegou.",
  },
  {
    id: "agora-2-3",
    tema: "Aqui e agora",
    variacao: 2,
    momento: "corpo",
    peso: 2,
    texto: "A cabeça vai querer ir pra frente. É o trabalho dela. Traga de volta, sem briga.",
  },
  {
    id: "agora-2-4",
    tema: "Aqui e agora",
    variacao: 2,
    momento: "corpo",
    peso: 2,
    texto: "Você não está atrasada em nada aqui.",
  },
  {
    id: "agora-2-5",
    tema: "Aqui e agora",
    variacao: 2,
    momento: "corpo",
    peso: 1,
    texto: "Um minuto inteiro só seu já é bastante coisa.",
  },
  {
    id: "agora-3-1",
    tema: "Aqui e agora",
    variacao: 3,
    momento: "corpo",
    peso: 3,
    texto: "Repare em três pontos do corpo que estão tocando alguma coisa.",
  },
  {
    id: "agora-3-2",
    tema: "Aqui e agora",
    variacao: 3,
    momento: "corpo",
    peso: 3,
    texto: "Os pés, as costas, as mãos. Onde encosta, você está apoiada.",
  },
  {
    id: "agora-3-3",
    tema: "Aqui e agora",
    variacao: 3,
    momento: "corpo",
    peso: 2,
    texto: "Não precisa mudar nada do que você reparou. Só reparar.",
  },
  {
    id: "agora-3-4",
    tema: "Aqui e agora",
    variacao: 3,
    momento: "corpo",
    peso: 2,
    texto: "O corpo está sempre no presente. Ele é o caminho de volta.",
  },
  {
    id: "agora-3-5",
    tema: "Aqui e agora",
    variacao: 3,
    momento: "corpo",
    peso: 1,
    texto: "Sempre que você se perder, procure onde o corpo encosta.",
  },
];

/* ══════════════════════════════════════════════════════════════════════════
   RECHAMADAS — o que se diz no silêncio

   De cinco para vinte. Numa sessão de dez minutos entram oito: com cinco no
   poço, três se repetiam DENTRO da mesma sessão. Com vinte, ela pode meditar
   dez minutos por dia durante duas semanas sem ouvir a mesma frase duas vezes.

   ⚠️ Rechamada NÃO instrui e NÃO cobra. Ela só reancora quem se perdeu — e
   quem se perdeu não precisa saber que se perdeu, precisa de um lugar pra
   voltar.
   ══════════════════════════════════════════════════════════════════════════ */

const SILENCIO: Fala[] = [
  {
    id: "re-1",
    momento: "silencio",
    peso: 3,
    texto: "Se a cabeça foi embora, tudo bem. Volte pra respiração.",
  },
  {
    id: "re-2",
    momento: "silencio",
    peso: 3,
    texto: "Nada pra resolver agora. Só o ar entrando e saindo.",
  },
  { id: "re-3", momento: "silencio", peso: 3, texto: "Solte os ombros de novo." },
  { id: "re-4", momento: "silencio", peso: 3, texto: "Você e o bebê, respirando juntos." },
  {
    id: "re-5",
    momento: "silencio",
    peso: 3,
    texto: "Deixe a expiração ser mais longa que a inspiração.",
  },
  {
    id: "re-6",
    momento: "silencio",
    peso: 2,
    texto: "Está tudo certo em não sentir nada de especial.",
  },
  {
    id: "re-7",
    momento: "silencio",
    peso: 2,
    texto: "Repare onde o corpo encosta. Volte por ali.",
  },
  { id: "re-8", momento: "silencio", peso: 2, texto: "Mais um pouco de ar. Sem pressa nenhuma." },
  { id: "re-9", momento: "silencio", peso: 2, texto: "A testa pode amolecer mais." },
  { id: "re-10", momento: "silencio", peso: 2, texto: "Você continua aqui. Isso já basta." },
  {
    id: "re-11",
    momento: "silencio",
    peso: 2,
    texto: "Se veio um pensamento, deixe ele passar como passa um carro.",
  },
  { id: "re-12", momento: "silencio", peso: 2, texto: "Nada precisa da sua atenção neste minuto." },
  { id: "re-13", momento: "silencio", peso: 1, texto: "Solte a mandíbula." },
  {
    id: "re-14",
    momento: "silencio",
    peso: 1,
    texto: "O ar não precisa ser fundo. Só precisa ser calmo.",
  },
  {
    id: "re-15",
    momento: "silencio",
    peso: 1,
    texto: "Você está no meio do caminho. Fique mais um pouco.",
  },
  { id: "re-16", momento: "silencio", peso: 1, texto: "Se der sono, deixe dar." },
  {
    id: "re-17",
    momento: "silencio",
    peso: 1,
    texto: "Repare como o corpo já está mais lento do que quando começou.",
  },
  { id: "re-18", momento: "silencio", peso: 1, texto: "Não existe fazer isso errado." },
  { id: "re-19", momento: "silencio", peso: 1, texto: "Só mais alguns respiros." },
  {
    id: "re-20",
    momento: "silencio",
    peso: 1,
    texto: "Fique com o silêncio um pouquinho. Ele é parte do exercício.",
  },
];

/* ══════════════════════════════════════════════════════════════════════════
   VOLTA — trazer de volta sem susto

   Terminar de repente é o defeito mais comum em meditação amadora: a pessoa
   está funda e a tela troca. Estas quatro dão a ela trinta segundos para
   voltar ao corpo antes da pergunta do fechamento.
   ══════════════════════════════════════════════════════════════════════════ */

const VOLTA: Fala[] = [
  {
    id: "volta-1",
    momento: "volta",
    peso: 3,
    texto: "Vamos voltar devagar. Comece mexendo os dedos das mãos.",
  },
  {
    id: "volta-2",
    momento: "volta",
    peso: 3,
    texto: "Sinta o corpo inteiro de novo, do jeito que ele está agora.",
  },
  {
    id: "volta-3",
    momento: "volta",
    peso: 2,
    texto: "Se quiser, alongue o pescoço pra um lado e pro outro.",
  },
  {
    id: "volta-4",
    momento: "volta",
    peso: 2,
    texto: "Quando estiver pronta, abra os olhos sem pressa.",
  },
];

/* ══════════════════════════════════════════════════════════════════════════
   FECHAMENTO — a última frase, e ela responde ao que a paciente disse

   Estas cinco casam com as cinco respostas de "como você está agora?". São o
   texto que já existe na tela (`FECHAMENTO` em `gestacao-path.tsx`), agora
   com voz — porque uma resposta lida é informação e uma resposta ouvida é
   companhia, e é a última coisa que ela leva da sessão.

   ⚠️ A de "ainda ansiosa" é a única do app inteiro que manda ela levar algo
   para a consulta. Ela não pode ser suavizada.
   ══════════════════════════════════════════════════════════════════════════ */

const FECHAMENTO_FALAS: Fala[] = [
  {
    id: "fe-calma",
    momento: "fechamento",
    peso: 3,
    texto: "É isso mesmo. Guarde esse ritmo pro resto do dia.",
  },
  {
    id: "fe-sono",
    momento: "fechamento",
    peso: 3,
    texto: "Sono depois de meditar é o corpo aceitando descansar. Vá deitar.",
  },
  {
    id: "fe-conectada",
    momento: "fechamento",
    peso: 3,
    texto: "Esse instante também é cuidado com ele. Vocês dois sentiram.",
  },
  {
    id: "fe-igual",
    momento: "fechamento",
    peso: 3,
    texto: "Nem toda sessão muda o dia — e mesmo assim ela contou. Volte amanhã.",
  },
  {
    id: "fe-ansiosa",
    momento: "fechamento",
    peso: 3,
    texto: "Ansiedade que não passa em cinco minutos merece ser falada. Leve isso pra consulta.",
  },
];

/**
 * O banco inteiro. É desta lista que sai o custo em créditos e os arquivos.
 *
 * As falas do PROGRAMA entram aqui porque são áudio como qualquer outra — o
 * que muda nelas é só o `tema` (`prog-1` … `prog-7`), que faz `planejarSessao`
 * montar o dia do programa reaproveitando acolhimento, ancoragem, rechamadas e
 * volta ao corpo deste mesmo banco. Ver `meditacao-programa.ts`.
 */
export const ROTEIROS: Fala[] = [
  ...ACOLHIMENTO,
  ...FASE,
  ...ANCORAGEM,
  ...CORPO,
  ...FALAS_DO_PROGRAMA,
  ...SILENCIO,
  ...VOLTA,
  ...FECHAMENTO_FALAS,
];

/** Qual acolhimento de fase serve esta semana. Sem semana, nenhum. */
export function trimestreDaSemana(semanas: number | null | undefined): Trimestre | null {
  if (semanas == null || !Number.isFinite(semanas)) return null;
  if (semanas < 14) return 1;
  if (semanas < 28) return 2;
  return 3;
}

/** Quanto o lote inteiro custa para gerar, pela régua medida do Higgsfield. */
export const CARACTERES_POR_CREDITO = 350;

export function custoEmCreditos(falas: Fala[] = ROTEIROS): number {
  const chars = falas.reduce((s, f) => s + f.texto.length, 0);
  return Math.round((chars / CARACTERES_POR_CREDITO) * 10) / 10;
}
