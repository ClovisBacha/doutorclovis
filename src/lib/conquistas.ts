/**
 * AS CONQUISTAS — catálogo, raridade e recompensa.
 *
 * ─── POR QUE ISTO SAIU DE `achievements.functions.ts` (ago/2026) ────────────
 *
 * O catálogo é lido pela TELA (a aba de conquistas desenha os 34 cartões) e
 * pelo SERVIDOR (quem concede). Enquanto morava junto das server functions,
 * a tela arrastava `typedDb`, `computeGestation` e `grantSementinhas` para o
 * pacote do navegador só para saber o título de um emblema.
 *
 * Aqui não há import de servidor nenhum. É texto e régua — a mesma razão de
 * `gratidao.ts`, `exercicios.ts` e `cartas-do-bebe.ts`: é isto que o dono relê
 * e corrige, e um catálogo enterrado num arquivo de banco é um catálogo que
 * ninguém revisa.
 *
 * ─── A RARIDADE, E POR QUE ELA PRECISA DE RÉGUA OBJETIVA ────────────────────
 *
 * Pedido do dono: "níveis de raridade — comum (cinza em volta), raro (azul) e
 * épico (dourado) — e cada conquista dá um pouco de semente; maior dificuldade,
 * mais sementes".
 *
 * ⚠️ O risco de raridade é ela virar GOSTO. "Achei que essa é épica" não
 * sobrevive à segunda pessoa que mexe no arquivo, e aí a paciente vê duas
 * conquistas de esforço parecido com molduras diferentes — o que faz o sistema
 * inteiro parecer arbitrário. Então a régua é sobre a NATUREZA do feito, não
 * sobre a impressão:
 *
 *   comum → PRIMEIRA VEZ. Ela fez uma coisa uma vez. É descoberta.
 *   raro  → REPETIÇÃO SUSTENTADA. Ela voltou N vezes. É hábito.
 *   épico → MARCO QUE LEVA MESES. Não dá para apressar nem repetir.
 *
 * Um teste cobra que toda conquista caiba numa das três descrições.
 */

/** As cinco prateleiras da tela de conquistas. */
export type CategoriaConquista = "saude" | "diario" | "bebe" | "educacao" | "familia";

export type Raridade = "comum" | "raro" | "epico";

export type RaridadeInfo = {
  chave: Raridade;
  label: string;
  /** A régua — o que faz uma conquista ser desta raridade. */
  criterio: string;
  /** Sementinhas concedidas. Ver `ORCAMENTO_DAS_CONQUISTAS`. */
  sementinhas: number;
  /** Classes do anel em volta do cartão, na tela. */
  anel: string;
  /** Cor do texto do rótulo. */
  texto: string;
};

/**
 * ⚠️ OS NÚMEROS SAEM DA ECONOMIA, NÃO DO GOSTO.
 *
 * Lidos de `economia-sementinhas.ts` na hora de calibrar:
 *   · a loja INTEIRA custa 10.969 🌱 (704 grátis + 10.265 premium)
 *   · o ganho TÍPICO é 35 🌱/dia, o teto 68
 *   · a jornada dura ~280 dias
 *
 * Com o catálogo atual, desbloquear TODAS as conquistas paga por volta de
 * 1.200 🌱 — cerca de 11% do sink total, espalhados por nove meses. É bônus
 * que se sente sem virar renda: quem só coleciona conquista não zera a loja.
 *
 * O teste `conquistas.test.ts` recalcula essa soma e reprova se ela passar de
 * um quinto do total da loja — o dia em que alguém acrescentar vinte épicas de
 * uma vez, a economia avisa antes da paciente.
 */
