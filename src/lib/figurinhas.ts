/**
 * AS FIGURINHAS DO DIRECT.
 *
 * ⚠️ **ELAS SÃO NOSSAS, e não um GIF de fora — e as três razões importam.**
 *
 * 1. **CSP.** O app tem política estrita; um host externo de imagem precisaria
 *    ser aberto, e ele passa a poder servir qualquer coisa.
 * 2. **Custo.** Giphy e afins cobram por chamada, e a figurinha é o formato que
 *    mais se usa por conversa.
 * 3. ⚠️ **E o que decide: conteúdo NÃO MODERADO.** A busca por "grávida" no
 *    Giphy devolve piada de parto e imagem de teor sexual. Num app de gestação
 *    de alto risco, onde a paciente pode estar internada, isso não é um risco
 *    aceitável por conveniência de desenvolvimento.
 *
 * ⚠️ **E O CATÁLOGO É PEQUENO DE PROPÓSITO.** Dezoito figurinhas cabem em duas
 * telas de rolagem e são escolhidas em um segundo. Um catálogo grande vira
 * busca, busca vira campo de texto, e aí o formato deixou de ser o gesto rápido
 * que ele existe para ser.
 */

export type Figurinha = {
  /** ⚠️ NUNCA renomeie: o id é gravado no texto da mensagem. */
  id: string;
  /** O desenho. Emoji por enquanto — ver `ARTE` abaixo. */
  arte: string;
  /** O que ela diz, para o leitor de tela e para a prévia da lista. */
  rotulo: string;
};

/**
 * ⚠️ **NENHUMA FIGURINHA FALA DE CORPO, DE EXAME OU DE CONDUTA.**
 *
 * É a mesma régua que decidiu as treze reações do post: um catálogo de gestação
 * tenta naturalmente incluir "contração", "pressão alta", "dilatação" — e uma
 * figurinha é um jeito de dizer uma coisa sem escrever, o que a torna o pior
 * formato possível para conteúdo clínico. Aqui elas dizem AFETO e PRESENÇA.
 *
 * ⚠️ **E nada de 😱 nem 😢**, pela razão já escrita nas reações: o primeiro
 * devolve pânico a quem está com medo, o segundo lê como PENA.
 */
export const FIGURINHAS: Figurinha[] = [
  { id: "abraco", arte: "🤗", rotulo: "um abraço" },
  { id: "aqui", arte: "🫂", rotulo: "estou aqui" },
  { id: "coracao", arte: "💛", rotulo: "coração" },
  { id: "forca", arte: "💪", rotulo: "força" },
  { id: "torcendo", arte: "🤞", rotulo: "torcendo" },
  { id: "orando", arte: "🙏", rotulo: "orando por você" },
  { id: "bomdia", arte: "🌅", rotulo: "bom dia" },
  { id: "boanoite", arte: "🌙", rotulo: "boa noite" },
  { id: "descansa", arte: "😴", rotulo: "descansa" },
  { id: "cafe", arte: "☕", rotulo: "um café" },
  { id: "flor", arte: "🌷", rotulo: "uma flor" },
  { id: "parabens", arte: "🎉", rotulo: "parabéns" },
  { id: "lindo", arte: "😍", rotulo: "que lindo" },
  { id: "chorando", arte: "🥹", rotulo: "me emocionei" },
  { id: "rindo", arte: "😂", rotulo: "rindo" },
  { id: "obrigada", arte: "🙌", rotulo: "obrigada" },
  { id: "saudade", arte: "🥺", rotulo: "saudade" },
  { id: "bebe", arte: "👶", rotulo: "bebê" },
];

export const FIGURINHAS_POR_ID = new Map(FIGURINHAS.map((f) => [f.id, f]));

/**
 * ⚠️ **A FIGURINHA VIAJA COMO TEXTO MARCADO, e não como coluna nova.**
 *
 * `:dc-fig:abraco:` é o corpo da mensagem. Assim ela passa por tudo que já
 * existe — a citação, o encaminhar, a busca local, o apagar, a prévia da lista —
 * sem uma linha de código nova em nenhum desses lugares. Uma coluna
 * `figurinha_id` exigiria tocar em seis leituras e num CHECK.
 *
 * ⚠️ E o marcador é feio de propósito: ninguém digita `:dc-fig:` por acaso, e um
 * texto que casasse com ele por acidente viraria uma figurinha inesperada.
 */
const MARCADOR = /^:dc-fig:([a-z]+):$/;

export function textoDaFigurinha(id: string): string {
  return `:dc-fig:${id}:`;
}

/**
 * Devolve a figurinha quando o texto É uma (e só uma), ou `null`.
 *
 * ⚠️ **A mensagem tem de ser SÓ o marcador.** Aceitar `"oi :dc-fig:abraco:"`
 * faria a tela ter de decidir como desenhar texto e figurinha juntos — e o
 * formato existe para ser um gesto, não um enfeite de frase.
 */
export function figurinhaDoTexto(texto: string | null | undefined): Figurinha | null {
  const m = MARCADOR.exec((texto ?? "").trim());
  if (!m) return null;
  return FIGURINHAS_POR_ID.get(m[1]) ?? null;
}

/**
 * O que a LISTA de conversas mostra na prévia.
 *
 * ⚠️ **Nunca o marcador cru.** Sem isto, a lista mostraria `:dc-fig:abraco:` —
 * e a paciente veria um código onde deveria ver o que a amiga mandou.
 */
export function previaDaFigurinha(texto: string | null | undefined): string | null {
  const f = figurinhaDoTexto(texto);
  return f ? `${f.arte} ${f.rotulo}` : null;
}
