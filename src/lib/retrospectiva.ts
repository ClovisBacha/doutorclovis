/**
 * A RETROSPECTIVA DA SEMANA — montada sozinha, aos domingos.
 *
 * Pedido do dono (ideia 6): um cartão que ela não precisa fazer. As fotos dela,
 * a semana que virou, quantas pessoas reagiram. Zero trabalho, e é o formato
 * que mais gera vontade de compartilhar em qualquer app.
 *
 * ─── AS QUATRO REGRAS QUE ATRAVESSAM O ARQUIVO ─────────────────────────────
 *
 * ⚠️ **1. NÃO É PLACAR, E POR ISSO NÃO COMPARA SEMANAS.** "Mais que a semana
 * passada" transformaria a retrospectiva numa esteira: bastaria uma semana de
 * internação para o cartão dizer que ela caiu. Ele conta o que ACONTECEU, e
 * nunca em relação a outra coisa.
 *
 * ⚠️ **2. SÓ APARECE QUANDO HÁ O QUE MOSTRAR.** Um cartão que diz "você não
 * publicou nada esta semana" é uma cobrança com cara de resumo — e chega
 * justamente a quem teve a semana pior.
 *
 * ⚠️ **3. NUNCA EM MODO CUIDADO.** É o cartão mais festivo da aba, montado a
 * partir de fotos de barriga, e chega sem ela pedir.
 *
 * ⚠️ **4. É PRIVADO.** Só ela vê a própria retrospectiva. O número de pessoas
 * que reagiram aos posts DELA já é dela; o mesmo número virando cartão público
 * seria o placar de audiência que `NUMEROS_PUBLICOS` existe para não haver.
 */

/** Quantas fotos entram no mosaico. Quatro fecham um quadrado 2×2. */
export const FOTOS_NA_RETROSPECTIVA = 4;

/** A janela: os últimos sete dias corridos. */
export const DIAS_DA_SEMANA = 7;

export type PostDaSemana = {
  id: string;
  criadoEm: string;
  imagemUrl: string | null;
  /** Quantas reações o post recebeu. */
  reacoes: number;
};

export type Retrospectiva = {
  /** Até quatro fotos, da mais nova para a mais antiga. */
  fotos: string[];
  /** Quantas publicações ela fez na janela. */
  publicacoes: number;
  /** A soma das reações recebidas na janela. */
  reacoes: number;
  /**
   * A semana gestacional que ela COMEÇOU nos últimos sete dias, ou `null`.
   *
   * ⚠️ É a semana que VIROU, não a semana atual: "você entrou na 29ª" só faz
   * sentido se a virada aconteceu dentro da janela. Sem isso, o cartão diria a
   * mesma frase todo domingo do mesmo mês.
   */
  semanaQueVirou: number | null;
};

/** É domingo? A retrospectiva é semanal e cai no fim da semana. */
export function ehDomingo(agora: Date): boolean {
  return agora.getDay() === 0;
}

/** Os posts dentro da janela de sete dias. */
export function daSemana(posts: PostDaSemana[], agora: Date): PostDaSemana[] {
  const limite = agora.getTime() - DIAS_DA_SEMANA * 86_400_000;
  return posts
    .filter((p) => {
      const t = Date.parse(p.criadoEm);
      return Number.isFinite(t) && t >= limite && t <= agora.getTime();
    })
    .sort((a, b) => Date.parse(b.criadoEm) - Date.parse(a.criadoEm));
}

/**
 * Monta a retrospectiva, ou devolve `null` quando não há o que mostrar.
 *
 * `semanaAgora` e `semanaHaSeteDias` vêm de `computeGestation` — a mesma régua
 * de sempre, e nunca uma conta de semanas escrita aqui.
 */
export function montarRetrospectiva(opts: {
  posts: PostDaSemana[];
  agora: Date;
  semanaAgora: number | null;
  semanaHaSeteDias: number | null;
  /** Modo Cuidado: o cartão simplesmente não existe. */
  emCuidado: boolean;
}): Retrospectiva | null {
  if (opts.emCuidado) return null;

  const semana = daSemana(opts.posts, opts.agora);
  const virou =
    opts.semanaAgora != null &&
    opts.semanaHaSeteDias != null &&
    opts.semanaAgora > opts.semanaHaSeteDias
      ? opts.semanaAgora
      : null;

  /* ⚠️ Sem publicação E sem virada, não há retrospectiva. Ver a regra 2. */
  if (semana.length === 0 && virou == null) return null;

  return {
    fotos: semana
      .map((p) => p.imagemUrl)
      .filter((u): u is string => !!u)
      .slice(0, FOTOS_NA_RETROSPECTIVA),
    publicacoes: semana.length,
    reacoes: semana.reduce((s, p) => s + Math.max(0, p.reacoes), 0),
    semanaQueVirou: virou,
  };
}

/**
 * A frase do cartão.
 *
 * ⚠️ **Nada de superlativo e nada de cobrança.** "Que semana incrível!" impõe
 * um sentimento a quem talvez tenha passado a semana no hospital; "você só
 * publicou uma vez" é cobrança. O cartão narra, no tom mais baixo que dá.
 */
export function fraseDaRetrospectiva(r: Retrospectiva): string {
  const partes: string[] = [];
  if (r.semanaQueVirou != null) partes.push(`Você entrou na ${r.semanaQueVirou}ª semana`);
  if (r.publicacoes === 1) partes.push("publicou uma vez");
  else if (r.publicacoes > 1) partes.push(`publicou ${r.publicacoes} vezes`);
  if (r.reacoes === 1) partes.push("e recebeu uma reação");
  else if (r.reacoes > 1) partes.push(`e recebeu ${r.reacoes} reações`);

  if (partes.length === 0) return "Sua semana ficou guardada aqui.";
  /* Primeira letra maiúscula, ponto no fim, sem vírgula sobrando. */
  const texto = partes.join(", ").replace(/, e /g, " e ");
  return `${texto[0].toLocaleUpperCase("pt-BR")}${texto.slice(1)}.`;
}

/** A chave do "já vi", por CONTA e por semana. */
export function chaveDaRetrospectiva(userId: string, agora: Date): string {
  const d = agora.toISOString().slice(0, 10);
  return `dc-rede-retro-${userId}-${d}`;
}
