/**
 * Central de notificações do app.
 *
 * O problema que ela resolve: cada aviso importante virava um cartão empilhado
 * no alto da home. Três deles ao mesmo tempo — "você não tem médico",
 * "convide o seu médico", "ative a localização" — empurravam o bebê para fora
 * da primeira tela. E, pior, um aviso dispensado sumia para sempre: não havia
 * onde reencontrá-lo.
 *
 * Agora todos moram num lugar só, atrás do ☰, e se comportam como caixa de
 * entrada: ficam na lista mesmo depois de lidos, e cada um leva a uma ação.
 *
 * ─── Duas fontes, um formato ────────────────────────────────────────────
 *
 * 1. DERIVADAS (hoje): nascem do estado atual da conta — não têm linha em
 *    banco nenhum. "Você ainda não tem médico" existe enquanto `doctor_id`
 *    for nulo e desaparece sozinha no instante em que ela vincula um. É por
 *    isso que elas não podem ser "apagadas": apagar não faria sentido, porque
 *    o que as cria é a situação, não uma mensagem enviada.
 *
 * 2. ENVIADAS (a fazer): recados do médico e novidades do app. Elas vão ter
 *    linha em banco, remetente e data. O formato abaixo já as comporta — o
 *    que falta é a tabela e a tela do médico para escrevê-las. `buildNotifs`
 *    recebe a lista pronta e mistura as duas por data.
 *
 * ─── O que é "lida" ─────────────────────────────────────────────────────
 *
 * Guardado em `localStorage`, por usuário. É deliberado que seja local: a
 * bolinha vermelha responde "tem coisa nova para MIM, neste aparelho", e
 * sincronizar isso com o servidor custaria uma escrita a cada abertura da
 * gaveta para resolver um problema que quase ninguém tem (a mesma conta em
 * dois celulares). Quando as notificações enviadas entrarem, o "lida" delas
 * sobe para o banco junto com elas.
 *
 * ─── QUANDO uma lida foi lida (ago/2026) ────────────────────────────────
 *
 * O formato deixou de ser uma lista de ids e passou a ser id → INSTANTE. A
 * razão é um pedido do dono: "sempre ficará guardado ali as notificações
 * durante pelo menos 7 dias, depois elas somem (as que já foram lidas)".
 *
 * Sem o instante não há como saber quando os sete dias começam — e a poda
 * antiga (`slice(-200)`) jogava fora pela ORDEM DE INSERÇÃO, o que é outra
 * coisa: apagava a lida mais velha mesmo que fosse de ontem, e mantinha uma de
 * um ano atrás se ela tivesse sido reinserida.
 *
 * O tipo é `Map`, e não um objeto, porque `Map.has()` é a mesma chamada que o
 * `Set` de antes: a folha de notificações não mudou uma linha.
 */

export type NotifAcao = {
  rotulo: string;
  /** Executada ao tocar. Fecha a gaveta por conta própria se precisar. */
  executar: () => void;
};

export type Notificacao = {
  /** Estável entre renderizações: é a chave do "já li isto". */
  id: string;
  icone: string;
  titulo: string;
  corpo: string;
  /** Quando existe, a notificação é tocável e leva a algum lugar. */
  acao?: NotifAcao;
  /** ISO. Sem data = derivada do estado atual; ordena como "agora". */
  data?: string;
};

const CHAVE = "dc-notif-lidas";

function chaveDe(uid: string | null): string {
  return `${CHAVE}:${uid ?? "anon"}`;
}

/** id → instante (ISO) em que foi lida. `has()` responde "já li isto". */
export type Lidas = Map<string, string>;

/**
 * Quanto tempo uma notificação LIDA continua na caixa antes de sumir.
 *
 * Sete dias, pedido do dono. A palavra dele foi "pelo menos", e é isso que o
 * número faz: a não lida NUNCA some — quem some é só a que ela já abriu, uma
 * semana depois. Tempo suficiente para reencontrar o que dispensou sem querer,
 * curto o bastante para a caixa não virar arquivo morto.
 */
export const DIAS_APOS_LIDA = 7;
const MS_DA_JANELA = DIAS_APOS_LIDA * 86_400_000;

