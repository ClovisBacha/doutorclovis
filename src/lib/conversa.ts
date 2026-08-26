/**
 * A MENSAGEM DIRETA — régua pura.
 *
 * O maior buraco estrutural da aba: duas pacientes podiam reagir uma ao post da
 * outra e não tinham como conversar. Nenhuma rede social existe sem isto, e é o
 * que transforma "seguir" em vínculo.
 *
 * ⚠️ **E É TAMBÉM O VETOR DE ASSÉDIO MAIS ÓBVIO QUE EXISTE.** Caixa de entrada
 * aberta a desconhecidos, numa base de gestantes de alto risco, é o desenho que
 * transforma um recurso de afeto numa porta de perseguição. As três travas
 * abaixo existem por isso, e nenhuma é enfeite.
 */

/** Quem pode PUXAR conversa com quem. */
export type PodeIniciar =
  | { pode: true; comoPedido: boolean }
  | { pode: false; motivo: "bloqueio" | "fora_de_alcance" | "eu_mesma" };

/**
 * ⚠️ **TRAVA 1 — SÓ QUEM ALCANÇA O PERFIL PODE ESCREVER.**
 *
 * É a MESMA régua de `alcancaOPerfil`, e de propósito: quem não consegue nem
 * abrir o perfil dela não pode aparecer na caixa de entrada dela. Uma régua
 * própria aqui divergiria da do perfil no primeiro ajuste, e a divergência
 * apareceria como mensagem de estranha chegando de um perfil que a paciente
 * fechou justamente para isso.
 *
 * ⚠️ **TRAVA 2 — SE ELA NÃO ME SEGUE, É PEDIDO.** A conversa nasce numa caixa
 * separada, e a paciente decide se aceita. Aceitar é o gesto que abre o canal;
 * sem ele, o canal não existe.
 */
export function podeIniciarConversa(v: {
  euId: string;
  alvoId: string;
  /** O alvo bloqueou você, ou você bloqueou o alvo. Vale nos dois sentidos. */
  temBloqueio: boolean;
  /** Você alcança o perfil do alvo? Ver `alcancaOPerfil`. */
  alcancaOPerfil: boolean;
  /** O ALVO segue VOCÊ. É isto que dispensa o pedido. */
  alvoMeSegue: boolean;
}): PodeIniciar {
  if (v.euId === v.alvoId) return { pode: false, motivo: "eu_mesma" };
  /* ⚠️ O bloqueio vem ANTES do alcance: quem bloqueou pode continuar tendo
     perfil público, e responder "fora de alcance" contaria a diferença. */
  if (v.temBloqueio) return { pode: false, motivo: "bloqueio" };
  if (!v.alcancaOPerfil) return { pode: false, motivo: "fora_de_alcance" };
  return { pode: true, comoPedido: !v.alvoMeSegue };
}

/**
 * ⚠️ **TRAVA 3 — UMA MENSAGEM ATÉ SER ACEITO. É a que o Instagram não tem.**
 *
 * Lá, quem manda pedido pode encher a caixa de solicitações com quantas
 * mensagens quiser, e a pessoa vê todas ao abrir. Aqui, quem pediu escreve UMA
 * e espera. Se a paciente não responder, o assunto morre ali.
 *
 * O custo é real e aceito: uma mensagem só às vezes não explica quem você é. O
 * benefício é que ninguém consegue despejar vinte mensagens em cima de alguém
 * que nunca respondeu — e essa é a diferença entre uma caixa de entrada e um
 * canal de perseguição.
 */
export const MENSAGENS_ANTES_DE_ACEITAR = 1;

