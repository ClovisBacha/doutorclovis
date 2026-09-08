/**
 * A RÉGUA DO CRONÔMETRO DE CONTRAÇÕES — pura, e por isso testável.
 *
 * ⚠️ **ELA MORAVA DENTRO DO COMPONENTE, e é a decisão de emergência mais
 * consequente do app da paciente:** é ela que decide se a tela mostra
 * "⚠️ Ligue para o seu médico agora" com o botão do 192. Enterrada num `.tsx`
 * que importa `sonner`, `supabase` e cinco ícones, a única forma de exercitá-la
 * era ler o FONTE e procurar palavras — e foi assim que os defeitos abaixo
 * sobreviveram a uma catraca que existia justamente para guardá-la.
 *
 * É a mesma lição de `assinatura.ts`, `buscar-paciente.ts`, `frases-do-mascote.ts`
 * e `gratidao.ts`: **régua pura em `lib/`, componente só desenha.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * A REESCRITA DE SET/2026: A RÉGUA PASSOU A SER OUTRA POR SEMANA GESTACIONAL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A versão anterior era UMA régua de trabalho de parto com um remendo de
 * prematuridade em cima. Uma pesquisa em fontes primárias (ACOG, NICE NG235,
 * Diretriz Nacional de Assistência ao Parto Normal, NICHD, March of Dimes)
 * achou quatro coisas que mudam o desenho:
 *
 * ⚠️ **1. O 5-1-1 NÃO É RECOMENDAÇÃO DE DIRETRIZ NENHUMA.** Ele não está na
 * ACOG, não está no NICE NG235 (que manda triagem POR TELEFONE, sem limiar
 * numérico) e não está na Diretriz Nacional (que usa DILATAÇÃO — 4 cm —, nunca
 * frequência). É convenção de maternidade, útil e amplamente ensinada. O app
 * pode acompanhá-la; não pode apresentá-la como "a regra médica".
 *
 * ⚠️ **2. ANTES DE 37 SEMANAS A ACOG NÃO DÁ NÚMERO — DÁ "NÃO ESPERE":** "If you
 * have any signs or symptoms of preterm labor, do not wait. Call the office of
 * your obstetrician-gynecologist right away or go to the hospital." O único
 * número que uma paciente pode usar antes do termo é o piso do NICHD (6 em 60
 * min, ou uma a cada 10), e ele é gatilho de LIGAR, nunca teto de sossego.
 * Por isso, antes do termo, **nenhum estado desta régua devolve uma frase
 * tranquilizadora** — nem com contrações espaçadas.
 *
 * ⚠️ **3. O ALERTA MANDA LIGAR, NUNCA DIAGNOSTICA.** Fase ativa não se afirma
 * sem exame do colo. A versão anterior escrevia "Trabalho de parto ativo" e
 * "⚠️ Vá para a maternidade agora" — as duas frases que o material do setor
 * nomeia como as erradas ("alerts should say call your provider, not go now or
 * you are in active labor"). `cronometro-nao-diagnostica.test.ts` roda a régua
 * em dezenas de cenários e proíbe as duas famílias de frase.
 *
 * ⚠️ **4. A JANELA É DE 60 MINUTOS, E NÃO "AS ÚLTIMAS N CONTRAÇÕES".** O "1"
 * final do 5-1-1 quer dizer SUSTENTADO POR UMA HORA, e o piso do NICHD é por
 * hora. Média das últimas dez responde outra pergunta. Daí `naUltimaHora` e
 * `sustentadoMin` — este último é a informação que quase nenhum app do gênero
 * mostra ("o padrão está assim há 24 min").
 *
 * ⚠️ E o intervalo é do INÍCIO de uma ao INÍCIO da seguinte, nunca do fim de
 * uma ao início da outra. Com contrações de 60 s, medir fim-a-início dá 4 min
 * onde a régua pede 5 — erro de MEDIDA CLÍNICA, da mesma família do
 * `started_at` que já saiu do relógio do servidor neste repositório.
 */
import { sinalContracoesFrequentes, sinalContracoesPrematuras } from "@/lib/sinais-clinicos";

/**
 * O que o analisador precisa de uma contração. `ContracoesTab` tem um tipo
 * mais rico (id, intensity); aqui só entram os dois instantes, e é isso que
 * torna esta régua testável sem montar tela nenhuma.
 */
export type ContracaoParaAnalise = {
  started_at: string;
  ended_at: string | null;
};

