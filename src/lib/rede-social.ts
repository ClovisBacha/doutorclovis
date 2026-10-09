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
  /* `publico` exige o perfil estar aberto **OU** o vínculo que já bastaria na
     camada de baixo.
     ⚠️ **Sem o `||`, a camada mais ABERTA era a mais FECHADA de todas** — e não
     num caso de canto: o perfil NASCE privado (`PERFIL_PUBLICO_PADRAO =
     false`), então a paciente que nunca mexeu na chave e publicou em "Todo
     mundo · Qualquer pessoa no app" fazia um post que ninguém via, nem as
     amigas dela, enquanto o MESMO texto em "Quem me segue" apareceria. O rótulo
     prometia o contrário do que acontecia, e o post sumia em silêncio.
     A intenção original continua de pé — quem fechou o perfil depois de
     publicar não passa a ser lida por estranhas —, porque `sigoAtivo` e
     `somosAmigas` são exatamente quem já tinha esse direito. */
  return autor.publico || opts.sigoAtivo || opts.somosAmigas;
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

export type TipoDeReacao =
  /* As cinco originais. NUNCA renomeie um `tipo` — ele está gravado em
     `rede_reacoes`, e trocar a string apaga a reação de todo mundo. */
  | "amei"
  | "torcendo"
  | "emocionei"
  | "forca"
  | "abraco"
  /* As oito de ago/2026, pedidas pelo dono. */
  | "apaixonei"
  | "carinho"
  | "beijo"
  | "fofo"
  | "anjo"
  | "festa"
  | "uau"
  | "rindo";

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
/**
 * O VOCABULÁRIO EMOCIONAL DO APP.
 *
 * Eram cinco; o dono pediu a lista larga, com a risada dentro
 * ("adicione recursos de reação mais legais… risada 😂, 😇🥹😍🥰😘🥳🤩😎😱😋😚☺️🙏").
 * São treze, na ordem em que se sentem: amor → carinho → emoção → apoio →
 * festa → riso.
 *
 * ⚠️ **A ordem é a da BARRA, e ela importa.** O dedo vai ao começo: as
 * primeiras são as que servem a qualquer notícia. A risada é a última porque
 * ela é a única que pode cair mal — ver abaixo.
 *
 * ⚠️ **DUAS FICARAM DE FORA, e uma delas por razão clínica.** 😱 (susto) não
 * entra: embaixo do relato de um sangramento ou de uma internação ela devolve
 * pânico a quem está com medo, e é o post que mais recebe reação numa base
 * assim. 😎 · 😋 · 😚 saíram por não terem trabalho próprio ao lado das treze.
 *
 * ⚠️ **E sobre a risada, uma ressalva registrada uma vez.** 😂 embaixo de um
 * post sobre uma perda é indefensável, e foi por isso que ela não entrou na
 * primeira versão. Ela entra agora porque o dono pediu, e porque a maior parte
 * deste feed é bebê chutando e barriga crescendo — mas ela é o item que eu
 * tiraria primeiro se alguma paciente reclamar, e é o único da lista com esse
 * risco.
 *
 * ⚠️ **NUNCA renomeie um `tipo`** — ele está gravado no banco.
 * ⚠️ **E acrescentar um item exige o SQL**: o CHECK de `rede_reacoes` lista os
 * treze. Sem rodar `APLICAR_REDE_SOCIAL.sql` de novo, a reação nova é aceita
 * pelo servidor e RECUSADA pelo banco — a tela mostra e o valor não grava.
 */
