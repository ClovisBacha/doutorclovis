/**
 * O QUE O PERFIL PÚBLICO CONTA SOBRE A GESTAÇÃO — a régua, longe do JSX.
 *
 * Pedido do dono: "a ideia aqui é fornecer o básico como tempo de gestação da
 * criança e nome; outras coisas são realmente sensíveis, e não podemos expor a
 * paciente sem ela saber".
 *
 * ─── ISTO REABRE UMA REGRA, E A REABERTURA É DELIBERADA ────────────────────
 *
 * `src/lib/amigas.ts` proíbe a semana pelo nome — "Nada clínico sai daqui:
 * sem semanas, sem DPP, sem peso, sem pressão" — e a razão escrita lá NÃO é
 * privacidade, é LUTO: é o que permite a aba das Amigas continuar de pé quando
 * uma gestação termina mal.
 *
 * Na rede social a mesma preocupação tem outra resposta, e é por isso que a
 * regra pode ser reaberta AQUI sem ser desfeita LÁ:
 *
 *  · nas Amigas o perfil continua visível no luto (a aba é a rede de apoio
 *    dela, e tirá-la seria isolá-la) — então o dado do corpo não pode estar
 *    lá, porque não haveria como escondê-lo sem anunciar a perda;
 *  · na rede social o Modo Cuidado já torna o perfil inteiro `indisponivel`
 *    (`verPerfil` devolve a mesma recusa de "não existe" e de "bloqueada"), e
 *    o selo some junto, sem uma linha nova e sem contar nada a ninguém.
 *
 * A regra das Amigas continua valendo nas Amigas. Aqui ela é exceção
 * declarada, e o portão de `emCuidado` mora DENTRO desta função para que
 * nenhuma tela precise lembrar disso.
 *
 * ─── DUAS CHAVES, NUNCA UMA ────────────────────────────────────────────────
 *
 * ⚠️ Uma chave só ("mostrar dados do bebê") obrigaria quem quer publicar o
 * NOME do bebê a publicar junto a SEMANA, que é o dado clínico. São duas
 * decisões diferentes, tomadas por razões diferentes, e as duas nascem
 * DESLIGADAS — pela mesma razão escrita em `PERFIL_PUBLICO_PADRAO`.
 */

/** Nasce desligado: publicar a idade gestacional é decisão dela, não padrão. */
export const MOSTRAR_SEMANA_PADRAO = false;

/** Idem para o nome do bebê. Duas chaves, duas decisões. */
export const MOSTRAR_BEBE_PADRAO = false;

/**
 * Teto de semanas que o selo aceita.
 *
 * ⚠️ Acima disto o selo CALA em vez de mostrar um número absurdo. `computeGestation`
 * conta para sempre a partir da DUM: uma paciente que corrigiu a data, ou que
 * pariu sem o app saber, apareceria como "47 semanas" no perfil — que não é só
 * errado, é a tela dizendo a estranhos que alguma coisa deu errado com ela.
 */
export const SEMANA_MAXIMA = 42;

export type EntradaDoSelo = {
  /** Dias de gestação, de `computeGestation`. `null` = sem DUM conhecida. */
  totalDias: number | null;
  /** Já nasceu? (`patient_profiles.birth_date` preenchido.) */
  nasceu: boolean;
  /** Modo Cuidado ligado. */
  emCuidado: boolean;
  mostrarSemana: boolean;
  mostrarBebe: boolean;
  nomeDoBebe: string | null;
};

export type Selo = {
  /** "28 semanas", ou `null` quando não há o que dizer. */
  semana: string | null;
  /** O nome do bebê, ou `null`. */
  bebe: string | null;
};

/**
 * O que aparece no perfil público.
 *
 * ⚠️ **O número sai da MESMA aritmética de `idadeGestacional`** (`floor(dias/7)`),
 * e é por isso que ele não é uma segunda régua: o que muda é a REDAÇÃO — o
 * médico lê `36s4d` porque os dias mudam a conduta, e um perfil social lê "36
 * semanas" porque ninguém escreve o dia na bio. Arredondar diferente aqui faria
 * a mesma paciente ser 36s numa tela e 37 semanas noutra, que é a lição que
 * `idadeGestacional` já custou uma vez.
 */
export function seloDoPerfil(e: EntradaDoSelo): Selo {
  /* O bebê pode aparecer sem a semana e vice-versa — as chaves são
     independentes de propósito. */
  const bebe = e.emCuidado ? null : e.mostrarBebe ? nomeLimpo(e.nomeDoBebe) : null;

  return { semana: semanaPublica(e), bebe };
}