export const RARIDADES: Record<Raridade, RaridadeInfo> = {
  comum: {
    chave: "comum",
    label: "Comum",
    criterio: "Primeira vez que ela faz alguma coisa — é descoberta, não esforço acumulado.",
    sementinhas: 15,
    /* Cinza, como o dono pediu. Anel visível mas quieto: comum é a maioria, e
       a maioria não pode brilhar ou o brilho perde o sentido. */
    anel: "border-slate-300 bg-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),var(--shadow-card)]",
    texto: "text-slate-500",
  },
  raro: {
    chave: "raro",
    label: "Raro",
    criterio: "Repetição sustentada — ela voltou N vezes. É hábito, e hábito custa semanas.",
    sementinhas: 40,
    anel: "border-sky-400 bg-sky-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),var(--shadow-card)]",
    texto: "text-sky-600",
  },
  epico: {
    chave: "epico",
    label: "Épico",
    criterio:
      "Marco que leva meses e não dá para apressar nem repetir — o fim de uma etapa da jornada.",
    sementinhas: 120,
    /* Dourado. `shadow` entra só aqui: é a única raridade que pode chamar
       atenção de longe numa grade de 34 cartões. */
    anel: "border-amber-400 bg-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_0_0_1px_rgba(251,191,36,0.35),var(--shadow-card)]",
    texto: "text-amber-600",
  },
};

/** A ordem de exibição — do mais raro para o mais comum, quando há legenda. */
export const RARIDADES_EM_ORDEM: Raridade[] = ["epico", "raro", "comum"];

export function sementinhasDaRaridade(r: Raridade): number {
  return RARIDADES[r].sementinhas;
}

export type ConquistaDef = {
  key: string;
  title: string;
  description: string;
  emoji: string;
  category: CategoriaConquista;
  raridade: Raridade;
  /**
   * Só acontece DEPOIS do parto.
   *
   * Sem marcá-las, a gestante via "3 de 18" com um anel de progresso que nunca
   * chegava perto de 100% — o teto real dela era 13, e nada na tela dizia isso:
   * parecia que ela estava falhando em conquistas que ainda nem eram possíveis.
   */
  posParto?: true;
};

/* ══════════════════════════════════════════════════════════════════════════
   O CATÁLOGO

   ⚠️ ORDEM DE LEITURA: as dezoito primeiras são as originais, reclassificadas.
   As demais entraram em ago/2026, quando o app tinha ganhado meditação com
   sequência, gratidão com marcos, cartas pro bebê, exercício por queixa e
   troféus de dia fechado — e NENHUM deles tinha conquista. A paciente podia
   meditar trinta dias seguidos sem que a aba de conquistas soubesse que ela
   existia.

   ⚠️ TODA CONQUISTA NOVA É PROVADA PELO LEDGER, e isso é decisão, não
   conveniência. As linhas `wellness:<atividade>:<ciclo>:<dia>` são escritas
   só pelo servidor, no instante em que a atividade acontece — as mesmas que
   `trofeusDasChaves` já conta. Três consequências que nenhuma outra fonte
   daria:

     · valem RETROATIVAMENTE (quem já meditou 30 vezes ganha na hora, sem
       migration nenhuma);
     · não dá para forjar do navegador, então podem valer Sementinhas;
     · sobrevivem à troca de aparelho, porque não moram no `localStorage`.

   O `<ciclo>` no meio da chave é o que separa uma gestação da seguinte — sem
   ele, quem já teve outro bebê no app começaria a segunda jornada com as
   conquistas da primeira.
   ══════════════════════════════════════════════════════════════════════════ */

