/**
 * O BILHETE que leva um momento até o compositor da Comunidade.
 *
 * Mesmo desenho de `aula-compartilhavel.ts`, e pela mesma razão: quem SABE do
 * momento é o Caminho (ou a aba de conquistas, ou a folha de gratidão), e o
 * compositor vive noutra aba. O Caminho deixa um bilhete; a Comunidade o lê.
 *
 * ⚠️ **O BILHETE GUARDA O MOMENTO, NUNCA A IMAGEM.** Um cartão em JPEG vira
 * algumas centenas de KB em base64, e o `localStorage` tem ~5 MB — o que quebra
 * quando a cota estoura não é este bilhete, é a PRÓXIMA gravação de qualquer
 * coisa, inclusive o `journey_state`, que carrega a jornada inteira dela. É a
 * mesma decisão do rascunho do post, que também recusa as fotos.
 *
 * O desenho é determinístico: o compositor redesenha o cartão a partir do
 * momento, em milissegundos, sem servidor.
 */
import type { Momento } from "@/lib/momento";

/** Prefixo `dc-`, como o resto do armazém local. */
export const CHAVE_DO_MOMENTO = "dc-momento-para-publicar";

type Bilhete = { momento: Momento; quando: number };

/**
 * Quanto tempo o bilhete vale.
 *
 * ⚠️ Trinta minutos, e não as doze horas do bilhete da aula. A diferença é o
 * gesto: a aula é um ANEXO que ela pode querer horas depois ("hoje eu fiz a
 * aula"); o cartão nasce de um toque em "Compartilhar" e o compositor abre no
 * segundo seguinte. Um bilhete de horas faria o cartão de ontem aparecer sobre
 * a foto que ela está publicando hoje.
 */
export const VALIDADE_MINUTOS = 30;

export function guardarMomentoParaPublicar(m: Momento, agora: number = Date.now()): void {
  try {
    const b: Bilhete = { momento: m, quando: agora };
    localStorage.setItem(CHAVE_DO_MOMENTO, JSON.stringify(b));
  } catch {
    /* Modo privado, cota estourada: o compositor abre vazio, e ela escreve. */
  }
}

/** Apaga o bilhete. Chamado depois de o compositor consumi-lo. */
export function esquecerMomento(): void {
  try {
    localStorage.removeItem(CHAVE_DO_MOMENTO);
  } catch {
    /* idem */
  }
}

/**
 * O momento que o compositor deve oferecer — ou `null`, que é o normal.
 *
 * ⚠️ **Formato estranho vira `null`, nunca exceção.** Este valor pode ter sido
 * escrito por uma versão anterior; derrubar a Comunidade por causa de um JSON
 * torto seria trocar um conforto por um defeito. Mesma decisão de `lerRascunho`.
 */
export function lerMomentoParaPublicar(agora: number = Date.now()): Momento | null {
  try {
    const cru = localStorage.getItem(CHAVE_DO_MOMENTO);
    if (!cru) return null;
    const b = JSON.parse(cru) as Partial<Bilhete>;
    const m = b?.momento;
    if (!m || typeof m !== "object") return null;
    if (typeof m.titulo !== "string" || typeof m.legenda !== "string") return null;
    if (typeof b.quando !== "number") return null;
    if (agora - b.quando > VALIDADE_MINUTOS * 60_000) return null;
    /* Relógio que andou para trás não vale bilhete do futuro. */
    if (b.quando > agora + 60_000) return null;
    return m as Momento;
  } catch {
    return null;
  }
}