export function podeEnviar(v: {
  souODono: boolean;
  /** A conversa já foi aceita pelo outro lado? */
  aceita: boolean;
  /** Sou eu quem pediu? */
  euIniciei: boolean;
  /** Quantas mensagens EU já mandei nesta conversa. */
  minhasMensagens: number;
  temBloqueio: boolean;
}): { pode: boolean; motivo?: "bloqueio" | "aguardando_aceite" | "nao_e_minha" } {
  if (!v.souODono) return { pode: false, motivo: "nao_e_minha" };
  if (v.temBloqueio) return { pode: false, motivo: "bloqueio" };
  if (v.aceita) return { pode: true };
  /**
   * ⚠️ **QUEM RECEBEU O PEDIDO PODE RESPONDER SEM "ACEITAR" FORMALMENTE.**
   * Responder É aceitar — obrigar dois toques (aceitar, depois escrever) faria
   * a paciente responder e a mensagem não sair, que é o pior desfecho possível
   * numa caixa de entrada.
   */
  if (!v.euIniciei) return { pode: true };
  if (v.minhasMensagens >= MENSAGENS_ANTES_DE_ACEITAR) {
    return { pode: false, motivo: "aguardando_aceite" };
  }
  return { pode: true };
}

/**
 * O par ordenado da conversa.
 *
 * ⚠️ Sem ele, (A,B) e (B,A) viram duas linhas: duas pessoas que se escrevem ao
 * mesmo tempo criam DUAS conversas, cada uma vê a sua, e as mensagens da outra
 * somem. Mesma lição de `duplas`.
 */
export function parOrdenado(x: string, y: string): { a: string; b: string } {
  return x < y ? { a: x, b: y } : { a: y, b: x };
}

/** Qual das duas colunas de "lido" é minha nesta conversa. */
export function minhaColunaDeLeitura(euId: string, aId: string): "lida_a" | "lida_b" {
  return euId === aId ? "lida_a" : "lida_b";
}

/**
 * A MESMA PERGUNTA, para as colunas que nasceram depois (silenciar e sair).
 *
 * ⚠️ **É UM SÓ LUGAR de propósito.** São três pares de colunas com o mesmo
 * sufixo `_a`/`_b`, e escrever `euId === aId ? "silenciada_a" : "silenciada_b"`
 * à mão em cada ponto de uso é a receita para um deles sair invertido — e um
 * invertido silencia a conversa da OUTRA pessoa, que é o pior desfecho: ela
 * para de receber aviso sem ter pedido, e não há nada na tela dela que explique.
 */
export function minhaColuna<P extends string>(
  prefixo: P,
  euId: string,
  aId: string,
): `${P}_a` | `${P}_b` {
  return euId === aId ? `${prefixo}_a` : `${prefixo}_b`;
}

/** E a coluna DA OUTRA — para saber se ela leu, ou se ela saiu. */
export function colunaDoOutro<P extends string>(
  prefixo: P,
  euId: string,
  aId: string,
): `${P}_a` | `${P}_b` {
  return euId === aId ? `${prefixo}_b` : `${prefixo}_a`;
}

/**
 * ELA JÁ LEU A MINHA MENSAGEM? — o ✓✓.
 *
 * ⚠️ **AS DUAS COLUNAS SEMPRE EXISTIRAM E NINGUÉM AS LIA para isto.**
 * `lida_a`/`lida_b` alimentavam só o emblema de não lidas; do lado de quem
 * MANDOU não havia nada. Numa conversa entre duas gestantes isso não é vaidade
 * de interface: quem escreve "acho que estou sentindo contração" e não sabe se
 * a outra viu fica olhando uma tela que não responde.
 *
 * ⚠️ **Só vale para mensagem MINHA.** Perguntar "a outra leu a mensagem dela?"
 * não quer dizer nada, e desenhar ✓✓ do lado dela seria o app afirmando que EU
 * li — informação que quem está do outro lado não tem como conferir.
 */
export function foiLidaPeloOutro(v: {
  souEu: boolean;
  criadaEm: string;
  /** O carimbo de leitura DA OUTRA pessoa. */
  leituraDoOutro: string | null;
}): boolean {
  if (!v.souEu) return false;
  if (!v.leituraDoOutro) return false;
  return new Date(v.leituraDoOutro).getTime() >= new Date(v.criadaEm).getTime();
}

