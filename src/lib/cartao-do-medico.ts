/**
 * "ELA TEM MÉDICO?" TEM TRÊS DESFECHOS, E NÃO DOIS.
 *
 * ─── O QUE ESTE ARQUIVO CONSERTA ───────────────────────────────────────────
 *
 * O cartão do médico é a terceira coisa que a paciente vê ao abrir o app, e
 * ele decidia o texto por um booleano só: `!medico?.nome`. Com isso ele
 * AFIRMAVA **"Você ainda não tem médico — toque para encontrar um obstetra no
 * app"** em três situações completamente diferentes:
 *
 *  1. **Enquanto a pergunta está em voo** — ou seja, em TODA ABERTURA. E não é
 *     acidente: `liberarCedo` (a correção de abertura de set/2026) solta a tela
 *     assim que o PERFIL chega, de propósito, sem esperar o médico. O cartão
 *     nascia negando o vínculo e trocava pelo nome um instante depois — o
 *     "pisca" que o dono relatou como "dá a sensação de que o app está
 *     estragado", aqui sobre o dado que mais importa.
 *  2. **Quando a leitura falhou** — e aí a negação é permanente.
 *  3. Quando ela de fato não tem médico — o único caso em que a frase é
 *     verdadeira.
 *
 * ⚠️ E a afirmação não é cosmética: numa gestação de alto risco, concluir que
 * se está sem obstetra muda o que ela faz a seguir — ela toca e vai procurar
 * outro, achando que o vínculo caiu. É o mesmo vínculo de que o SOS depende
 * para avisar alguém.
 *
 * ─── POR QUE A RÉGUA É ÚNICA, E MORA EM `lib/` ─────────────────────────────
 *
 * São DOIS leitores que precisam concordar: o cartão da home e a Central de
 * Emergência. A Central já distinguia "ainda não sei" de "não tem"
 * (`medicoIndefinido`) e o cartão não — que é a forma mais comum de defeito
 * deste repositório: a régua aplicada num lugar e deixada de pé no vizinho.
 * Duas cópias divergiriam no primeiro ajuste, e a divergência apareceria como
 * **a home negando o médico que o SOS mostra**.
 *
 * E mora aqui, e não dentro do `.tsx`, porque uma régua enterrada num
 * componente de duas mil linhas só pode ser exercitada lendo o FONTE e
 * procurando palavras — este arquivo registra doze vezes em que um teste assim
 * ficou verde exatamente sobre o defeito que ele existia para pegar.
 */

/**
 * O desfecho da pergunta ao servidor.
 *
 * ⚠️ São TRÊS porque um booleano fazia dois trabalhos: `medicoResolvido`
 * queria dizer "ou eu sei, ou desisti", e essas duas coisas exigem telas
 * diferentes. É a mesma separação que "TEM ACESSO" ≠ "ESTÁ PAGANDO" já custou
 * aqui.
 */
export type EstadoDoMedico =
  /** A pergunta está em voo. Nada pode ser afirmado. */
  | "perguntando"
  /** O servidor respondeu. A resposta vale — inclusive quando é "nenhum". */
  | "respondeu"
  /** Perguntei e não obtive resposta confiável. Continua sem saber. */
  | "ilegivel";

/** O que a tela tem o direito de dizer. */
export type CartaoDoMedico =
  | "carregando"
  | "com"
  /** Só aqui a tela pode dizer "você ainda não tem médico". */
  | "sem"
  | "ilegivel";

/**
 * A régua.
 *
 * ⚠️ **`temVinculo` vem PRIMEIRO, e isso não é ordem estética.** Ter o nome na
 * mão já É a resposta: qualquer estado que chegasse junto com um médico
 * carregado descreveria uma corrida que não existe, e apagar o nome da tela por
 * causa de um estado atrasado seria o pisca de novo, ao contrário.
 *
 * ⚠️ E o padrão de `estado` é `"respondeu"` — o comportamento de hoje —, para
 * que nenhum chamador que ainda não passe o estado mude de tela. Falhar para o
 * lado de "carregando" deixaria uma tela eternamente em esqueleto para quem
 * não foi migrado, que é pior que a afirmação que estamos consertando.
 */
export function cartaoDoMedico(
  temVinculo: boolean,
  estado: EstadoDoMedico = "respondeu",
): CartaoDoMedico {
  if (temVinculo) return "com";
  if (estado === "perguntando") return "carregando";
  if (estado === "ilegivel") return "ilegivel";
  return "sem";
}

/**
 * "A tela pode AFIRMAR que ela não tem médico?"
 *
 * O predicado que o defeito pedia, num nome que se lê no ponto de uso. Só é
 * verdadeiro no único caso em que a frase é verdade.
 */
export function podeAfirmarSemMedico(
  temVinculo: boolean,
  estado: EstadoDoMedico = "respondeu",
): boolean {
  return cartaoDoMedico(temVinculo, estado) === "sem";
}
