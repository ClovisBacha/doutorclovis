/**
 * A SESSÃO PARA DOIS — e por que ela é a coisa mais difícil de escrever do app.
 *
 * ─── O RISCO ────────────────────────────────────────────────────────────────
 *
 * Conteúdo de casal é o que mais dá errado no gênero, e sempre pelo mesmo
 * motivo: soa piegas. Uma voz pedindo que duas pessoas adultas "sintam o amor
 * fluindo entre vocês" faz um casal rir, se entreolhar e fechar o app — e
 * nunca mais abrir aquela aba. A defesa é ser CONCRETA: toda fala manda alguém
 * fazer uma coisa específica com as mãos, com o ar ou com a voz. Nada aqui
 * pede que ninguém SINTA nada.
 *
 * ─── E POR QUE ELA NÃO É DECORAÇÃO ──────────────────────────────────────────
 *
 * Isto é preparação de parto disfarçada de exercício de casal. As três coisas
 * que o acompanhante mais precisa saber na sala de parto estão aqui, treinadas
 * numa noite tranquila em vez de aprendidas no dia:
 *
 *  1. **Seguir o ritmo dela**, nunca impor o dele. Um acompanhante que respira
 *     mais rápido que a parturiente acelera a parturiente.
 *  2. **A pressão no sacro**. É a manobra manual com melhor evidência de
 *     alívio de dor lombar no trabalho de parto, e não custa nada. A mão tem
 *     de estar no lugar certo e a pressão tem de ser firme, não carinhosa.
 *  3. **A palavra combinada.** Uma âncora dita antes, para valer depois — em
 *     trabalho de parto ninguém aprende palavra nova.
 *
 * ─── A QUEM A VOZ FALA ──────────────────────────────────────────────────────
 *
 * O maior defeito das práticas para duas pessoas num aparelho só é ninguém
 * saber de quem é a vez. Por isso todo bloco carrega `alvo`, e a TELA mostra
 * isso em letra grande. Quem está ouvindo sabe, num relance, se a instrução
 * é para ela, para quem está com ela, ou para os dois.
 *
 * ⚠️ Nunca usamos "ele", "marido" ou "papai": o acompanhante pode ser o pai, a
 * companheira, a mãe dela ou a irmã. "Quem está com você" cobre todos, e é a
 * mesma palavra que o Modo Acompanhante do app já usa.
 */

export type Alvo = "ela" | "par" | "dois";

export type BlocoDoCasal = {
  /** Vira o nome do `.mp3`. Permanente. */
  id: string;
  texto: string;
  alvo: Alvo;
  /** Segundos de silêncio depois da fala — é neles que a prática acontece. */
  pausa: number;
  /** O que a tela desenha durante este bloco. */
  figura?: "respirar" | "mao-no-sacro" | "mao-na-barriga" | "palavra";
};

export const ROTULO_DO_ALVO: Record<Alvo, string> = {
  ela: "Para você",
  par: "Para quem está com você",
  dois: "Para vocês dois",
};