export const CONQUISTAS: ConquistaDef[] = [
  // ── As originais ────────────────────────────────────────────────────────
  {
    key: "first_login",
    title: "Bem-vinda!",
    description: "Criou sua conta no portal",
    emoji: "🌟",
    category: "bebe",
    raridade: "comum",
  },
  {
    key: "profile_complete",
    title: "Perfil Completo",
    description: "Preencheu todas as informações do perfil",
    emoji: "✅",
    category: "bebe",
    raridade: "comum",
  },
  {
    key: "first_health_log",
    title: "Saúde em Dia",
    description: "Registrou o primeiro dado de saúde",
    emoji: "❤️",
    category: "saude",
    raridade: "comum",
  },
  {
    key: "health_7_days",
    title: "Semana Saudável",
    description: "7 registros de saúde realizados",
    emoji: "💪",
    category: "saude",
    raridade: "raro",
  },
  {
    key: "first_journal",
    title: "Memória Afetiva",
    description: "Escreveu o primeiro diário",
    emoji: "📝",
    category: "diario",
    raridade: "comum",
  },
  {
    key: "journal_10",
    title: "Escritora Dedicada",
    description: "10 entradas no diário da gestação",
    emoji: "📔",
    category: "diario",
    raridade: "raro",
  },
  {
    key: "first_kicks",
    title: "Primeiros Chutes!",
    description: "Registrou a primeira sessão de movimentos",
    emoji: "👟",
    category: "bebe",
    raridade: "comum",
  },
  {
    key: "kicks_10",
    title: "Bebê Ativo",
    description: "10 sessões de contagem de chutes",
    emoji: "⚽",
    category: "bebe",
    raridade: "raro",
  },
  /* ── ⚠️ AS TRÊS DA "ESCOLA DO BEBÊ" APONTAVAM PRO VAZIO ─────────────────
     Elas liam `course_progress`, e nada escreve nessa tabela: `completeLesson`
     só é chamada pelo `LessonSheet`, que só abre por um nó `kind: "lesson"`
     — e o construtor da trilha NÃO EMITE MAIS esse nó (o tipo existe na
     linha 1002 de `gestacao-path.tsx`, o bloco de render na 2823, o emissor
     não existe). `EscolaBebêTab` tem zero chamadores.

     Ou seja: três conquistas permanentemente impossíveis, uma delas ÉPICA
     (120 🌱), aparecendo como "🔒 bloqueada" para sempre numa grade que a
     paciente lê como "o que ainda dá pra fazer".

     ⚠️ AS CHAVES FICAM. Apagá-las tiraria a medalha de quem por acaso já a
     tivesse — o app não pode tirar de volta o que deu (a mesma lei que a
     Coroa da Coleção segue). O que muda é PARA ONDE elas apontam: a AULA DO
     DIA, que é o que ela de fato faz, tem 294 edições e já deixa rastro
     próprio no ledger (`dailyquiz:<ciclo>:<dia>`). O título e a descrição
     foram reescritos para dizer a verdade nova. */
  {
    key: "first_course",
    title: "Escola Aberta",
    description: "Respondeu a primeira aula do dia",
    emoji: "🎓",
    category: "educacao",
    raridade: "comum",
  },
  {
    key: "course_5",
    title: "Aluna Dedicada",
    description: "5 aulas do dia respondidas",
    emoji: "🏅",
    category: "educacao",
    raridade: "raro",
  },
  {
    key: "course_complete",
    title: "Mamãe Preparada!",
    description: "100 aulas do dia respondidas",
    emoji: "🏆",
    /* Cem de 294. Meses de app aberto quase todo dia — não dá pra apressar
       nem repetir, que é a definição de épico. */
    category: "educacao",
    raridade: "epico",
  },
  {
    key: "companion_invited",
    title: "Família Unida",
    description: "Convidou um acompanhante para o portal",
    emoji: "💑",
    category: "familia",
    raridade: "comum",
  },
  {
    key: "album_post",
    title: "Memórias Registradas",
    description: "Adicionou a primeira foto ao álbum da família",
    emoji: "📸",
    category: "familia",
    raridade: "comum",
  },
  {
    key: "prenatal_done",
    title: "Pré-natal Concluído!",
    description: "Checklist completo — parabéns!",
    emoji: "🥇",
    category: "bebe",
    raridade: "epico",
  },

  // ── A AULA DO DIA ───────────────────────────────────────────────────────
  // Não confundir com a Escola do Bebê (12 módulos, acima): esta é a aula da
  // professora, uma por dia, 294 no total. Prova: `dailyquiz:<ciclo>:<dia>`.
  {
    key: "aula_10",
    title: "Curiosa",
    description: "10 aulas do dia respondidas",
    emoji: "📖",
    category: "educacao",
    raridade: "raro",
  },
  {
    key: "aula_50",
    title: "Estudiosa",
    description: "50 aulas do dia respondidas",
    emoji: "🎒",
    category: "educacao",
    /* Raro, e não épico: a escada da aula já termina em `course_complete`
       (100). Dois épicos na mesma escada fariam o dourado valer metade. */
    raridade: "raro",
  },

  // ── MEDITAÇÃO ───────────────────────────────────────────────────────────
  {
    key: "medita_1",
    title: "Primeiro Respiro",
    description: "Fez a primeira meditação",
    emoji: "🧘",
    category: "saude",
    raridade: "comum",
  },
  {
    key: "medita_10",
    title: "Mente Calma",
    description: "10 meditações concluídas",
    emoji: "🕯️",
    category: "saude",
    raridade: "raro",
  },
  {
    key: "medita_30",
    title: "Serenidade",
    description: "30 meditações concluídas",
    emoji: "🌸",
    category: "saude",
    raridade: "epico",
  },

  // ── GRATIDÃO ────────────────────────────────────────────────────────────
  {
    key: "gratidao_1",
    title: "Uma Coisa Boa",
    description: "Guardou a primeira gratidão",
    emoji: "✨",
    category: "diario",
    raridade: "comum",
  },
  {
    key: "gratidao_10",
    title: "Colecionadora de Bons Dias",
    description: "10 coisas boas guardadas",
    emoji: "🌻",
    category: "diario",
    raridade: "raro",
  },
  {
    key: "gratidao_50",
    title: "Caderno Cheio",
    description: "50 coisas boas guardadas",
    emoji: "📚",
    category: "diario",
    raridade: "epico",
  },

  // ── CARTAS PRO BEBÊ ─────────────────────────────────────────────────────
  {
    key: "carta_1",
    title: "Ele Ouviu Você",
    description: "Leu a primeira carta em voz alta pro bebê",
    emoji: "💌",
    category: "bebe",
    raridade: "comum",
  },
  {
    key: "carta_10",
    title: "A Voz Preferida",
    description: "10 cartas lidas pro bebê",
    emoji: "💛",
    category: "bebe",
    raridade: "raro",
  },
  {
    key: "carta_30",
    title: "Já Se Conhecem",
    description: "30 cartas lidas pro bebê",
    emoji: "🤍",
    category: "bebe",
    raridade: "epico",
  },

  // ── MEXER O CORPO ───────────────────────────────────────────────────────
  {
    key: "exercicio_1",
    title: "Corpo em Movimento",
    description: "Fez a primeira sessão de exercícios",
    emoji: "🤸",
    category: "saude",
    raridade: "comum",
  },
  {
    key: "exercicio_10",
    title: "Alongou de Novo",
    description: "10 sessões de exercícios",
    emoji: "🧡",
    category: "saude",
    raridade: "raro",
  },
  {
    key: "exercicio_30",
    title: "Rotina de Cuidado",
    description: "30 sessões de exercícios",
    emoji: "🏃‍♀️",
    category: "saude",
    raridade: "epico",
  },

  // ── DIAS FECHADOS (as quatro atividades) e SEQUÊNCIA ────────────────────
  {
    key: "trofeu_1",
    title: "Dia Redondo",
    description: "Fechou as atividades de um dia inteiro",
    emoji: "🏵️",
    category: "bebe",
    raridade: "comum",
  },
  {
    key: "trofeu_10",
    title: "Dez Dias Redondos",
    description: "10 dias com todas as atividades feitas",
    emoji: "🏆",
    category: "bebe",
    raridade: "raro",
  },
  {
    key: "trofeu_30",
    title: "Trinta Dias Redondos",
    description: "30 dias com todas as atividades feitas",
    emoji: "👑",
    category: "bebe",
    raridade: "epico",
  },
  {
    key: "sequencia_7",
    title: "Uma Semana Seguida",
    description: "7 dias seguidos aparecendo por aqui",
    emoji: "🔥",
    category: "bebe",
    raridade: "raro",
  },
  {
    key: "sequencia_30",
    title: "Um Mês Seguido",
    description: "30 dias seguidos aparecendo por aqui",
    emoji: "☄️",
    category: "bebe",
    raridade: "epico",
  },

  // ── O CANTINHO ──────────────────────────────────────────────────────────
  {
    key: "cantinho_1",
    title: "Meu Cantinho",
    description: "Comprou o primeiro item do seu cantinho",
    emoji: "🌱",
    category: "familia",
    raridade: "comum",
  },
  {
    key: "cantinho_10",
    title: "Cantinho Florido",
    description: "10 itens no seu cantinho",
    emoji: "🪴",
    category: "familia",
    raridade: "raro",
  },

  // ── Pós-parto ───────────────────────────────────────────────────────────
  {
    key: "first_breastfeeding",
    title: "Primeira Mamada",
    description: "Registrou a primeira amamentação",
    emoji: "🤱",
    category: "bebe",
    raridade: "comum",
    posParto: true,
  },
  {
    key: "first_baby_weight",
    title: "Crescendo!",
    description: "Registrou o primeiro peso do bebê",
    emoji: "⚖️",
    category: "saude",
    raridade: "comum",
    posParto: true,
  },
  {
    key: "first_vaccine",
    title: "Protegido",
    description: "Primeira vacina do bebê registrada",
    emoji: "💉",
    category: "saude",
    raridade: "comum",
    posParto: true,
  },
  {
    key: "first_baby_milestone",
    title: "Primeiro Marco",
    description: "Registrou o primeiro marco do bebê",
    emoji: "🌟",
    category: "bebe",
    raridade: "comum",
    posParto: true,
  },
];

