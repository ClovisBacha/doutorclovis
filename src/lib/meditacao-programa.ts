/**
 * OS SETE PRIMEIROS DIAS — o programa que ensina a meditar.
 *
 * ─── O PROBLEMA QUE ELE RESOLVE ────────────────────────────────────────────
 *
 * Abrir a meditação hoje é responder quatro perguntas antes de qualquer coisa
 * acontecer: duração, tema, som e densidade de voz. Para quem nunca meditou,
 * "o que você precisa agora?" é uma pergunta difícil — ela não sabe, e é
 * justamente por não saber que está ali. Quatro decisões viram quatro chances
 * de fechar o app.
 *
 * O programa troca o menu por um caminho: sete sessões em ORDEM, cada uma
 * ensinando uma coisa e sendo um pouco menos guiada que a anterior. Ela não
 * escolhe nada — toca em "Começar" e começa. No sétimo dia o cartão some
 * sozinho e a tela volta a ser o menu, agora com uma pessoa que sabe escolher.
 *
 * É a estrutura que faz o Headspace ser o app mais recomendado para
 * iniciante, e a pesquisa é clara sobre por quê: para quem está começando o
 * gargalo não é profundidade, é HÁBITO — cinco minutos todo dia superam trinta
 * minutos duas vezes por semana.
 *
 * ─── ⚠️ O PROGRAMA NÃO É A SEQUÊNCIA, E OS DOIS NUNCA SE AMARRAM ───────────
 *
 * A sequência (a chama) é de CALENDÁRIO: dias seguidos, e quebra se ela pular.
 * O programa é de ORDEM: Dia 1, 2, 3, independente de quando.
 *
 * Amarrar os dois — "perdeu um dia, volta pro Dia 1" — faria o app punir a
 * gestante de alto risco que passou a noite no hospital tirando dela o que já
 * aprendeu. E há evidência de que seria contraproducente: falhar UMA vez quase
 * não afeta a formação de um hábito; falhar DUAS SEGUIDAS é onde ele
 * desmorona. Um programa que reinicia transforma uma falha em duas.
 *
 * O fluxo é de mão única: fazer o dia do programa ACENDE a chama (é uma
 * meditação como outra qualquer). A chama nunca decide qual dia vem a seguir.
 *
 * ─── COMO ELE REAPROVEITA TUDO ─────────────────────────────────────────────
 *
 * Cada dia é um TEMA (`prog-1` … `prog-7`) para `planejarSessao`. Com isso o
 * acolhimento, a ancoragem, as rechamadas, a volta ao corpo e o fechamento
 * saem do mesmo banco de 149 falas que já existe — o que é novo é só o "hoje a
 * gente vai treinar isto" de cada dia.
 */

import type { Densidade } from "./meditacao-sessao";
import type { Fala } from "./meditacao-roteiros";

export type DiaDoPrograma = {
  dia: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  /** O tema que `planejarSessao` recebe. Casa com o `tema` das falas abaixo. */
  tema: string;
  minutos: number;
  /** O que aparece no cartão. É a promessa do dia, na voz da paciente. */
  titulo: string;
  sub: string;
  densidade: Densidade;
};

/**
 * ⚠️ A DURAÇÃO CRESCE E A VOZ DIMINUI, nesta ordem e de propósito.
 *
 * Três minutos no primeiro dia porque a barreira do iniciante é começar, não
 * aguentar. Dez no sétimo porque a essa altura ela aguenta. E a densidade cai
 * de "guiada" para "pouca voz" nos dois últimos: é o silêncio crescendo, que é
 * o que o programa está ensinando a suportar.
 */
