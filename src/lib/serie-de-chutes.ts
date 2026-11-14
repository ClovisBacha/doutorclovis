/**
 * A SÉRIE DE MOVIMENTOS — o que o gráfico desenha, e por que ele é DESTE eixo.
 *
 * ⚠️ **O EIXO É O TEMPO ATÉ 10 MOVIMENTOS, e não "quantos chutes por dia".**
 * Não é escolha de desenho: é o único protocolo de contagem com base empírica
 * (Moore & Piacquadio, 1989 — contagem vespertina, deitada de lado, medindo a
 * LATÊNCIA até o décimo movimento), e é o que ACOG, SOGC e PSANZ adotaram.
 * O mobilograma brasileiro (contar por uma hora fixa) mede outra coisa —
 * densidade — e as duas séries não são comparáveis entre si.
 *
 * ⚠️ **E A LINHA ESPERADA É PLANA. Isto é o achado que autoriza o gráfico a
 * existir.** Winje 2011 (n = 1786, contagem diária das 28 semanas ao parto):
 * a média fica em ~10 minutos e NÃO sobe no terceiro trimestre — 9,43 min
 * entre 28 e 31 semanas, 9,16 entre 32 e 36, 10,88 a partir de 37; menos de
 * dois minutos de diferença até o termo, "de utilidade clínica limitada para a
 * mulher individual". Winje 2012 vai além: idade gestacional MAIOR associou-se
 * a tempos mais CURTOS, "refuting the wide-spread notion that fetal activity
 * decreases in late pregnancy".
 *
 * Um gráfico que desenhasse uma faixa esperada SUBINDO estaria ensinando, com
 * a autoridade de um desenho, o mito que mata — o mesmo que a trilha diária
 * chama de "mito perigoso" em quatro dias diferentes.
 *
 * ⚠️ **A RÉGUA É A MEDIANA DELA, NUNCA UM CORTE POPULACIONAL.** Winje 2011
 * aplicou os limiares publicados à população inteira: o alarme de Moore
 * (menos de 10 em 2 h) tem sensibilidade de 5% para desfecho subótimo e se
 * associou apenas a sobrepeso materno; o de Kuwata (25/35 min) sobe para 44%
 * de sensibilidade e DISPARA EM 41% DAS GESTAÇÕES NORMAIS. Conclusão dos
 * autores: a contagem padronizada "was not useful as a screening tool".
 *
 * O que sobra, e é o que este arquivo calcula, é o desvio em relação ao NORMAL
 * DELA. E ele **não é um alarme clínico** — é um convite a olhar. O único
 * limiar absoluto continua sendo o piso de segurança de ACOG (10 em 2 horas),
 * que mora em `sinais-clinicos.ts`, e acima dele a percepção dela, que a
 * diretriz PSANZ diz ganhar de qualquer número.
 */

export type SessaoDeChutes = {
  started_at: string;
  ended_at: string | null;
  kick_count: number;
};

export type PontoDaSerie = {
  /** ISO do início da sessão — é o que o eixo X usa. */
  em: string;
  /** Minutos até o décimo movimento. */
  valor: number;
};

/** O piso de segurança de ACOG, em minutos. Vive aqui só como CORTE DE OUTLIER. */
const TETO_DE_SESSAO_MIN = 120;

/** Abaixo disto não há "normal dela" — há duas medidas e ruído. */
export const MINIMO_PARA_FAIXA = 5;

/** A janela do "seu normal": as últimas quatorze sessões completas. */
export const JANELA_DA_FAIXA = 14;

/**
 * ⚠️ **SÓ SESSÃO QUE CHEGOU A DEZ VIRA PONTO.**
 *
 * Misturar a sessão de quatro movimentos em duas horas como "ponto de 120 min"
 * INVERTE o sinal do gráfico: o alarme viraria o ponto mais alto da série, e
 * seria lido como "o bebê está mais lento" — quando o que aconteceu é que a
 * contagem nem se completou. Aquela sessão é assunto do alerta, e não da
 * tendência.
 *
 * ⚠️ E a sessão ESQUECIDA ABERTA é descartada pelo mesmo teto: uma noite
 * inteira com o cronômetro rodando entraria como um ponto de 8 horas e
 * estragaria a mediana pessoal para sempre.
 */
export function tempoAte10(s: SessaoDeChutes): number | null {
  if (!s.ended_at) return null;
  if (!Number.isFinite(s.kick_count) || s.kick_count < 10) return null;
  const ini = new Date(s.started_at).getTime();
  const fim = new Date(s.ended_at).getTime();
  if (!Number.isFinite(ini) || !Number.isFinite(fim)) return null;
  const min = (fim - ini) / 60000;
  if (min <= 0 || min > TETO_DE_SESSAO_MIN) return null;
  return Math.round(min * 10) / 10;
}

/** A série, em ordem cronológica — que é a ordem em que o gráfico lê. */
export function serieDeChutes(sessoes: SessaoDeChutes[]): PontoDaSerie[] {
  return sessoes
    .map((s) => {
      const valor = tempoAte10(s);
      return valor == null ? null : { em: s.started_at, valor };
    })
    .filter((p): p is PontoDaSerie => p != null)
    .sort((a, b) => new Date(a.em).getTime() - new Date(b.em).getTime());
}

export type FaixaPessoal = {
  /** O quartil de baixo, em minutos. */
  de: number;
  /** O quartil de cima. */
  ate: number;
  mediana: number;
  /** Quantas sessões entraram na conta. */
  sessoes: number;
};