/** As que só existem depois do parto — usado para separar na tela. */
export function ehPosParto(key: string): boolean {
  return CONQUISTAS.some((d) => d.key === key && d.posParto);
}

export function conquistaPorChave(key: string): ConquistaDef | undefined {
  return CONQUISTAS.find((d) => d.key === key);
}

/**
 * Quanto vale desbloquear tudo. Usado pelo teste que protege a economia.
 */
export function orcamentoDasConquistas(defs: ConquistaDef[]): number {
  return defs.reduce((soma, d) => soma + sementinhasDaRaridade(d.raridade), 0);
}

/** Quantas de cada raridade — para a legenda e para o teste de equilíbrio. */
export function contarPorRaridade(defs: ConquistaDef[]): Record<Raridade, number> {
  const fora: Record<Raridade, number> = { comum: 0, raro: 0, epico: 0 };
  for (const d of defs) fora[d.raridade]++;
  return fora;
}

/* ══════════════════════════════════════════════════════════════════════════
   A LEITURA DO LEDGER — pura, para poder ser testada

   Quem lê o banco é o servidor; estas funções recebem as `dedupe_key` cruas e
   respondem. Mesmo desenho de `trofeusDasChaves` em `trofeus.ts`, e pela mesma
   razão: uma contagem que só existe dentro de um handler de servidor é uma
   contagem que ninguém consegue provar sem um banco na mão.
   ══════════════════════════════════════════════════════════════════════════ */

