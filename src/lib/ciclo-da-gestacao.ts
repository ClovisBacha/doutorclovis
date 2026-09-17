/**
 * O CICLO — a chave que separa uma gestação da seguinte.
 *
 * ⚠️ **UMA EXPRESSÃO SÓ, e o CLAUDE.md já dizia por quê:** ela vive em
 * `loadCycleAndGestation` (`sementinhas.functions.ts`) e é usada nas chaves do
 * ledger. **"Se divergir, a contagem procura um ciclo que nunca foi gravado e
 * devolve zero"** — a paciente perderia troféus e conquistas sem erro nenhum.
 *
 * Ela passou a ser lida também pelas MEMÓRIAS da rede, onde a divergência seria
 * pior: uma publicação carimbada com um ciclo e comparada com outro faria a foto
 * de uma gestação ANTERIOR voltar como memória da de agora. Por isso a expressão
 * saiu de dentro do módulo e virou régua.
 */

/** O que a linha de `patient_profiles` precisa ter para o ciclo sair. */
export type FonteDoCiclo = {
  lmp_date?: string | null;
  reference_date?: string | null;
  birth_date?: string | null;
} | null;

/**
 * ⚠️ **A ORDEM É A DO ORIGINAL, e ela não é arbitrária:** a DUM é o marco
 * preferido; sem ela, a data de referência que o médico corrigiu; sem as duas, o
 * nascimento. `"x"` é a paciente sem nenhum marco — um valor que existe para as
 * chaves do ledger não colidirem em `null`.
 */
export function cicloDoPerfil(p: FonteDoCiclo): string {
  return p?.lmp_date ?? p?.reference_date ?? p?.birth_date ?? "x";
}

/**
 * O ciclo para CARIMBAR uma publicação.
 *
 * ⚠️ **Aqui `"x"` vira `null`, e a diferença importa.** No ledger, `"x"` é uma
 * chave válida — todo mundo precisa de uma. Numa memória, "não sei de que
 * gestação isto é" tem de significar NÃO MOSTRAR: carimbar `"x"` faria todas as
 * publicações de todas as gestações sem marco caírem no mesmo balde e voltarem
 * umas para as outras.
 */
export function cicloParaCarimbo(p: FonteDoCiclo): string | null {
  const c = cicloDoPerfil(p);
  return c === "x" ? null : c;
}