export const REACOES: { tipo: TipoDeReacao; emoji: string; rotulo: string }[] = [
  { tipo: "amei", emoji: "❤️", rotulo: "Amei" },
  { tipo: "apaixonei", emoji: "😍", rotulo: "Apaixonei" },
  { tipo: "carinho", emoji: "🥰", rotulo: "Que carinho" },
  { tipo: "beijo", emoji: "😘", rotulo: "Beijo" },
  { tipo: "abraco", emoji: "🤗", rotulo: "Abraço" },
  { tipo: "emocionei", emoji: "🥹", rotulo: "Me emocionei" },
  { tipo: "fofo", emoji: "☺️", rotulo: "Que fofo" },
  { tipo: "anjo", emoji: "😇", rotulo: "Anjinho" },
  { tipo: "torcendo", emoji: "🙏", rotulo: "Torcendo" },
  { tipo: "forca", emoji: "👏", rotulo: "Força" },
  { tipo: "festa", emoji: "🥳", rotulo: "Festa" },
  { tipo: "uau", emoji: "🤩", rotulo: "Uau" },
  { tipo: "rindo", emoji: "😂", rotulo: "Ri muito" },
];

/**
 * A reação do TOQUE DUPLO na foto — o gesto que todo mundo já traz de casa.
 *
 * ⚠️ É `amei` e não uma sexta coisa: o duplo toque tem de cair no MESMO balde
 * do coração da barra, senão a mesma pessoa reagindo de dois jeitos criaria
 * duas contagens para o mesmo gesto.
 */
export const REACAO_DO_TOQUE_DUPLO: TipoDeReacao = "amei";

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
 * As reações que o post de fato RECEBEU, da mais usada para a menos.
 *
 * A linha do post dizia "12 reações". Com treze emojis disponíveis, esse número
 * deixou de responder a pergunta que se faz ao ler: **como** as pessoas
 * reagiram. Doze corações e doze risadas são notícias diferentes, e o número
 * sozinho conta a mesma história para as duas.
 *
 * ⚠️ **Devolve só o que tem contagem maior que zero.** Mostrar os treze em
 * cinza faria a linha virar uma paleta — e transformaria a ausência de reação
 * em algo que ocupa espaço na tela.
 *
 * ⚠️ **O desempate é a ORDEM DE `REACOES`, e não o alfabeto.** Duas reações com
 * a mesma contagem precisam sair sempre na mesma ordem, senão o mesmo post
 * troca de cara entre duas aberturas — e `REACOES` já está ordenada por como as
 * emoções se sentem, que é uma ordem melhor que "amei antes de beijo".
 */
