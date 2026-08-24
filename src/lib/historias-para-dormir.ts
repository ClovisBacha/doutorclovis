/**
 * HISTÓRIAS PARA DORMIR — e por que elas são BLOCOS, não um arquivo só.
 *
 * ─── O QUE ISTO É ───────────────────────────────────────────────────────────
 *
 * Sleep Story é o carro-chefe do Calm à noite, e o produto que mais assinatura
 * vende no gênero. A insônia do terceiro trimestre é quase universal — o corpo
 * não acha posição, a bexiga acorda, o bebê se mexe às três da manhã — e o
 * nosso app, que sabe exatamente em que semana ela está, não tinha uma linha
 * para essa hora.
 *
 * ─── A ESTRUTURA É O REMÉDIO, NÃO O ENREDO ──────────────────────────────────
 *
 * Uma história para dormir não tem clímax, não tem pergunta e não tem nada para
 * a pessoa guardar. Ela ocupa a atenção o suficiente para tirá-la do próprio
 * pensamento, e não o suficiente para prender. Por isso: segunda pessoa, tempo
 * presente, frases curtas, muito detalhe sensorial e nenhum acontecimento.
 * Quem dorme no meio recebeu o que veio buscar.
 *
 * ─── POR QUE BLOCOS ─────────────────────────────────────────────────────────
 *
 * 1. **O silêncio faz parte.** Entre um bloco e outro há uma pausa que CRESCE
 *    ao longo da história (3 s no começo, 16 s no fim). É isso que faz a voz
 *    ir se afastando; num arquivo único, a pausa teria de ser gravada — e
 *    pausa gravada custa crédito por segundo de silêncio.
 * 2. **Cabe no cache.** O service worker guarda arquivo por arquivo; um mp3 de
 *    onze minutos precisaria baixar inteiro antes do primeiro som (ver o custo
 *    conhecido em `sw.js`). Em blocos, o primeiro toca em segundos e os
 *    seguintes chegam enquanto ela ouve.
 * 3. **Regravar sai barato.** Uma frase ruim custa UM bloco, não a história.
 *
 * ⚠️ Os `id` são PERMANENTES: cada um vira o nome de um `.mp3` que custou
 * crédito. Renomear órfã o arquivo; mudar o texto obriga a regravar aquele
 * bloco, e só aquele.
 */

export type BlocoDaHistoria = {
  /** Vira o nome do `.mp3`. Permanente. */
  id: string;
  texto: string;
};

export type Historia = {
  chave: string;
  titulo: string;
  sub: string;
  emoji: string;
  /**
   * Serve a quem está em Modo Cuidado?
   *
   * Uma história para dormir que não cita bebê nem gravidez serve a QUALQUER
   * pessoa numa noite ruim — e a noite de quem acabou de perder a gestação é
   * exatamente uma noite ruim. Estas duas foram escritas assim de propósito:
   * é o único conteúdo do app que atravessa o luto sem precisar de ressalva.
   */
  noLuto: boolean;
  blocos: BlocoDaHistoria[];
};

/**
 * A pausa DEPOIS de cada bloco, em segundos.
 *
 * Cresce de 3 s até 16 s: a voz vai se afastando, e o silêncio no fim é maior
 * que qualquer frase. É a curva que o gênero inteiro usa, e é o que diferencia
 * uma história para dormir de um audiolivro lido devagar.
 */
export function pausaDepoisDo(indice: number, total: number): number {
  if (total <= 1) return 3;
  const t = indice / (total - 1);
  return Math.round(3 + t * 13);
}

/** Quanto tempo a história leva, em minutos (narração + silêncios). */
export function duracaoAproximada(h: Historia): number {
  const palavras = h.blocos.reduce((s, b) => s + b.texto.split(/\s+/).length, 0);
  /* 150 palavras por minuto é o ritmo medido da Isabella nas falas curtas da
     meditação (5,0 s para 12 a 15 palavras). A tela toca a 0,92× para arrastar
     um pouco a leitura, então o divisor efetivo é 138. */
  const narracao = palavras / 138;
  const silencio = h.blocos.reduce((s, _, i) => s + pausaDepoisDo(i, h.blocos.length), 0) / 60;
  return Math.round(narracao + silencio);
}

/* ══════════════════════════════════════════════════════════════════════════
   1. A CASA JUNTO AO MAR

   O molde clássico: chegada, casa, cômodo a cômodo, cama, mar. Nada acontece.
   Cada bloco descreve UMA coisa e a entrega ao tato, à temperatura ou ao som —
   nunca à vista sozinha, que é o sentido mais desperto dos cinco.
   ══════════════════════════════════════════════════════════════════════════ */

