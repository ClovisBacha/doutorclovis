/**
 * O BOLÃO DO NASCIMENTO — a régua, sem JSX e sem banco.
 *
 * Cada pessoa da torcida palpita QUANDO o bebê nasce, QUANTO ele pesa e A QUE
 * HORAS. No dia do parto a mãe registra o que aconteceu de verdade e o bolão
 * fecha com um ganhador.
 *
 * ─── POR QUE ESTE, E NÃO OUTRO ─────────────────────────────────────────────
 *
 * De todas as funções da Comunidade, esta é a de melhor relação entre interação
 * gerada e trabalho de construir, por uma razão que nenhuma outra tem: ela se
 * AUTO-RELANÇA. Um álbum precisa de foto nova, uma votação de nome acaba quando
 * o nome é escolhido, um recado precisa de alguém com assunto. O bolão tem um
 * evento de resolução marcado — o nascimento — que traz a torcida inteira de
 * volta ao app no dia em que a mãe mais quer ser vista. E palpitar custa dez
 * segundos, o que é o piso de esforço que faz todo mundo entrar.
 *
 * Bolão também é linguagem nativa aqui: brasileiro faz bolão de Copa, de
 * loteria e de sexo do bebê sem ninguém precisar explicar as regras.
 *
 * ─── AS TRÊS DECISÕES QUE PARECEM DETALHE E NÃO SÃO ────────────────────────
 *
 * 1. **Um palpite por pessoa, EDITÁVEL até o parto.** Travar no primeiro envio
 *    parece mais justo e é pior: quem palpita na 20ª semana com a informação
 *    daquele dia não volta mais, porque não tem o que fazer aqui. Editável, a
 *    pessoa revisita — e revisitar é o produto.
 *
 * 2. **Todo mundo VÊ o palpite dos outros.** Isso "estraga" a justiça: dá para
 *    copiar o palpite alheio. Mas o valor daqui é social, não competitivo — a
 *    graça é a tia ver que o cunhado apostou 4,2 kg e rir dele no grupo. Um
 *    bolão de envelope fechado é mais justo e não gera conversa nenhuma, que é
 *    a única coisa que ele existe para gerar.
 *
 * 3. **Só a MÃE fecha o bolão.** O resultado real é dado dela sobre o parto
 *    dela. Ninguém da torcida registra nascimento.
 *
 * ⚠️ **E O BOLÃO NÃO EXISTE EM MODO CUIDADO.** Um bolão de nascimento aberto
 * numa gestação que se perdeu é o artefato mais cruel que este app conseguiria
 * produzir: uma lista de pessoas queridas apostando alegremente numa data que
 * não vai chegar. O portão mora em `bolaoDisponivel`, e ele é conferido no
 * SERVIDOR — filtrar só na tela deixaria os palpites viajando pela rede.
 */

/** Um palpite. `horaMinutos` é opcional: nem todo mundo quer chutar a hora. */
export type PalpiteDoBolao = {
  /** Dia do nascimento, em `YYYY-MM-DD` (data local, sem fuso). */
  dia: string;
  /** Peso em GRAMAS. Inteiro — "3,4 kg" vira 3400 na entrada. */
  pesoGramas: number;
  /** Minutos depois da meia-noite (0–1439), ou `null` se ela não palpitou hora. */
  horaMinutos: number | null;
};

/** O que de fato aconteceu. Mesmo formato do palpite, sem o `null` na hora. */
export type NascimentoReal = PalpiteDoBolao;

/* ─── AS FAIXAS PLAUSÍVEIS ──────────────────────────────────────────────────
 *
 * Elas existem para barrar dedo errado, não para julgar palpite ruim. Alguém
 * que digita 340 no lugar de 3400 não quis dizer que o bebê pesa 340 g; alguém
 * que palpita o nascimento para daqui a três anos errou o ano no seletor.
 *
 * ⚠️ As bordas são generosas de PROPÓSITO. Um prematuro de 26 semanas pesando
 * 900 g é uma gestação de alto risco real, e é justamente a paciente deste app.
 * Uma faixa apertada em torno do "normal" recusaria o palpite certo da avó que
 * conhece o histórico da família. */

