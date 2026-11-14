import { cartaDoDia, falaDaBolhaNaCarta, poolDeHoje, type Carta } from "@/lib/cartas-do-bebe";
import { D_MINIMO, semanaDoDia } from "~/lib/jornada/dia";

/**
 * AS CARTAS COMO O APP AS LÊ — as do site (`@/lib/cartas-do-bebe`, congeladas),
 * com as linhas que fogem das regras do app trocadas (21/10/2026: rede social +
 * gamificação, não conselho médico).
 *
 * - **O que ela sente das mexidinhas fica fora** ("sei quando você dança aí
 *   dentro", "um chutinho seu", "fica aí, quietinho" — o bebê quieto como coisa
 *   boa é justo o sinal que só o SOS trata —, "você mexe mais forte"). Quem
 *   sente pouco lê ali um sinal.
 * - **Exame e sintoma** ("eu vi, no exame", o enjoo como prova de que está
 *   tudo bem, "pode ter sido gases", "o sono é curto").
 * - **O bebê no masculino** ("encantado", "tranquilo", "pronto", "calminho",
 *   "juntos", "colados"): a carta é lida para meninas também.
 * - **A mala "já pronta" na 28ª semana**, uma régua para quem não arrumou.
 *
 * Duas cartas inteiras eram o próprio tema que saiu (o enjoo e "A primeira vez
 * que te senti"): viram cartas do app no MESMO `id`, para o rastro de leitura
 * seguir valendo. A troca casa pela linha EXATA do site; a catraca do teste
 * cobra que cada linha trocada ainda exista lá.
 */
export const LINHAS_DAS_CARTAS_NO_APP: Readonly<Record<string, string>> = {
  "Sei quando você acorda, sei quando você dança aí dentro.":
    "Sei que você está aí, crescendo um pouquinho a cada dia.",
  "Cresce tranquilo, que aqui fora já existe um amor te esperando.":
    "Cresce em paz, que aqui fora já existe um amor te esperando.",
  "Eu vou te mostrar o céu e você vai piscar, encantado.":
    "Eu vou te mostrar o céu e você vai piscar, com cara de encanto.",
  "Você. Um chutinho seu vale por dez xícaras de café.":
    "Você. Pensar em você vale por dez xícaras de café.",
  "Então fica aí, quietinho, sendo o meu melhor motivo.":
    "Então fica aí, crescendo em paz, sendo o meu melhor motivo.",
  "A gente atravessa qualquer chuva juntos.": "A gente atravessa qualquer chuva, lado a lado.",
  "Sabe o que me impressiona, {bebe}? Que você já existe, e é tão pequenininho.":
    "Sabe o que me impressiona, {bebe}? Que você já existe, num tamanhinho de nada.",
  "E mesmo assim, o seu coraçãozinho já bate — eu vi, no exame.":
    "E mesmo assim, você já ocupa um espaço enorme no meu coração.",
  "É a coisa mais incrível que eu já testemunhei de perto.":
    "É a coisa mais incrível que eu já vivi de perto.",
  "O corpo está pesado, o sono é curto, e mesmo assim eu não troco por nada.":
    "Os dias estão mais lentos, a espera é grande, e mesmo assim eu não troco por nada.",
  "A sua mala já está pronta, {bebe}, do lado da porta.":
    "A sua mala vai ganhando forma, {bebe}, aos pouquinhos.",
  "Eu arrumei com calma, pensando em cada detalhe pra te receber bem.":
    "Eu vou arrumando com calma, pensando em cada detalhe pra te receber bem.",
  "Meu time inteiro vai estar comigo, cuidando de nós dois.":
    "Quem a gente ama vai estar torcendo por nós dois.",
  "Você não precisa se apressar. Quando estiver pronto, eu estou pronta pra te receber.":
    "Você não precisa se apressar. Na sua hora, eu estou pronta pra te receber.",
  "Você mexe com menos espaço, mas mexe mais forte — eu sinto cada cotovelo, cada soluço.":
    "A barriga cresceu tanto, e cada carinho que eu faço ali é para você.",
  "É a última vez que a gente vai estar assim, tão colados, o tempo inteiro.":
    "É a última vez que a gente vai estar assim, tão pertinho, o tempo inteiro.",
  "E depois, enrolado na toalha, você ficou tão calminho no meu colo.":
    "E depois, na toalha quentinha, você ficou em paz no meu colo.",
  "{bebe}, tem um jeito de você dormir encostado no meu peito que para o mundo inteiro.":
    "{bebe}, tem um jeito de você dormir no meu peito que para o mundo inteiro.",
  "Dorme tranquilo. Eu seguro você. 💤": "Dorme em paz. Eu seguro você. 💤",
  "Pode ter sido gases, todo mundo avisou — mas eu escolho acreditar que foi por mim mesmo.":
    "Pode ter sido sem querer, todo mundo avisou — mas eu escolho acreditar que foi por mim mesmo.",
  "Você é feito de tantas coisinhas pequenas que se juntam pra formar exatamente você.":
    "Você é um monte de coisinhas pequenas que se juntam pra formar exatamente você.",
  "{bebe}, a nossa primeira noite juntos eu nunca vou esquecer.":
    "{bebe}, a nossa primeira noite lado a lado eu nunca vou esquecer.",
  "Mas eu vou até você toda vez, e a gente vai aprendendo juntos.":
    "Mas eu vou até você toda vez, e a gente vai aprendendo junto.",
};

export const TITULOS_DAS_CARTAS_NO_APP: Readonly<Record<string, string>> = {
  "Sua mala está pronta": "Sua mala vai ficando pronta",
  "As últimas semanas de você só meu": "As últimas semanas só nossas",
};

