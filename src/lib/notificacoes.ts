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

/** Ids já lidos por este usuário neste aparelho. */
export function lerLidas(uid: string | null): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const cru = localStorage.getItem(chaveDe(uid));
    const arr = cru ? (JSON.parse(cru) as unknown) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []);
  } catch {
    /* storage cheio, desligado ou com lixo: ninguém leu nada, e tudo bem —
       o pior caso é a bolinha vermelha aparecer de novo. */
    return new Set();
  }
}

/**
 * Marca ids como lidos.
 *
 * Guarda no máximo 200: a lista só cresce, e as derivadas trocam de id quando
 * a cidade muda (`local:BH` → `local:SP`), então sem teto isso viraria lixo
 * eterno no storage da paciente.
 */
export function marcarLidas(uid: string | null, ids: string[]): Set<string> {
  const atual = lerLidas(uid);
  ids.forEach((id) => atual.add(id));
  const podadas = [...atual].slice(-200);
  try {
    localStorage.setItem(chaveDe(uid), JSON.stringify(podadas));
  } catch {
    /* sem storage a bolinha volta na próxima abertura — irritante, não quebra */
  }
  return new Set(podadas);
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

/** Quantas ainda não foram abertas — é isto que acende a bolinha. */
export function contarNaoLidas(lista: Notificacao[], lidas: Set<string>): number {
  return lista.filter((n) => !lidas.has(n.id)).length;
}