/** Peso mínimo aceito, em gramas. Abaixo disto é erro de digitação. */
export const PESO_MINIMO = 500;
/** Peso máximo aceito, em gramas. O recorde mundial fica abaixo de 7 kg. */
export const PESO_MAXIMO = 7000;

/** Quantos dias ANTES da DPP o palpite pode cair (≈ 22 semanas de gestação). */
export const DIAS_ANTES_DA_DPP = 126;
/** Quantos dias DEPOIS da DPP o palpite pode cair. Ninguém passa de 42 semanas. */
export const DIAS_DEPOIS_DA_DPP = 21;

/* ─── PONTUAÇÃO ─────────────────────────────────────────────────────────────
 *
 * Duzentos pontos no total, repartidos pelo peso EMOCIONAL de cada palpite e
 * não pela dificuldade de acertar: a data é a pergunta que todo mundo faz, o
 * peso é a que todo mundo lembra depois, e a hora é enfeite.
 *
 * A queda é linear e o piso é zero — quem errou por um mês fica com zero na
 * data, e não com um número negativo que precisaria ser explicado numa tela
 * que ninguém vai ler. */

/** Pontos de quem acerta o dia em cheio. */
export const PONTOS_DA_DATA = 100;
/** Pontos perdidos por dia de diferença. */
export const PONTOS_POR_DIA = 15;

/** Pontos de quem acerta o peso dentro da margem. */
export const PONTOS_DO_PESO = 60;
/** Margem de peso, em gramas, que ainda vale a pontuação cheia. */
export const MARGEM_DE_PESO = 50;
/** Pontos perdidos a cada 10 g fora da margem. */
export const PONTOS_POR_DEZ_GRAMAS = 1;

/** Pontos de quem acerta a hora dentro da margem. */
export const PONTOS_DA_HORA = 40;
/** Margem de hora, em minutos, que ainda vale a pontuação cheia. */
export const MARGEM_DE_HORA = 60;
/** Pontos perdidos por hora de diferença fora da margem. */
export const PONTOS_POR_HORA = 2;

/** O teto — só para a tela poder dizer "142 de 200". */
export const PONTOS_MAXIMOS = PONTOS_DA_DATA + PONTOS_DO_PESO + PONTOS_DA_HORA;

/**
 * `YYYY-MM-DD` → dias inteiros, em UTC.
 *
 * ⚠️ Lê ano/mês/dia como números e monta a data em UTC — nunca `new Date(iso)`
 * sobre a string crua. `new Date("2026-08-17")` é interpretada como MEIA-NOITE
 * UTC, e em São Paulo isso é o dia 16 às 21h: toda comparação de data do app
 * andaria um dia para trás durante a maior parte do dia. É o mesmo erro de três
 * horas que a agenda já pagou, e a mesma correção de `sequenciaDeDatas`.
 */
