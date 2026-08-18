/**
 * AS FRALDAS DO CHÁ DE BEBÊ — a régua, sem JSX e sem banco.
 *
 * ─── O ERRO UNIVERSAL, QUANTIFICADO ────────────────────────────────────────
 *
 * Todo chá de bebê do Brasil erra da mesma maneira: **sobra RN e P, falta M e
 * G**. A reclamação está em todo blog de maternidade — "muitas mães acabam
 * doando fraldas pequenas que nem chegaram a usar".
 *
 * Não é falta de bom senso de quem dá. É que RN é o tamanho que a palavra
 * "bebê" evoca, e é o que está estampado na embalagem. Os números:
 *
 * | tamanho | dura            | volume no 1º ano | % do total |
 * | ------- | --------------- | ---------------- | ---------- |
 * | RN      | 2 a 3 SEMANAS   | ~150–200         | ~6 %       |
 * | P       | ~2 meses        | ~450–500         | ~19 %      |
 * | M       | 3º ao 7º mês    | ~900             | ~37 %      |
 * | G       | 8º ao 13º mês   | ~700             | ~29 %      |
 * | XG      | depois          | resto            | ~9 %       |
 *
 * **M e G são dois terços do volume do ano e quase ninguém dá.** Eles chegam
 * quando o chá já acabou e a mãe está pagando sozinha — no mês em que a renda
 * da casa caiu porque ela parou de trabalhar.
 *
 * ─── POR QUE O TETO DE RN É A PEÇA CENTRAL ─────────────────────────────────
 *
 * RN é o único tamanho que pode durar ZERO dias. Um bebê que nasce com 3,8 kg
 * usa RN por uns dez dias; um de 2,8 kg usa por dois meses. Não há como saber
 * antes, e o excedente de RN é o único presente do chá que literalmente não
 * tem uso — não dá para guardar para depois, porque "depois" o bebê é maior.
 *
 * Por isso `tetoPacotes` existe e por isso RN tem 6. Seis pacotes são 180
 * fraldas, que cobrem o pior caso realista. Acima disso o servidor RECUSA a
 * reserva — não é a tela que esconde, é a régua que diz não.
 *
 * ⚠️ **Sem o teto, o recurso não existe.** Uma lista que mostra "RN completo ✓"
 * e deixa a próxima amiga reservar RN assim mesmo reproduz o erro universal com
 * um contador bonito por cima.
 */

export type TamanhoFralda = "RN" | "P" | "M" | "G" | "XG";

export type FaixaDeFralda = {
  tamanho: TamanhoFralda;
  pesoMinGramas: number;
  pesoMaxGramas: number;
  /** Trocas por dia nessa fase. */
  porDiaMin: number;
  porDiaMax: number;
  /** Dias de vida que a fase costuma cobrir. */
  diaInicio: number;
  diaFim: number;
  /** Meta do CHÁ, em pacotes. Não é a necessidade do ano — ver `TOTAL_*`. */
  metaPacotes: number;
  /** Acima disto o servidor recusa. `null` = sem teto. */
  tetoPacotes: number | null;
};

/** Fraldas por pacote. Média de mercado; a conta inteira é em PACOTES. */
export const UNIDADES_POR_PACOTE = 30;

export const FAIXAS: FaixaDeFralda[] = [
  {
    tamanho: "RN",
    pesoMinGramas: 0,
    pesoMaxGramas: 4500,
    porDiaMin: 8,
    porDiaMax: 10,
    diaInicio: 0,
    diaFim: 21,
    metaPacotes: 4,
    tetoPacotes: 6,
  },
  {
    tamanho: "P",
    pesoMinGramas: 4000,
    pesoMaxGramas: 8000,
    porDiaMin: 7,
    porDiaMax: 9,
    diaInicio: 14,
    diaFim: 75,
    metaPacotes: 10,
    tetoPacotes: 14,
  },
  {
    tamanho: "M",
    pesoMinGramas: 5000,
    pesoMaxGramas: 9000,
    porDiaMin: 5,
    porDiaMax: 7,
    diaInicio: 75,
    diaFim: 210,
    metaPacotes: 18,
    tetoPacotes: null,
  },
  {
    tamanho: "G",
    pesoMinGramas: 9000,
    pesoMaxGramas: 12000,
    porDiaMin: 4,
    porDiaMax: 5,
    diaInicio: 210,
    diaFim: 390,
    metaPacotes: 12,
    tetoPacotes: null,
  },
  {
    tamanho: "XG",
    pesoMinGramas: 12000,
    pesoMaxGramas: 15000,
    porDiaMin: 4,
    porDiaMax: 4,
    diaInicio: 390,
    diaFim: 540,
    metaPacotes: 4,
    tetoPacotes: null,
  },
];

