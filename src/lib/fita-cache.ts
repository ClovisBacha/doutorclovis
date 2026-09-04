/**
 * O CACHE DA FITA DO JOGO — o último saldo, troféus e amigas que o servidor
 * devolveu, para a fita PINTAR NA HORA na abertura seguinte.
 *
 * O dono, no aparelho (set/2026): "na aba do jogo o número de sementinhas e o
 * da ofensiva demoram para carregar". Medido no código: o saldo só existia
 * depois de `claimDailyAndGetWallet` responder — uma função serverless que
 * acorda fria e faz sete idas ao banco em série antes de devolver um número.
 * Até lá a fita nem desenhava o 🌱. O número de amigas, idem, atrás de
 * `contarAmigas`.
 *
 * O cache não muda NADA do que o servidor decide: ele é o que a fita mostra
 * enquanto a resposta não chega, e a resposta o sobrescreve. É a mesma
 * decisão do `hydrateFromLocal()` da jornada — pintar com o que o aparelho
 * tem, corrigir quando a nuvem falar.
 *
 * ⚠️ **A chave leva o `uid`.** O aparelho é compartilhado (num consultório é
 * o caso comum), e o saldo de uma conta não pode aparecer na fita de outra
 * nem por um segundo. Quem lê confere o uid da SESSÃO antes.
 *
 * ⚠️ **NÃO é `dc-path-`.** Esse prefixo viaja no blob de `journey_state` e
 * dispara um push a cada escrita; um cache de número não é jornada.
 *
 * ⚠️ **`saldo: null` é um valor, não ausência**: é o Modo Cuidado, em que a
 * fita esconde o 🌱. Guardar `null` faz a abertura seguinte já esconder, em
 * vez de piscar um número para quem perdeu a gestação.
 */
export type FitaCache = {
  saldo?: number | null;
  trofeus?: number;
  amigas?: number;
};

export const PREFIXO_FITA_CACHE = "dc-cache-fita:";

export function chaveDaFita(uid: string): string {
  return `${PREFIXO_FITA_CACHE}${uid}`;
}

function armazem(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** O que o aparelho lembra da fita desta conta; `null` quando não há nada. */
export function lerFitaCache(uid: string): FitaCache | null {
  const ls = armazem();
  if (!ls) return null;
  try {
    const cru = ls.getItem(chaveDaFita(uid));
    if (!cru) return null;
    const v = JSON.parse(cru) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const o = v as Record<string, unknown>;
    const fora: FitaCache = {};
    if (o.saldo === null || typeof o.saldo === "number") fora.saldo = o.saldo as number | null;
    if (typeof o.trofeus === "number") fora.trofeus = o.trofeus;
    if (typeof o.amigas === "number") fora.amigas = o.amigas;
    return fora;
  } catch {
    return null;
  }
}

/**
 * Grava SÓ o que veio (`parcial`), preservando o resto: o saldo e as amigas
 * chegam de funções diferentes, em instantes diferentes, e uma escrita que
 * substituísse o objeto inteiro apagaria o número da outra.
 */
export function gravarFitaCache(uid: string, parcial: FitaCache): void {
  const ls = armazem();
  if (!ls) return;
  try {
    const atual = lerFitaCache(uid) ?? {};
    ls.setItem(chaveDaFita(uid), JSON.stringify({ ...atual, ...parcial }));
  } catch {
    /* cota estourada ou storage bloqueado: o cache é conveniência, e a fita
       continua funcionando pelo caminho de sempre. */
  }
}
