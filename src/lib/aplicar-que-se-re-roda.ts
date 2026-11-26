/**
 * OS `APLICAR_*.sql` QUE A SONDA DE TABELA E COLUNA NÃO CONSEGUE CONFERIR POR
 * INTEIRO — e por que a aba Banco não pode chamá-los de "aplicado" e parar aí.
 *
 * ⚠️ **A conferência do Banco pergunta "a tabela existe?" e "a coluna existe?",
 * e há arquivo cuja pendência não é NENHUMA DAS DUAS.**
 * `APLICAR_EVENTOS_CLINICOS.sql` monta a view `clinical_events`, que ganha
 * fonte e campo a cada leva; a tabela que a sonda olha (`clinical_acks`) existe
 * desde jul/2026 e continuará existindo para sempre. Ou seja, o arquivo que a
 * documentação manda RE-RODAR é justamente o que a tela responderia "aplicado"
 * para qualquer versão.
 *
 * ⚠️ **E o mapa é GERADO a partir do SQL** — um gerador não tem como saber que
 * uma view foi recriada, então isto NÃO é um buraco a tapar no gerador: é uma
 * pergunta que aquela sonda não faz, e que outra tela faz.
 *
 * O que este arquivo faz é impedir a única frase inaceitável: **"todo
 * `APLICAR_*.sql` que o repositório conhece já está no banco"**, dita sobre uma
 * conferência que não alcança a VERSÃO. Ele não inventa um estado novo nem
 * pinta nada de vermelho — aponta para onde a pergunta certa é feita.
 *
 * ⚠️ **A lista é CURTA de propósito.** Ela não é "arquivos importantes": é
 * "arquivos cuja pendência a sonda de tabela/coluna não enxerga". Um item a
 * mais aqui gasta a atenção que o único caso de verdade precisa ter.
 */
export const SE_RE_RODA = [
  {
    arquivo: "APLICAR_EVENTOS_CLINICOS.sql",
    /** O que a sonda do Banco NÃO consegue perguntar sobre este arquivo. */
    oQueEscapa:
      "ele monta a view clinical_events, e a view ganha fonte e campo a cada leva — a sonda vê a tabela, nunca a VERSÃO da view",
    /**
     * ⚠️ O RÓTULO EXATO DA ABA, como ele aparece na fita do admin — nunca o
     * título do arquivo. Um destino que não é o nome que ele lê na tela manda
     * o dono procurar uma aba que não existe. Há teste comparando com
     * `admin.tsx`.
     */
    ondeConferir: "Fila clínica",
  },
] as const;

/** O que escapa da conferência daquele arquivo, ou `null` se nada escapa. */
export function oQueEscapaDaConferencia(arquivo: string): (typeof SE_RE_RODA)[number] | null {
  return SE_RE_RODA.find((x) => x.arquivo === arquivo) ?? null;
}

/** Os que estão na lista E foram dados como aplicados — é sobre eles que a tela ressalva. */
export function comConferenciaParcial(
  aplicados: readonly { arquivo: string }[],
): (typeof SE_RE_RODA)[number][] {
  return aplicados
    .map((a) => oQueEscapaDaConferencia(a.arquivo))
    .filter((x): x is (typeof SE_RE_RODA)[number] => x !== null);
}
