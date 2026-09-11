/**
 * A FILA LOCAL — o mecanismo que faz um registro clínico não se perder sem rede.
 *
 * ⚠️ **ISTO NASCEU COMO CÓPIA, E É POR ISSO QUE VIROU UM MÓDULO SÓ.** A fila de
 * contrações resolveu, em set/2026, o defeito de a contração ser perdida num 4G
 * de elevador: ela nasce no aparelho e sobe quando fecha. A aba irmã — o
 * contador de movimentos — continuava exigindo rede para gravar DUAS HORAS de
 * contagem, e ia ganhar a segunda cópia do mesmo laço.
 *
 * Duas filas escritas à mão divergiriam no primeiro conserto, e a divergência
 * apareceria como UMA DAS DUAS PERDENDO DADO CLÍNICO — sem erro nenhum, porque
 * a fila que falha fica em silêncio por construção. É a mesma razão pela qual o
 * catálogo da intensidade, a régua da semana pública e o link de indicação
 * moram num lugar só.
 *
 * ⚠️ **O QUE NÃO É GENÉRICO FICA FORA.** Cada fila declara a FORMA do pacote
 * dela e o que conta como pronto para subir: numa contração o que sobe é a
 * ENCERRADA (a aberta ainda vai ganhar `ended_at`), e numa sessão de chutes
 * tudo que entra na fila já está fechado, porque a contagem em curso mora em
 * `sessao-guardada.ts`. Espremer as duas num campo comum faria uma delas subir
 * cedo.
 */

/** Id local. É o que distingue da linha do banco em toda lista mesclada. */
export const PREFIXO_LOCAL = "local-";

/**
 * ⚠️ **SETE DIAS, e o limite existe pelo lado do `localStorage`.** Um registro
 * pendente é dado clínico e não se joga fora por pressa — mas uma fila eterna
 * acumula, e a cota que estourar derruba a PRÓXIMA gravação de qualquer coisa,
 * inclusive o `journey_state`, que carrega a jornada inteira dela. Sete dias
 * cobrem qualquer viagem, internação ou troca de aparelho; depois disso o
 * episódio já passou e a linha não muda conduta nenhuma.
 */
export const VALIDADE_DIAS = 7;

/** O mínimo que a fila precisa saber de um pacote para poder cuidar dele. */
export type PacoteLocal = {
  id: string;
  started_at: string;
  /**
   * Quantas vezes já tentamos subir.
   *
   * ⚠️ Ela existe por causa da DUPLICATA: se o `insert` deu certo e a resposta
   * se perdeu no caminho, a segunda tentativa criaria uma segunda linha no
   * mesmo instante. A partir da primeira tentativa o chamador CONFERE antes de
   * inserir — nenhuma das duas tabelas tem chave única, então a chave natural é
   * o `started_at`, que é único por construção (ninguém começa duas contrações
   * nem duas contagens no mesmo milissegundo).
   */
  tentativas: number;
};

export function ehLocal(id: string): boolean {
  return id.startsWith(PREFIXO_LOCAL);
}

/** Um id local novo, ancorado no instante — legível e único por construção. */
export function novoIdLocal(agora: number): string {
  return `${PREFIXO_LOCAL}${agora}`;
}

function seguro<T>(f: () => T, padrao: T): T {
  try {
    return f();
  } catch {
    /* `localStorage` lança em janela privada, com dados de site bloqueados e
       em captura de miniatura. Uma fila que estoura aqui derrubaria o toque
       que INICIA o registro. */
    return padrao;
  }
}

/**
 * O que ainda não subiu, já podado e em ordem CRESCENTE.
 *
 * ⚠️ Crescente porque quem sincroniza insere na ordem em que aconteceram, e a
 * tela mescla com o servidor por instante. Devolver fora de ordem faria o
 * intervalo entre registros — o número que decide ir à maternidade, do lado das
 * contrações — sair negativo em alguma linha.
 */
export function lerFilaDe<T extends PacoteLocal>(
  chave: string,
  ehPacote: (x: unknown) => x is T,
  agora: number,
): T[] {
  if (typeof window === "undefined" || !chave) return [];
  return seguro(() => {
    const cru = window.localStorage.getItem(chave);
    if (!cru) return [];
    const bruto: unknown = JSON.parse(cru);
    if (!Array.isArray(bruto)) return [];
    return podar(bruto.filter(ehPacote), agora);
  }, []);
}

export function gravarFilaEm<T extends PacoteLocal>(chave: string, lista: readonly T[]): void {
  if (typeof window === "undefined" || !chave) return;
  seguro(() => {
    if (!lista.length) window.localStorage.removeItem(chave);
    else window.localStorage.setItem(chave, JSON.stringify(lista));
    return null;
  }, null);
}

/** Poda o que venceu — e o que tem instante no FUTURO. */
export function podar<T extends PacoteLocal>(lista: readonly T[], agora: number): T[] {
  const limite = agora - VALIDADE_DIAS * 24 * 3600000;
  return [...lista]
    .filter((c) => {
      const t = new Date(c.started_at).getTime();
      /* ⚠️ Instante no futuro também vence: relógio adiantado e depois
         corrigido deixaria uma pendente eterna na fila. */
      return Number.isFinite(t) && t >= limite && t <= agora + 3600000;
    })
    .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
}

/** Põe ou substitui um pacote na fila, devolvendo a lista nova. */
export function comPacote<T extends PacoteLocal>(
  lista: readonly T[],
  pacote: T,
  agora: number,
): T[] {
  const sem = lista.filter((c) => c.id !== pacote.id);
  return podar([...sem, pacote], agora);
}

export function semPacote<T extends PacoteLocal>(lista: readonly T[], id: string): T[] {
  return lista.filter((c) => c.id !== id);
}

/**
 * Mescla o que veio do servidor com o que ainda está no aparelho.
 *
 * ⚠️ **O `started_at` DESEMPATA, e é isso que impede o registro de aparecer
 * duas vezes** no segundo em que ele sobe: entre o `insert` dar certo e o
 * `load()` responder, a mesma linha existe nos dois lugares. Quem vence é a do
 * SERVIDOR — ela já tem o id de verdade, que é o que o botão de apagar e o de
 * corrigir precisam.
 *
 * ⚠️ E a saída é DECRESCENTE: é a ordem das duas listas na tela.
 */
export function mesclar<T extends { id: string; started_at: string }, P extends PacoteLocal>(
  doServidor: readonly T[],
  pendentes: readonly P[],
): (T | P)[] {
  const jaTem = new Set(doServidor.map((c) => c.started_at));
  const sobra = pendentes.filter((c) => !jaTem.has(c.started_at));
  return [...doServidor, ...sobra].sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
  );
}
