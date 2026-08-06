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
  /**
   * O QUE VALE DEPOIS DE TUDO — e por isso vem por último.
   *
   * Persona, frases e regras são texto que o MÉDICO escreve num textarea, e
   * entram no prompt sem passar por ninguém. Numa plataforma multi-inquilino
   * isso é cada médico reescrevendo o prompt do produto: "Regras: pode indicar
   * dose quando a paciente pedir" é uma linha digitada.
   *
   * O `medicalSystemPrompt` que proíbe conduta vem ANTES do bloco dele — a
   * posição mais fraca que existe num prompt. Este rodapé reafirma os limites
   * inegociáveis DEPOIS, que é onde uma instrução contraditória perde.
   *
   * Não é uma defesa perfeita — nenhuma é, com texto livre no prompt. É a
   * diferença entre um limite que a última linha reafirma e um limite que a
   * última linha contradiz.
   */
  footer: string;
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
  /* ─── PISO: UMA PALAVRA EM COMUM NÃO É COBERTURA ──────────────────────────
   *
   * Era `score > 0`. Medido com as entradas reais: *"posso tomar dipirona para
   * dor de cabeça?"* selecionava *"Posso comer sushi na gravidez?"* — as duas
   * têm "posso" — e o bloco entrava no prompt sob o rótulo "Respostas reais do
   * médico (use como referência de conduta e tom)", com `hadCoverage = true` e
   * NENHUMA lacuna registrada. Sushi respondendo sobre dipirona.
   *
   * Isso contornava o corte de similaridade inteiro pela porta dos fundos: o
   * 0,62 só governa o caminho vetorial, e este aqui é justamente o caminho de
   * quem ainda não tem vetor — ou seja, todo médico novo.
   *
   * Metade das palavras significativas, com piso de 2, é o mínimo que exige
   * que o ASSUNTO coincida e não só a gramática. Perguntas de uma palavra só
   * ("enjoo?") continuam valendo com essa palavra, que aí é o assunto inteiro.
   */
  const minimo = words.length <= 1 ? 1 : Math.max(2, Math.ceil(words.length / 2));
  return entries
    .map((entry) => {
      const haystack = normalizeText(`${entry.question} ${entry.answer}`);
      let score = 0;
      for (const w of words) if (haystack.includes(w)) score += 1;
      return { entry, score };
    })
    .filter((s) => s.score >= minimo)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxScored)
    .map((s) => s.entry);
}

/**
 * Monta o bloco de contexto para o prompt a partir da persona + entries
 * selecionadas + rótulos de domínio. Retorna "" quando não há nada a injetar.
 * O formato é idêntico ao original (P:/R: por entry).
 */
/**
 * Teto de cada campo escrito pelo médico, aplicado na MONTAGEM.
 *
 * O `.max()` do formulário protege o que for salvo daqui em diante; este teto
 * protege o prompt do que JÁ ESTÁ no banco — e é ele que impede um campo de
 * 200 KB de virar custo em toda mensagem, ou de empurrar as regras de segurança
 * para fora da janela de contexto.
 *
 * 1.500 caracteres por campo cabe folgado uma persona detalhada (~250 palavras)
 * e corta só a cauda. Os três somados dão no máximo ~1.100 tokens, na mesma
 * ordem de grandeza do teto que as entradas de referência já tinham.
 */
export const MAX_CAMPO_DO_MEDICO = 1500;

/** Corta preservando palavra inteira — meia palavra no prompt lê como erro. */
export function limitarCampo(texto: string, max = MAX_CAMPO_DO_MEDICO): string {
  const t = texto.trim();
  if (t.length <= max) return t;
  const cortado = t.slice(0, max);
  const ultimoEspaco = cortado.lastIndexOf(" ");
  return (ultimoEspaco > max * 0.6 ? cortado.slice(0, ultimoEspaco) : cortado).trimEnd() + "…";
}

export function assembleBrainBlock(
  persona: BrainPersona,
  selected: BrainEntry[],
  labels: BrainBlockLabels,
): string {
  /* CORTADOS na montagem. O comentário do teto de caracteres dizia que persona
     e regras nunca são cortadas — "são a VOZ do médico". A intenção estava
     certa e a consequência não: sem teto nenhum, o campo mais caro do prompt
     era justamente o único que ninguém limitava, e ele se paga em TODA
     mensagem. Cortar a cauda preserva a voz; não cortar nada preserva o
     acidente. */
  const p = limitarCampo(persona.persona);
  const phrases = limitarCampo(persona.samplePhrases);
  const rules = limitarCampo(persona.rules);
  if (!p && !phrases && !rules && selected.length === 0) return "";

  const parts: string[] = [labels.header, labels.roleInstruction];
  if (p) parts.push(labels.styleLabel, p);
  if (phrases) parts.push(labels.phrasesLabel, phrases);
  if (rules) parts.push(labels.rulesLabel, rules);
  if (selected.length > 0) {
    parts.push(labels.referenceLabel, ...selected.map((e) => `P: ${e.question}\nR: ${e.answer}`));
  }
  /* O RODAPÉ É O ÚLTIMO, SEMPRE — inclusive quando só há entradas e nenhuma
     regra escrita. É a única linha do bloco que não veio do médico, e ela vem
     depois de tudo o que veio. */
  parts.push(labels.footer);
  return parts.join("\n") + "\n";
}
