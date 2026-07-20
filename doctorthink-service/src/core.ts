/**
 * DoctorThink — núcleo PORTÁVEL do "cérebro" de um profissional.
 *
 * Este módulo é o IP reutilizável: seleção de conhecimento por relevância e
 * montagem do bloco de contexto que vai no prompt do LLM. NÃO importa nada
 * específico da Obstétrica (nem Supabase, nem entitlements, nem domínio
 * médico) — tudo que é específico entra como parâmetro/config. É a "costura"
 * que, no futuro, o DoctorThink expõe como produto para outros apps.
 *
 * Segurança preservada do original: a mensagem do usuário serve SÓ para
 * pontuar relevância; nunca é interpolada no bloco (anti prompt-injection).
 */

export type BrainEntry = { question: string; answer: string };

/** Estilo/tom do profissional (o "jeito de responder"). */
export type BrainPersona = {
  persona: string;
  samplePhrases: string;
  rules: string;
};

/**
 * Rótulos do bloco de contexto. É AQUI que mora o acoplamento de domínio:
 * a Obstétrica usa termos médicos/obstétricos; outro app (cardiologia,
 * jurídico, etc.) passa os seus. Trocar isto = trocar o domínio sem tocar
 * na lógica.
 */
export type BrainBlockLabels = {
  header: string;
  roleInstruction: string;
  styleLabel: string;
  phrasesLabel: string;
  rulesLabel: string;
  /** Instrução de segurança/uso das respostas reais (específica do domínio). */
  referenceLabel: string;
};

/** Normaliza texto para comparação: minúsculas e sem acentos. */
export function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Palavras significativas (>3 letras) da mensagem, normalizadas e únicas. */
export function significantWords(message: string): string[] {
  return [
    ...new Set(
      normalizeText(message)
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 3),
    ),
  ];
}

/** Normaliza a pergunta para deduplicar lacunas ("Posso tomar café?" ≈ "posso tomar cafe"). */
export function normalizeGapQuestion(q: string): string {
  return q
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

/**
 * Ranking clássico por palavras (fallback quando não há busca semântica):
 * pontua cada entry pelas palavras da mensagem presentes em pergunta+resposta
 * e devolve as `maxScored` melhores com score > 0. Sort estável: empates
 * mantêm as primeiras da lista (por convenção, as mais recentes).
 */
export function rankEntriesByKeywords(
  userMessage: string,
  entries: BrainEntry[],
  maxScored: number,
): BrainEntry[] {
  const words = significantWords(userMessage);
  return entries
    .map((entry) => {
      const haystack = normalizeText(`${entry.question} ${entry.answer}`);
      let score = 0;
      for (const w of words) if (haystack.includes(w)) score += 1;
      return { entry, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxScored)
    .map((s) => s.entry);
}

/**
 * Monta o bloco de contexto para o prompt a partir da persona + entries
 * selecionadas + rótulos de domínio. Retorna "" quando não há nada a injetar.
 * O formato é idêntico ao original (P:/R: por entry).
 */
export function assembleBrainBlock(
  persona: BrainPersona,
  selected: BrainEntry[],
  labels: BrainBlockLabels,
): string {
  const p = persona.persona.trim();
  const phrases = persona.samplePhrases.trim();
  const rules = persona.rules.trim();
  if (!p && !phrases && !rules && selected.length === 0) return "";

  const parts: string[] = [labels.header, labels.roleInstruction];
  if (p) parts.push(labels.styleLabel, p);
  if (phrases) parts.push(labels.phrasesLabel, phrases);
  if (rules) parts.push(labels.rulesLabel, rules);
  if (selected.length > 0) {
    parts.push(labels.referenceLabel, ...selected.map((e) => `P: ${e.question}\nR: ${e.answer}`));
  }
  return parts.join("\n") + "\n";
}
