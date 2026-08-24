/**
 * O QUE ESTÁ ACONTECENDO ATRÁS DE CADA PORTA DA COMUNIDADE.
 *
 * ─── POR QUE ISTO EXISTE ────────────────────────────────────────────────────
 *
 * Pedido do dono: a aba da Comunidade "não tem o acabamento que a aba do
 * Instagram tem". Fotografadas lado a lado, a diferença **não é de estilo** —
 * é de INFORMAÇÃO:
 *
 *   · a aba do Instagram mostra os stories de quem ela conhece, a próxima live
 *     com horário, e "você entrou na 29ª semana, publicou 3 vezes e recebeu 12
 *     reações";
 *   · a Comunidade mostra **seis cartões idênticos que nunca mudam**.
 *
 * Um menu não é um hub. O que faltava era cada porta dizer se aconteceu alguma
 * coisa atrás dela — que é o que faz alguém abrir.
 *
 * ⚠️ **NÃO CONFUNDIR COM `resumo-da-comunidade.ts`**, que é o push semanal
 * ("três pessoas que você acompanha publicaram"). Este arquivo é o estado das
 * PORTAS, dentro do app. Eu já sobrescrevi aquele por acidente uma vez ao
 * escolher um nome parecido demais.
 *
 * ─── A DIREÇÃO DA FALHA, QUE É A DECISÃO CENTRAL ────────────────────────────
 *
 * ⚠️ **"NÃO CONSEGUI LER" NÃO É "ZERO".** Um contador que falha e mostra `0`
 * AFIRMA que não há nada, e ela deixa de abrir a porta onde havia. É a mesma
 * régua que este repositório já aplicou à fila de denúncias ("não consegui
 * olhar" ≠ "não há nada"), à disponibilidade da agenda e ao saldo do chá de
 * bebê. Aqui: contagem ilegível vira `null`, e `null` **não desenha nada** — a
 * porta volta a ser só a porta.
 *
 * ─── E O QUE ESTES NÚMEROS NÃO SÃO ──────────────────────────────────────────
 *
 * ⚠️ **Nenhum deles cobra.** Não há "faltam 3", não há prazo, não há "você não
 * publicou esta semana". São FATOS sobre o que outras pessoas fizeram por ela:
 * quem reservou um presente, quem entrou, quantas fotos a família já viu. É a
 * mesma linha que separa "3 de 4" de "falta 1!" nos conjuntos do Cantinho.
 *
 * Num app de gestação de alto risco, um hub que cobra é um hub que ela fecha.
 */

/** A chave de cada porta — a mesma de `PORTAS`, em `comunidade.ts`. */
export type ChaveDaPorta = "cha" | "feed" | "amigas" | "acompanhante" | "album" | "nome";

/**
 * O que se sabe de uma porta.
 *
 * ⚠️ `null` quer dizer **"não sei"**, nunca "zero". Zero é `0` — e ele também
 * não desenha emblema: porta sem novidade é porta em paz.
 */
export type EstadoDaPorta = {
  /** Quantas coisas atrás da porta. `null` = não consegui ler. */
  quantas: number | null;
  /** Uma linha curta e concreta, quando há o que dizer. */
  frase?: string | null;
};

export type EstadoDasPortas = Partial<Record<ChaveDaPorta, EstadoDaPorta>>;

/**
 * O emblema que a porta mostra.
 *
 * ⚠️ **Teto em `99+`, e não em `9+`.** O primeiro teto que escrevi foi `9+`, e
 * a bancada mostrou por que estava errado: o cartão do Álbum saiu com o emblema
 * **9+** ao lado da frase **"12 fotos no álbum"** — dois números para a mesma
 * coisa, se contradizendo a um centímetro de distância. Teto que aparece antes
 * do número real vira mentira quando a frase ao lado diz a verdade.
 *
 * `99+` é o mesmo teto do contador de amigas na fita do Caminho, e cobre o caso
 * real (fotos, sugestões de nome, presentes) sem nunca contradizer a frase.
 *
 * ⚠️ E o teto continua existindo porque é limite de LARGURA: são dois cartões
 * por linha num celular de 393px, e "137" empurraria o título para a segunda
 * linha em "Acompanhante", que é o rótulo mais longo.
 */
export function emblemaDaPorta(e: EstadoDaPorta | undefined): string | null {
  if (!e || e.quantas === null || e.quantas === undefined) return null;
  if (e.quantas <= 0) return null;
  return e.quantas > 99 ? "99+" : String(e.quantas);
}

/**
 * A linha de estado sob o subtítulo.
 *
 * ⚠️ **Só aparece quando há FATO.** Um cartão que inventa "tudo em dia" para
 * preencher espaço é ruído, e ruído repetido seis vezes vira uma tela que
 * ninguém lê.
 */
export function fraseDaPorta(e: EstadoDaPorta | undefined): string | null {
  if (!e) return null;
  const f = e.frase?.trim();
  return f ? f : null;
}

/** A porta tem alguma novidade? Serve para ordenar. */
export function temNovidade(e: EstadoDaPorta | undefined): boolean {
  return emblemaDaPorta(e) !== null || fraseDaPorta(e) !== null;
}

/**
 * Quantas novidades a aba inteira tem.
 *
 * ⚠️ **Soma só o que É número.** Porta com `null` não entra, e porta que só tem
 * frase também não: um emblema promete CONTAGEM, e somar frases faria o número
 * não bater com o que ela encontra ao abrir. Mesma regra do contador que sobe
 * para o grupo de abas do painel.
 */
export function novidadesDasPortas(r: EstadoDasPortas): number {
  let total = 0;
  for (const e of Object.values(r)) {
    if (e && typeof e.quantas === "number" && e.quantas > 0) total += e.quantas;
  }
  return total;
}

/**
 * A ORDEM DAS PORTAS.
 *
 * ⚠️ **O que tem novidade sobe, e o resto MANTÉM a ordem original.** Não é
 * ordenação por contagem: uma porta com 7 e outra com 2 continuam na ordem em
 * que foram desenhadas, porque reordenar por tamanho transforma o hub num
 * PLACAR — e "quem me deu mais presentes" é exatamente a comparação que a aba
 * das Amigas gastou um arquivo inteiro para não ter.
 *
 * ⚠️ E é ESTÁVEL de propósito: sem isso, a porta que ela acabou de visitar (e
 * cujo contador zerou) pula de lugar enquanto ela olha, e na próxima volta ela
 * procura o cartão onde ele estava.
 */
export function ordenarPortas<T extends { key: string }>(
  portas: T[],
  estado: EstadoDasPortas,
): T[] {
  const com: T[] = [];
  const sem: T[] = [];
  for (const p of portas) {
    if (temNovidade(estado[p.key as ChaveDaPorta])) com.push(p);
    else sem.push(p);
  }
  return [...com, ...sem];
}