/** Ids já lidos por este usuário neste aparelho, com o instante da leitura. */
export function lerLidas(uid: string | null): Lidas {
  if (typeof window === "undefined") return new Map();
  try {
    const cru = localStorage.getItem(chaveDe(uid));
    const dado = cru ? (JSON.parse(cru) as unknown) : null;
    /* ─── O FORMATO ANTIGO ERA UM ARRAY DE IDS ────────────────────────────
       Quem já usava o app tem isso gravado. Convertido com o instante de
       AGORA, e não com zero: com zero, tudo o que ela já leu sumiria da caixa
       no primeiro carregamento da versão nova — inclusive um recado de ontem.
       Assim elas cumprem os sete dias a partir daqui, uma vez só. */
    if (Array.isArray(dado)) {
      const agora = new Date().toISOString();
      return new Map(
        dado.filter((x): x is string => typeof x === "string").map((id) => [id, agora]),
      );
    }
    if (dado && typeof dado === "object") {
      return new Map(
        Object.entries(dado as Record<string, unknown>).filter(
          (par): par is [string, string] => typeof par[1] === "string",
        ),
      );
    }
    return new Map();
  } catch {
    /* storage cheio, desligado ou com lixo: ninguém leu nada, e tudo bem —
       o pior caso é a bolinha vermelha aparecer de novo. */
    return new Map();
  }
}

/**
 * Marca ids como lidos, AGORA.
 *
 * ─── ⚠️ O REGISTRO DE LEITURA VIVE MUITO MAIS QUE A JANELA DE EXIBIÇÃO ─────
 *
 * A primeira versão podava aqui pelos MESMOS sete dias da caixa, e isso criava
 * um laço: quem esconde a notificação lida é justamente o carimbo. Apagado o
 * carimbo, `visiveis` não tem o que esconder e a notificação VOLTA — não lida,
 * com ponto vermelho, contando no emblema do mascote. Como as derivadas são
 * recriadas para sempre a partir do estado da conta ("você ainda não tem
 * médico"), o alvo era garantido: reproduzido em teste, uma notificação lida há
 * 30 dias reaparecia sob o dedo dela no instante em que ela tocasse em qualquer
 * outra.
 *
 * A janela do storage é de meio ano — folgada de propósito. Quem esconde é
 * `visiveis`, com `DIAS_APOS_LIDA`; o storage só precisa LEMBRAR, e lembrar
 * custa alguns bytes. O teto de 400 continua como rede para o caso de as
 * derivadas trocarem de id (a cidade muda: `local:BH` → `local:SP`).
 */
const MS_DA_MEMORIA = 180 * 86_400_000;
export function marcarLidas(uid: string | null, ids: string[], agora = new Date()): Lidas {
  const atual = lerLidas(uid);
  const carimbo = agora.toISOString();
  ids.forEach((id) => atual.set(id, carimbo));
  const limite = agora.getTime() - MS_DA_MEMORIA;
  const vivas = [...atual.entries()]
    .filter(([, quando]) => {
      const t = Date.parse(quando);
      return Number.isFinite(t) && t >= limite;
    })
    .slice(-400);
  try {
    localStorage.setItem(chaveDe(uid), JSON.stringify(Object.fromEntries(vivas)));
  } catch {
    /* sem storage a bolinha volta na próxima abertura — irritante, não quebra */
  }
  return new Map(vivas);
}

/**
 * O que a caixa MOSTRA: tudo que não foi lido, mais o que foi lido há menos de
 * sete dias.
 *
 * ⚠️ A não lida nunca é filtrada, por mais velha que seja. Uma notificação que
 * ela nunca abriu sumir sozinha é a única falha grave possível nesta tela —
 * seria o app decidir por ela que aquilo não importava.
 */
export function visiveis(lista: Notificacao[], lidas: Lidas, agora = new Date()): Notificacao[] {
  const limite = agora.getTime() - MS_DA_JANELA;
  return lista.filter((n) => {
    const quando = lidas.get(n.id);
    if (!quando) return true;
    const t = Date.parse(quando);
    /* Carimbo ilegível conta como recém-lida: na dúvida, mostrar. */
    return !Number.isFinite(t) || t >= limite;
  });
}

/**
 * Monta a lista final.
 *
 * As enviadas vêm primeiro porque são o que alguém escreveu para ela; as
 * derivadas são o app falando de si mesmo e ficam abaixo, na ordem em que
 * foram declaradas (a mais acionável primeiro).
 */
export function ordenar(enviadas: Notificacao[], derivadas: Notificacao[]): Notificacao[] {
  const porData = [...enviadas].sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""));
  return [...porData, ...derivadas];
}

/** Quantas ainda não foram abertas — é isto que acende o emblema do mascote. */
export function contarNaoLidas(lista: Notificacao[], lidas: Lidas): number {
  return lista.filter((n) => !lidas.has(n.id)).length;
}