/**
 * O chá cobre ~8 meses, NÃO o ano — e a tela diz isso.
 *
 * Um bebê usa 2.000 a 2.500 fraldas no primeiro ano (90 a 100 pacotes). Pedir
 * isso num chá é pedir a uma rede de 30 pessoas que banque a fralda inteira do
 * ano, e a lista viraria um orçamento. As metas somam bem menos de propósito.
 *
 * Os dois números existem para o TESTE travar: se alguém dobrar uma meta sem
 * perceber, a soma sai da faixa e o teste reprova antes de a lista chegar na
 * mão de trinta pessoas.
 */
export const TOTAL_MINIMO_DE_FRALDAS = 1200;
export const TOTAL_MAXIMO_DE_FRALDAS = 1600;

export const TAMANHOS: TamanhoFralda[] = FAIXAS.map((f) => f.tamanho);

export function faixaDe(tamanho: TamanhoFralda): FaixaDeFralda {
  const f = FAIXAS.find((x) => x.tamanho === tamanho);
  if (!f) throw new Error(`tamanho de fralda desconhecido: ${tamanho}`);
  return f;
}

/**
 * A meta em pacotes por tamanho.
 *
 * ⚠️ **Sem peso estimado, devolve a TABELA PADRÃO — nunca o mínimo.** É a mesma
 * lição de `escalaDaArvore` devolver 1 sem semana conhecida: um valor mínimo
 * inesperado lê como recurso quebrado, e aqui faria a lista pedir uma fralda RN
 * a uma paciente cujo bebê pode muito bem nascer pequeno.
 *
 * Com peso estimado alto, RN cai. Um bebê que já está projetado para 3,9 kg vai
 * usar RN por poucos dias, e é o único ajuste que a biometria fetal permite
 * fazer com honestidade — os outros tamanhos dependem de curva de crescimento
 * pós-natal, que ninguém sabe antes.
 */
export function metaDeFraldas(opts?: {
  pesoEstimadoGramas?: number | null;
}): Record<TamanhoFralda, number> {
  const base = {} as Record<TamanhoFralda, number>;
  for (const f of FAIXAS) base[f.tamanho] = f.metaPacotes;

  const peso = opts?.pesoEstimadoGramas;
  if (peso != null && Number.isFinite(peso) && peso >= 3700) {
    /* Bebê grande: RN vira questão de dias. Dois pacotes é o que se usa numa
       maternidade e na primeira semana em casa. */
    base.RN = Math.min(base.RN, 2);
  }
  return base;
}

export type SaldoDeFralda = {
  tamanho: TamanhoFralda;
  meta: number;
  reservado: number;
  /** Nunca negativo. */
  falta: number;
  /** Pode passar de 1 nos tamanhos sem teto — a legenda diz "20 de 18". */
  fracao: number;
  cheio: boolean;
};

/** O que ainda falta, por tamanho. */
export function saldoDeFraldas(
  meta: Record<TamanhoFralda, number>,
  reservado: Partial<Record<TamanhoFralda, number>>,
): SaldoDeFralda[] {
  return TAMANHOS.map((tamanho) => {
    const m = Math.max(0, meta[tamanho] ?? 0);
    const r = Math.max(0, reservado[tamanho] ?? 0);
    return {
      tamanho,
      meta: m,
      reservado: r,
      falta: Math.max(0, m - r),
      fracao: m > 0 ? r / m : 1,
      cheio: r >= m,
    };
  });
}