const CASA_DO_MAR: Historia = {
  chave: "casa-do-mar",
  titulo: "A casa junto ao mar",
  sub: "Uma casa baixa, a janela aberta, o mar lá fora",
  emoji: "🌊",
  noLuto: true,
  blocos: [
    {
      id: "mar-01",
      texto:
        "Você não precisa acompanhar esta história até o fim. Ela não tem final para guardar, nem nome para lembrar. Se você dormir no meio, ela terá funcionado exatamente como devia. Então procure a posição que o seu corpo pedir hoje. Um travesseiro entre os joelhos, se ajudar. Deixe os ombros pesarem no colchão, e deixe a mandíbula solta.",
    },
    {
      id: "mar-02",
      texto:
        "Respire pelo nariz, sem contar e sem controlar nada. O ar entra morno e sai um pouquinho mais morno ainda. É só isso que você precisa fazer daqui pra frente. O resto sou eu que faço.",
    },
    {
      id: "mar-03",
      texto:
        "Agora já é noite, e você está chegando numa casa junto ao mar. Não é uma casa grande. É baixa, de janelas largas, com uma varanda de madeira que range um pouquinho quando a gente pisa. Você já esteve aqui antes, embora não lembre exatamente de quando.",
    },
    {
      id: "mar-04",
      texto:
        "A chave está debaixo do vaso de barro, como sempre esteve. Ela é fria na sua mão, e um pouco mais pesada do que parece. Entra na fechadura no primeiro movimento, sem resistência nenhuma. A porta abre para dentro, devagar.",
    },
    {
      id: "mar-05",
      texto:
        "O ar da casa vem te encontrar: cheiro de madeira, de sal, de roupa de cama que secou no varal. Alguém deixou uma luz acesa lá no fundo. Uma luz baixa, amarela, dessas que não pedem nada de você.",
    },
    {
      id: "mar-06",
      texto:
        "O chão é de tábua larga e é fresco sob os seus pés. Você tira os sapatos ali mesmo, na entrada, e deixa os dois tortos, um em cima do outro, porque hoje isso não importa. Cada passo faz um som macio. Esta casa é toda de sons macios.",
    },
    {
      id: "mar-07",
      texto:
        "Na sala há um sofá fundo, com uma manta dobrada no braço. Há uma mesinha de canto com uma tigela de conchas — conchas brancas, gastas de tanto rolar na areia. E há uma janela grande, que está aberta.",
    },
    {
      id: "mar-08",
      texto:
        "É por essa janela que entra o barulho do mar. Não o mar bravo do meio do dia. O mar de fim de noite, que vai e volta sem nenhuma pressa de chegar a lugar nenhum.",
    },
    {
      id: "mar-09",
      texto:
        "Da sala você vê a cozinha. Uma xícara secando de boca para baixo. Um pano dobrado em três. Uma janelinha acima da pia por onde entra um pouco de vento. Você chega perto e encosta a mão no mármore. Ele é frio, e demora a esquentar.",
    },
    {
      id: "mar-10",
      texto:
        "Um corredor curto leva ao quarto. Nas paredes há fotografias antigas de gente que você não conhece, e isso é bom: você não precisa lembrar de ninguém esta noite. Você passa a mão numa das molduras ao passar, sem parar, e o dedo sente uma poeira fina, macia.",
    },
    {
      id: "mar-11",
      texto:
        "O quarto é pequeno e a cama é grande. Lençol branco, esticado. Dois travesseiros: um para a cabeça e outro para o corpo abraçar. A janela deste quarto também está aberta.",
    },
    {
      id: "mar-12",
      texto:
        "A cortina de algodão se enche de ar e desincha, devagar, e enche de novo. Como se a casa inteira estivesse respirando junto com você. Você fica olhando isso por um tempo, sem nenhum motivo.",
    },
    {
      id: "mar-13",
      texto:
        "Você se senta na beira da cama. O colchão afunda o tanto certo. Deita de lado, do lado que for mais confortável hoje, e traz o travesseiro extra para junto do corpo. O lençol é fresco nos primeiros segundos, e depois vai ficando morno, do jeito que a gente gosta.",
    },
    {
      id: "mar-14",
      texto:
        "Lá fora o mar continua. Uma onda sobe, se abre e desmancha na areia. Depois vem um silêncio. Depois vem outra onda. Você não precisa contar nenhuma delas. Elas vêm de qualquer jeito, com você prestando atenção ou não.",
    },
    {
      id: "mar-15",
      texto:
        "Faz milhares de anos que elas fazem isso. E vão continuar fazendo enquanto você dorme, e amanhã, e depois de amanhã, sem que ninguém precise cuidar disso.",
    },
    {
      id: "mar-16",
      texto:
        "No banheiro alguém deixou uma toalha limpa dobrada na cadeira, e uma janelinha alta entreaberta. Entra um fio de ar frio que encontra o ar morno da casa e some no meio do caminho.",
    },
    {
      id: "mar-17",
      texto:
        "Se você quiser, mais tarde tem água quente. Mas isso é para depois, ou para nunca. Hoje não precisa levantar mais.",
    },
    {
      id: "mar-18",
      texto:
        "Do lado de fora da janela do quarto tem um pé de alecrim num vaso, e o vento passa por ele antes de entrar aqui. Por isso o ar tem esse cheiro — um cheiro verde, seco, que vem e vai conforme o vento.",
    },
    {
      id: "mar-19",
      texto:
        "Mais além do alecrim tem uma trilha de areia batida que desce até a praia. Você não vai descer hoje. Ela vai continuar lá amanhã, e depois de amanhã, sem que ninguém precise usá-la.",
    },
    {
      id: "mar-20",
      texto:
        "O céu está limpo. As estrelas estão espalhadas do jeito bagunçado que elas ficam longe das cidades, sem desenho nenhum, sem nome nenhum que você precise saber.",
    },
    {
      id: "mar-21",
      texto:
        "Uma delas pisca mais que as outras. Você olha por um tempo e depois esquece qual era, e não faz a menor diferença.",
    },
    {
      id: "mar-22",
      texto:
        "Se algum pensamento aparecer agora, deixe ele atravessar como atravessa a luz de um carro no teto. Ele passa e some. Você não precisa resolver nada esta noite.",
    },
    {
      id: "mar-23",
      texto:
        "O que ficou por resolver vai continuar existindo amanhã. E amanhã você vai estar mais descansada para olhar para isso.",
    },
    {
      id: "mar-24",
      texto:
        "A casa é velha e já viu muita gente dormir. Ela sabe fazer isso. As tábuas estalam sozinhas de vez em quando, esfriando, e não é ninguém.",
    },
    {
      id: "mar-25",
      texto:
        "A cortina enche e desincha. O mar sobe e volta. Não há mais nada para fazer aqui, e não há mais nada para conferir.",
    },
    {
      id: "mar-26",
      texto: "Você pode ficar o tempo que quiser. Eu vou ficando quieta agora. Boa noite.",
    },
  ],
};