export const PROGRAMA: DiaDoPrograma[] = [
  {
    dia: 1,
    tema: "prog-1",
    minutos: 3,
    titulo: "Só sentar",
    sub: "Três minutos. Não precisa esvaziar a cabeça",
    densidade: "guiada",
  },
  {
    dia: 2,
    tema: "prog-2",
    minutos: 3,
    titulo: "O ar como âncora",
    sub: "Três minutos. Um lugar para onde voltar",
    densidade: "guiada",
  },
  {
    dia: 3,
    tema: "prog-3",
    minutos: 5,
    titulo: "O corpo inteiro",
    sub: "Cinco minutos. De baixo para cima, sem pressa",
    densidade: "guiada",
  },
  {
    dia: 4,
    tema: "prog-4",
    minutos: 5,
    titulo: "A cabeça vai embora — e voltar é o exercício",
    sub: "Cinco minutos. A voz vai ficando mais rara",
    densidade: "guiada",
  },
  {
    dia: 5,
    tema: "prog-5",
    minutos: 7,
    titulo: "O silêncio cresce",
    sub: "Sete minutos, e mais espaço entre as frases",
    densidade: "guiada",
  },
  {
    dia: 6,
    tema: "prog-6",
    minutos: 7,
    titulo: "Levar para fora",
    sub: "Sete minutos. O que serve na fila do mercado",
    densidade: "pouca",
  },
  {
    dia: 7,
    tema: "prog-7",
    minutos: 10,
    titulo: "Sozinha",
    sub: "Dez minutos, quase sem voz. Depois deste, o menu é seu",
    densidade: "pouca",
  },
];

/**
 * As falas de ensino de cada dia.
 *
 * Seis por dia, com peso caindo: as duas de peso 3 entram até na sessão de
 * três minutos, as de 1 só nas de sete e dez. É o mesmo mecanismo que faz o
 * banco servir quatro durações — aqui ele faz o dia curto ensinar o essencial
 * e o dia longo ensinar por inteiro.
 *
 * ⚠️ Elas seguem as mesmas quatro regras do resto do banco: nunca cobra,
 * convida em vez de mandar, não promete clínica, e fala com uma pessoa. Um
 * programa é o lugar mais fácil de escorregar para o tom de professor — e
 * professor é exatamente o que ninguém quer às onze da noite.
 */
