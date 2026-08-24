/**
 * ACHAR UMA PACIENTE PELO NOME.
 *
 * ─── POR QUE ISTO É UM ARQUIVO, E NÃO DUAS LINHAS NO COMPONENTE ─────────────
 *
 * Porque régua se testa, e componente não. Deixado dentro de
 * `mesada-do-medico.tsx`, o teste teria de importar o componente — que importa
 * `sonner`, que toca `document` ao carregar e derruba o `bun test` inteiro com
 * um erro que não tem nada a ver com busca de nome. Foi exatamente o que
 * aconteceu na primeira tentativa.
 *
 * ─── AS DUAS REGRAS ─────────────────────────────────────────────────────────
 *
 * 1. **Sem acento e sem caixa.** "SOFIA", "sofia" e "Sofía" são a mesma
 *    pessoa. Quem digita o nome de uma paciente está com pressa e não vai
 *    acertar o acento — e a lista vazia depois de digitar certo é indistinguível
 *    de "essa paciente não é minha".
 *
 * 2. **O nome do BEBÊ também acha.** É assim que muito médico guarda a
 *    paciente na cabeça ("a mãe da Helena"), e o dado já está na mão.
 *
 * Busca vazia devolve TODAS, e busca sem resultado devolve NENHUMA. O segundo
 * caso parece óbvio e é o erro clássico: cair para a lista inteira quando nada
 * casa faria o médico digitar um nome, ver todas, e presentear a errada.
 */

/** O mínimo que a lista precisa expor para ser procurada. */
export type PacienteBuscavel = {
  display_name?: string | null;
  baby_name?: string | null;
};

export function filtrarPacientes<T extends PacienteBuscavel>(pacientes: T[], busca: string): T[] {
  const alvo = normalizarNome(busca);
  if (!alvo) return pacientes;
  return pacientes.filter(
    (p) =>
      normalizarNome(p.display_name ?? "").includes(alvo) ||
      normalizarNome(p.baby_name ?? "").includes(alvo),
  );
}

/** Minúsculas, sem acento, sem espaço nas pontas. */
export function normalizarNome(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}
