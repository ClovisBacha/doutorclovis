/**
 * COMO UMA FOTO VIRA BYTES — WebP quando dá, JPEG quando não dá.
 *
 * ⚠️ **ESTE É O ÚNICO GANHO DE BANDA QUE NÃO CUSTA QUALIDADE.** Medido
 * codificando a mesma imagem (degradês de pele e céu com detalhe fino de
 * cabelo e tecido, que é do que uma foto de gestação é feita): **125 kB em
 * JPEG contra 88 kB em WebP** no mesmo número de qualidade — 29% a menos,
 * mesma imagem. Reduzir o lado ou baixar a qualidade custa nitidez; trocar de
 * formato não custa nada.
 *
 * ⚠️ **E EU TINHA DESCARTADO ISTO POR MEDIR ERRADO.** A primeira medição usou
 * uma imagem de RUÍDO puro e deu "9% maior" — ruído é o único conteúdo em que
 * o WebP perde, porque ele não tem o que prever. Com imagem parecida com foto,
 * a conta inverte. Régua que fica: **medida de compressão feita com imagem
 * sintética mente**; use conteúdo com degradê e textura, ou uma foto de
 * verdade.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ⚠️ **A ARMADILHA QUE OBRIGA A SONDA: `toDataURL` FALHA EM SILÊNCIO.**
 *
 * Um navegador que não sabe codificar WebP **não devolve erro** — ele devolve
 * um **PNG**, com o mesmo formato de data URL e sem nenhum aviso. E PNG de uma
 * foto é catastrófico: são vários megabytes, o oposto exato do que este módulo
 * existe para fazer. A foto estouraria o teto de 1,5 MB do servidor e a
 * publicação seria **recusada**, com a paciente sem entender por quê.
 *
 * Por isso a decisão nunca é "o navegador é moderno?" — é **codificar 1×1 e
 * ler o que voltou**. É a única resposta que não pode mentir.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ⚠️ **QUEM DECODIFICA NÃO É QUEM CODIFICA** — e este é o risco de verdade.
 * A foto sai do aparelho de quem publica e é aberta no de quem olha. Um
 * navegador que não decodifique WebP mostraria imagem quebrada.
 *
 * Na prática o piso é iOS 14 / Safari 14 (setembro de 2020); Chrome e Android
 * decodificam desde 2014, Firefox desde 2019. E **este app já exige mais que
 * isso**: o push só funciona em iOS 16.4+, que é dois anos e meio DEPOIS do
 * WebP. O formato não estreita o público do app — o push já estreitou antes.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ⚠️ **O QUE NÃO PASSA POR AQUI, e por quê:** `share-card.ts` desenha o cartão
 * que a paciente MANDA PARA FORA — WhatsApp, Instagram, a galeria do celular.
 * Ali o destino é outro app, às vezes outro sistema, e o JPEG é o formato que
 * todo lugar aceita há trinta anos. Economizar 29% de uma imagem que sai uma
 * vez não paga o risco de ela não abrir do outro lado.
 */

/** O que a sonda respondeu. `null` = ainda não perguntamos. */
let sondado: boolean | null = null;

/**
 * ⚠️ **NUNCA CHAME ISTO DENTRO DE UM RENDER.** Ela toca `document`, então no
 * SSR ela responderia uma coisa e no cliente outra — e o React descarta a
 * árvore inteira quando as duas passadas discordam. Este app já ficou SEM
 * ABRIR por um defeito dessa família, e há catraca
 * (`capacidade-fora-do-render.test.ts`) proibindo capacidade de navegador em
 * JSX. Aqui ela é chamada de dentro das funções de preparar foto, que só
 * rodam depois de um gesto.
 */
export function suportaWebp(): boolean {
  if (sondado !== null) return sondado;
  if (typeof document === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    /* ⚠️ A comparação é com o PREFIXO do que voltou, e não com o que pedimos:
       o navegador que não sabe WebP devolve `data:image/png;base64,...` sem
       reclamar de nada. */
    sondado = c.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    sondado = false;
  }
  return sondado;
}

/** Só para o teste: esquecer o que a sonda respondeu. */
export function esquecerSondaDeWebp(): void {
  sondado = null;
}

/**
 * CODIFICA UM CANVAS — o único caminho por onde uma foto do app vira bytes.
 *
 * ⚠️ **O NÚMERO DA QUALIDADE NÃO MUDA ao trocar de formato**, e isso é
 * deliberado. As duas escalas não são a mesma coisa, e no WebP o mesmo número
 * costuma entregar imagem IGUAL ou MELHOR que no JPEG — então manter o número
 * é o lado conservador: ganha-se banda sem apostar em nitidez. Mexer nele é
 * outra decisão, e é a decisão que custa qualidade.
 */
export function codificarFoto(canvas: HTMLCanvasElement, qualidade: number): string {
  return suportaWebp()
    ? canvas.toDataURL("image/webp", qualidade)
    : canvas.toDataURL("image/jpeg", qualidade);
}