/**
 * Tem mensagem não lida?
 *
 * ⚠️ **A MINHA PRÓPRIA MENSAGEM NUNCA CONTA COMO NÃO LIDA.** Sem esta regra, o
 * emblema acende no instante em que ela manda — a conversa fica marcada como
 * "tem coisa nova" por causa do que ela mesma escreveu, e o número perde o
 * sentido na primeira mensagem enviada.
 */
export function temNaoLida(v: {
  ultimaEm: string | null;
  minhaLeitura: string | null;
  /** Quem escreveu a última mensagem. */
  ultimoAutor: string | null;
  euId: string;
}): boolean {
  if (!v.ultimaEm) return false;
  if (v.ultimoAutor && v.ultimoAutor === v.euId) return false;
  if (!v.minhaLeitura) return true;
  return new Date(v.ultimaEm).getTime() > new Date(v.minhaLeitura).getTime();
}

/** Teto do texto. Conversa não é redação; e o campo é entrada de terceiro. */
export const LIMITE_DA_MENSAGEM = 2000;

/**
 * Teto de mensagens por dia, por pessoa.
 *
 * ⚠️ É o freio contra o dedo preso e contra automação — nunca contra conversa
 * de verdade. Duzentas mensagens num dia é muito acima do que uma conversa
 * humana produz, e bem abaixo do que um roteiro produziria.
 */
export const MENSAGENS_POR_DIA = 200;

/**
 * O texto que aparece na lista, encurtado.
 *
 * ⚠️ **Mensagem apagada vira aviso, nunca some da lista.** Uma conversa que
 * perde a última linha e volta a mostrar a anterior faz a paciente achar que a
 * mensagem que ela viu chegar não existiu.
 */
export function previaDaMensagem(
  texto: string | null,
  apagada: boolean,
  limite = 60,
  /**
   * O que a mensagem carrega além do texto.
   *
   * ⚠️ **SEM ISTO, UMA MENSAGEM QUE É SÓ FOTO APARECIA COMO LINHA EM BRANCO** na
   * lista de conversas — a paciente veria o nome da amiga, a hora, e nada. E ela
   * não teria como saber se aquilo é um defeito ou uma mensagem vazia de
   * verdade.
   */
  carrega?: { imagem?: boolean; ref?: "post" | "story" | null },
): string {
  if (apagada) return "Mensagem apagada";
  const t = (texto ?? "").replace(/\s+/g, " ").trim();
  if (!t) {
    if (carrega?.imagem) return "📷 Foto";
    if (carrega?.ref === "post") return "Publicação";
    if (carrega?.ref === "story") return "Respondeu ao seu story";
    return "";
  }
  return t.length <= limite ? t : `${t.slice(0, limite - 1)}…`;
}

/**
 * Quantas mensagens vêm por vez, e quantas a tela pede ao rolar para cima.
 *
 * ⚠️ **A CONVERSA NÃO PAGINAVA: eram 50 e acabou.** Uma dupla que se escreve
 * todo dia passa disso na primeira semana, e o começo da conversa — que é
 * justamente o que se procura quando se rola para cima — ficava inalcançável
 * para sempre, sem nada na tela dizendo que havia mais.
 */
export const MENSAGENS_POR_PAGINA = 50;

/**
 * O TETO DA FOTO DA CONVERSA.
 *
 * ⚠️ **Menor que o do post (1080), e maior que o do avatar (512).** A foto de um
 * direct é olhada uma vez, no celular, dentro de um balão — e cada uma que sobe
 * fica no balde para sempre, pago por conta do app. 1080 aqui seria guardar
 * qualidade de publicação para um conteúdo que ninguém vai reabrir.
 */
export const LADO_DA_FOTO = 900;

/** Teto do arquivo, conferido NO SERVIDOR. Relógio e tela de cliente mentem. */
export const BYTES_DA_FOTO = 8 * 1024 * 1024;

