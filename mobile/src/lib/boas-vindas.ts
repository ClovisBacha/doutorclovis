/**
 * O QUE OS SLIDES DE BOAS-VINDAS DIZEM (19/11/2026), num lugar só, para a
 * catraca de conteúdo (`boas-vindas.test.ts`) ler sem abrir a tela.
 *
 * O dono: "eu quero vender esse aplicativo [...] a mãe esperta é também
 * aquela que cuida da saúde [...] ser esperta também é cuidar da saúde". Os
 * slides vendem BEM-ESTAR MATERNO, com a Bolha se apresentando e um slide
 * para cada cuidado de verdade do app: a aula, respirar, mexer o corpo e a
 * trilha com uma amiga.
 *
 * ⚠️ Nada aqui fala do bebê (a entrada não sabe se quem abre está no Modo
 * Cuidado) nem promete efeito ("reduz", "melhora", "faz bem"): o app convida,
 * não prescreve.
 */

/** O que a Bolha diz nos balões dos slides. */
export const FALA_NA_ENTRADA = {
  /** O primeiro slide: ela se apresenta e diz o que vocês vão fazer juntas. */
  ola: "Oi, eu sou a Bolha! Todo dia eu te chamo para aprender, respirar e mexer o corpo. Coisa de poucos minutos.",
  /** O último slide, para quem vai criar a conta. */
  conta: "Falta pouco! Crie a sua conta e eu te mostro o primeiro cuidado de hoje.",
  /** O último slide, para quem já entrou neste aparelho. */
  voltou: "Oi de novo! Entre e a gente continua de onde parou.",
} as const;

export type SlideDeBoasVindas = { titulo: string; texto?: string };

/** O título e a linha de apoio de cada slide, na ordem. */
export const SLIDES = {
  bolha: { titulo: "Mãe Esperta", texto: "Ser esperta também é cuidar de você." },
  aula: {
    titulo: "Uma aula curta por dia",
    texto: "Perguntas rápidas sobre a semana em que você está. Cada acerto vale sementinhas.",
  },
  pausa: {
    titulo: "Pausa para respirar",
    texto: "Meditações de poucos minutos, e sons de chuva ou de mar para a hora de dormir.",
  },
  mexer: {
    titulo: "O corpo, no seu ritmo",
    texto: "Movimentos leves, de 2 a 10 minutos. Você escolhe o tempo e pula o que quiser.",
  },
  trilha: {
    titulo: "A trilha, em dupla",
    texto: "Cada dia vira um passo. Feche o dia com uma amiga e as duas ganham sementinhas.",
  },
  conta: { titulo: "Crie a sua conta" },
  voltou: { titulo: "Que bom te ver de novo" },
} as const satisfies Record<string, SlideDeBoasVindas>;

/** Todas as frases dos slides (para a catraca). */
export function frasesDasBoasVindas(): string[] {
  return [
    ...Object.values(FALA_NA_ENTRADA),
    ...Object.values(SLIDES).flatMap((s: SlideDeBoasVindas) => [s.titulo, s.texto ?? ""]),
  ].filter(Boolean);
}
