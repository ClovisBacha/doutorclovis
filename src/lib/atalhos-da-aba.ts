/**
 * OS ATALHOS DA ABA — o que abre quando ela toca DE NOVO no ícone da barra.
 *
 * Pedido do dono, com a foto do aparelho na mão: "toda essa parte de cima deve
 * sumir, não precisamos que cada aba do app ocupe esse espaço que é precioso.
 * As funções adicionais — ir no perfil, mensagens da própria aba da comunidade —
 * devem abrir quando a pessoa está na aba e toca no ícone dela na navbar de
 * novo; aí abrem várias bolinhas pra cima com opções de atalhos. Vamos deixar o
 * mais clean possível, onde o primeiro elemento da aba será os stories, assim
 * como no Instagram."
 *
 * ─── POR QUE UM REGISTRO, E NÃO UMA PROP ───────────────────────────────────
 *
 * Quem desenha a barra é `AppBottomNav`, no topo da árvore. Quem sabe quais são
 * os atalhos é a TELA, lá no fundo (o feed sabe o que é "publicar", a Saúde
 * saberá o que é dela). Ligar os dois por prop obrigaria cada tela a repassar
 * uma lista por toda a cadeia de componentes até a barra — e a próxima tela a
 * ganhar atalhos teria de refazer a mesma travessia.
 *
 * É a mesma decisão de `evento-sementinhas.ts`, e pelo mesmo motivo: seis
 * pontos em galhos diferentes precisando falar com um só.
 *
 * ⚠️ **Sem JSX aqui.** O atalho carrega uma CHAVE de ícone (`"mais"`,
 * `"coracao"`…) e quem desenha é a barra. Um `ReactNode` neste arquivo faria a
 * barra depender do módulo do feed — que importa a rede social inteira — só
 * para saber que existe um botão de publicar.
 */

/** Os desenhos que a barra sabe fazer. */
export type IconeDeAtalho =
  | "buscar"
  | "coracao"
  | "mais"
  | "pessoa"
  | "grade"
  | "marcador"
  /** O balão de fala — a caixinha de perguntas. */
  | "balao"
  | "engrenagem"
  /** Os três pontos — a bolinha "Mais", que abre a folha com o resto. */
  | "pontos";

export type AtalhoDaAba = {
  /** Estável — a barra usa como `key` e para animar sem remontar tudo. */
  id: string;
  rotulo: string;
  icone: IconeDeAtalho;
  /**
   * Um número ao lado do rótulo (recados não lidos, por exemplo).
   *
   * ⚠️ Número, e não booleano: "tem coisa" obriga a abrir para descobrir se
   * vale a pena, e a pergunta que ela faz é quantos. Mesma régua do emblema do
   * bebê bolha.
   */
  emblema?: number;
  aoTocar: () => void;
};

/** Qual seção da barra publicou o quê. */
type Registro = Record<string, AtalhoDaAba[]>;

/**
 * A lista vazia — UMA, para sempre.
 *
 * ⚠️ **ISTO NÃO É ECONOMIA DE MEMÓRIA: É O QUE IMPEDE O APP DE NÃO ABRIR.**
 *
 * Quem lê este registro é `useSyncExternalStore`, e o contrato dele é que
 * `getSnapshot` devolva a MESMA referência enquanto nada muda. `?? []` devolvia
 * um array NOVO a cada leitura — e como o React relê o instantâneo depois de
 * cada pintura e compara por `Object.is`, ele concluía "mudou" toda vez,
 * repintava, relia, concluía "mudou"…
 *
 * Medido no navegador, em `/preview-home`: a barra estourava com
 * `Maximum update depth exceeded` e o erro subia até a raiz da rota — ou seja,
 * até a tela "Algo deu errado". A barra vive FORA de qualquer
 * `TabErrorBoundary` (ela é a moldura do app, não o conteúdo de uma aba), então
 * não havia nada entre o defeito e a paciente: o app inteiro parava de abrir.
 *
 * E o caso que estourava era o COMUM — a seção sem atalho publicado, que é toda
 * aba fora da Comunidade, incluindo a home, que é onde o app abre.
 *
 * ⚠️ **`getServerSnapshot` precisa devolver ESTA MESMA constante**, e não um
 * `[]` literal: ele é lido na hidratação, e um literal ali reproduz o laço no
 * primeiro instante da abertura.
 */
export const SEM_ATALHOS: readonly AtalhoDaAba[] = Object.freeze([] as AtalhoDaAba[]);

const registro: Registro = {};
const ouvintes = new Set<() => void>();

function avisar() {
  for (const f of ouvintes) f();
}

/**
 * A tela diz quais atalhos ela oferece.
 *
 * ⚠️ Devolve a função de LIMPEZA, e ela é obrigatória no `useEffect`: sem
 * limpar, uma tela desmontada continuaria oferecendo atalhos que abrem para o
 * nada — e o pior deles seria "publicar" numa aba que já não é a da rede.
 */
export function publicarAtalhos(secao: string, atalhos: AtalhoDaAba[]): () => void {
  registro[secao] = atalhos;
  avisar();
  return () => {
    if (registro[secao] === atalhos) {
      delete registro[secao];
      avisar();
    }
  };
}

export function atalhosDe(secao: string | null | undefined): readonly AtalhoDaAba[] {
  if (!secao) return SEM_ATALHOS;
  return registro[secao] ?? SEM_ATALHOS;
}

/** Assina mudanças. Devolve a função que cancela. */
export function assinarAtalhos(fn: () => void): () => void {
  ouvintes.add(fn);
  return () => {
    ouvintes.delete(fn);
  };
}

/**
 * O toque no ícone da barra: navegar ou abrir os atalhos?
 *
 * ⚠️ **Abrir os atalhos só quando ela JÁ ESTÁ na seção.** Vindo de outra aba, o
 * primeiro toque tem de levar até lá — um menu que aparece no lugar da
 * navegação faria o caminho mais usado do app custar dois toques.
 *
 * ⚠️ **E só quando há atalho publicado.** Sem isso, tocar duas vezes em "Saúde"
 * abriria uma nuvem de bolinhas vazia, que lê como defeito.
 */
export function oToqueAbreOsAtalhos(
  secaoTocada: string,
  secaoAtiva: string | null | undefined,
  quantosAtalhos: number,
): boolean {
  return secaoTocada === secaoAtiva && quantosAtalhos > 0;
}
