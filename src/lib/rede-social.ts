/**
 * A REDE SOCIAL DA GESTANTE — as réguas, sem JSX e sem banco.
 *
 * Dez estruturas, e elas se sustentam umas nas outras:
 *
 *   1. PERFIL          público ou privado, e quem decide é ela
 *   2. SEGUIR          assimétrico (eu sigo você, você não me segue)
 *   3. POST            foto e/ou texto
 *   4. VISIBILIDADE    de cada post, separada da do perfil
 *   5. FEED            o que eu vejo, e de quem
 *   6. REAÇÕES         o vocabulário emocional do app
 *   7. AVISOS          quem te seguiu, quem reagiu
 *   8. DESCOBERTA      como se acha alguém
 *   9. BLOQUEIO        a defesa individual, calada
 *  10. MODO CUIDADO    o portão que atravessa as nove
 *
 * ─── O QUE ESTE ARQUIVO NÃO TEM, E POR QUÊ ─────────────────────────────────
 *
 * ⚠️ **Não há comentário.** Decisão do dono, sobre a pesquisa: de 1.098
 * respostas com conselho analisadas em fóruns de gestação, **20,9% estavam
 * erradas ou enganosas e 5,5% eram potencialmente danosas** — e o grupo não se
 * autocorrige (só 5,2% das ruins foram retificadas). Num app que carrega o nome
 * do consultório, "comigo foi assim, não precisa ir ao pronto-socorro" é
 * responsabilidade do médico. Reação dá quase toda a sensação de comunidade com
 * uma fração do risco, e é reversível: dá para abrir texto depois. O contrário
 * não dá.
 *
 * ⚠️ **Não há contador público de seguidores.** Um placar de audiência num app
 * de gestação de alto risco mede popularidade num momento em que a pessoa já
 * está sendo medida clinicamente, e dá número objetivo a uma comparação que sem
 * número seria só sensação. O contador de REAÇÕES DE UM POST fica, e a
 * diferença não é de grau: reação num post é calor sobre uma coisa específica;
 * contagem de seguidores é um ranking de pessoas.
 */

/* ══════════════════════════════════════════════════════════════════════════
   1 · PERFIL
   ══════════════════════════════════════════════════════════════════════════ */

export type Perfil = {
  id: string;
  nome: string;
  bio: string | null;
  avatarUrl: string | null;
  /** Ela ligou. Padrão é FECHADO — ver `PERFIL_PUBLICO_PADRAO`. */
  publico: boolean;
  /** Modo Cuidado. Some da rede inteira, sem anunciar. */
  emCuidado: boolean;
};

/**
 * ⚠️ **O padrão é PRIVADO, e isso não é conservadorismo.**
 *
 * O grafo desta aba nasceu fechado por indicação, e é isso que a torna segura
 * SEM MODERAÇÃO: para duas contas se enxergarem, uma teve de mandar o convite
 * para a outra fora do app. O perfil público é uma exceção que a própria pessoa
 * liga — normalmente uma influenciadora, que sabe o que está fazendo e para
 * quem audiência é o trabalho.
 *
 * Nascer público inverteria isso: milhares de gestantes de alto risco expostas
 * por omissão, sem nunca terem pedido plateia.
 */
export const PERFIL_PUBLICO_PADRAO = false;

export const LIMITE_DA_BIO = 140;

/* ══════════════════════════════════════════════════════════════════════════
   2 · SEGUIR
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * `ativo` — segue de verdade, vê os posts de seguidores.
 * `pendente` — pediu para seguir um perfil PRIVADO e espera resposta.
 *
 * Não existe `recusado`: recusar APAGA a linha. Guardar a recusa bloquearia o
 * par para sempre pela chave única, e quem pediu de novo depois de um
 * mal-entendido nunca mais conseguiria — é a mesma decisão de
 * `APLICAR_DUPLAS.sql` sobre recusar um convite de dupla.
 */
export type EstadoDeSeguir = "ativo" | "pendente";

export type VinculoDeSeguir = {
  estado: EstadoDeSeguir;
} | null;

/**
 * O que acontece quando alguém toca em "Seguir".
 *
 * Perfil público → entra direto. Perfil privado → vira pedido.
 *
 * ⚠️ E as três recusas devolvem o MESMO `null`: bloqueio, Modo Cuidado e
 * "sou eu mesma". Distinguir contaria a quem foi bloqueada que ela foi
 * bloqueada (o bloqueio é calado, ver §9) e contaria a perda de quem entrou em
 * Modo Cuidado.
 */
export function aoSeguir(opts: {
  euId: string;
  alvo: Perfil;
  fuiBloqueada: boolean;
}): EstadoDeSeguir | null {
  if (opts.euId === opts.alvo.id) return null;
  if (opts.fuiBloqueada) return null;
  if (opts.alvo.emCuidado) return null;
  return opts.alvo.publico ? "ativo" : "pendente";
}