function nomeLimpo(nome: string | null): string | null {
  const n = (nome ?? "").trim();
  return n || null;
}

/**
 * A frase da semana — a ÚNICA no app inteiro.
 *
 * ⚠️ Ela cala em cinco casos, e cada um deles é um defeito que existiria sem
 * ele:
 *
 *  1. **Modo Cuidado** — o portão mora aqui, e não em cada tela, pela mesma
 *     razão de `humorDaJornada`: uma segunda régua faria a semana aparecer
 *     numa das superfícies para quem acabou de perder a gestação.
 *  2. **Já nasceu** — `computeGestation` conta para sempre, então a mãe que
 *     pariu na 39ª apareceria como "47 semanas" e a foto do recém-nascido
 *     sairia carimbada com uma semana de gravidez.
 *  3. **Sem DUM** — silêncio, nunca "0 semanas" nem "—". O perfil de quem
 *     ainda não preencheu a data não deve exibir um campo quebrado.
 *  4. **Acima do teto** — ver `SEMANA_MAXIMA`.
 *  5. **A chave desligada** — que é o pedido do dono inteiro.
 */
export function semanaPublica(e: EntradaDoSelo): string | null {
  if (!e.mostrarSemana) return null;
  if (e.emCuidado) return null;
  if (e.nasceu) return null;
  if (e.totalDias == null || e.totalDias < 0) return null;
  const semanas = Math.floor(e.totalDias / 7);
  /* ⚠️ "0 semanas" não é silêncio: a régua promete calar quando não há o que
     dizer e devolvia um número. A jornada do próprio app começa na semana 1
     (o banco de aulas vai de D 7 a D 300), e ninguém sabe que está grávida
     antes disso. */
  if (semanas < 1) return null;
  if (semanas > SEMANA_MAXIMA) return null;
  return `${semanas} ${semanas === 1 ? "semana" : "semanas"}`;
}

/* ══════════════════════════════════════════════════════════════════════════
   O CARIMBO DO STORY — Fase 3
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * A semana que vai no canto da foto do story.
 *
 * ⚠️ **A ARITMÉTICA É A MESMA do selo do perfil, e o PORTÃO é outro — de
 * propósito.** As duas superfícies respondem "que semana aparece em público",
 * então uma régua só faria as duas concordarem sempre. Mas o que as libera é
 * diferente, e tem de ser:
 *
 *  · o selo do perfil é uma chave PERMANENTE: ela liga uma vez e a semana fica
 *    lá, atualizando-se sozinha, para todo mundo que abrir o perfil;
 *  · o carimbo é um ato POR PUBLICAÇÃO: ela vê a foto carimbada, decide, e
 *    publica — e a foto some em 24 horas.
 *
 * Amarrar o carimbo à chave do perfil obrigaria quem quer mandar UMA foto com
 * a semana a publicar a semana no perfil para sempre. O contrário — carimbar
 * sozinho porque a chave está ligada — seria o app decidindo por ela o que vai
 * na foto dela.
 *
 * Os SILÊNCIOS continuam sendo os mesmos, porque moram na régua: Modo Cuidado,
 * depois do parto, sem DUM e acima de 42 semanas não carimbam nada, e nenhuma
 * tela precisa lembrar disso.
 */
export function semanaParaCarimbo(e: EntradaDoSelo): string | null {
  return semanaPublica({ ...e, mostrarSemana: true });
}

/* ══════════════════════════════════════════════════════════════════════════
   A ABA "DO BEBÊ" — Fase 2
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * O que a aba "Do bebê" mostra.
 *
 * ─── ELA JÁ EXISTIA, VAZIA, PROMETENDO ─────────────────────────────────────
 *
 * `ABAS_DO_PERFIL` tem duas abas desde o primeiro dia, e a segunda dizia "Os
 * marcos da gestação vão aparecer aqui 💛" — para QUALQUER perfil, inclusive o
 * de terceiro. Era a única promessa não paga da rede.
 *
 * ─── E ELA NÃO ACRESCENTA FATO NENHUM ──────────────────────────────────────
 *
 * ⚠️ **Tudo aqui é DERIVADO da semana**, e é isso que resolve a objeção de a
 * chave `mostrar_semana` passar a governar duas coisas: quem sabe que ela está
 * de 28 semanas já sabe que o bebê tem o tamanho de uma berinjela — é o mesmo
 * fato em outras palavras, e a tabela é igual para toda gestante do mundo.
 * Se um dia esta aba precisar de um dado que NÃO sai da semana, ele precisa de
 * chave PRÓPRIA, e não desta.
 *
 * ⚠️ **NADA de marcos de exame.** `consultaForWeek` devolve "TOTG", "ultrassom
 * morfológico", "hemograma" — a agenda clínica dela. Publicar isso num feed
 * social seria transformar o perfil em prontuário, e é o oposto do que o dono
 * pediu ("outras coisas são realmente sensíveis").
 */