export function diaEmNumero(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const t = Date.UTC(ano, mes - 1, dia);
  const d = new Date(t);
  // Recusa 31 de fevereiro e companhia: o `Date.UTC` normaliza em silêncio.
  if (d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return Math.round(t / 86400000);
}

export type ErroDoPalpite = "data" | "data-fora-da-faixa" | "peso" | "hora";

/**
 * O palpite serve? `null` quando sim.
 *
 * `dpp` pode ser `null` — paciente sem DPP cadastrada ainda existe, e nesse
 * caso a única coisa que dá para conferir é o formato. Recusar o palpite por
 * falta de um dado que é NOSSO, e não dela, seria cobrar dela o nosso buraco.
 */
export function validarPalpite(p: PalpiteDoBolao, dpp: string | null): ErroDoPalpite | null {
  const dia = diaEmNumero(p.dia);
  if (dia == null) return "data";

  const alvo = dpp ? diaEmNumero(dpp) : null;
  if (alvo != null && (dia < alvo - DIAS_ANTES_DA_DPP || dia > alvo + DIAS_DEPOIS_DA_DPP)) {
    return "data-fora-da-faixa";
  }

  if (
    !Number.isFinite(p.pesoGramas) ||
    !Number.isInteger(p.pesoGramas) ||
    p.pesoGramas < PESO_MINIMO ||
    p.pesoGramas > PESO_MAXIMO
  ) {
    return "peso";
  }

  if (p.horaMinutos != null) {
    if (
      !Number.isFinite(p.horaMinutos) ||
      !Number.isInteger(p.horaMinutos) ||
      p.horaMinutos < 0 ||
      p.horaMinutos > 1439
    ) {
      return "hora";
    }
  }

  return null;
}

/** A nota de um palpite, repartida — a tela mostra as três, não só o total. */
export type NotaDoPalpite = {
  data: number;
  peso: number;
  hora: number;
  total: number;
  /** Diferença de dias, com sinal: negativo = palpitou antes do que aconteceu. */
  diasDeDiferenca: number;
  /** Diferença de peso, com sinal, em gramas. */
  gramasDeDiferenca: number;
};

/**
 * Quantos pontos o palpite fez contra o nascimento real.
 *
 * ⚠️ **Quem não palpitou hora tira ZERO na hora, e não a pontuação cheia.**
 * A alternativa — não contar a hora para quem a deixou em branco — daria a essa
 * pessoa um total sobre 160 enquanto os outros disputam 200, e o ranking
 * passaria a comparar notas de provas diferentes. Deixar a hora em branco é uma
 * escolha legítima; ela só não pode valer ponto.
 */
export function pontuar(p: PalpiteDoBolao, real: NascimentoReal): NotaDoPalpite {
  const diaP = diaEmNumero(p.dia);
  const diaR = diaEmNumero(real.dia);

  const diasDeDiferenca = diaP != null && diaR != null ? diaP - diaR : 0;
  const data =
    diaP != null && diaR != null
      ? Math.max(0, PONTOS_DA_DATA - Math.abs(diasDeDiferenca) * PONTOS_POR_DIA)
      : 0;

  const gramasDeDiferenca = p.pesoGramas - real.pesoGramas;
  const foraDaMargem = Math.max(0, Math.abs(gramasDeDiferenca) - MARGEM_DE_PESO);
  const peso = Math.max(0, PONTOS_DO_PESO - Math.floor(foraDaMargem / 10) * PONTOS_POR_DEZ_GRAMAS);

  let hora = 0;
  if (p.horaMinutos != null && real.horaMinutos != null) {
    /* A distância é CIRCULAR: 23h50 e 00h10 são vinte minutos, não 23h40.
       Sem isto, quem palpita "de madrugada" e acerta em cheio um parto às
       23h55 tiraria zero — e é justamente o palpite mais comum, porque bebê
       nasce de madrugada. */
    const bruta = Math.abs(p.horaMinutos - real.horaMinutos);
    const minutos = Math.min(bruta, 1440 - bruta);
    const foraDaHora = Math.max(0, minutos - MARGEM_DE_HORA);
    hora = Math.max(0, PONTOS_DA_HORA - Math.ceil(foraDaHora / 60) * PONTOS_POR_HORA);
  }

  return {
    data,
    peso,
    hora,
    total: data + peso + hora,
    diasDeDiferenca,
    gramasDeDiferenca,
  };
}

/** Uma linha do bolão, do jeito que a tela precisa. */
export type LinhaDoBolao<T> = {
  palpite: T & PalpiteDoBolao;
  nota: NotaDoPalpite;
  /** 1 = ganhador. Empate divide a mesma posição. */
  posicao: number;
};

/**
 * O ranking, depois que o bebê nasceu.
 *
 * O desempate é pela DATA e depois pelo PESO — nunca pela ordem de chegada do
 * palpite. Premiar quem palpitou primeiro puniria justamente quem a mecânica
 * quer trazer de volta: a pessoa que revisita e ajusta.
 *
 * Empate de verdade (mesma data, mesmo peso, mesma hora) divide a posição, e as
 * seguintes pulam — 1, 1, 3 —, que é como todo mundo já espera que um placar
 * funcione.
 */
export function ranking<T extends PalpiteDoBolao>(
  palpites: readonly T[],
  real: NascimentoReal,
): LinhaDoBolao<T>[] {
  const comNota = palpites.map((palpite) => ({ palpite, nota: pontuar(palpite, real) }));

  comNota.sort((a, b) => {
    if (b.nota.total !== a.nota.total) return b.nota.total - a.nota.total;
    if (b.nota.data !== a.nota.data) return b.nota.data - a.nota.data;
    return b.nota.peso - a.nota.peso;
  });

  const chave = (x: (typeof comNota)[number]) => `${x.nota.total}:${x.nota.data}:${x.nota.peso}`;

  let posicao = 0;
  let anterior: string | null = null;
  return comNota.map((x, i) => {
    const k = chave(x);
    if (k !== anterior) {
      posicao = i + 1;
      anterior = k;
    }
    return { palpite: x.palpite, nota: x.nota, posicao };
  });
}

/**
 * O bolão pode aparecer?
 *
 * ⚠️ **Modo Cuidado tira o bolão do ar, e essa é a razão de esta função
 * existir separada da tela.** Ver o cabeçalho do arquivo: uma lista de pessoas
 * queridas apostando numa data que não vai chegar é o pior artefato que este
 * app conseguiria produzir. O portão é conferido no servidor, porque filtrar na
 * tela deixaria os palpites viajando pela rede antes de sumirem.
 *
 * A segunda condição é de sentido, não de segurança: sem DPP e sem gestação
 * aberta não há o que palpitar.
 */
export function bolaoDisponivel({
  careMode,
  temGestacao,
}: {
  careMode: boolean;
  temGestacao: boolean;
}): boolean {
  return !careMode && temGestacao;
}

/* ─── FORMATAÇÃO ────────────────────────────────────────────────────────────
   Mora aqui, e não no componente, porque o mesmo texto aparece na lista, no
   cartão do ganhador e no push — três lugares que precisam concordar. */

/** 3400 → "3,400 kg". Vírgula porque é a régua daqui. */
export function pesoEmTexto(gramas: number): string {
  const kg = Math.floor(gramas / 1000);
  const g = Math.abs(gramas % 1000);
  return `${kg},${String(g).padStart(3, "0")} kg`;
}

/**
 * "2026-09-08" → "08/09".
 *
 * ⚠️ Fatia a string, e NUNCA passa por `new Date`. `new Date("2026-09-08")` é
 * meia-noite UTC, e em São Paulo `getDate()` sobre ela devolve 7 — a lista do
 * bolão mostraria todo palpite um dia adiantado. Mesmo motivo de
 * `diaEmNumero`.
 *
 * O ano fica de fora: o bolão inteiro cabe em poucos meses, e o ano só ocuparia
 * a largura de que a lista precisa para o nome de quem palpitou.
 */
export function diaEmTexto(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  return m ? `${m[3]}/${m[2]}` : iso;
}

/** 545 → "09:05". `null` → "—". */
export function horaEmTexto(minutos: number | null): string {
  if (minutos == null) return "—";
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * "2 dias antes" · "no dia" · "3 dias depois".
 *
 * O sinal é do ponto de vista do PALPITE: negativo quer dizer que ela chutou
 * uma data anterior à que aconteceu, ou seja, o bebê demorou mais do que ela
 * esperava.
 */
export function diferencaEmTexto(dias: number): string {
  if (dias === 0) return "no dia";
  const n = Math.abs(dias);
  const plural = n === 1 ? "dia" : "dias";
  return dias < 0 ? `${n} ${plural} antes` : `${n} ${plural} depois`;
}