/* ══════════════════════════════════════════════════════════════════════════
   3 · POST  ·  4 · VISIBILIDADE
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * A quem o post se dirige.
 *
 * ⚠️ **É separada da do perfil, e essa separação é o recurso.** Um perfil
 * público com um post `amigas` é o caso normal, não a exceção: a influenciadora
 * publica a ultrassom para o mundo e o desabafo de terça para as seis pessoas
 * que ela conhece.
 *
 * Sem camada, o post é dirigido a "todo mundo que me segue" — que inclui a
 * sogra e a chefe —, e é o motivo número um de as pessoas não postarem coisa
 * nenhuma. A pesquisa chama isso de colapso de contexto.
 */
export type Visibilidade = "publico" | "seguidores" | "amigas";

export const VISIBILIDADES: { chave: Visibilidade; rotulo: string; sub: string }[] = [
  { chave: "publico", rotulo: "Todo mundo", sub: "Qualquer pessoa no app" },
  { chave: "seguidores", rotulo: "Quem me segue", sub: "Só quem acompanha você" },
  { chave: "amigas", rotulo: "Só as amigas", sub: "As pessoas que você conhece" },
];

export type Post = {
  id: string;
  autorId: string;
  texto: string | null;
  imagemUrl: string | null;
  visibilidade: Visibilidade;
  criadoEm: string;
};

export const LIMITE_DO_TEXTO = 500;

/** Post vazio não existe: ou tem foto, ou tem texto. */
export function postEhValido(p: { texto: string | null; temImagem: boolean }): boolean {
  return p.temImagem || !!p.texto?.trim();
}

/**
 * ⚠️ **QUEM PODE VER ESTE POST?** É a função mais importante do arquivo, e a
 * ordem das perguntas é a régua inteira.
 *
 * O Modo Cuidado e o bloqueio vêm ANTES de tudo: um post público de quem entrou
 * em luto não é público, é inexistente. E quem foi bloqueada não vê nada, nem
 * o que é público — senão o bloqueio não bloquearia coisa nenhuma.
 */
export function podeVerPost(opts: {
  post: { autorId: string; visibilidade: Visibilidade };
  euId: string | null;
  autor: Pick<Perfil, "emCuidado" | "publico">;
  /** O autor me bloqueou, ou eu bloqueei o autor. Qualquer um dos dois. */
  bloqueado: boolean;
  /** Eu sigo o autor com estado `ativo`. */
  sigoAtivo: boolean;
  /** Somos amigas pelo grafo que já existe (`saoAmigas`). */
  somosAmigas: boolean;
}): boolean {
  const { post, euId, autor } = opts;

  /* A dona vê tudo que é dela, sempre — inclusive em Modo Cuidado, porque é
     a memória dela e escondê-la seria o app apagar o que ela viveu. */
  if (euId && euId === post.autorId) return true;

  if (autor.emCuidado) return false;
  if (opts.bloqueado) return false;
  if (!euId) return false;

  if (post.visibilidade === "amigas") return opts.somosAmigas;
  if (post.visibilidade === "seguidores") return opts.sigoAtivo || opts.somosAmigas;
  /* `publico` ainda exige o perfil estar aberto: ela pode ter fechado o perfil
     depois de publicar, e a decisão nova manda sobre a antiga. */
  return autor.publico;
}

/* ══════════════════════════════════════════════════════════════════════════
   5 · FEED
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠️ **O feed é CRONOLÓGICO, e isso é decisão de produto, não preguiça.**
 *
 * Um feed ordenado por "relevância" precisa de um sinal de relevância, e o
 * único disponível aqui seria engajamento — o que faria o app promover os
 * posts que geram mais reação. Numa comunidade de gestação de alto risco, o
 * post que gera mais reação é o da emergência, e um algoritmo que aprende isso
 * transforma o susto de uma paciente no conteúdo que todas veem primeiro.
 *
 * Cronológico é previsível, explicável, e não tem nada a aprender.
 */
export function ordenarFeed<T extends { criadoEm: string }>(posts: T[]): T[] {
  return [...posts].sort((a, b) =>
    a.criadoEm < b.criadoEm ? 1 : a.criadoEm > b.criadoEm ? -1 : 0,
  );
}

/** Quantos posts por página. */
export const POSTS_POR_PAGINA = 20;

/* ══════════════════════════════════════════════════════════════════════════
   6 · REAÇÕES
   ══════════════════════════════════════════════════════════════════════════ */

export type TipoDeReacao = "amei" | "torcendo" | "emocionei" | "forca" | "abraco";

