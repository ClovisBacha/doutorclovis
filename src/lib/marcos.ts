/**
 * OS MARCOS — o assunto que existe DEPOIS da barriga.
 *
 * ⚠️ **É A METADE PRÁTICA DO "A ABA NÃO MORRE", e ela resolve um problema que
 * não é de tecnologia: a mãe para de publicar porque não tem o que dizer.**
 *
 * A gestante tem assunto pronto — a semana muda sozinha toda terça, a fruta
 * troca, o app avisa. A mãe de um bebê de sete meses não tem nenhum: ninguém
 * lhe diz "hoje é um dia diferente", e o silêncio dela não é falta de vontade,
 * é falta de deixa. O marco devolve o calendário.
 *
 * ⚠️ **O MESVERSÁRIO É O CENTRO DISTO, e é uma tradição brasileira.** Foto
 * mensal do bebê com o número do mês, todo dia do mês que ele nasceu. Nenhum
 * aplicativo de gestação estrangeiro tem isso, e no Brasil é a coisa que as
 * mães mais publicam no primeiro ano.
 *
 * ⚠️ **A IDADE VAI EM DIAS, NUNCA EM TEXTO.** "3 meses" gravado num post
 * continuaria dizendo "3 meses" daqui a um ano. Com os dias, a tela recalcula
 * — e o post velho continua contando a idade certa daquele dia.
 */

/** Um marco do catálogo. */
export type Marco = {
  /** Chave gravada no banco. ⚠️ NUNCA renomeie: está em `rede_posts.marco_tipo`. */
  id: string;
  emoji: string;
  titulo: string;
  /**
   * A faixa em que ele costuma acontecer, em meses. Serve para SUGERIR, nunca
   * para impedir.
   *
   * ⚠️ **NENHUM MARCO É BLOQUEADO FORA DA FAIXA.** Bebê prematuro, bebê com
   * síndrome, bebê que andou com nove meses ou com vinte — a faixa é a média de
   * uma população, e a mãe que está ali não é uma média. Um app que recusasse
   * "primeiros passos" aos 20 meses estaria dizendo a ela que o filho está
   * errado.
   */
  de: number;
  ate: number;
};

/**
 * O catálogo.
 *
 * ⚠️ **NADA AQUI É COMPARATIVO NEM CLÍNICO.** Não há "já deveria", não há
 * percentil, não há "atrasado". São acontecimentos para celebrar, e a diferença
 * entre celebrar e avaliar é a diferença entre esta aba ser um álbum ou virar
 * uma régua de desenvolvimento — que é trabalho do pediatra, não nosso.
 */
export const MARCOS: Marco[] = [
  { id: "mesversario", emoji: "🎂", titulo: "Mesversário", de: 1, ate: 24 },
  { id: "primeira_noite", emoji: "🌙", titulo: "Primeira noite em casa", de: 0, ate: 1 },
  { id: "coto", emoji: "🩹", titulo: "O coto caiu", de: 0, ate: 2 },
  { id: "sorriso", emoji: "😊", titulo: "Primeiro sorriso", de: 1, ate: 4 },
  { id: "sustentou", emoji: "🙆", titulo: "Sustentou a cabeça", de: 2, ate: 5 },
  { id: "rolou", emoji: "🔄", titulo: "Rolou sozinho", de: 3, ate: 7 },
  { id: "papinha", emoji: "🥄", titulo: "Primeira papinha", de: 5, ate: 8 },
  { id: "dente", emoji: "🦷", titulo: "Primeiro dente", de: 4, ate: 12 },
  { id: "sentou", emoji: "🪑", titulo: "Sentou sozinho", de: 5, ate: 9 },
  { id: "engatinhou", emoji: "🐛", titulo: "Engatinhou", de: 6, ate: 12 },
  { id: "palavra", emoji: "💬", titulo: "Primeira palavra", de: 8, ate: 18 },
  { id: "andou", emoji: "👣", titulo: "Primeiros passos", de: 9, ate: 20 },
  { id: "aniversario", emoji: "🎉", titulo: "Primeiro aniversário", de: 12, ate: 12 },
  /* ⚠️ Fora de faixa de propósito: acontecem quando acontecem. */
  { id: "passeio", emoji: "🌳", titulo: "Primeiro passeio", de: 0, ate: 24 },
  { id: "banho", emoji: "🛁", titulo: "Primeiro banho", de: 0, ate: 24 },
  { id: "vovo", emoji: "👵", titulo: "Conheceu a vovó", de: 0, ate: 24 },
];