/** Percentil por posto mais próximo — determinístico, e sem interpolar nada. */
function percentil(ordenado: number[], p: number): number {
  const i = Math.min(ordenado.length - 1, Math.max(0, Math.round(p * (ordenado.length - 1))));
  return ordenado[i];
}

/**
 * ⚠️ **MEDIANA, NUNCA MÉDIA.** Uma sessão de duas horas arrasta a média e some
 * com o sinal — e é justamente a sessão atípica que a paciente quer enxergar.
 *
 * ⚠️ E `null` abaixo de cinco sessões: com duas, o app compararia a segunda
 * com a primeira e chamaria ruído de tendência. "Ainda não sei o seu normal"
 * é uma resposta honesta; uma faixa inventada não é.
 */
export function faixaPessoal(
  pontos: PontoDaSerie[],
  minimo: number = MINIMO_PARA_FAIXA,
): FaixaPessoal | null {
  const usados = pontos.slice(-JANELA_DA_FAIXA);
  if (usados.length < minimo) return null;
  const ordenado = usados.map((p) => p.valor).sort((a, b) => a - b);
  const meio = Math.floor(ordenado.length / 2);
  return {
    de: percentil(ordenado, 0.25),
    ate: percentil(ordenado, 0.75),
    mediana: ordenado.length % 2 ? ordenado[meio] : (ordenado[meio - 1] + ordenado[meio]) / 2,
    sessoes: usados.length,
  };
}

export type LeituraDeHoje = "sem-base" | "dentro" | "acima" | "abaixo";

/**
 * Onde a última sessão cai em relação ao normal DELA.
 *
 * ⚠️ Isto NÃO é gravidade e não pinta ponto de vermelho: o alarme de Kuwata,
 * que é o mais sensível publicado, dispara em 41% das gestações normais — ou
 * seja, quase metade das noites acenderia. É informação, e o texto que a
 * acompanha diz o que fazer com ela: se ela achou o bebê diferente, o caminho
 * de contato está na tela o tempo todo, independentemente deste número.
 */
export function leituraDeHoje(pontos: PontoDaSerie[], faixa: FaixaPessoal | null): LeituraDeHoje {
  if (!faixa || pontos.length === 0) return "sem-base";
  const hoje = pontos[pontos.length - 1].valor;
  if (hoje > faixa.ate) return "acima";
  if (hoje < faixa.de) return "abaixo";
  return "dentro";
}

/**
 * A frase do rodapé do gráfico. Mora aqui, e não no JSX, porque é texto que o
 * dono relê — e porque a segunda metade dela é uma afirmação clínica.
 */
export const FRASE_DA_LINHA_PLANA =
  "Em uma gestação saudável esta linha fica plana. O bebê não se mexe menos perto do fim — ele muda o jeito de se mexer.";

/**
 * ⚠️ **"A ÚLTIMA" É UM RÓTULO, E NÃO UM PONTO DA SÉRIE — e confundir os dois
 * fazia a tela dar sossego sobre um dia que não era o último.**
 *
 * `serieDeChutes` descarta de propósito toda sessão que não chegou a dez
 * (ver `tempoAte10`): está certo para o GRÁFICO, e é falso para um cartão
 * escrito "A última". Medido: histórico com cinco contagens normais de 9 a 13
 * minutos e a sessão de ONTEM com seis movimentos em duas horas — exatamente o
 * caso que dispara o alerta vermelho — e a fita mostrava "A última: 11 min"
 * (a contagem de dois dias antes) com a frase "A última ficou dentro dele.".
 * Reasseguramento afirmativo, na tela que mede um dos nove sintomas VERMELHOS.
 *
 * ⚠️ **`kick_count < 10` É O QUE DEFINE "não fechou", e nunca `tempoAte10ser
 * nulo`.** Uma sessão de doze movimentos esquecida aberta a noite inteira sai
 * da série pelo TETO (é outlier), e chamá-la de "não chegou a 10" seria o app
 * afirmando o contrário do que aconteceu. Ela cai em `sem-medida`: o cartão
 * não mostra número e a frase se cala — que é a única coisa verdadeira a
 * dizer sobre uma duração que não dá para usar.
 *
 * ⚠️ **A ORDEM É RECALCULADA AQUI, e não herdada de quem chama.** A série
 * chega crescente e a lista da tela chega DECRESCENTE; uma régua que confiasse
 * na ordem recebida rotularia o dia errado conforme o chamador.
 *
 * ⚠️ **Sessão ainda ABERTA não é "a última".** Ela é a contagem em curso, e
 * quem a mostra é o cronômetro no alto da tela — repeti-la aqui como um fato
 * encerrado seria a mesma contagem descrita duas vezes, com dois sentidos.
 */
export type UltimaContagem =
  | { estado: "completa"; em: string; minutos: number }
  | { estado: "incompleta"; em: string; movimentos: number }
  | { estado: "sem-medida"; em: string };

export function ultimaContagem(sessoes: SessaoDeChutes[]): UltimaContagem | null {
  let ultima: SessaoDeChutes | null = null;
  for (const s of sessoes) {
    if (!s.ended_at) continue;
    const t = new Date(s.started_at).getTime();
    if (!Number.isFinite(t)) continue;
    if (!ultima || t > new Date(ultima.started_at).getTime()) ultima = s;
  }
  if (!ultima) return null;

  const movimentos = Number.isFinite(ultima.kick_count) ? Math.max(0, ultima.kick_count) : 0;
  if (movimentos < 10) return { estado: "incompleta", em: ultima.started_at, movimentos };

  const minutos = tempoAte10(ultima);
  if (minutos == null) return { estado: "sem-medida", em: ultima.started_at };
  return { estado: "completa", em: ultima.started_at, minutos };
}
