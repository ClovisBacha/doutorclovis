/**
 * "Essa coluna não existe neste banco" — o teste, num lugar só.
 *
 * Este produto roda contra um banco de produção que tem MENOS colunas que o
 * repositório (migrations pendentes), então quase toda escrita tem um recuo:
 * tenta com a coluna nova, e se ela não existir, grava o que dá. O recuo é a
 * diferença entre "o médico consegue trabalhar" e "o botão não faz nada".
 *
 * O problema é que o teste estava escrito à mão em mais de vinte lugares, e
 * metade deles testa o código ERRADO. São dois códigos diferentes, e a
 * diferença não é cosmética:
 *
 *   42703     Postgres. Sai de um SELECT/ORDER/FILTER que cita coluna ausente.
 *             O erro atravessa o PostgREST vindo do banco.
 *
 *   PGRST204  PostgREST. Sai de um INSERT/UPDATE cujo PAYLOAD tem coluna que não
 *             está no schema cache. Nem chega ao Postgres — logo, nunca 42703.
 *
 * Ou seja: quem escreve `error.code === "42703"` num caminho de ESCRITA
 * escreveu um recuo que nunca roda. Foi exatamente isso que fez a devolutiva de
 * exame do médico sumir enquanto a tela dizia "✓", e o botão "marcar
 * respondida" falhar em silêncio no banco de hoje.
 *
 * `PGRST205` entra junto em `faltaNoBanco`: é o mesmo caso, uma tabela inteira
 * fora do schema cache, e tratá-lo como erro real fazia o painel exibir "não
 * consegui ler todos os registros" em todo carregamento — um alarme que grita
 * sempre é um alarme que se aprende a ignorar.
 */

type ErroPostgrest = { code?: string | null } | null | undefined;

const cod = (e: ErroPostgrest): string => (e && typeof e.code === "string" ? e.code : "");

/**
 * Coluna ausente, nos DOIS sentidos. Use em qualquer recuo de "tenta com a
 * coluna nova": cobre tanto a leitura (42703) quanto o payload de escrita
 * (PGRST204), e assim não depende de quem escreve lembrar de qual é qual.
 */
export function colunaAusente(erro: ErroPostgrest): boolean {
  const c = cod(erro);
  return c === "PGRST204" || c === "42703";
}

/** Tabela que não existe (ou não está no schema cache do PostgREST). */
export function tabelaAusente(erro: ErroPostgrest): boolean {
  const c = cod(erro);
  return c === "42P01" || c === "PGRST205";
}

/** Coluna OU tabela: "este banco ainda não tem essa migration". */
export function faltaNoBanco(erro: ErroPostgrest): boolean {
  return colunaAusente(erro) || tabelaAusente(erro);
}