/**
 * A FASE, e é ela que decide qual régua vale.
 *
 * ⚠️ `sem-regua` não é "tudo bem": é "não existe padrão de trabalho de parto a
 * acompanhar aqui". Trabalho de parto prematuro é definido a partir de 20
 * semanas; abaixo disso, contração com dor ou sangramento tem outra
 * investigação, e qualquer número na tela sugeriria uma régua que não existe.
 */
export type FaseDoCronometro = "sem-regua" | "pre-termo" | "termo" | "pos-termo";

export type FaseResolvida = {
  fase: FaseDoCronometro;
  /** Falso quando a semana falta ou é implausível — o texto não pode afirmá-la. */
  semanaConhecida: boolean;
};

/**
 * ⚠️ **SEM DUM, OU COM SEMANA IMPLAUSÍVEL, A RÉGUA É A DE PRÉ-TERMO.**
 *
 * Não há diretriz sobre isto — é decisão de produto, e a assimetria de dano é
 * clara: aplicar a régua de termo a uma gestante de 30 semanas TRANQUILIZA
 * quem precisa ligar; aplicar a de pré-termo a uma de 39 manda ligar quem já
 * ia ligar. É o mesmo "não sei = o lado seguro" que `fichaResolvida` e
 * `conjuntoDeBloqueio` já aplicam neste repositório.
 */
export function faseDoCronometro(semanas: number | null | undefined): FaseResolvida {
  if (semanas == null || !Number.isFinite(semanas) || semanas < 4 || semanas > 42)
    return { fase: "pre-termo", semanaConhecida: false };
  if (semanas < 20) return { fase: "sem-regua", semanaConhecida: true };
  if (semanas < 37) return { fase: "pre-termo", semanaConhecida: true };
  if (semanas < 41) return { fase: "termo", semanaConhecida: true };
  return { fase: "pos-termo", semanaConhecida: true };
}

export type AnaliseDeContracoes = {
  status: "normal" | "atencao" | "alerta" | "urgente";
  label: string;
  detail: string;
  fase: FaseDoCronometro;
  semanaConhecida: boolean;
  /** Quantas COMEÇARAM nos últimos 60 minutos. É o número que a fonte usa. */
  naUltimaHora: number;
  /** Há quantos minutos o padrão atual se mantém, quando há padrão. */
  sustentadoMin: number | null;
  /** O intervalo típico usado na decisão, em minutos. */
  intervaloMin: number | null;
  /** Duração média das contrações encerradas, em segundos. */
  duracaoSeg: number | null;
};

const HORA = 3600000;