/** As quatro atividades que deixam linha `wellness:` no ledger. */
export const ATIVIDADES_DO_DIA = ["movement", "meditation", "bonding", "gratitude"] as const;
export type AtividadeDoDia = (typeof ATIVIDADES_DO_DIA)[number];

/**
 * Quantas vezes uma atividade foi feita, no CICLO ATUAL.
 *
 * ⚠️ O ciclo importa: sem ele, quem já teve outro bebê no app começaria a
 * segunda gestação com as conquistas da primeira já desbloqueadas — e a
 * jornada nova nasceria sem nada para conquistar.
 *
 * O par `<ciclo>:<dia>` é deduplicado: a mesma atividade no mesmo dia conta
 * uma vez, por mais linhas que existam.
 */
export function vezesQueFez(
  chaves: readonly (string | null | undefined)[],
  atividade: AtividadeDoDia,
  ciclo: string,
): number {
  const dias = new Set<string>();
  for (const k of chaves) {
    const p = (k ?? "").split(":");
    if (p.length !== 4 || p[0] !== "wellness") continue;
    const [, ativ, c, dia] = p;
    if (ativ !== atividade || c !== ciclo || !/^\d+$/.test(dia)) continue;
    dias.add(dia);
  }
  return dias.size;
}

/**
 * Quantos DIAS DISTINTOS aparecem numa lista de instantes ISO.
 *
 * ⚠️ Existe porque "7 registros de saúde" e "10 entradas no diário" contavam
 * LINHAS. Dava para desbloquear as duas — ambas de raridade `raro`, cujo
 * critério declarado é *"repetição sustentada; é hábito, e hábito custa
 * semanas"* — salvando dez vezes seguidas numa tarde. A régua e a
 * implementação discordavam, e quem tinha razão era a régua.
 *
 * O dia é o LOCAL de São Paulo, e não o UTC: quem registra às 22h de Brasília
 * está gravando 01h do dia seguinte em UTC, e dois registros da mesma noite
 * contariam como dois dias. É o mesmo fuso que `todayKeySaoPaulo` usa para o
 * check-in diário — duas noções de "dia" no mesmo app é como elas divergem.
 */
