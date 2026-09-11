/**
 * QUEM PODE FALAR COM A NUTRICIONISTA, E QUANTAS VEZES POR DIA.
 *
 * ─── POR QUE ESTA RÉGUA EXISTE ──────────────────────────────────────────────
 *
 * O app tem DOIS livros-caixa de IA, e eles nunca se tocam:
 *
 *   · o **chat clínico** (`canal: "app"`) é a voz do médico, e quem paga é ELE
 *     — a franquia do plano dele, contada em `cota-ia.server.ts`;
 *   · a **nutricionista** (`canal: "nutricao"` e `"prato"`) é da PACIENTE, e
 *     quem paga é ela, no Premium.
 *
 * Decisão do dono, com todas as letras: "as mensagens do médico são pagas pelo
 * médico; no plano premium somente essa da nutricionista deveria ser paga pela
 * paciente". Foi por isso que `nutricao` saiu de `CANAIS_DA_COTA` no mesmo
 * commit em que este arquivo nasceu — deixar nos dois lugares faria o médico
 * pagar por uma conversa que a paciente já comprou.
 *
 * ─── O TETO DIÁRIO NÃO É MESQUINHARIA: É A MARGEM ───────────────────────────
 *
 * Medido em `custo-da-nutricao.ts` a partir dos prompts REAIS: uma mensagem de
 * texto custa ~1,7 centavos e uma foto ~0,7. Sem teto, uma única paciente
 * conversando cinquenta vezes por dia gasta mais em modelo do que a assinatura
 * dela inteira — e a conta não aparece em lugar nenhum até o fim do mês.
 *
 * ⚠️ **O teto vale para TODO MUNDO, inclusive quem não paga e inclusive o Modo
 * Cuidado.** É o único limite que não tem exceção, porque é o que impede um
 * laço (dois aparelhos, um toque nervoso, um script) de virar prejuízo. As
 * exceções abaixo dispensam o PREMIUM, nunca o teto.
 */

/**
 * Quantas perguntas por dia uma assinante tem.
 *
 * ⚠️ **O NÚMERO SAI DA MARGEM, e não do gosto.** A 10 por dia o pior caso é
 * 300 perguntas no mês: ~R$ 5,32 de modelo. `custo-da-nutricao.test.ts` cobra
 * essa conta contra os preços de `promo.ts`, e não contra um preço escrito
 * aqui — o dia em que o dono reajustar, a conta reajusta junto.
 *
 * ⚠️ **QUEM DIMENSIONA O TETO É O PLANO ANUAL, e não o mensal.** O anual sai
 * por ~R$ 9,16/mês (R$ 109,90 cobrados de uma vez), menos da METADE do mensal
 * — então dimensionar pelo mensal seria dimensionar pelo caso fácil. Medido,
 * com a taxa cheia da loja e as dez perguntas usadas todo dia:
 *
 *   · mensal (R$ 19,90) → IA em 38% do líquido, sobra R$ 8,59
 *   · **anual (R$ 9,16) → IA em 83% do líquido, sobra R$ 1,07**
 *
 * É apertado, e é POSITIVO — que é exatamente o que o teto compra. Sem teto, a
 * mesma assinante anual a trinta perguntas por dia leva a conta a **R$ −9,56**.
 *
 * ⚠️ **E ISSO PÕE O NÚMERO PERTO DA BORDA.** Medido por mutação, subindo o
 * teto um degrau de cada vez:
 *
 *   · a **11** a fração do mensal passa de 40% e o teste fica vermelho;
 *   · a **12** o anual sobra **um centavo** — menos que a própria conta de
 *     infraestrutura da paciente, e o segundo guarda fica vermelho também;
 *   · a **13** o anual fica negativo.
 *
 * O 10 tem UM degrau de folga, não vinte. Subir este número sem refazer a
 * conta é escolher prejuízo sem saber, e é por isso que os dois guardas de
 * `custo-da-nutricao.test.ts` são derivados (a fatia do médico, e a sobra
 * contra o custo de infra) em vez de escolhidos.
 *
 * (A decisão do dono, set/2026, foi manter os preços de hoje e dimensionar o
 * teto para o PIOR caso: "vamos continuar cobrando os preços que temos e
 * deixar o limite de mensagens no pior caso". A alternativa medida — subir o
 * Premium para R$ 24,90, onde a IA cairia a 30% — foi considerada e NÃO
 * adotada. Fica escrito para ser uma decisão, e não um esquecimento.)
 *
 * ⚠️ **O TETO É SÓ DA NUTRICIONISTA.** Ele conta as linhas de
 * `CANAIS_DA_NUTRICIONISTA` (`nutricao` e `prato`) e mais nada: o chat clínico
 * do médico — que ELE paga, pela franquia do plano dele — nunca é limitado por
 * este número. `nutricao-so-da-nutricionista.test.ts` é a catraca disso.
 *
 * ⚠️ **E "perto da borda" é do lado da MARGEM, nunca do lado dela.** Para a
 * paciente o número é folgado — o uso esperado é de duas por dia, e quem
 * planeja as refeições da semana faz cinco ou seis de uma vez. O teto existe
 * para o caso extremo, não para ser encontrado no uso normal; quem está
 * apertado contra ele é a conta, não a assinante.
 */