/** Mediana — e não média: um vão longo no começo arrasta a média e apaga o padrão. */
function mediana(xs: number[]): number {
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

const min0 = (n: number) => Math.max(0, Math.round(n));

/**
 * @param agora  instante de referência, em ms. ⚠️ PARÂMETRO, nunca `Date.now()`
 *   aqui dentro: régua que lê o relógio não é testável e diverge entre servidor
 *   e cliente — é o mismatch de hidratação que já derrubou este app inteiro.
 */
export function analyzeContractions(
  list: ContracaoParaAnalise[],
  weeks: number | null,
  agora: number,
): AnaliseDeContracoes {
  const { fase, semanaConhecida } = faseDoCronometro(weeks);

  const ordenadas = [...list].sort(
    (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
  );
  const inicios = ordenadas.map((c) => new Date(c.started_at).getTime());
  const naUltimaHora = inicios.filter((t) => agora - t <= HORA && agora - t >= 0).length;

  const base = {
    fase,
    semanaConhecida,
    naUltimaHora,
    sustentadoMin: null as number | null,
    intervaloMin: null as number | null,
    duracaoSeg: null as number | null,
  };

  if (ordenadas.length < 2)
    return {
      ...base,
      ...aberturaDaFase(fase, semanaConhecida, naUltimaHora),
    };

  /* Intervalo do INÍCIO de uma ao INÍCIO da seguinte. Sai de `list` inteira e
     não só das encerradas: para saber de quanto em quanto tempo elas vêm basta
     o `started_at`, e a contração EM CURSO conta — foi por exigir duas
     encerradas que o alerta de prematuridade ficava mudo com a segunda
     contração acontecendo. */
  const intervalos: number[] = [];
  for (let i = 1; i < inicios.length; i++) intervalos.push((inicios[i] - inicios[i - 1]) / 60000);
  const media = intervalos.reduce((s, x) => s + x, 0) / intervalos.length;
  const mediaOuMediana = Math.min(media, mediana(intervalos));

  /**
   * ⚠️ **O MENOR DOS DOIS, e nunca a troca de um pelo outro.**
   *
   * "Regular" quer dizer que o intervalo TÍPICO é curto, não que a soma
   * dividida pelo número é curta. O caso real: ela começa a cronometrar em
   * dúvida, tem um vão longo, e só depois as contrações ficam regulares —
   * [30, 5, 5, 5] dá média 11,25 e a régua (≤ 10) NÃO dispara, com três
   * contrações de cinco em cinco minutos às 32 semanas. E existe o caso
   * inverso — [1, 12, 12] tem média 8,3 e mediana 12. Tomando o menor, a
   * segunda medida só pode ALARGAR o alerta, nunca estreitá-lo.
   */
  const intervalo = mediaOuMediana;

  const encerradas = ordenadas.filter((c) => c.ended_at != null);
  const duracao = encerradas.length
    ? encerradas.reduce(
        (s, c) => s + (new Date(c.ended_at!).getTime() - new Date(c.started_at).getTime()) / 1000,
        0,
      ) / encerradas.length
    : null;

  const medidas = {
    ...base,
    intervaloMin: Math.round(intervalo),
    duracaoSeg: duracao == null ? null : Math.round(duracao),
  };

  /* ─── PREMATURIDADE VEM ANTES DE TUDO ──────────────────────────────────────
     Antes das 37 semanas, contração regular é sinal vermelho independentemente
     de quão "leve" o padrão parece — e é justamente o padrão leve que a régua
     de trabalho de parto classificaria como normal. Por isso este teste vem
     PRIMEIRO: ele não pode ser alcançado só depois de a paciente passar pelos
     cortes de parto ativo. E ele não exige contração ENCERRADA: precisa de
     semana e intervalo, e de nenhuma duração. */
  const regular =
    sinalContracoesPrematuras({ semanas: weeks, intervaloMin: intervalo }) ??
    sinalContracoesFrequentes({ semanas: weeks, naUltimaHora });

  /* ⚠️ **ANTES DAS 20 SEMANAS O ALERTA CONTINUA, E O TEXTO MUDA.**
     O limite é o MESMO — quem o declara é `sinais-clinicos.ts`, e ele não é
     reescrito aqui —, mas a NOTA daquela régua fala em "trabalho de parto
     prematuro", e trabalho de parto prematuro é definido a partir de 20
     semanas. Numa gestante de 16, contração regular tem outra investigação;
     dizer "prematuridade" a ela seria afirmar um quadro errado. O que não muda
     é a ação: ligar hoje. */
  if (fase === "sem-regua") {
    if (regular)
      return {
        ...medidas,
        status: "urgente",
        label: "⚠️ Ligue para o seu médico hoje",
        detail: `Contrações regulares antes das 20 semanas precisam ser avaliadas. ${frase(naUltimaHora)}.`,
        sustentadoMin: sustentado(inicios, 10),
      };
    return { ...medidas, ...aberturaDaFase(fase, semanaConhecida, naUltimaHora) };
  }

  if (regular)
    return {
      ...medidas,
      status: "urgente",
      label: "⚠️ Ligue para o seu médico agora",
      detail: `${regular.nota} ${frase(naUltimaHora)}.`,
      sustentadoMin: sustentado(inicios, 10),
    };

  /* ─── OS CORTES DE INTERVALO E DURAÇÃO ────────────────────────────────────
     Eles valem no termo e no pós-termo — e TAMBÉM quando a semana é
     desconhecida, que é a correção mais importante desta régua.

     ⚠️ **SEM DUM, A VERSÃO ANTERIOR TIRAVA O CAMINHO DE LIGAR DE UMA PACIENTE
     EM TRABALHO DE PARTO.** `faseDoCronometro(null)` cai em `pre-termo` (o lado
     seguro), as duas réguas de prematuridade devolvem `null` sem semana (de
     propósito — elas não inventam um quadro), e o ramo de pré-termo respondia
     sempre `atencao`. Medido: doze contrações na última hora, de 3 em 3
     minutos, 70 s cada, numa gestante sem `lmp_date` — a versão anterior
     devolvia `urgente` COM o botão do SAMU, e a nova devolvia
     "Sem a sua semana, uso a régua mais cuidadosa". A régua mais cuidadosa
     tinha ficado a MENOS cuidadosa exatamente onde importava.

     ⚠️ E o texto continua não afirmando semana nenhuma: o que roda sem DUM são
     os CORTES, que só escalam. */
  const cortes = cortesDoPadrao({
    intervalo,
    duracao,
    inicios,
    naUltimaHora,
    posTermo: fase === "pos-termo",
    /* ⚠️ Sem DUM os cortes ESCALAM, mas o texto não pode citar o 5-1-1: ele é
       o combinado do TERMO, e ela pode estar de trinta semanas. O que ela
       precisa ler é o que fazer — ligar —, e não o nome de uma convenção que
       talvez não valha para ela. */
    semSemana: !semanaConhecida,
  });

  if (fase === "pre-termo") {
    /* Se o padrão já é de trabalho de parto, o alerta vale — e ele vence o
       texto de contexto, que continua embaixo para quem não chegou lá. */
    if (!semanaConhecida && cortes && cortes.status !== "normal") return { ...medidas, ...cortes };
    return {
      ...medidas,
      status: "atencao",
      label: semanaConhecida
        ? "Antes das 37 semanas, padrão regular é motivo de ligar"
        : "Sem a sua semana, uso a régua mais cuidadosa",
      detail: `${frase(naUltimaHora)}${
        duracao != null ? `, de cerca de ${Math.round(duracao)}s` : ""
      }, a cada ${Math.round(intervalo)} min. Não espere fechar um padrão: se elas ficarem regulares ou mais frequentes, ligue para o seu médico.`,
      sustentadoMin: sustentado(inicios, 10),
    };
  }

  return { ...medidas, ...cortes };
}

/**
 * Os cortes do padrão, no termo — e a razão de eles NÃO dependerem da duração
 * para escalar.
 *
 * ⚠️ **A DURAÇÃO É A MEDIDA MENOS CONFIÁVEL DESTA TELA.** Quem a produz é uma
 * mulher com dor: ela aperta "iniciar" tarde e "encerrar" cedo, e o erro é
 * SEMPRE para menos. A versão anterior pendurava a escada inteira nela — todos
 * os degraus exigiam `duracao >= 60 | 45 | 30` —, então bastava sub-cronometrar
 * para tudo desabar até o `else`. Medido: **trinta contrações na última hora,
 * de 1 em 1 minuto, cronometradas em 20 s, devolviam `normal` com o rótulo
 * "Ainda espaçadas"** — uma afirmação factualmente falsa, numa caixa VERDE, a
 * um centímetro do número "30 contrações na última hora".
 *
 * ⚠️ E sem NENHUMA contração encerrada — o caso comum de quem está com dor e só
 * aperta um botão — a resposta era "Falta a duração: encerre as contrações para
 * eu saber quanto tempo elas duram": o app com vinte contrações em mãos pedindo
 * lição de casa. A régua de pré-termo, no mesmo arquivo, já declarava que NÃO
 * exige contração encerrada; no termo tinha sido feito o oposto.
 *
 * ⚠️ O corte de 10 minutos NÃO é inventado aqui: é o mesmo "regular" que
 * `sinalContracoesPrematuras` já usa, e ele entra só para IMPEDIR o verde —
 * "ainda espaçadas" com um minuto de intervalo é falso em qualquer leitura.
 */
function cortesDoPadrao(o: {
  intervalo: number;
  duracao: number | null;
  inicios: number[];
  naUltimaHora: number;
  posTermo: boolean;
  semSemana?: boolean;
}): {
  status: AnaliseDeContracoes["status"];
  label: string;
  detail: string;
  sustentadoMin: number | null;
} {
  const { intervalo, duracao, inicios, naUltimaHora, posTermo, semSemana } = o;
  const cauda = posTermo
    ? " A partir das 41 semanas quem decide é o acompanhamento do consultório, e não o padrão do cronômetro."
    : "";
  const iv = Math.round(intervalo);
  const dur = duracao == null ? "" : `, de cerca de ${Math.round(duracao)}s`;
  const pedirDuracao =
    duracao == null ? " Encerre as contrações para eu acompanhar também quanto elas duram." : "";

  if (intervalo <= 3 && duracao != null && duracao >= 60)
    return {
      status: "urgente",
      label: "⚠️ Ligue agora para o seu médico ou para a maternidade",
      detail: `${frase(naUltimaHora)}${dur}, a cada ${iv} min.${cauda}`,
      sustentadoMin: sustentado(inicios, 3),
    };

  if (intervalo <= 5 && duracao != null && duracao >= 45) {
    const segurando = sustentado(inicios, 5);
    /* ⚠️ O "1" final do 5-1-1 quer dizer UMA HORA assim — e é justamente esse
       "há quanto tempo" que quase nenhum app do gênero mostra. */
    const fechou = segurando != null && segurando >= 60;
    return {
      status: fechou ? "alerta" : "atencao",
      label: semSemana
        ? "Elas estão vindo perto uma da outra — ligue para o seu médico"
        : fechou
          ? "O padrão combinado (5-1-1) se manteve por uma hora — ligue para o consultório"
          : "Perto do padrão combinado (5-1-1)",
      detail:
        fechou || semSemana
          ? `${frase(naUltimaHora)}${dur}, a cada ${iv} min.${cauda}`
          : `${frase(naUltimaHora)}${dur}, a cada ${iv} min. O combinado pede uma hora assim — está assim há ${segurando ?? 0} min.${cauda}`,
      sustentadoMin: segurando,
    };
  }

  /* ⚠️ O INTERVALO SOZINHO JÁ ESCALA — ver o cabeçalho: a duração não pode ser
     a única porta, porque ela é a medida que mais erra para menos. */
  if (intervalo <= 5)
    return {
      status: "atencao",
      label: "Elas estão vindo perto uma da outra",
      detail: `${frase(naUltimaHora)}${dur}, a cada ${iv} min. Ligue para o consultório se elas seguirem assim.${pedirDuracao}${cauda}`,
      sustentadoMin: sustentado(inicios, 5),
    };

  if (intervalo <= 10)
    return {
      status: "atencao",
      label: "Estão ficando mais próximas",
      detail: `${frase(naUltimaHora)}${dur}, a cada ${iv} min. Em dúvida, ligue para o consultório.${pedirDuracao}${cauda}`,
      sustentadoMin: sustentado(inicios, 10),
    };

  return {
    /* Verde SÓ acima de dez minutos de intervalo, e nunca no pós-termo. */
    status: posTermo ? "atencao" : "normal",
    label: "Ainda espaçadas",
    detail: `${frase(naUltimaHora)}${dur}, a cada ${iv} min. Em dúvida, ligue para o consultório.${cauda}`,
    sustentadoMin: sustentado(inicios, 10),
  };
}

/** O texto do começo da sessão — e ele TAMBÉM muda com a fase. */
function aberturaDaFase(
  fase: FaseDoCronometro,
  semanaConhecida: boolean,
  naUltimaHora: number,
): { status: AnaliseDeContracoes["status"]; label: string; detail: string } {
  if (fase === "sem-regua")
    return {
      /* ⚠️ Nunca "normal", nem aqui: antes das 20 semanas não existe padrão de
         trabalho de parto, e uma caixa verde afirmaria que a régua olhou e
         aprovou. Ela não olhou — não há régua. */
      status: "atencao",
      label: "Antes das 20 semanas não há um padrão a acompanhar",
      detail:
        "O cronômetro guarda o que você sentir, e isso chega ao seu médico. Se as contrações vierem com dor, sangramento ou perda de líquido, ligue para ele hoje.",
    };
  if (fase === "pre-termo")
    return {
      status: "atencao",
      label: semanaConhecida
        ? "Antes das 37 semanas, não espere fechar um padrão"
        : "Sem a sua semana, uso a régua mais cuidadosa",
      detail: `${frase(naUltimaHora)}. Contração regular ou frequente antes do termo é motivo de ligar para o seu médico — não há um número a alcançar antes disso.`,
    };
  return {
    status: "normal",
    label: "Monitorando",
    detail: "Registre mais contrações para eu acompanhar o padrão com você.",
  };
}

function frase(n: number): string {
  if (n === 0) return "Nenhuma contração na última hora";
  return n === 1 ? "1 contração na última hora" : `${n} contrações na última hora`;
}

/**
 * Há quantos minutos o padrão se mantém: caminha de trás para a frente
 * enquanto os intervalos seguem dentro do corte, e devolve o tempo do começo
 * dessa sequência até a contração mais recente.
 *
 * ⚠️ Devolve `null` quando nem o último intervalo cabe no corte — "0 min" e
 * "não há padrão" são coisas diferentes, e a tela precisa distinguir as duas.
 */
function sustentado(inicios: number[], corteMin: number): number | null {
  if (inicios.length < 2) return null;
  let i = inicios.length - 1;
  while (i > 0 && (inicios[i] - inicios[i - 1]) / 60000 <= corteMin) i--;
  if (i === inicios.length - 1) return null;
  return min0((inicios[inicios.length - 1] - inicios[i]) / 60000);
}