export function diasDistintos(instantes: readonly (string | null | undefined)[]): number {
  const dias = new Set<string>();
  for (const iso of instantes) {
    if (!iso) continue;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) continue;
    dias.add(d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }));
  }
  return dias.size;
}

/** Quantas aulas do dia ela respondeu no ciclo (`dailyquiz:<ciclo>:<dia>`). */
export function aulasRespondidas(
  chaves: readonly (string | null | undefined)[],
  ciclo: string,
): number {
  const dias = new Set<string>();
  for (const k of chaves) {
    const p = (k ?? "").split(":");
    if (p.length !== 3 || p[0] !== "dailyquiz") continue;
    const [, c, dia] = p;
    if (c !== ciclo || !/^\d+$/.test(dia)) continue;
    dias.add(dia);
  }
  return dias.size;
}

/**
 * A maior SEQUÊNCIA de dias seguidos em que ela fez pelo menos uma atividade.
 *
 * ⚠️ Conta pelo DIA GESTACIONAL da chave, não por data de calendário. Os dois
 * andam juntos (o dia gestacional sobe um por dia), e o da chave é o único que
 * o ledger carrega — usar `created_at` daria a data em que o SERVIDOR gravou,
 * que difere quando ela fecha o dia depois da meia-noite ou está noutro fuso.
 *
 * ⚠️ E é a MAIOR sequência já feita, não a atual. A conquista é um marco —
 * "você já conseguiu sete dias seguidos" é um fato que aconteceu, e tirá-lo
 * dela porque a sequência quebrou seria transformar conquista em cobrança,
 * que é exatamente o que este app não faz. A chama do topo do Caminho continua
 * mostrando a sequência ATUAL; são perguntas diferentes.
 */
export function maiorSequencia(
  chaves: readonly (string | null | undefined)[],
  ciclo: string,
): number {
  const dias = new Set<number>();
  for (const k of chaves) {
    const p = (k ?? "").split(":");
    if (p.length !== 4 || p[0] !== "wellness") continue;
    const [, ativ, c, dia] = p;
    if (c !== ciclo || !/^\d+$/.test(dia)) continue;
    if (!(ATIVIDADES_DO_DIA as readonly string[]).includes(ativ)) continue;
    dias.add(Number(dia));
  }
  if (dias.size === 0) return 0;
  const ordenados = [...dias].sort((a, b) => a - b);
  let melhor = 1;
  let atual = 1;
  for (let i = 1; i < ordenados.length; i++) {
    if (ordenados[i] === ordenados[i - 1] + 1) atual++;
    else atual = 1;
    if (atual > melhor) melhor = atual;
  }
  return melhor;
}