/**
 * ⚠️ **A ORDEM DA PÁGINA PÚBLICA, e ela é o recurso.**
 *
 * Se a lista mostrar RN · P · M · G · XG, a amiga toca no primeiro e o erro
 * universal se reproduz inteiro — com um contador bonito por cima. A ordem é
 * por CARÊNCIA: quem está mais longe da meta aparece primeiro.
 *
 * ⚠️ **O empate desce para a MAIOR META, e não para o maior tamanho.** A
 * primeira versão desempatava por tamanho, e a bancada mostrou o resultado: com
 * a lista zerada, o primeiro cartão era **XG** — um tamanho que o bebê só usa
 * depois de um ano, aberto num chá que acontece na 32ª semana. Estava certo na
 * letra ("na dúvida, empurra o que dura mais") e errado no espírito.
 *
 * A meta já É a régua de volume: M tem 18 pacotes porque M é 37% do ano. Ordenar
 * por ela põe M e G na frente, que é exatamente a mensagem clínica que a lista
 * existe para passar — e sem precisar de uma segunda tabela que um dia
 * discordaria da primeira.
 */
export function ordemDeUrgencia(saldos: SaldoDeFralda[]): TamanhoFralda[] {
  return [...saldos]
    .sort((a, b) => {
      if (a.fracao !== b.fracao) return a.fracao - b.fracao;
      return b.meta - a.meta;
    })
    .map((s) => s.tamanho);
}

export type RecusaDeFralda = {
  ok: false;
  motivo: "acima-do-teto" | "quantidade-invalida";
  maximo: number;
};

/**
 * O SERVIDOR pergunta isto antes de gravar.
 *
 * ⚠️ **Recusa por INTEIRO, nunca trunca.** Truncar faria a amiga sair achando
 * que deu quatro pacotes enquanto o app registrou dois — e ela descobriria no
 * chá, na frente de todo mundo. Melhor recusar e dizer o máximo.
 *
 * ⚠️ E isto é conferido no servidor, não só na vitrine. Cadeado que só existe
 * na tela é decoração — a mesma lição que `cantinho.functions.ts` já pagou com
 * o gate de troféus.
 */
export function podeReservarFralda(
  faixa: FaixaDeFralda,
  jaReservado: number,
  pedido: number,
): { ok: true } | RecusaDeFralda {
  if (!Number.isInteger(pedido) || pedido < 1) {
    return { ok: false, motivo: "quantidade-invalida", maximo: 0 };
  }
  if (faixa.tetoPacotes == null) return { ok: true };

  const livre = Math.max(0, faixa.tetoPacotes - Math.max(0, jaReservado));
  if (pedido > livre) return { ok: false, motivo: "acima-do-teto", maximo: livre };
  return { ok: true };
}

/**
 * O texto do cartão.
 *
 * ⚠️ **Estado, nunca dívida.** "4 de 18 pacotes" e jamais "faltam 14!". Lista
 * de presentes é a mecânica que mais facilmente vira cobrança sobre a rede de
 * uma gestante, e quem paga o constrangimento é ela. É a mesma régua dos
 * conjuntos do Cantinho, e há teste com regex proibindo as palavras de pressa.
 */
export function legendaDoTamanho(s: SaldoDeFralda): string {
  const p = s.meta === 1 ? "pacote" : "pacotes";
  if (s.cheio) return `${s.reservado} de ${s.meta} ${p} · completo`;
  return `${s.reservado} de ${s.meta} ${p}`;
}

/** Quanto tempo aquele tamanho dura, para a tela poder explicar a ordem. */
export function duracaoEmTexto(t: TamanhoFralda): string {
  const f = faixaDe(t);
  const dias = f.diaFim - f.diaInicio;
  if (dias <= 31) return `${Math.round(dias / 7)} semanas`;
  return `${Math.round(dias / 30)} meses`;
}