/** As duas cartas que eram o próprio tema que saiu — o mesmo `id`, o texto do app. */
export const CARTAS_INTEIRAS_NO_APP: Readonly<
  Record<string, { siteTitulo: string } & Pick<Carta, "title" | "emoji" | "lines">>
> = {
  "t1-enjoo": {
    siteTitulo: "Enjoo com propósito",
    title: "Os nossos primeiros dias",
    emoji: "🌿",
    lines: [
      "Hoje eu reparei numa coisa, {bebe}: o meu dia já tem você em tudo.",
      "Eu me pego sorrindo no meio da tarde, sem ninguém entender por quê.",
      "Guardei uma foto minha de agora, para um dia, se você quiser, te mostrar como tudo começou.",
      "Ainda é cedo para quase tudo — e tudo bem, a gente tem tempo.",
      "Um dia eu vou rir contando essa parte da história.",
      "Hoje, eu só respiro fundo e sigo. Com você. 🌿",
    ],
  },
  "t2-senti": {
    siteTitulo: "A primeira vez que te senti",
    title: "A nossa foto de hoje",
    emoji: "📸",
    lines: [
      "{bebe}, hoje eu tirei uma foto da barriga, de lado, no espelho.",
      "Fiquei um tempão olhando, como quem olha pela janela de uma casa nova.",
      "Cada foto é uma página do nosso álbum, antes mesmo de você chegar.",
      "Um dia, se você quiser, eu te mostro todas, em ordem.",
      "Por enquanto, elas ficam guardadas aqui comigo, com o seu nome do lado.",
      "Sorri pra foto, viu? Daí de dentro mesmo. 📸",
    ],
  },
};

/** A carta como o app a lê (o mesmo `id`; o rastro de leitura segue valendo). */
export function cartaNoApp(c: Carta): Carta {
  const inteira = CARTAS_INTEIRAS_NO_APP[c.id];
  if (inteira && inteira.siteTitulo === c.title)
    return { ...c, title: inteira.title, emoji: inteira.emoji, lines: [...inteira.lines] };
  return {
    ...c,
    title: TITULOS_DAS_CARTAS_NO_APP[c.title] ?? c.title,
    lines: c.lines.map((l) => LINHAS_DAS_CARTAS_NO_APP[l] ?? l),
  };
}

/** As cartas da fase (o álbum "ver todas"), como o app as lê. */
export function poolDeHojeNoApp(o: Parameters<typeof poolDeHoje>[0]): Carta[] {
  return poolDeHoje(o).map(cartaNoApp);
}

/**
 * O que a bolha diz na abertura da carta. As do site falavam do bebê no
 * masculino e afirmavam o que ele sente ("ele reconhece a sua voz" — no 1º
 * trimestre nem é verdade).
 */
export const FALAS_DA_CARTA_NO_APP: Readonly<Record<string, string>> = {
  "Essas palavras são suas. Lê pra ele com calma.":
    "Essas palavras são suas. Lê pro bebê com calma.",
  "Ele também gosta de ouvir sua voz de madrugada.":
    "Madrugada quietinha também é hora boa de ler baixinho.",
  "Antes de dormir, que tal ler pra ele?": "Antes de dormir, que tal ler pro bebê?",
  "Toda vez que você lê, ele reconhece a sua voz.":
    "Toda vez que você lê, é um minutinho só de vocês.",
};

export function falaDaBolhaNaCartaNoApp(o: Parameters<typeof falaDaBolhaNaCarta>[0]): string {
  const f = falaDaBolhaNaCarta(o);
  return FALAS_DA_CARTA_NO_APP[f] ?? f;
}

/**
 * A CARTA DO DIA SEM REPETIR DE UM DIA PARA O OUTRO.
 *
 * A régua do site (`cartaDoDia`) gira `dia % n` dentro do poço da fase. Na
 * troca de fase o poço muda, e a mesma carta pode cair em dois dias seguidos —
 * medido em 15/10/2026: dias 195 e 196 (semanas 27→28), "Pra você, que eu
 * ainda não vi". Quem abre o vínculo todo dia lia a mesma carta duas vezes.
 *
 * Aqui, SÓ no dia da colisão, entra outra carta do mesmo poço — diferente da
 * de ontem e da de amanhã. Todos os outros dias são os mesmos da régua do
 * site. A colisão só acontece na troca de fase (dentro de uma fase, dois dias
 * seguidos caem em posições vizinhas do poço), e uma fase dura semanas — então
 * ontem e amanhã nunca são, eles próprios, dias de colisão.
 *
 * Sem react-native aqui: é testado pelo bun.
 */
export function cartaDoDiaNoApp(o: {
  dia: number;
  semanas?: number | null;
  posParto?: boolean;
}): Carta {
  /* A semana de cada dia, como o app a calcula: na gestação, a do próprio
     dia; no pós-parto, a régua não usa semana. */
  const em = (dia: number) => ({
    dia,
    semanas: o.posParto ? (o.semanas ?? null) : semanaDoDia(dia),
    posParto: o.posParto,
  });
  const hoje = cartaDoDia(em(o.dia));
  if (o.dia <= D_MINIMO) return cartaNoApp(hoje);
  const ontem = cartaDoDia(em(o.dia - 1));
  if (hoje.id !== ontem.id) return cartaNoApp(hoje);

  const amanha = cartaDoDia(em(o.dia + 1));
  const pool = poolDeHoje(em(o.dia));
  const n = pool.length;
  const base = Math.abs(Math.floor(o.dia));
  for (let passo = 1; passo < n; passo++) {
    for (const k of [-passo, passo]) {
      const c = pool[(((base + k) % n) + n) % n];
      if (c.id !== ontem.id && c.id !== amanha.id) return cartaNoApp(c);
    }
  }
  return cartaNoApp(hoje);
}
