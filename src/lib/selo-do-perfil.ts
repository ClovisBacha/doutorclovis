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
  if (semanas > SEMANA_MAXIMA) return null;
  return `${semanas} ${semanas === 1 ? "semana" : "semanas"}`;
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
 * A estranha consegue abrir o meu perfil?
 *
 * ⚠️ Com o perfil FECHADO (o padrão de toda paciente), não — e o espelho tem de
 * dizer isso em vez de desenhar um perfil bonito que ninguém alcança. É a
 * informação mais útil que esta tela dá para a maioria das pacientes: a de que
 * elas não estão expostas a ninguém.
 */
export function personaAlcancaOPerfil(p: Persona, perfilPublico: boolean): boolean {
  if (p === "amiga") return true;
  if (p === "seguidora") return true;
  return perfilPublico;
}