export const LIMITE_DIARIO = 10;

/**
 * Quantas perguntas quem NÃO assina tem — por SEMANA, e não por dia.
 *
 * ⚠️ **Uma amostra que nunca acaba não converte ninguém, e uma que não existe
 * não convence ninguém.** Três por semana é o meio: dá para experimentar a
 * nutricionista de verdade (não uma tela de propaganda) e não dá para viver
 * dela. Por semana, e não por dia, porque 2 por dia seriam 60 por mês — a
 * assinatura deixaria de ter o que vender.
 *
 * ⚠️ **PARA TRANCAR DE VEZ, ponha 0.** A régua já trata esse caso: a primeira
 * pergunta de quem não assina cai no paywall. É a única linha a mexer.
 */
export const AMOSTRA_SEMANAL = 3;

/** Dias da janela da amostra. Sete: a semana corrida, nunca o domingo. */
export const JANELA_DA_AMOSTRA_DIAS = 7;

export type EntradaDoAcesso = {
  /**
   * `true` assinante · `false` não assina · **`null` não deu para ler**.
   *
   * ⚠️ `null` LIBERA (ver `decidirAcesso`). Punir a paciente por uma leitura
   * que falhou do NOSSO lado é o defeito que este repositório já pagou seis
   * vezes com outro nome: "não consegui ler" com cara de "não há nada".
   */
  premium: boolean | null;
  /** Modo Cuidado — o luto. */
  careMode: boolean;
  /** Perguntas já feitas hoje, ou `null` quando a contagem falhou. */
  usadasHoje: number | null;
  /** Perguntas já feitas nos últimos sete dias, ou `null`. */
  usadasNaSemana: number | null;
};

export type MotivoDoBloqueio = "teto_diario" | "sem_premium";

export type Acesso = {
  pode: boolean;
  /** Só quando `pode` é falso. */
  motivo: MotivoDoBloqueio | null;
  /** Quantas ainda cabem hoje. `null` quando não deu para contar. */
  restantesHoje: number | null;
  /**
   * Está gastando a amostra grátis? A tela usa isto para dizer quantas sobram
   * — sem o aviso, a paciente descobre a parede batendo nela.
   */
  amostra: boolean;
  /** Quantas da amostra ainda sobram nesta semana. `null` fora da amostra. */
  restantesNaAmostra: number | null;
};

/**
 * A decisão. Pura: nenhuma leitura, nenhum relógio.
 *
 * ⚠️ **A ORDEM DAS REGRAS É A RÉGUA.** O teto diário é conferido PRIMEIRO,
 * antes de qualquer isenção — senão o Modo Cuidado e a leitura que falhou
 * viravam duas portas para consumo ilimitado, que é exatamente o que o teto
 * existe para fechar.
 */
