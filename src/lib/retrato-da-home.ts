/**
 * O RETRATO DA HOME — a última linha de `patient_profiles` que o servidor
 * devolveu, para a home PINTAR NA HORA na abertura seguinte.
 *
 * Toda abertura esperava o `select` do perfil voltar antes de desenhar a
 * saudação, a semana e o bebê — mesmo com rede boa, e mesmo sendo a MESMA
 * linha que o aparelho recebeu na abertura anterior. A fita do Jogo já não
 * espera (`fita-cache.ts`), e a jornada também não (`hydrateFromLocal`): esta
 * é a mesma decisão, para a tela que ela abre todo dia. Pintar com o que o
 * aparelho tem, corrigir quando a nuvem falar — e a resposta da rede SEMPRE
 * sobrescreve, inclusive quando é "não consegui ler".
 *
 * ⚠️ **SÓ QUEM JÁ FOI LIBERADA COMO PACIENTE.** O retrato é gravado no mesmo
 * ponto em que a home libera cedo (âncora gestacional e sem marca de médico), e
 * lido com a mesma regra. Médico e admin nunca gravam; um perfil sem âncora
 * não pinta nada, porque a home dele é o ritual de boas-vindas.
 *
 * ⚠️ **A chave leva o `uid`, e o `id` da linha é conferido na leitura.** O
 * aparelho é compartilhado (num consultório é o caso comum), e o perfil de uma
 * conta não pode aparecer na home de outra nem por um quadro. E o `signOut`
 * apaga TODOS os retratos do aparelho, junto com a jornada local.
 *
 * ⚠️ **NÃO é `dc-path-`.** Esse prefixo viaja no blob de `journey_state`.
 */
export const PREFIXO_RETRATO_DA_HOME = "dc-cache-home:";
const VERSAO = 1;

export type PerfilRetratado = Record<string, unknown> & { id?: unknown };

type Armazem = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function armazem(): Armazem | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function chaveDoRetrato(uid: string): string {
  return `${PREFIXO_RETRATO_DA_HOME}${uid}`;
}

/** DUM, DPP ou ultrassom: sem uma delas a home é o ritual, não a semana. */
export function temAncoraGestacional(perfil: PerfilRetratado | null | undefined): boolean {
  return !!(perfil?.lmp_date || perfil?.due_date || perfil?.reference_date);
}

/** A MESMA regra do `liberarCedo` da home: paciente com âncora, sem marca de médico. */
export function podePintarDoRetrato(
  perfil: PerfilRetratado | null | undefined,
  marcaDeMedico: boolean,
): boolean {
  return temAncoraGestacional(perfil) && !marcaDeMedico;
}

/** O que o aparelho lembra da home desta conta; `null` quando não há nada que sirva. */
export function lerRetratoDaHome(
  uid: string,
  storage: Armazem | null = armazem(),
): PerfilRetratado | null {
  if (!storage || !uid) return null;
  try {
    const cru = storage.getItem(chaveDoRetrato(uid));
    if (!cru) return null;
    const v = JSON.parse(cru) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const o = v as { v?: unknown; perfil?: unknown };
    if (o.v !== VERSAO || !o.perfil || typeof o.perfil !== "object" || Array.isArray(o.perfil)) {
      return null;
    }
    const perfil = o.perfil as PerfilRetratado;
    /* A linha tem de ser DESTA conta — a chave já leva o uid, mas a conferência
       custa nada e é a última barreira num aparelho compartilhado. */
    if (perfil.id !== uid) return null;
    return perfil;
  } catch {
    return null;
  }
}

/** Grava só o que a home aceitaria pintar; qualquer outra coisa é ignorada. */
export function gravarRetratoDaHome(
  uid: string,
  perfil: PerfilRetratado | null | undefined,
  storage: Armazem | null = armazem(),
): void {
  if (!storage || !uid || !perfil || perfil.id !== uid || !temAncoraGestacional(perfil)) return;
  try {
    storage.setItem(chaveDoRetrato(uid), JSON.stringify({ v: VERSAO, em: Date.now(), perfil }));
  } catch {
    /* cota estourada ou storage bloqueado: o retrato é conveniência, e a home
       continua esperando a rede como sempre esperou */
  }
}

export function apagarRetratoDaHome(uid: string, storage: Armazem | null = armazem()): void {
  try {
    storage?.removeItem(chaveDoRetrato(uid));
  } catch {
    /* idem */
  }
}