/**
 * O caminho da foto é de quem mandou?
 *
 * ⚠️ **A MESMA TRAVA DE `caminhoEhDoDono` DO VÍDEO, e ela existe porque o
 * cliente escolhe o caminho ao subir pela URL assinada.** Sem conferir, uma
 * paciente monta um caminho apontando para a pasta de outra e a mensagem dela
 * passa a exibir — dentro de uma conversa privada — um arquivo que não é dela.
 * A barra final é obrigatória: sem ela, `<uuid-de-alguem>` casaria
 * `<uuid-de-alguem-outro>` por prefixo.
 */
export function fotoEhDeQuemMandou(caminho: string, autorId: string): boolean {
  if (!caminho || caminho.includes("..") || caminho.includes("//")) return false;
  return caminho.startsWith(`${autorId}/`);
}

/* ══════════════════════════════════════════════════════════════════════════
   RESPONDER, REAGIR E DENUNCIAR — as três que faltavam no direct
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠️ **A CITAÇÃO NÃO SE ANINHA — um nível só.**
 *
 * Responder a uma resposta cita a MESMA mensagem original, e não a resposta.
 * Numa tela de 393px a citação da citação vira uma faixa de 40px que ninguém
 * lê, e o histórico deixa de caber. É a mesma decisão de `raizDoComentario`, e
 * pelo mesmo motivo.
 *
 * ⚠️ **A coluna aceita qualquer uuid, então quem garante é o servidor.** Um
 * pedido montado à mão criaria o segundo nível — e a tela, que só desenha um,
 * deixaria a citação ÓRFÃ: gravada, contada, e invisível.
 */
export function alvoDaCitacao(m: { id: string; respondeA: string | null }): string {
  return m.respondeA ?? m.id;
}

/**
 * As reações de mensagem.
 *
 * ⚠️ **SEIS, e não as treze do post.** Embaixo de uma publicação a reação é
 * pública e escolhe o tom; numa conversa entre duas pessoas ela é um aceno, e
 * treze opções transformam um aceno numa decisão. Estas seis cobrem o que uma
 * conversa de apoio precisa: concordar, agradecer, abraçar, emocionar-se, rir e
 * dizer que é muito.
 *
 * ⚠️ **NÃO tem 😢 nem 😱**, pela mesma razão da lista do post: 😢 lê como PENA,
 * que é a coisa que ela menos quer receber, e 😱 devolve pânico a quem está com
 * medo — e numa base de alto risco é justamente a mensagem assustada que mais
 * receberia reação.
 */
export const REACOES_DE_MENSAGEM = ["❤️", "🙏", "🤗", "🥹", "😂", "👏"] as const;
export type ReacaoDeMensagem = (typeof REACOES_DE_MENSAGEM)[number];

export function reacaoDeMensagemConhecida(t: unknown): t is ReacaoDeMensagem {
  return typeof t === "string" && (REACOES_DE_MENSAGEM as readonly string[]).includes(t);
}

/**
 * O que a citação mostra.
 *
 * ⚠️ **UMA LINHA, e cortada** — a citação existe para lembrar QUAL mensagem,
 * não para reler a mensagem. Uma citação de cinco linhas empurra a resposta para
 * fora da tela e inverte a hierarquia.
 *
 * ⚠️ E mensagem apagada vira "mensagem apagada": a coluna é `ON DELETE SET
 * NULL`, mas apagar MARCA em vez de remover, então a linha continua ali com o
 * texto nulo — e a citação em branco pareceria defeito.
 */
export const CITACAO_MAX = 80;

export function textoDaCitacao(m: {
  texto: string | null;
  apagada: boolean;
  imagemUrl?: string | null;
  refTipo?: string | null;
}): string {
  if (m.apagada) return "mensagem apagada";
  const t = (m.texto ?? "").trim();
  if (t) return t.length > CITACAO_MAX ? `${t.slice(0, CITACAO_MAX - 1)}…` : t;
  if (m.imagemUrl) return "📷 Foto";
  if (m.refTipo === "post") return "🖼 Publicação";
  if (m.refTipo === "story") return "↩ Story";
  return "mensagem";
}