export const MARCO_POR_ID: Record<string, Marco> = Object.fromEntries(MARCOS.map((m) => [m.id, m]));

/**
 * Os marcos que fazem sentido AGORA, os da faixa primeiro.
 *
 * ⚠️ **A LISTA NUNCA ESCONDE NADA — ela só REORDENA.** Ver o comentário de
 * `de`/`ate`: um bebê que anda aos vinte meses não pode encontrar a tela sem a
 * opção "primeiros passos". O que muda é o que aparece no topo.
 */
export function marcosSugeridos(idadeEmMeses: number): Marco[] {
  const dentro = MARCOS.filter((m) => idadeEmMeses >= m.de && idadeEmMeses <= m.ate);
  const fora = MARCOS.filter((m) => !dentro.includes(m));
  /* Dentro da faixa, os mais estreitos primeiro: "primeiro dente" (4–12) é uma
     aposta pior que "sentou" (5–9) para um bebê de 6 meses. */
  dentro.sort((a, b) => a.ate - a.de - (b.ate - b.de));
  return [...dentro, ...fora];
}

/**
 * ⚠️ HOJE É MESVERSÁRIO? — e o dia 31 é o caso que quebra.
 *
 * Um bebê que nasceu em 31 de janeiro não tem "dia 31" em fevereiro, abril,
 * junho, setembro nem novembro. Sem tratar isso, ele ficaria sem mesversário em
 * cinco meses do ano — e a mãe repararia. O último dia do mês vale.
 */
export function mesversarioDeHoje(nascidoEm: string, hoje: string): number | null {
  const n = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nascidoEm);
  const h = /^(\d{4})-(\d{2})-(\d{2})$/.exec(hoje);
  if (!n || !h) return null;

  const [na, nm, nd] = [Number(n[1]), Number(n[2]), Number(n[3])];
  const [ha, hm, hd] = [Number(h[1]), Number(h[2]), Number(h[3])];

  const meses = (ha - na) * 12 + (hm - nm);
  if (meses < 1 || meses > 24) return null;

  /* Quantos dias tem o mês de hoje: `Date.UTC(ano, mês, 0)` devolve o último
     dia do mês anterior, então mês+1 com dia 0 é o último dia deste. */
  const ultimoDoMes = new Date(Date.UTC(ha, hm, 0)).getUTCDate();
  const diaQueVale = Math.min(nd, ultimoDoMes);
  return hd === diaQueVale ? meses : null;
}

/**
 * O texto que acompanha o marco no post.
 *
 * ⚠️ Recebe a idade em DIAS (o que o banco guarda) e a converte na hora — é o
 * que faz um post de um ano atrás continuar dizendo a idade daquele dia.
 */
export function textoDoMarco(tipo: string, dias: number | null): string | null {
  const m = MARCO_POR_ID[tipo];
  if (!m) return null;
  if (dias === null || dias < 0) return `${m.emoji} ${m.titulo}`;

  if (tipo === "mesversario") {
    const meses = Math.round(dias / 30.44);
    if (meses >= 1) return `${m.emoji} ${meses} ${meses === 1 ? "mês" : "meses"}`;
  }
  if (dias < 30) return `${m.emoji} ${m.titulo} · ${dias} ${dias === 1 ? "dia" : "dias"}`;
  const meses = Math.floor(dias / 30.44);
  return `${m.emoji} ${m.titulo} · ${meses} ${meses === 1 ? "mês" : "meses"}`;
}
