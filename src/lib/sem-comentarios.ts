/**
 * APAGAR OS COMENTÁRIOS DE UM ARQUIVO, SEM ENGOLIR CÓDIGO.
 *
 * Dezenas de testes deste repositório leem o fonte e procuram texto nele. Todos
 * precisam tirar a prosa antes — este arquivo registra dez vezes em que um
 * comentário fez um teste passar sobre um defeito, ou reprovar código correto.
 *
 * ─── ⚠️ AS DUAS FORMAS INGÊNUAS QUEBRAM, E AS DUAS JÁ CUSTARAM AQUI ────────
 *
 *  1. **Regex de barra-asterisco até o próximo fechamento.** Num `.tsx`,
 *     `accept="image/(estrela)"` tem uma barra-asterisco DENTRO de uma string:
 *     o padrão abre um "comentário" ali e o fecha centenas de linhas abaixo.
 *     Medido em `nutricao-tab.tsx`: o cartão da câmera inteiro sumia, e três
 *     arquivos de teste vizinhos passaram a ler um fonte com um buraco — dois
 *     ficaram vermelhos sobre código que não mudou, e um continuou VERDE com
 *     uma asserção negativa cega, que é a direção perigosa.
 *  2. **Varredor que conhece strings.** Em JSX, aspas simples e duplas
 *     aparecem como TEXTO ("a capa é o primeiro quadro"), e o varredor abre uma
 *     string ali, engolindo o que vier até a próxima aspa.
 *
 * ─── O QUE FUNCIONA: A ÂNCORA DE LINHA ─────────────────────────────────────
 *
 * Neste repositório todo comentário de bloco COMEÇA a sua linha — os blocos de
 * doc e os comentários de JSX, sem exceção. Uma barra-asterisco no meio de uma
 * linha é, portanto, sempre outra coisa: uma string, um glob, uma expressão
 * regular. Ancorar a abertura no começo da linha resolve os dois casos acima e
 * não depende de entender a sintaxe.
 *
 * ⚠️ Isto NÃO é um analisador de JavaScript, e não deve virar um: o trabalho
 * dele é servir uma busca de texto, e o custo de errar é um teste que mente.
 * Se um dia um comentário de bloco precisar começar no meio de uma linha, a
 * resposta é mover o comentário — nunca afrouxar esta régua.
 */
export function semComentarios(fonte: string): string {
  return (
    fonte
      /* Bloco de JSX e bloco comum, os dois ancorados no começo da linha. */
      .replace(/^[ \t]*\{\/\*[\s\S]*?\*\/\}[ \t]*\n?/gm, "")
      .replace(/^[ \t]*\/\*[\s\S]*?\*\/[ \t]*\n?/gm, "")
      /* ⚠️ A de linha exige espaço, aspas ou começo de linha antes das duas
         barras: sem isso ela come `https://exemplo.com` de dentro de uma
         string e leva o resto da linha junto. */
      .replace(/(^|[\s"'`(){}[\],;])\/\/[^\n]*/g, "$1")
  );
}