export function decidirAcesso(e: EntradaDoAcesso): Acesso {
  const hoje = e.usadasHoje;

  /* 1 · O TETO, SEMPRE E PARA TODOS. */
  if (hoje !== null && hoje >= LIMITE_DIARIO) {
    return {
      pode: false,
      motivo: "teto_diario",
      restantesHoje: 0,
      amostra: false,
      restantesNaAmostra: null,
    };
  }

  const restantesHoje = hoje === null ? null : Math.max(0, LIMITE_DIARIO - hoje);

  /* 2 · ASSINANTE — o caminho normal. */
  if (e.premium === true) {
    return {
      pode: true,
      motivo: null,
      restantesHoje,
      amostra: false,
      restantesNaAmostra: null,
    };
  }

  /* 3 · MODO CUIDADO NÃO VÊ PAYWALL.
     Quem acabou de perder uma gestação não recebe convite de assinatura — é a
     mesma regra que tirou o tutorial, a festa e o desafio de grupo do luto. E
     comer bem depois de uma perda continua sendo cuidado: fechar a porta aqui
     seria cobrar pela única coisa que ainda serve a ela nesta aba.
     O teto do passo 1 continua valendo, então isto não é porta aberta. */
  if (e.careMode) {
    return { pode: true, motivo: null, restantesHoje, amostra: false, restantesNaAmostra: null };
  }

  /* 4 · NÃO SEI SE ELA ASSINA → ATENDE.
     `consultorioDaPaciente` já falha fechado para o LUTO (não sei = luto), e
     aqui a direção segura é a oposta: o pior caso de liberar é uma pergunta
     que não foi paga; o de bloquear é uma assinante pagando e batendo numa
     parede que o defeito é nosso. Continua limitado pelo teto. */
  if (e.premium === null) {
    return { pode: true, motivo: null, restantesHoje, amostra: false, restantesNaAmostra: null };
  }

  /* 5 · NÃO ASSINA — a amostra da semana. */
  const semana = e.usadasNaSemana;
  if (semana !== null && semana >= AMOSTRA_SEMANAL) {
    return {
      pode: false,
      motivo: "sem_premium",
      restantesHoje: 0,
      amostra: true,
      restantesNaAmostra: 0,
    };
  }
  return {
    pode: true,
    motivo: null,
    restantesHoje,
    amostra: true,
    restantesNaAmostra: semana === null ? null : Math.max(0, AMOSTRA_SEMANAL - semana),
  };
}

/**
 * O recado que a tela mostra quando a porta fecha.
 *
 * ⚠️ **Mora aqui, e não no JSX, pela razão de sempre**: é texto que o dono
 * relê e corrige, e texto enterrado num componente é texto que ninguém revisa.
 *
 * ⚠️ E nenhum dos dois COBRA nem culpa. "Você usou tudo" e "você não assinou"
 * põem a falta nela; o que estas frases dizem é o FATO e o que fazer a seguir.
 * Há teste com lista de palavras proibidas.
 */
export function recadoDoBloqueio(motivo: MotivoDoBloqueio): { titulo: string; texto: string } {
  if (motivo === "teto_diario") {
    return {
      titulo: "Por hoje é isto 💛",
      texto:
        `A nutricionista responde até ${LIMITE_DIARIO} perguntas por dia. ` +
        "Amanhã ela recomeça do zero — e o que você já perguntou continua aqui.",
    };
  }
  return {
    titulo: "A nutricionista é do Premium",
    texto:
      `A amostra é de ${AMOSTRA_SEMANAL} perguntas por semana, e ela volta na ` +
      "semana que vem. No Premium ela responde todo dia, lê a foto do seu " +
      "prato e monta a refeição com o que você tem em casa.",
  };
}

/**
 * O aviso da amostra: quantas perguntas grátis ainda sobram nesta semana.
 *
 * ⚠️ **SEM ELE, A PACIENTE DESCOBRE A PAREDE BATENDO NELA.** É o requisito que
 * o tipo `Acesso` já declarava e que ficou sem tela por uma volta: ela usa as
 * três perguntas ao longo de uma semana, sem nada dizendo que são contadas, e
 * na quarta encontra um convite de assinatura que parece ter aparecido do nada.
 *
 * ⚠️ **`null` é "não sei", e "não sei" NÃO FALA.** A contagem falha aberta de
 * propósito (`usoDaNutricionista` devolve `null` quando o banco não responde),
 * e um número inventado aqui seria pior que o silêncio: dizer "resta 1" para
 * quem tem três é encurtar a amostra por causa de uma falha de rede.
 *
 * ⚠️ **E ele NÃO COBRA.** Nada de "você já usou" nem de "não perca" — a frase
 * diz o FATO e o que continua valendo. Mesma lista de palavras proibidas do
 * `recadoDoBloqueio`, com teste.
 */
export function recadoDaAmostra(restantes: number | null): string | null {
  if (restantes === null) return null;
  if (restantes <= 0) return "Essa foi a última pergunta grátis desta semana.";
  if (restantes === 1) return "Resta 1 pergunta grátis nesta semana.";
  return `Restam ${restantes} perguntas grátis nesta semana.`;
}
