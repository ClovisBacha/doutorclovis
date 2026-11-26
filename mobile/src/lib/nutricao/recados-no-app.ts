import { AMOSTRA_SEMANAL, LIMITE_DIARIO, type MotivoDoBloqueio } from "@/lib/nutricao-premium";

/**
 * Os recados da porta da nutricionista NO APP. O app da v1 não vende nada
 * (sem compra dentro do app, sem preço), então não pode falar em "Premium"
 * nem em pergunta "grátis" — o que soaria como uma loja que não existe, e é
 * motivo de recusa na revisão da Apple. As regras e os números são os do site
 * (`@/lib/nutricao-premium`); só as palavras mudam.
 */
export function recadoDoBloqueioNoApp(motivo: MotivoDoBloqueio): {
  titulo: string;
  texto: string;
} {
  if (motivo === "teto_diario") {
    return {
      titulo: "Por hoje é isto 💛",
      texto:
        `A nutricionista responde até ${LIMITE_DIARIO} perguntas por dia. ` +
        "Amanhã ela recomeça — e o que você já perguntou continua aqui.",
    };
  }
  return {
    titulo: "As perguntas desta semana acabaram",
    texto:
      `A nutricionista responde ${AMOSTRA_SEMANAL} perguntas por semana, e elas voltam na ` +
      "semana que vem. O que você já perguntou continua aqui.",
  };
}

export function recadoDaAmostraNoApp(restantes: number | null): string | null {
  if (restantes === null) return null;
  if (restantes <= 0) return "Essa foi a última pergunta desta semana.";
  if (restantes === 1) return "Resta 1 pergunta nesta semana.";
  return `Restam ${restantes} perguntas nesta semana.`;
}