export function principaisReacoes(c: ContagemDeReacoes, quantas = 3): TipoDeReacao[] {
  return REACOES.map((r, ordem) => ({ tipo: r.tipo, n: c[r.tipo] ?? 0, ordem }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.ordem - b.ordem)
    .slice(0, Math.max(0, quantas))
    .map((x) => x.tipo);
}

/* ══════════════════════════════════════════════════════════════════════════
   7 · AVISOS
   ══════════════════════════════════════════════════════════════════════════ */

export type EspecieDeAviso =
  | "seguiu"
  | "pediu_para_seguir"
  | "reagiu"
  | "aceitou"
  | "marcou"
  | "reagiu_story"
  /**
   * Comentou numa publicação dela.
   *
   * ⚠️ O índice dedupa por `(dono, quem, espécie, post)`, então dez comentários
   * da mesma pessoa no mesmo post viram UM aviso. É o certo: a caixa ♡ diz
   * "Fulana comentou", e dez linhas iguais seriam a mesma informação repetida
   * com cara de dez pessoas.
   */
  | "comentou"
  /** Mencionou ela num post ou comentário. */
  | "mencionou";

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
 *
 * ⚠️ **E a MARCAÇÃO também não manda**, apesar de parecer mais forte que uma
 * reação — o nome dela vai para a foto de outra pessoa. Não manda porque não há
 * prazo nem decisão presa: a marcação já está visível, aparece na caixa de
 * Atividade com emblema, e ela pode tirá-la a qualquer momento. Push é para o
 * que fica esperando resposta.
 */
export function avisoMandaPush(e: EspecieDeAviso): boolean {
  /**
   * ⚠️ **O QUE PEDE ALGUMA COISA DELA, e nada mais.**
   *
   * A régua devolvia `true` só para `pediu_para_seguir`, e as outras sete
   * espécies tinham texto de push escrito e NENHUM uso: comentar, mencionar e
   * marcar não avisavam ninguém. A caixa ♡ gravava e a pessoa só ficava sabendo
   * se abrisse o app por conta própria — numa aba cuja graça inteira é alguém
   * te responder.
   *
   * ⚠️ **E o corte não é "o que é importante", é "o que PEDE".** O push deste
   * app é o mesmo canal do aviso de emergência: gastá-lo com o coraçãozinho de
   * madrugada ensina a ignorá-lo, e quem desliga por causa disso desliga o SOS
   * junto. Por isso `reagiu` e `reagiu_story` ficam de fora — são afago, e
   * afago espera ela abrir. `seguiu` também: ninguém precisa fazer nada.
   *
   * Entram: o pedido (decisão dela), o comentário (é conversa dirigida a ela),
   * a menção (chamaram pelo nome) e a marcação (o nome dela numa foto de outra
   * pessoa — e ela pode querer tirar).
   *
   * ⚠️ **`aceitou` FICOU DE FORA, e o teste pegou minha inconsistência.** Eu
   * escrevi "o que PEDE alguma coisa dela" e em seguida incluí `aceitou`, que
   * não pede nada: ela mandou o pedido, e vai encontrar a resposta quando
   * abrir. A decisão já estava tomada e testada; o critério novo, aplicado
   * direito, chega nela sozinho.
   */
  return e === "pediu_para_seguir" || e === "comentou" || e === "mencionou" || e === "marcou";
}

/**
 * ⚠️ **O QUE ELA PODE DESLIGAR, e o que NÃO.**
 *
 * Antes disto o único jeito de parar de receber aviso da Comunidade era
 * desligar a notificação do app inteiro — o mesmo canal por onde chega o aviso
 * de emergência e o lembrete de consulta. "Ou tudo, ou nada" numa gestação de
 * alto risco é uma escolha que ninguém deveria ter de fazer.
 *
 * ⚠️ **A lista é do que ela DESLIGOU, e não do que ligou.** Guardar o que está
 * ligado faria toda espécie nova nascer DESLIGADA para quem já usava o app — e
 * um recurso que nasce mudo para a base inteira é um recurso que ninguém
 * descobre. Desligado é sempre escolha explícita.
 */
export const AVISOS_QUE_ELA_DESLIGA: { chave: EspecieDeAviso; rotulo: string }[] = [
  { chave: "pediu_para_seguir", rotulo: "Pedidos para te acompanhar" },
  { chave: "comentou", rotulo: "Comentários nas suas publicações" },
  { chave: "mencionou", rotulo: "Quando te mencionam" },
  { chave: "marcou", rotulo: "Quando te marcam numa foto" },
];

/**
 * ⚠️ **FALHA ABERTO: sem saber o que ela desligou, o aviso VAI.**
 *
 * O pior caso aqui é um push que ela preferia não receber; o oposto é o
 * silêncio — e silêncio numa leitura degradada some sem deixar rastro nenhum,
 * exatamente como o defeito que fez esta régua existir.
 */
export function podeAvisar(e: EspecieDeAviso, desligados: readonly string[] | null): boolean {
  if (!avisoMandaPush(e)) return false;
  if (!desligados) return true;
  return !desligados.includes(e);
}

export function textoDoAviso(e: EspecieDeAviso, quem: string): string {
  switch (e) {
    case "mencionou":
      /* ⚠️ Também sem o texto: o comentário ou a legenda onde ela foi
         mencionada pode ser justamente o que ela não deve ler sem contexto. */
      return `${quem} mencionou você`;
    case "comentou":
      /* ⚠️ O TEXTO NÃO TRAZ O COMENTÁRIO. Um trecho na caixa faria a frase de
         quem escreveu aparecer numa tela que ela abre por reflexo — e é
         justamente o comentário duro que ela não deve encontrar sem contexto,
         fora da publicação onde ele está. Ela toca e vai ler onde ele vive. */
      return `${quem} comentou na sua publicação`;
    case "seguiu":
      return `${quem} começou a te acompanhar`;
    case "pediu_para_seguir":
      return `${quem} quer te acompanhar`;
    case "aceitou":
      return `${quem} aceitou seu pedido`;
    case "reagiu":
      return `${quem} reagiu ao seu post`;
    case "reagiu_story":
      /* ⚠️ Diz que foi no STORY, e não "reagiu ao seu post": o story some em
         24h, e ela precisa saber que o afago foi naquilo que está acabando. */
      return `${quem} reagiu ao seu story`;
    case "marcou":
      /* ⚠️ Diz que dá para TIRAR, na própria frase. Descobrir isso só abrindo o
         post faria a primeira reação de quem não quis ser marcada ser pedir à
         amiga que apagasse a publicação inteira. */
      return `${quem} marcou você num post — você pode tirar`;
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

/* ══════════════════════════════════════════════════════════════════════════
   10 · MODO CUIDADO
   ══════════════════════════════════════════════════════════════════════════ */

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

/* ══════════════════════════════════════════════════════════════════════════
   12 · A ENQUETE E A AULA DENTRO DO POST — Fase 4
   ══════════════════════════════════════════════════════════════════════════ */

/** Mínimo e máximo de opções. O CHECK do banco repete os dois. */
export const OPCOES_MIN = 2;
export const OPCOES_MAX = 4;

/**
 * O TETO DO TEXTO DO STORY.
 *
 * ⚠️ **Um número só, lido pela tela E pelo `zod` do servidor.** Ele já existia
 * cravado em `publicarStory` (`z.string().max(200)`) e a tela não tinha campo
 * nenhum — quando o campo nasceu, um `200` digitado nele seria a segunda cópia
 * do mesmo limite, e a divergência apareceria como a paciente digitando até o
 * fim e o servidor recusando sem dizer por quê.
 *
 * 200 e não mais: o texto pousa POR CIMA da foto, e um parágrafo ali tapa o
 * conteúdo que o story existe para mostrar.
 */
export const TEXTO_DO_STORY_MAX = 200;
/** Uma opção é um rótulo curto, não um parágrafo. */
export const LIMITE_DA_OPCAO = 40;

/**
 * As opções que a paciente digitou viram a enquete — ou não viram.
 *
 * ⚠️ **Duas opções iguais não são uma enquete**, e o servidor precisa recusar
 * antes de gravar: com "sim" e "sim" nas duas, o resultado é ininteligível e
 * não há como corrigir depois (post não se edita).
 */
export function enqueteValida(opcoes: string[]): boolean {
  const limpas = opcoes.map((o) => o.trim()).filter(Boolean);
  if (limpas.length < OPCOES_MIN || limpas.length > OPCOES_MAX) return false;
  if (limpas.some((o) => o.length > LIMITE_DA_OPCAO)) return false;
  const distintas = new Set(limpas.map((o) => o.toLowerCase()));
  return distintas.size === limpas.length;
}

/** Limpa o que veio da tela: apara, tira vazias e corta no teto. */
export function limparOpcoes(opcoes: string[]): string[] {
  return opcoes
    .map((o) => o.trim().slice(0, LIMITE_DA_OPCAO))
    .filter(Boolean)
    .slice(0, OPCOES_MAX);
}

/**
 * O que a tela mostra ao lado de cada opção.
 *
 * ⚠️ **NÚMERO, e nunca porcentagem.** "67%" são dois votos de três, e numa base
 * pequena a porcentagem transforma três pessoas numa maioria — a mesma razão
 * pela qual o contador do desafio em grupo não mostra fração. O número absoluto
 * nunca mente sobre o tamanho da amostra.
 */
export function rotuloDeVotos(n: number): string {
  return n === 1 ? "1 voto" : `${n} votos`;
}

/**
 * A aula anexada a um post.
 *
 * ─── ⚠️ O DIA DA AULA É A SEMANA DELA DISFARÇADA ───────────────────────────
 *
 * A primeira versão deste tipo era `{ dia: number; titulo: string }`, e o
 * `dia` é o dia gestacional: **D = semana × 7 + diaDaSemana**. Publicar "Aula
 * do dia 139" é publicar "estou de 19 semanas" para quem souber dividir por
 * sete — e passaria por cima da chave `mostrar_semana` da Fase 1, que existe
 * exatamente para essa decisão ser dela.
 *
 * Seria o pior tipo de vazamento: o que entra pela porta dos fundos de um
 * recurso construído para fechar a porta da frente.
 *
 * ─── O QUE SOBRA, E POR QUE BASTA ──────────────────────────────────────────
 *
 * O TEMA do dia, que gira a cada sete dias para toda gestante do app
 * (`0 bebê · 1 corpo · 2 nutrição · 3 sinais · 4 exames · 5 vínculo ·
 * 6 revisão`). Ele não diz a semana de ninguém, e é o que responde à pergunta
 * de quem lê: "aula sobre o quê?".
 *
 * E continua fora: a NOTA (seria o placar público que a aba das Amigas gastou
 * um arquivo inteiro para não ter, agora entre desconhecidas), e enunciado,
 * alternativas e gabarito — que vazam conteúdo premium pelo `quizPremium` e
 * estragam a aula de quem está uma semana atrás.
 */
export const TEMAS_DA_AULA = [
  "bebê",
  "corpo",
  "nutrição",
  "sinais",
  "exames",
  "vínculo",
  "revisão",
] as const;

export type TemaDaAula = (typeof TEMAS_DA_AULA)[number];

export type AulaNoPost = { tema: TemaDaAula };

export function aulaValida(a: unknown): a is AulaNoPost {
  if (!a || typeof a !== "object") return false;
  const x = a as Record<string, unknown>;
  return typeof x.tema === "string" && (TEMAS_DA_AULA as readonly string[]).includes(x.tema);
}

/**
 * O tema a partir do dia gestacional.
 *
 * ⚠️ **A conversão acontece ANTES de sair do aparelho dela**, e o `dia` nunca
 * chega ao servidor: é o que garante que a semana não viaje junto. O ritmo é o
 * mesmo de `challengeForDay` — uma segunda tabela faria a aula de terça ser
 * "nutrição" no Caminho e "sinais" no post.
 */
export function temaDoDia(dia: number): TemaDaAula {
  const i = ((Math.floor(dia) % 7) + 7) % 7;
  return TEMAS_DA_AULA[i];
}

/* ══════════════════════════════════════════════════════════════════════════
   QUEM ESTÁ BLOQUEADA — e o que responder quando não deu para saber
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * O conjunto de bloqueio, com uma resposta segura para a falha de leitura.
 *
 * ⚠️ **Um `Set` cru falha ABERTO, e foi assim que ele viveu.** `supabase-js` não
 * lança em erro de consulta: resolve com `{ data: null, error }`, e `data ?? []`
 * transformava um timeout em conjunto VAZIO. Como TODOS os pontos de uso
 * perguntam `bloqueio.has(x)` para ESCONDER, um conjunto vazio não escondia
 * ninguém: os posts de quem ela bloqueou voltavam ao feed, o perfil dele abria,
 * os stories reapareciam e a caixinha anônima voltava a aceitar pergunta dele —
 * sem erro na tela. No mesmo `contextoDe`, três linhas abaixo, o grafo de
 * amigas já falhava FECHADO, com o comentário certo escrito ao lado: a
 * assimetria era interna à função.
 *
 * A correção NÃO é conferir `error` em catorze lugares. É fazer a resposta ser
 * segura por construção: degradado, `has()` responde **`true` para todo
 * mundo** — nada aparece —, e isso vale também para o ponto de uso que alguém
 * escrever amanhã sem ler este comentário.
 *
 * ⚠️ Mora aqui, e não no servidor, porque é RÉGUA: no servidor ela só poderia
 * ser testada lendo o fonte, e teste que lê fonte foi exatamente o que deixou
 * dez asserções desta aba passarem verdes sobre guardas apagadas.
 */
export type ConjuntoDeBloqueio = { has(id: string): boolean; readonly degradado: boolean };

export function conjuntoDeBloqueio(ids: Iterable<string>, degradado: boolean): ConjuntoDeBloqueio {
  const set = new Set(ids);
  return {
    degradado,
    has: (id: string) => degradado || set.has(id),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   FIXAR PUBLICAÇÃO NO PERFIL
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Quantas publicações cabem fixadas.
 *
 * ⚠️ **Três, e o número é de LAYOUT antes de ser de produto.** A grade do
 * perfil tem três colunas (ver `medidas-instagram.ts`): com três fixadas, a
 * primeira fileira inteira é o que ela escolheu mostrar e a segunda já é a
 * ordem cronológica. Com quatro, sobra uma sozinha numa fileira nova e o
 * recorte deixa de ser legível como recorte — vira "algumas publicações no
 * começo".
 */
export const FIXADOS_MAX = 3;

/**
 * A ordem da grade do perfil: fixadas primeiro, depois o resto.
 *
 * ⚠️ **A ORDEM DENTRO DAS FIXADAS É A DE FIXAÇÃO, não a de publicação.** Fixar
 * é um gesto de agora: quem acabou de fixar espera ver aquilo na frente. Ordenar
 * as três fixadas por `criadoEm` faria a mais nova ir para o fim quando ela
 * fixasse uma foto antiga — e ela não teria como corrigir, porque não há como
 * reordenar.
 *
 * ⚠️ **E é uma ORDENAÇÃO ESTÁVEL sobre a lista que chega.** Ela NÃO reordena o
 * resto: o que não é fixado mantém exatamente a ordem em que veio do servidor,
 * que já é cronológica e já carrega a paginação. Reordenar aqui faria a segunda
 * página aparecer embaralhada em relação à primeira.
 */
export function ordenarComFixados<T extends { fixadoEm?: string | null }>(posts: T[]): T[] {
  const fixados = posts.filter((p) => !!p.fixadoEm);
  if (fixados.length === 0) return posts;
  const resto = posts.filter((p) => !p.fixadoEm);
  fixados.sort((a, b) => Date.parse(b.fixadoEm!) - Date.parse(a.fixadoEm!));
  return [...fixados, ...resto];
}

/**
 * Posso fixar mais uma?
 *
 * ⚠️ **Quem já está fixada NÃO conta como "mais uma"** — refixar o que já está
 * fixado é um toque sem efeito, e recusá-lo com "você já tem três" seria o app
 * respondendo a uma pergunta que ninguém fez.
 */
export function podeFixar(v: { jaFixados: number; esteJaEstaFixado: boolean }): boolean {
  if (v.esteJaEstaFixado) return true;
  return v.jaFixados < FIXADOS_MAX;
}

/* ══════════════════════════════════════════════════════════════════════════
   A CAMADA DO STORY
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * As camadas que um STORY aceita.
 *
 * ⚠️ **É um SUBCONJUNTO de `Visibilidade`, e não um tipo novo.** Duas escadas
 * de visibilidade no mesmo app divergiriam no primeiro ajuste — e aqui a
 * divergência apareceria como um story alcançando quem o post equivalente não
 * alcança, que é o pior jeito de descobrir um bug de privacidade.
 *
 * ⚠️ **`publico` FICA DE FORA, de propósito.** Um story público seria visto por
 * quem ela não conhece — e a fileira de bolinhas não tem rótulo de procedência
 * nenhum: a paciente abriria achando que é de alguém que ela segue. O post pode
 * ser público porque toda publicação de fora carrega "Sugerido para você"; o
 * story não carrega, então não pode.
 */
export type VisibilidadeDoStory = Extract<Visibilidade, "seguidores" | "amigas">;

/**
 * ⚠️ **O padrão é `seguidores`, e é o comportamento que os stories já tinham.**
 *
 * Fechar por padrão faria as publicações futuras dela alcançarem menos gente que
 * as de ontem sem ela ter pedido — e ela descobriria pelo silêncio. Quem quiser
 * fechar, fecha por publicação.
 *
 * ⚠️ Note que isto é o CONTRÁRIO do padrão do post (`amigas`), e a diferença é
 * deliberada: lá a camada existe desde sempre e nasceu fechada; aqui ela está
 * chegando a um formato que já era aberto, e mudar o alcance de quem não pediu
 * nada é pior que oferecer a escolha.
 */
export const VISIBILIDADE_DO_STORY_PADRAO: VisibilidadeDoStory = "seguidores";

export const VISIBILIDADES_DO_STORY: {
  chave: VisibilidadeDoStory;
  rotulo: string;
  sub: string;
}[] = [
  { chave: "seguidores", rotulo: "Quem me segue", sub: "Como sempre foi" },
  { chave: "amigas", rotulo: "Só amigas", sub: "Quem você já conhece" },
];

/**
 * Limpa o que vem do cliente.
 *
 * ⚠️ **Desconhecido cai no PADRÃO, e nunca no mais aberto.** Um valor estranho
 * (formato antigo, corpo montado à mão) não pode alargar o alcance de um story
 * — e como o padrão é `seguidores`, que já era o comportamento, o pior caso é
 * "ficou como antes".
 */
export function camadaDoStory(bruto: unknown): VisibilidadeDoStory {
  return bruto === "amigas" ? "amigas" : VISIBILIDADE_DO_STORY_PADRAO;
}

/**
 * Este story alcança quem está olhando?
 *
 * ⚠️ **A régua é POR STORY, e o recorte por AUTOR não basta.** A leitura da
 * fileira monta a lista de autoras (`sigo ∪ amigas`) e busca os stories delas —
 * mas dentro dessa lista há gente que eu SIGO sem ser amiga, e é justamente
 * dessa gente que o story `amigas` tem de se esconder. Filtrar só por autora
 * entregaria o story fechado a toda a fileira.
 *
 * ⚠️ **A autora sempre vê o próprio**, inclusive o fechado: sem isto, publicar
 * em `amigas` faria o story sumir da fileira dela mesma, e ela concluiria que a
 * publicação falhou.
 */
export function storyAlcanca(v: {
  euId: string;
  autorId: string;
  camada: VisibilidadeDoStory;
  somosAmigas: boolean;
}): boolean {
  if (v.euId === v.autorId) return true;
  return v.camada === "amigas" ? v.somosAmigas : true;
}

/* ══════════════════════════════════════════════════════════════════════════
   QUEM PODE COMENTAR
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠️ **O POST ESCOLHE QUEM VÊ; NINGUÉM ESCOLHIA QUEM RESPONDE.**
 *
 * Hoje é tudo ou nada — `comentarios_abertos` fecha para todo mundo. Num app
 * cuja decisão central foi limitar conselho de leiga (os 20,9% de respostas
 * erradas medidos em fóruns de gestação), "só amigas podem comentar" é a peça
 * que faltava: ela deixa a publicação visível e restringe QUEM opina.
 *
 * ⚠️ **O padrão é `todos`**, que é o comportamento de hoje. Fechar por padrão
 * emudeceria as conversas já existentes sem ninguém ter pedido.
 */
export type QuemComenta = "todos" | "seguidores" | "amigas";

export const QUEM_COMENTA_PADRAO: QuemComenta = "todos";

export const QUEM_COMENTA: { chave: QuemComenta; rotulo: string; sub: string }[] = [
  { chave: "todos", rotulo: "Todo mundo", sub: "Quem puder ver a publicação" },
  { chave: "seguidores", rotulo: "Quem me segue", sub: "Só quem acompanha você" },
  { chave: "amigas", rotulo: "Só amigas", sub: "Quem você já conhece" },
];

/** Limpa o que vem do cliente. Desconhecido cai no padrão. */
export function quemComentaDe(bruto: unknown): QuemComenta {
  return bruto === "seguidores" || bruto === "amigas" ? bruto : QUEM_COMENTA_PADRAO;
}

/**
 * A camada de comentário NUNCA pode ser mais aberta que a de visibilidade.
 *
 * ⚠️ **Quem não vê não comenta — e sem esta régua a tela prometeria o
 * contrário.** Um post da camada `amigas` com "todo mundo pode comentar" é uma
 * combinação sem sentido: as pessoas a quem "todo mundo" se refere não veem a
 * publicação. Oferecer a combinação faria a autora acreditar que abriu a
 * conversa quando não abriu nada.
 *
 * A ordem de abertura é `publico` > `seguidores` > `amigas`; a de comentário
 * usa as duas últimas mais `todos`, que equivale a "todos os que veem".
 */
const ABERTURA: Record<Visibilidade, number> = { publico: 3, seguidores: 2, amigas: 1 };
const ABERTURA_DO_COMENTARIO: Record<QuemComenta, number> = {
  todos: 3,
  seguidores: 2,
  amigas: 1,
};

export function apertarQuemComenta(v: {
  visibilidade: Visibilidade;
  quemComenta: QuemComenta;
}): QuemComenta {
  /* ⚠️ `todos` num post `publico` continua `todos` — ali "todos os que veem" É
     todo mundo. O aperto só acontece quando a publicação é mais fechada. */
  if (ABERTURA_DO_COMENTARIO[v.quemComenta] <= ABERTURA[v.visibilidade]) return v.quemComenta;
  return v.visibilidade === "amigas" ? "amigas" : "seguidores";
}

/**
 * Esta pessoa pode comentar nesta publicação?
 *
 * ⚠️ **A autora sempre pode**, inclusive no próprio post fechado: responder a
 * quem comentou é o uso mais comum, e uma régua que a barrasse tornaria a opção
 * "só amigas" inutilizável para quem não tem amigas na rede ainda.
 *
 * ⚠️ **E ela NÃO substitui `podeVerPost`.** Quem não vê a publicação não chega
 * ao campo de comentário; esta régua recorta DENTRO de quem já vê.
 */
export function podeComentar(v: {
  euId: string;
  autorId: string;
  quemComenta: QuemComenta;
  sigoAtivo: boolean;
  somosAmigas: boolean;
}): boolean {
  if (v.euId === v.autorId) return true;
  if (v.quemComenta === "todos") return true;
  if (v.quemComenta === "amigas") return v.somosAmigas;
  /* `seguidores`: quem SEGUE a autora. ⚠️ Amiga entra também — o grafo de
     amizade deste app é um vínculo mais forte que seguir, e barrar a amiga que
     não segue seria a régua contradizendo a própria escada. */
  return v.sigoAtivo || v.somosAmigas;
}

/**
 * ⚠️ **O LINK DA BIO É LIMPO NO SERVIDOR, e não confiado ao campo.**
 *
 * `javascript:alert(1)` numa bio é XSS na tela de quem VISITA o perfil — e o
 * `href` é o único lugar do app onde texto de uma paciente vira comportamento
 * na tela de outra. Só `http` e `https` passam; qualquer outra coisa (`data:`,
 * `javascript:`, `file:`) vira `null`.
 *
 * ⚠️ **E `//exemplo.com` NÃO é aceito como atalho.** Um esquema-relativo herda
 * o esquema da página e passa despercebido em toda revisão; se ela quer um
 * link, ela escreve o endereço inteiro — e sem esquema nenhum a gente COMPLETA
 * com `https://`, que é o caso comum de quem cola "instagram.com/fulana".
 */
export function limparLinkDaBio(bruto: string | null | undefined): string | null {
  const t = (bruto ?? "").trim();
  if (!t) return null;
  if (t.startsWith("//")) return null;
  const comEsquema = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(comEsquema);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    /* Um endereço sem ponto no host não leva a lugar nenhum — e `https://oi`
       renderizado como link é uma promessa que o toque não cumpre. */
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** ⚠️ Teto de tamanho: um `href` gigantesco é a outra forma de abusar do campo. */
export const LINK_DA_BIO_MAX = 200;