/**
 * ⚠️ **O CATÁLOGO DE REAÇÕES É O VOCABULÁRIO EMOCIONAL DO APP**, e escolher
 * errado aqui faz um dano que nenhuma tela conserta.
 *
 * O Facebook tem seis, e três delas seriam catastróficas aqui:
 *
 *  · **😂 (haha)** — numa gestação de alto risco, todo post pode ser sobre um
 *    susto. Uma risada embaixo do relato de um sangramento é indefensável, e
 *    quem tocou por engano não consegue explicar depois.
 *  · **😮 (uau)** — ambíguo por natureza. Lido como "que lindo" pela metade das
 *    pessoas e como "que horror" pela outra metade.
 *  · **😢 (triste)** — parece o certo para um post difícil e não é: numa
 *    gestante de risco, carinha triste embaixo de uma notícia lê como PENA, e
 *    pena é a coisa que ela menos quer receber.
 *
 * As cinco daqui são todas inequivocamente calorosas, e nenhuma pode ser lida
 * como julgamento. `abraco` é a que faz o conjunto funcionar: sem ela, quem
 * posta uma coisa difícil só recebe coração, o que soa comemorativo no momento
 * errado.
 */
export const REACOES: { tipo: TipoDeReacao; emoji: string; rotulo: string }[] = [
  { tipo: "amei", emoji: "❤️", rotulo: "Amei" },
  { tipo: "torcendo", emoji: "🙏", rotulo: "Torcendo" },
  { tipo: "emocionei", emoji: "🥹", rotulo: "Me emocionei" },
  { tipo: "forca", emoji: "👏", rotulo: "Força" },
  { tipo: "abraco", emoji: "🤗", rotulo: "Abraço" },
];

export const REACAO_PADRAO: TipoDeReacao = "amei";

export function reacaoConhecida(t: string): t is TipoDeReacao {
  return REACOES.some((r) => r.tipo === t);
}

export function emojiDaReacao(t: TipoDeReacao): string {
  return REACOES.find((r) => r.tipo === t)?.emoji ?? "❤️";
}

/**
 * UMA reação por pessoa por post, trocável.
 *
 * Tocar na mesma tira; tocar noutra troca. É o comportamento que todo mundo já
 * conhece, e é o que impede uma pessoa de encher um post com cinco emojis —
 * que num post sobre uma notícia difícil pareceria deboche.
 */
export function aoReagir(atual: TipoDeReacao | null, tocada: TipoDeReacao): TipoDeReacao | null {
  return atual === tocada ? null : tocada;
}

export type ContagemDeReacoes = Partial<Record<TipoDeReacao, number>>;

/** Total de reações de um post. */
export function totalDeReacoes(c: ContagemDeReacoes): number {
  return REACOES.reduce((s, r) => s + (c[r.tipo] ?? 0), 0);
}

/**
 * Os emojis que aparecem na linha do post, em ordem de quantidade.
 *
 * Teto de três: a linha vive embaixo de cada post num celular, e cinco emojis
 * mais o número empurram o texto. Quem quiser o detalhe abre.
 */
export function resumoDeReacoes(c: ContagemDeReacoes, teto = 3): string[] {
  return REACOES.filter((r) => (c[r.tipo] ?? 0) > 0)
    .sort((a, b) => (c[b.tipo] ?? 0) - (c[a.tipo] ?? 0))
    .slice(0, teto)
    .map((r) => r.emoji);
}

/* ══════════════════════════════════════════════════════════════════════════
   7 · AVISOS
   ══════════════════════════════════════════════════════════════════════════ */

export type EspecieDeAviso = "seguiu" | "pediu_para_seguir" | "reagiu" | "aceitou";

/**
 * ⚠️ **Reação NÃO manda push — só o pedido para seguir manda.**
 *
 * O push deste app é o mesmo canal por onde chega o aviso de emergência. Um
 * coraçãozinho de madrugada gasta o canal que um dia vai avisar de uma consulta
 * ou de uma vaga liberada, e a paciente que desliga as notificações por causa
 * de uma reação desliga também o resto. É a mesma régua já escrita em
 * `lembretes.ts`: um push perdido é melhor que um push de hora em hora.
 *
 * O pedido para seguir manda porque ele PEDE UMA AÇÃO dela e fica parado até
 * que ela responda.
 */
export function avisoMandaPush(e: EspecieDeAviso): boolean {
  return e === "pediu_para_seguir";
}