export const FALAS_DO_PROGRAMA: Fala[] = [
  // ── Dia 1 · Só sentar ───────────────────────────────────────────────────
  {
    id: "prog-1-1",
    tema: "prog-1",
    variacao: 1,
    momento: "corpo",
    peso: 3,
    texto: "Hoje a gente só senta. Não tem nada para conseguir, e não existe fazer isto errado.",
  },
  {
    id: "prog-1-2",
    tema: "prog-1",
    variacao: 1,
    momento: "corpo",
    peso: 3,
    texto: "Meditar não é esvaziar a cabeça. Ninguém consegue isso — nem quem faz há vinte anos.",
  },
  {
    id: "prog-1-3",
    tema: "prog-1",
    variacao: 1,
    momento: "corpo",
    peso: 2,
    texto: "Os pensamentos vão continuar vindo. Deixe. Eles não estragam nada.",
  },
  {
    id: "prog-1-4",
    tema: "prog-1",
    variacao: 1,
    momento: "corpo",
    peso: 2,
    texto: "O que você está treinando é ficar. Só isso, por enquanto.",
  },
  {
    id: "prog-1-5",
    tema: "prog-1",
    variacao: 1,
    momento: "corpo",
    peso: 1,
    texto: "Se der vontade de levantar, repare na vontade e fique mais um pouco.",
  },
  {
    id: "prog-1-6",
    tema: "prog-1",
    variacao: 1,
    momento: "corpo",
    peso: 1,
    texto: "Amanhã são outros três minutos. Um dia de cada vez.",
  },

  // ── Dia 2 · O ar como âncora ────────────────────────────────────────────
  {
    id: "prog-2-1",
    tema: "prog-2",
    variacao: 1,
    momento: "corpo",
    peso: 3,
    texto: "Ontem você só sentou. Hoje a gente escolhe um lugar para a atenção morar: o ar.",
  },
  {
    id: "prog-2-2",
    tema: "prog-2",
    variacao: 1,
    momento: "corpo",
    peso: 3,
    texto: "Repare onde você sente a respiração mais claramente. No nariz, no peito ou na barriga.",
  },
  {
    id: "prog-2-3",
    tema: "prog-2",
    variacao: 1,
    momento: "corpo",
    peso: 2,
    texto: "Fique nesse ponto. Quando a cabeça sair, é para ele que você volta.",
  },
  {
    id: "prog-2-4",
    tema: "prog-2",
    variacao: 1,
    momento: "corpo",
    peso: 2,
    texto: "Não precisa respirar diferente. Só reparar no que já está acontecendo.",
  },
  {
    id: "prog-2-5",
    tema: "prog-2",
    variacao: 1,
    momento: "corpo",
    peso: 1,
    texto: "A âncora não segura o barco parado. Ela só impede que ele vá longe demais.",
  },
  {
    id: "prog-2-6",
    tema: "prog-2",
    variacao: 1,
    momento: "corpo",
    peso: 1,
    texto: "Esse ponto está com você o dia inteiro, de graça.",
  },

  // ── Dia 3 · O corpo inteiro ─────────────────────────────────────────────
  {
    id: "prog-3-1",
    tema: "prog-3",
    variacao: 1,
    momento: "corpo",
    peso: 3,
    texto: "Hoje a gente vai passar pelo corpo inteiro, devagar. Comece pelos pés.",
  },
  {
    id: "prog-3-2",
    tema: "prog-3",
    variacao: 1,
    momento: "corpo",
    peso: 3,
    texto: "Suba pelas pernas. Não precisa mudar nada do que encontrar — só reparar.",
  },
  {
    id: "prog-3-3",
    tema: "prog-3",
    variacao: 1,
    momento: "corpo",
    peso: 2,
    texto: "Quadril, costas, ombros. Onde estiver duro, respire para dentro dali.",
  },
  {
    id: "prog-3-4",
    tema: "prog-3",
    variacao: 1,
    momento: "corpo",
    peso: 2,
    texto: "Braços, mãos, dedos. E o rosto, que guarda o dia sem a gente pedir.",
  },
  {
    id: "prog-3-5",
    tema: "prog-3",
    variacao: 1,
    momento: "corpo",
    peso: 1,
    texto: "Agora o corpo todo de uma vez, como uma coisa só.",
  },
  {
    id: "prog-3-6",
    tema: "prog-3",
    variacao: 1,
    momento: "corpo",
    peso: 1,
    texto: "Esta varredura serve deitada, na cama, quando o sono não vem.",
  },

  // ── Dia 4 · A cabeça vai embora ─────────────────────────────────────────
  {
    id: "prog-4-1",
    tema: "prog-4",
    variacao: 1,
    momento: "corpo",
    peso: 3,
    texto: "Hoje o assunto é a distração. Ela vai acontecer, e é sobre ela o exercício.",
  },
  {
    id: "prog-4-2",
    tema: "prog-4",
    variacao: 1,
    momento: "corpo",
    peso: 3,
    texto:
      "Quando você perceber que foi embora, você já voltou. Esse instante é a meditação inteira.",
  },
  {
    id: "prog-4-3",
    tema: "prog-4",
    variacao: 1,
    momento: "corpo",
    peso: 2,
    texto: "Não precisa se irritar com a cabeça. Vagar é o trabalho dela.",
  },
  {
    id: "prog-4-4",
    tema: "prog-4",
    variacao: 1,
    momento: "corpo",
    peso: 2,
    texto: "Cem vezes que ela sair, cem vezes que você volta. Isso é uma boa sessão.",
  },
  {
    id: "prog-4-5",
    tema: "prog-4",
    variacao: 1,
    momento: "corpo",
    peso: 1,
    texto: "Repare, sem brigar, para onde ela costuma ir. Só repare.",
  },
  {
    id: "prog-4-6",
    tema: "prog-4",
    variacao: 1,
    momento: "corpo",
    peso: 1,
    texto: "A partir de agora eu vou falar menos. Você já sabe voltar.",
  },

  // ── Dia 5 · O silêncio cresce ───────────────────────────────────────────
  {
    id: "prog-5-1",
    tema: "prog-5",
    variacao: 1,
    momento: "corpo",
    peso: 3,
    texto: "Hoje tem mais silêncio, e o silêncio é a parte que treina.",
  },
  {
    id: "prog-5-2",
    tema: "prog-5",
    variacao: 1,
    momento: "corpo",
    peso: 3,
    texto: "Quando eu calar, continue. A respiração segue sem instrução.",
  },
  {
    id: "prog-5-3",
    tema: "prog-5",
    variacao: 1,
    momento: "corpo",
    peso: 2,
    texto: "Se ficar desconfortável, é só desconforto. Ele passa sem você fazer nada.",
  },
  {
    id: "prog-5-4",
    tema: "prog-5",
    variacao: 1,
    momento: "corpo",
    peso: 2,
    texto: "Você não está esperando o fim. Você está aqui.",
  },
  {
    id: "prog-5-5",
    tema: "prog-5",
    variacao: 1,
    momento: "corpo",
    peso: 1,
    texto: "Repare em como o corpo já sabe o ritmo, sem ninguém contar.",
  },
  {
    id: "prog-5-6",
    tema: "prog-5",
    variacao: 1,
    momento: "corpo",
    peso: 1,
    texto: "Mais um pouco de silêncio. Ele é seu.",
  },

  // ── Dia 6 · Levar para fora ─────────────────────────────────────────────
  {
    id: "prog-6-1",
    tema: "prog-6",
    variacao: 1,
    momento: "corpo",
    peso: 3,
    texto: "Hoje a gente treina o que serve fora daqui — na fila, no ônibus, na sala de espera.",
  },
  {
    id: "prog-6-2",
    tema: "prog-6",
    variacao: 1,
    momento: "corpo",
    peso: 3,
    texto: "Três respirações lentas, de olhos abertos, sem ninguém perceber. É isso.",
  },
  {
    id: "prog-6-3",
    tema: "prog-6",
    variacao: 1,
    momento: "corpo",
    peso: 2,
    texto: "Não precisa de tapete, nem de silêncio, nem de tempo. Precisa de lembrar.",
  },
  {
    id: "prog-6-4",
    tema: "prog-6",
    variacao: 1,
    momento: "corpo",
    peso: 2,
    texto: "Escolha um momento do seu dia para isso. A porta do consultório serve bem.",
  },
  {
    id: "prog-6-5",
    tema: "prog-6",
    variacao: 1,
    momento: "corpo",
    peso: 1,
    texto: "O corpo aprende por repetição, não por esforço.",
  },
  {
    id: "prog-6-6",
    tema: "prog-6",
    variacao: 1,
    momento: "corpo",
    peso: 1,
    texto: "Um minuto na hora certa vale mais que dez na hora errada.",
  },

  // ── Dia 7 · Sozinha ─────────────────────────────────────────────────────
  {
    id: "prog-7-1",
    tema: "prog-7",
    variacao: 1,
    momento: "corpo",
    peso: 3,
    texto: "Último dia do começo. Dez minutos, e eu vou falar pouco.",
  },
  {
    id: "prog-7-2",
    tema: "prog-7",
    variacao: 1,
    momento: "corpo",
    peso: 3,
    texto: "Você já tem tudo: a âncora, o corpo, e o voltar. Use do jeito que quiser.",
  },
  {
    id: "prog-7-3",
    tema: "prog-7",
    variacao: 1,
    momento: "corpo",
    peso: 2,
    texto: "Daqui pra frente você escolhe o tempo e o tema. O caminho é seu.",
  },
  {
    id: "prog-7-4",
    tema: "prog-7",
    variacao: 1,
    momento: "corpo",
    peso: 2,
    texto: "Sete dias não fazem de ninguém uma meditadora. Fazem uma pessoa que sabe começar.",
  },
  {
    id: "prog-7-5",
    tema: "prog-7",
    variacao: 1,
    momento: "corpo",
    peso: 1,
    texto: "Se um dia isto ficar chato, mude o tema. Se ficar difícil, encurte.",
  },
  {
    id: "prog-7-6",
    tema: "prog-7",
    variacao: 1,
    momento: "corpo",
    peso: 1,
    texto: "Eu continuo aqui, todo dia, no tempo que você tiver.",
  },
];

/** Onde o dia atual do programa é guardado. */
export const CHAVE_DO_PROGRAMA = "dc-path-med-programa";

/**
 * O dia que ela deve fazer agora — ou `null` quando o programa acabou.
 *
 * ⚠️ `feitos` é a CONTAGEM de dias do programa concluídos, e não a data de
 * nada. É o que mantém o programa independente do calendário: ela sumiu uma
 * semana e volta no dia onde parou.
 */
export function diaDoPrograma(feitos: number): DiaDoPrograma | null {
  const i = Math.max(0, Math.floor(feitos));
  return i < PROGRAMA.length ? PROGRAMA[i] : null;
}

/** O prefixo dos temas do programa — usado para não misturá-los com o menu. */
export const PREFIXO_PROGRAMA = "prog-";

export function ehTemaDoPrograma(tema: string): boolean {
  return tema.startsWith(PREFIXO_PROGRAMA);
}
