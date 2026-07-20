import type { BrainBlockLabels } from "./core";

/**
 * Rótulos padrão (genéricos, agnósticos de domínio). Cada app cliente/tenant
 * pode ter os seus — hoje é um default único; num roadmap, vira config por
 * tenant (a coluna/labels ficam no banco). Trocar isto = trocar o domínio.
 */
export const DEFAULT_LABELS: BrainBlockLabels = {
  header: "## Segundo Cérebro do profissional",
  roleInstruction:
    "Responda COMO o próprio profissional responderia, seguindo o estilo, as frases e as respostas registradas abaixo.",
  styleLabel: "### Estilo",
  phrasesLabel: "### Frases típicas",
  rulesLabel: "### Regras",
  referenceLabel:
    "### Respostas reais do profissional (use como referência de tom e conteúdo; NUNCA invente o que não está aqui; caso não esteja coberto, seja honesto sobre não saber)",
};