export function textoDoAviso(e: EspecieDeAviso, quem: string): string {
  switch (e) {
    case "seguiu":
      return `${quem} começou a te acompanhar`;
    case "pediu_para_seguir":
      return `${quem} quer te acompanhar`;
    case "aceitou":
      return `${quem} aceitou seu pedido`;
    case "reagiu":
      return `${quem} reagiu ao seu post`;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   8 · DESCOBERTA
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠️ **A BUSCA SÓ ENCONTRA PERFIL PÚBLICO.** Este é o portão que preserva o
 * desenho original da aba: quem não ligou o perfil público continua invisível
 * para estranhas, exatamente como antes desta estrutura existir. Uma busca que
 * achasse perfil privado transformaria "privado" em "sem feed", que não é a
 * mesma coisa nem de longe.
 *
 * Quem está em Modo Cuidado não aparece — e não é que ela seja filtrada da
 * lista depois: ela não entra na consulta.
 */
export function podeAparecerNaBusca(p: Pick<Perfil, "publico" | "emCuidado">): boolean {
  return p.publico && !p.emCuidado;
}

/** Sem acento, sem caixa — "vo ana" acha "Vó Ana". */
export function normalizarBusca(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** Piso de caracteres. Menos que isso devolve meia base. */
export const MINIMO_DA_BUSCA = 3;

/* ══════════════════════════════════════════════════════════════════════════
   9 · BLOQUEIO
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠️ **O BLOQUEIO É DE MÃO DUPLA NO EFEITO E CALADO NO AVISO.**
 *
 * Efeito duplo: se eu bloqueio alguém, nenhuma das duas vê a outra. Bloquear
 * "só de um lado" deixaria a bloqueada continuar lendo tudo que eu escrevo, o
 * que é o oposto do que a palavra promete.
 *
 * Calado: a bloqueada não recebe aviso e não vê mensagem de erro diferente —
 * o perfil simplesmente não existe para ela. Anunciar transforma o bloqueio num
 * ato de confronto, e num app onde as pessoas se conhecem da vida real isso
 * costuma piorar a situação que motivou o bloqueio.
 *
 * ⚠️ E bloquear DESFAZ o seguir nos dois sentidos. Sem isso a linha de seguir
 * fica viva e ressuscita o vínculo no dia em que o bloqueio for desfeito.
 */
export function bloqueioDesfazSeguir(): boolean {
  return true;
}

/* ══════════════════════════════════════════════════════════════════════════
   10 · MODO CUIDADO
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * O que a rede social faz quando ela liga o Modo Cuidado.
 *
 * ⚠️ **Some, sem anunciar, e sem apagar nada.** O perfil não é encontrável, os
 * posts não são visíveis para ninguém, ela não aparece na busca, e quem já a
 * seguia simplesmente para de ver posts novos — sem nenhuma mensagem dizendo
 * por quê. "Fulana saiu" contaria a perda dela para todo mundo que a seguia,
 * e essa é a decisão mais íntima que existe.
 *
 * ⚠️ E ela continua vendo os PRÓPRIOS posts. Escondê-los dela seria o app
 * apagar o bebê dela — a mesma decisão que manteve `exam_files` de pé quando o
 * envio de exames saiu do produto, e o Álbum de pé na Comunidade.
 *
 * As linhas ficam. Quando ela desligar, tudo volta como estava.
 */
export function redeDisponivel(p: Pick<Perfil, "emCuidado">): boolean {
  return !p.emCuidado;
}

/* ══════════════════════════════════════════════════════════════════════════
   11 · QUANDO FOI PUBLICADO
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * "agora" · "3 min" · "5 h" · "2 d" · "3 sem" · "18 de agosto de 2026".
 *
 * ⚠️ **A hora não é enfeite, e a falta dela já é um defeito neste feed.** Sem
 * ela, um post de três semanas atrás lê como notícia de hoje — e aqui as
 * notícias têm data biológica: "fizemos o ultrassom" de uma gestante que
 * naquela semana estava com 28 e hoje está com 31 é outra frase. É a única
 * informação que o modelo põe em TODO post, e a nossa tela estava sem.
 *
 * ⚠️ **`agora` é PARÂMETRO**, nunca `Date.now()` lá dentro: teste que depende
 * do relógio do contêiner é teste que falha às terças. Mesma decisão de
 * `faseDoDiaNoite`, que recebe a hora local já extraída.
 *
 * ⚠️ **Passa de "sem" para a data cheia em 4 semanas**, e não segue para
 * "meses". Um post de gestação com dois meses é de outro trimestre; "há 2
 * meses" obriga a paciente a fazer a conta de quando foi, e a conta que ela
 * quer fazer é com a semana dela.
 */
export function haQuantoPublicou(iso: string, agora: number): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  /* Futuro por relógio dessincronizado vira "agora": "em -2 min" é pior que
     impreciso, é visivelmente quebrado. */
  const seg = Math.max(0, Math.round((agora - t) / 1000));
  if (seg < 60) return "agora";
  const min = Math.floor(seg / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} d`;
  const sem = Math.floor(d / 7);
  if (sem < 4) return `${sem} sem`;
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