/** A tabela do bebê começa aqui — antes disso não há o que mostrar. */
export const SEMANA_COM_TABELA = 4;

export type BebeNoPerfil = {
  emoji: string;
  fruta: string;
  tamanho: string;
  peso: string;
  sobre: string;
};

export function bebeDoPerfil(
  e: EntradaDoSelo,
  opts: { souEu: boolean },
  tabela: (semana: number) => { size: string; weight: string; fruit: string; desc: string } | null,
  emoji: (semana: number) => string,
): BebeNoPerfil | null {
  /* ⚠️ Modo Cuidado cala inclusive para ELA. O resto do perfil dela continua
     de pé (os posts são a memória dela), mas "seu bebê está do tamanho de uma
     berinjela" no presente é exatamente o que o Modo Cuidado existe para não
     dizer. */
  if (e.emCuidado) return null;
  if (e.nasceu) return null;
  if (e.totalDias == null || e.totalDias < 0) return null;

  /* ⚠️ Para TERCEIROS, a mesma chave da semana — porque é o mesmo fato. Para
     ela, sempre: é a jornada dela, e a aba é o lugar onde ela a vê. */
  if (!opts.souEu && !e.mostrarSemana) return null;

  const semana = Math.floor(e.totalDias / 7);
  /* ⚠️ A tabela do bebê começa na 4ª semana (`WEEK_MIN`), e `babyForWeek`
     CLAMPA para ela — pedir a semana 2 devolveria os dados da 4 sem avisar. O
     piso mora aqui para a aba calar em vez de mentir. */
  if (semana < SEMANA_COM_TABELA) return null;
  /* ⚠️ **E o TETO, que a régua não tinha.** `babyForWeek` CLAMPA
     (`BABY_BY_WEEK[clamp(4, 42, week)] ?? BABY_BY_WEEK[40]`) e nunca devolve
     `null`: sem este corte, a paciente de 50 semanas — DUM corrigida, ou uma
     leitura pós-termo — veria a aba do bebê de 40, como se fosse a dela.
     O teste já cobrava isso; quem o cumpria era o DUBLÊ, que devolvia `null`
     fora da faixa enquanto o colaborador real clampa. Um dublê mais permissivo
     que a coisa real é um teste que mede a si mesmo. */
  if (semana > SEMANA_MAXIMA) return null;
  const dados = tabela(semana);
  if (!dados) return null;
  return {
    emoji: emoji(semana),
    fruta: dados.fruit,
    tamanho: dados.size,
    peso: dados.weight,
    sobre: dados.desc,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   O ESPELHO — "ver meu perfil como visitante"
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * As três personas do espelho.
 *
 * ⚠️ **Abstratas, e nunca uma pessoa real.** "Ver como a Marina me vê" seria um
 * verificador de bloqueio e revelaria por tabela quem segue quem — e a lista de
 * seguidores deste app não é pública de propósito.
 */
/**
 * A linha de `patient_profiles` vira a entrada da régua.
 *
 * ⚠️ **Isto mora aqui, e não num adaptador dentro do servidor, por causa de uma
 * mutação que passou verde.** A verificação da Fase 1 cravou
 * `mostrarSemana: true, mostrarBebe: true` no adaptador — desligando o
 * consentimento inteiro — e os 3.149 testes continuaram passando, porque a
 * única cobertura daquele trecho era um `toContain` sobre o texto do fonte.
 * Régua pura é régua testável; adaptador escondido no servidor não é.
 */
export function entradaDoSelo(
  linha: {
    care_mode?: boolean | null;
    birth_date?: string | null;
    baby_name?: string | null;
    mostrar_semana?: boolean | null;
    mostrar_bebe?: boolean | null;
  } | null,
  totalDias: number | null,
): EntradaDoSelo {
  return {
    totalDias,
    nasceu: !!linha?.birth_date,
    emCuidado: !!linha?.care_mode,
    /* ⚠️ Ausente vale FALSE — nunca `?? true`. É o que faz um banco sem as
       colunas se comportar como "ela não ligou nada", que é a verdade. */
    mostrarSemana: linha?.mostrar_semana === true,
    mostrarBebe: linha?.mostrar_bebe === true,
    nomeDoBebe: linha?.baby_name ?? null,
  };
}

export type Persona = "estranha" | "seguidora" | "amiga";

export const PERSONAS: { chave: Persona; rotulo: string; sub: string }[] = [
  {
    chave: "estranha",
    rotulo: "Uma estranha",
    sub: "Alguém que achou você na busca e não te segue",
  },
  { chave: "seguidora", rotulo: "Quem me segue", sub: "Já teve o pedido aceito" },
  { chave: "amiga", rotulo: "Uma amiga", sub: "Entrou pelo seu convite, na aba Amigas" },
];

/**
 * O que cada persona enxerga, em forma de argumentos para `podeVerPost`.
 *
 * ⚠️ **`euId` é um SENTINELA, nunca o meu id.** `podeVerPost` tem um
 * curto-circuito na primeira linha (`euId === post.autorId → true`, "a dona
 * sempre vê os dela"), então passar o meu próprio id faria TODO post passar —
 * inclusive os da camada `amigas` — e a tela afirmaria que uma seguidora vê o
 * desabafo de terça. Sem erro, sem log, e com ela publicando confiando naquilo.
 * É o pior desfecho possível deste recurso, e é um `===` de distância.
 */
export const OLHO_DA_PREVIA = "previa";

export function olharDe(p: Persona): {
  euId: string;
  sigoAtivo: boolean;
  somosAmigas: boolean;
  bloqueado: boolean;
} {
  return {
    euId: OLHO_DA_PREVIA,
    /* A amiga também segue: no app, quem entrou pelo convite enxerga a camada
       `seguidores` — `podeVerPost` aceita `sigoAtivo || somosAmigas`. Marcar só
       `somosAmigas` faria a prévia da amiga esconder um post que ela vê. */
    sigoAtivo: p === "seguidora" || p === "amiga",
    somosAmigas: p === "amiga",
    bloqueado: false,
  };
}

/**
 * O CONTEXTO da prévia: com que olhos `montarPosts` roda.
 *
 * ⚠️ Puro e testável pela mesma razão de `entradaDoSelo`: a verificação mutou
 * a escolha da persona (`persona === "amiga" ? … : …`, montando a prévia da
 * estranha com o meu id) e nenhum teste ficou vermelho.
 */
export function contextoDaPersona(p: Persona, alvoId: string) {
  const olho = olharDe(p);
  return {
    euId: olho.euId,
    sigo: olho.sigoAtivo ? new Set([alvoId]) : new Set<string>(),
    amigas: olho.somosAmigas ? new Set([alvoId]) : new Set<string>(),
    /* Bloqueio é outra pergunta, e o espelho não é o lugar de simulá-la. */
    bloqueio: new Set<string>(),
  };
}

/**
 * QUEM ALCANÇA ESTE PERFIL — a régua, e ela vale nos DOIS lados.
 *
 * ⚠️ **Esta função nasceu servindo só o espelho, e isso era um defeito grave.**
 * `verPerfil` NUNCA conferiu `perfil_publico` para um visitante de verdade: com
 * o uuid em mãos — e ele viaja em toda reação, todo story visto, todo pedido de
 * seguir — qualquer paciente autenticada abria qualquer perfil, fechado ou não.
 * Enquanto o perfil só tinha nome, foto e bio, era exposição pequena; a Fase 1
 * pôs ali a idade gestacional e o nome do bebê.
 *
 * E o pior: o espelho AFIRMAVA a tranca que o servidor não tinha. A paciente de
 * perfil fechado lia "ela não consegue abrir o seu perfil" e ligava o selo
 * confiando naquilo. Uma tela de verificação que erra para o lado de "você está
 * protegida" é pior que não existir.
 *
 * Agora é uma régua só, chamada pelos dois caminhos: o real (`verPerfil`, com o
 * vínculo de verdade) e o do espelho (com o vínculo da persona). Se um dia elas
 * divergirem, divergem juntas.
 */
export function alcancaOPerfil(v: {
  perfilPublico: boolean;
  souEu: boolean;
  sigoAtivo: boolean;
  somosAmigas: boolean;
}): boolean {
  /* A dona sempre alcança o próprio perfil — inclusive fechado. */
  if (v.souEu) return true;
  /* Quem já foi aceita, e quem entrou pelo convite das Amigas, continuam
     vendo: fechar o perfil é impedir gente NOVA, não expulsar quem já entrou. */
  if (v.sigoAtivo || v.somosAmigas) return true;
  return v.perfilPublico;
}
