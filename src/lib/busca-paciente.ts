/**
 * ACHAR UMA PACIENTE ENTRE DUZENTAS.
 *
 * ─── POR QUE ISTO EXISTE ────────────────────────────────────────────────────
 *
 * A aba Pacientes mostra um quadro por paciente — o espelho da tela do bebê. É
 * ótimo para reconhecer e péssimo para PROCURAR: com duzentas pacientes são
 * duzentos quadros iguais em tamanho e diferentes só no desenho, e achar a
 * Fernanda vira rolagem.
 *
 * Pedido do dono (ago/2026): "quando o médico tiver duzentas pacientes tem que
 * ter ali um filtro".
 *
 * ─── POR QUE UM MÓDULO, E NÃO UM `.includes()` NA TELA ──────────────────────
 *
 * Por causa dos acentos. Um médico com pressa digita "jessica", "aparecida",
 * "conceicao" — sem acento, porque é mais rápido. Um `includes` cru não acha
 * "Jéssica", e o resultado é uma tela que diz "nenhuma paciente" para uma
 * paciente que está ali. Buscar é comparar TEXTO NORMALIZADO dos dois lados, e
 * essa regra merece teste próprio.
 */

/**
 * Texto comparável: sem acento, sem caixa, sem espaço sobrando.
 *
 * `NFD` separa a letra do acento e a faixa `̀-ͯ` remove só as marcas
 * combinantes — "ç" vira "c", "ã" vira "a", e nenhuma letra se perde.
 *
 * A faixa está escrita em ESCAPE, e não com os acentos soltos literais: um
 * caractere combinante dentro de um `[...]` é invisível no editor e gruda no
 * colchete anterior ao ser copiado. Escrito assim, dá para ler o que faz.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** O mínimo que uma paciente precisa ter para ser procurada. */
export type Buscavel = { display_name?: string | null };

/**
 * Filtra por nome. Termo vazio devolve a lista INTEIRA — e isso importa: um
 * filtro que devolve nada quando ninguém digitou nada é uma tela vazia sem
 * explicação, que é como o médico conclui que perdeu as pacientes.
 *
 * Cada palavra do termo tem de aparecer em algum lugar do nome, em qualquer
 * ordem: "silva ana" acha "Ana Paula da Silva", que é como as pessoas lembram
 * de nomes compostos.
 */
export function filtrarPacientes<T extends Buscavel>(lista: T[], termo: string): T[] {
  const partes = normalizar(termo).split(/\s+/).filter(Boolean);
  if (partes.length === 0) return lista;
  return lista.filter((p) => {
    const nome = normalizar(p.display_name ?? "");
    return partes.every((parte) => nome.includes(parte));
  });
}