export const SESSAO_DO_CASAL: {
  titulo: string;
  sub: string;
  emoji: string;
  blocos: BlocoDoCasal[];
} = {
  titulo: "Para vocês dois",
  sub: "Dez minutos que valem no dia do parto",
  emoji: "🤲",
  blocos: [
    {
      id: "casal-01",
      alvo: "dois",
      pausa: 6,
      texto:
        "Antes de começar, deixem o celular apoiado em algum lugar, com o volume num nível em que os dois escutem sem esforço. Ninguém precisa segurar nada nos próximos dez minutos.",
    },
    {
      id: "casal-02",
      alvo: "dois",
      pausa: 8,
      texto:
        "Sentem-se um atrás do outro. Quem está grávida na frente, sentada no chão, na cama ou numa cadeira, do jeito que for confortável hoje. Quem está acompanhando fica atrás, perto o bastante para alcançar as costas dela sem esticar o braço.",
    },
    {
      id: "casal-03",
      alvo: "ela",
      pausa: 25,
      figura: "respirar",
      texto:
        "Agora só você. Feche os olhos se quiser. Respire do seu jeito, no seu ritmo — não tente respirar bonito, nem devagar demais. Só respire como o seu corpo está respirando agora.",
    },
    {
      id: "casal-04",
      alvo: "par",
      pausa: 30,
      figura: "respirar",
      texto:
        "Agora você. Olhe para os ombros dela e descubra o ritmo da respiração dela. Não diga nada. Só ajuste a sua respiração até que as duas fiquem iguais. Quem manda no ritmo é ela.",
    },
    {
      id: "casal-05",
      alvo: "par",
      pausa: 10,
      texto:
        "Isso que você está fazendo agora é a coisa mais útil que existe no trabalho de parto. Quando a hora chegar, ninguém vai lembrar de nenhuma técnica — mas o corpo dela vai seguir a respiração de quem estiver colado nela. Se você acelerar, ela acelera.",
    },
    {
      id: "casal-06",
      alvo: "par",
      pausa: 10,
      figura: "mao-no-sacro",
      texto:
        "Sem parar de respirar junto, encoste a palma da mão aberta na parte de baixo das costas dela. Bem embaixo, na base da coluna, logo acima do bumbum. É um ossinho chato, largo, do tamanho da sua palma.",
    },
    {
      id: "casal-07",
      alvo: "par",
      pausa: 30,
      figura: "mao-no-sacro",
      texto:
        "Empurre para dentro, com firmeza. Não é carinho: é pressão. Use o peso do seu corpo, não a força do braço, e mantenha. Enquanto ela solta o ar, empurre um pouco mais.",
    },
    {
      id: "casal-08",
      alvo: "ela",
      pausa: 15,
      texto:
        "Se a pressão estiver boa, não diga nada. Se estiver no lugar errado, leve essa mão com a sua até o ponto certo. É mais rápido que explicar, e é assim que vocês vão fazer no dia.",
    },
    {
      id: "casal-09",
      alvo: "dois",
      /* ⚠️ SESSENTA SEGUNDOS, e o número não é arredondamento: é a duração de
         uma contração de trabalho de parto ativo. O casal não está "ficando
         quieto um pouco" — está ensaiando uma contração inteira, com a mão no
         lugar e a respiração no ritmo. É o bloco mais importante da sessão, e
         era o mais curto antes desta correção. */
      pausa: 60,
      figura: "mao-no-sacro",
      texto:
        "Fiquem assim por algumas respirações. A mão firme, o ar saindo devagar. Não precisa conversar.",
    },
    {
      id: "casal-10",
      alvo: "par",
      pausa: 12,
      figura: "mao-na-barriga",
      texto:
        "Agora solte as costas e leve as duas mãos para a barriga dela, uma de cada lado, sem apertar. Fique aí um instante, só apoiando o peso das mãos.",
    },
    {
      id: "casal-11",
      alvo: "par",
      pausa: 30,
      figura: "mao-na-barriga",
      texto:
        "Diga alguma coisa em voz alta. Não precisa ser bonito, e não precisa ser para mais ninguém além de vocês. Diga o nome, ou diga o que você fez hoje. O bebê já reconhece a sua voz há semanas, e reconhece porque você fala perto — não porque você fala bonito.",
    },
    {
      id: "casal-12",
      alvo: "dois",
      pausa: 20,
      figura: "palavra",
      texto:
        "Agora escolham uma palavra. Uma só, curta, que não signifique nada de especial: uma cor, uma fruta, o nome de uma rua. Digam essa palavra um para o outro, em voz alta, uma vez.",
    },
    {
      id: "casal-13",
      alvo: "dois",
      pausa: 10,
      figura: "palavra",
      texto:
        "Essa palavra passa a querer dizer uma coisa só: pare tudo e volte a respirar comigo. Ela serve na sala de parto, e serve amanhã no meio de uma discussão boba. Palavra combinada antes funciona; palavra inventada na hora, não.",
    },
    {
      id: "casal-14",
      alvo: "ela",
      pausa: 12,
      texto:
        "Volte a atenção para o seu próprio corpo por um instante. Repare no lugar onde a mão esteve, e em como as costas ficaram depois.",
    },
    {
      id: "casal-15",
      alvo: "dois",
      pausa: 8,
      texto:
        "Vocês acabaram de treinar as três coisas que mais funcionam no dia: a respiração de um seguindo a do outro, a pressão nas costas, e a palavra. Podem repetir isso numa noite qualquer. Cinco minutos por semana já bastam.",
    },
    {
      id: "casal-16",
      alvo: "dois",
      pausa: 10,
      texto: "Por hoje é isso. Podem ficar em silêncio mais um pouco, se quiserem.",
    },
  ],
};

/** Quanto tempo leva, em minutos (narração a 138 ppm + as pausas). */
export function duracaoDaSessaoDoCasal(): number {
  const palavras = SESSAO_DO_CASAL.blocos.reduce((s, b) => s + b.texto.split(/\s+/).length, 0);
  const pausas = SESSAO_DO_CASAL.blocos.reduce((s, b) => s + b.pausa, 0);
  return Math.round(palavras / 138 + pausas / 60);
}