/* ══════════════════════════════════════════════════════════════════════════
   2. O TREM DA NOITE

   O outro molde do gênero: movimento constante. O balanço e o ruído regular
   fazem metade do trabalho, e a paisagem passa sozinha — ela não precisa ir a
   lugar nenhum, e a história também não.
   ══════════════════════════════════════════════════════════════════════════ */

const TREM_DA_NOITE: Historia = {
  chave: "trem-da-noite",
  titulo: "O trem da noite",
  sub: "Um vagão quase vazio, atravessando o campo escuro",
  emoji: "🚂",
  noLuto: true,
  blocos: [
    {
      id: "trem-01",
      texto:
        "Esta história é para ser interrompida. Se você apagar antes do fim, ela cumpriu o que veio fazer. Ajeite o travesseiro. Solte os ombros. E deixe o corpo pesar no colchão, sem procurar a posição perfeita — hoje serve a posição possível.",
    },
    {
      id: "trem-02",
      texto:
        "Você está num trem. É noite, e o vagão está quase vazio. Você tem uma poltrona junto da janela, e a poltrona do lado está livre, com o seu casaco dobrado em cima dela.",
    },
    {
      id: "trem-03",
      texto:
        "As luzes do teto estão baixas. Não é escuro: é aquela luz cor de mel que os trens antigos têm, que ilumina o suficiente para andar e pouco demais para ler.",
    },
    {
      id: "trem-04",
      texto:
        "Embaixo de você, os trilhos fazem um som duplo, repetido, sempre igual. Tum-tum. Um instante. Tum-tum. É um som que não pede nada, não muda de assunto e não termina.",
    },
    {
      id: "trem-05",
      texto:
        "O vagão balança de leve, de um lado para o outro. É o mesmo balanço de quando alguém embala uma rede devagar. O seu corpo já entendeu esse ritmo e parou de se segurar.",
    },
    {
      id: "trem-06",
      texto:
        "Do outro lado do corredor, alguém dorme com a cabeça encostada no vidro. Mais adiante, uma senhora tricota sem olhar para as mãos. Ninguém vai falar com você nesta viagem.",
    },
    {
      id: "trem-07",
      texto:
        "Lá fora está escuro, mas não é um escuro vazio. De vez em quando passa uma casa com uma luz acesa na cozinha. Alguém está de pé àquela hora, como você, e isso é estranhamente confortável.",
    },
    {
      id: "trem-08",
      texto:
        "Passa um campo aberto. Passa uma cerca de madeira, um poste, outro poste. Passa uma fileira de árvores que o vento move todas juntas, e depois o campo de novo.",
    },
    {
      id: "trem-09",
      texto:
        "O vidro está frio perto do rosto e morno perto do ombro. Se você encostar a testa nele, sente a vibração fina dos trilhos subindo pelo corpo, como um ronronar.",
    },
    {
      id: "trem-10",
      texto:
        "O trem entra numa curva longa. O vagão inteiro se inclina um pouquinho, e volta. Lá na frente, os faróis da locomotiva desenham a linha no chão por alguns segundos, e a curva termina.",
    },
    {
      id: "trem-11",
      texto:
        "Agora vem uma ponte. O som muda: fica mais oco, mais largo, por uns instantes. Embaixo tem um rio que você não consegue ver, só adivinhar. E o som volta ao que era.",
    },
    {
      id: "trem-12",
      texto:
        "Tum-tum. Um instante. Tum-tum. Você não precisa acompanhar. Ele continua igual se você prestar atenção e continua igual se você parar.",
    },
    {
      id: "trem-13",
      texto:
        "A viagem é longa. Ninguém vai te acordar para descer. Não há estação com o seu nome esta noite, e o condutor já passou. Não há mais nada para conferir.",
    },
    {
      id: "trem-14",
      texto:
        "Você puxa o casaco da poltrona ao lado e cobre as pernas. A lã é áspera por fora e macia no avesso. Encaixa o ombro no encosto, e a cabeça encontra sozinha o lugar dela.",
    },
    {
      id: "trem-15",
      texto:
        "As luzes do teto baixam mais um pouco. A senhora do tricô parou. Lá fora, o campo continua passando, no escuro, sem precisar de ninguém olhando.",
    },
    {
      id: "trem-16",
      texto:
        "Começa a chover lá fora. Não é chuva forte: são gotas pequenas que batem no vidro de lado, por causa da velocidade, e escorrem para trás desenhando riscos finos.",
    },
    {
      id: "trem-17",
      texto:
        "Cada gota corre um pouco, encontra outra, fica mais pesada e desce mais rápido. Depois some na borda da janela. E vem outra, e faz o mesmo caminho.",
    },
    {
      id: "trem-18",
      texto:
        "O trem entra num túnel. O som fecha, fica mais próximo, e o vidro vira um espelho escuro por alguns segundos. Depois abre de novo, e o campo volta.",
    },
    {
      id: "trem-19",
      texto:
        "Passa uma estação sem parar. Uma plataforma vazia, molhada, com duas lâmpadas acesas e um banco. Não tinha ninguém esperando ali, e o trem nem diminui.",
    },
    {
      id: "trem-20",
      texto:
        "O condutor passa pelo corredor com uma lanterna baixa, conferindo alguma coisa que não é você. Os passos dele se afastam e a porta do fim do vagão se fecha sozinha, devagar.",
    },
    {
      id: "trem-21",
      texto:
        "Se um pensamento entrar aqui agora, deixe ele descer na próxima parada. Ele não precisa ir com você até o fim da linha.",
    },
    {
      id: "trem-22",
      texto:
        "O balanço continua. O som continua. O trem sabe o caminho, e vai a noite inteira, com você dormindo ou não.",
    },
    {
      id: "trem-23",
      texto: "Está tudo cuidado. Você pode soltar. Boa noite.",
    },
  ],
};

export const HISTORIAS: Historia[] = [CASA_DO_MAR, TREM_DA_NOITE];

export function historiaPorChave(chave: string): Historia | null {
  return HISTORIAS.find((h) => h.chave === chave) ?? null;
}

/** Todos os blocos de todas as histórias — para conferir áudio e custo. */
export function todosOsBlocos(): BlocoDaHistoria[] {
  return HISTORIAS.flatMap((h) => h.blocos);
}
