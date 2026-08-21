/**
 * A MINIATURA DA GRADE — por que ela existe e de que tamanho.
 *
 * ─── O QUE ISTO CONSERTA ────────────────────────────────────────────────────
 *
 * A grade do perfil desenha células de 130×173 e baixava a foto de **1080px**
 * para cada uma. Medido numa abertura de perfil: **2,67 MB e 21 requisições**,
 * para desenhar miniaturas — e é exatamente o caminho que o dono descreveu
 * ("clico na foto de quem publicou e demora cinco segundos").
 *
 * A foto grande continua existindo e continua sendo a que abre quando ela toca
 * na publicação. O que muda é o que a GRADE pede.
 *
 * ─── O TAMANHO SAI DE CONTA, NÃO DE GOSTO ──────────────────────────────────
 *
 * A grade tem três colunas com 2px de vão numa tela de 393px:
 *
 *     célula = (393 − 2×2) / 3 ≈ 129,7 px de largura
 *     altura = 129,7 × 4/3 ≈ 173 px          (a célula é 3:4, como o modelo)
 *
 * Num iPhone Pro (densidade 3) isso são **389 × 519 pixels reais**. Uma foto em
 * retrato entra na célula pelo lado MAIOR, então o lado maior da miniatura
 * precisa cobrir 519.
 *
 * ⚠️ **480, e não 320.** Trezentos e vinte seriam 62% do necessário num
 * aparelho de densidade 3 — visivelmente mole justamente na tela que existe
 * para mostrar foto. 480 cobre 92% de 519, o que é imperceptível, e ainda
 * assim é ~4× menos byte que 1080.
 *
 * ⚠️ **E não adianta reduzir sem consertar o `lazy`.** As vinte células
 * disparam todas na abertura (só 8 estão na dobra) porque as `<img>` não têm
 * `width`/`height`: sem as dimensões, o navegador não sabe o que está fora da
 * tela e baixa tudo. As duas coisas juntas é que transformam 2,67 MB em ~500 kB.
 */

/** O lado maior da miniatura, em pixels. Ver a conta no cabeçalho. */
export const LADO_DA_MINIATURA = 480;

/**
 * As dimensões da célula da grade, para o `<img>` declarar.
 *
 * ⚠️ **Sem `width`/`height` o `loading="lazy"` é inerte.** O navegador precisa
 * saber a altura de cada célula para calcular o que está fora da tela; sem
 * isso, ele trata a página como se tudo estivesse na dobra e pede as vinte
 * imagens de uma vez. Medido: 21 de 21 requisições saíam na abertura, com 8
 * células visíveis.
 *
 * São 3:4 — a proporção que o modelo passou a usar em 2025, e a mesma de
 * `medidas-instagram.ts`. Estes números são o valor do ATRIBUTO (a proporção),
 * não o tamanho na tela: quem dimensiona é o CSS.
 */
export const CELULA_DA_GRADE = { largura: 130, altura: 173 } as const;

/** O que a grade e as capas pequenas precisam saber de uma publicação. */
export type ComMiniatura = {
  imagemUrl: string | null;
  /** `null` em toda publicação anterior a este recurso. */
  miniaturaUrl?: string | null;
};

/**
 * A URL que a GRADE deve usar.
 *
 * ⚠️ **A foto cheia é o recuo, e ele não é temporário.** Toda publicação
 * anterior a este recurso não tem miniatura, e gerá-las em lote exigiria baixar,
 * reduzir e subir de novo o acervo inteiro — trabalho grande sobre dado de
 * paciente, para economizar byte numa foto que ela talvez nunca mais abra. Elas
 * continuam servindo a foto grande, como sempre serviram; só as novas ficam
 * leves. A conta melhora sozinha com o tempo.
 *
 * ⚠️ E o recuo é por PUBLICAÇÃO, nunca global: uma bandeira "usar miniaturas"
 * faria a grade escolher errado para metade do acervo.
 */
export function urlDaGrade(p: ComMiniatura): string | null {
  return p.miniaturaUrl ?? p.imagemUrl ?? null;
}

/**
 * Vale a pena gerar miniatura para esta foto?
 *
 * ⚠️ **Não, quando a original já é pequena.** Uma foto que já cabe no tamanho
 * da miniatura viraria um segundo arquivo do mesmo peso: mais um upload, mais
 * uma assinatura, mais uma linha para limpar na exclusão de conta — e zero byte
 * economizado. O corte é generoso de propósito (1,25×): abaixo dele a economia
 * não paga o arquivo a mais.
 */
export function valeMiniatura(ladoMaiorOriginal: number): boolean {
  return ladoMaiorOriginal > LADO_DA_MINIATURA * 1.25;
}
