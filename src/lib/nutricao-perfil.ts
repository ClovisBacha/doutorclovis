/**
 * O QUE A NUTRICIONISTA SABE DA PACIENTE.
 *
 * ⚠️ **ANTES DISTO ELA NÃO SABIA NADA.** `/api/nutrition` mandava um prompt
 * genérico: sem alergias, sem medicações, sem trimestre, sem glicemia, sem
 * peso — e as três primeiras já estavam preenchidas no perfil desde a primeira
 * migration. Uma nutricionista que não sabe da alergia pode sugerir camarão
 * para quem é alérgica a frutos do mar. É o defeito que faz a palavra
 * "personalizada" ser falsa, e ele vinha antes de qualquer recurso novo.
 *
 * ⚠️ **CONTEXTO, NUNCA CONDUTA** — a mesma régua de `buildMedidasBlock` no
 * chat principal. O bloco entrega FATOS que a paciente registrou e a faixa de
 * referência que o app já desenha; quem decide alvo, dose e dieta é o médico
 * dela, e o prompt continua proibindo prescrição.
 *
 * ⚠️ **EM MODO CUIDADO SÓ SOBREVIVE O QUE É DO CORPO DELA.** Alergia e
 * medicação ficam — são segurança, e valem mais depois de uma perda, não
 * menos. Semana, trimestre, faixa de ganho e o bebê somem: o prompt de luto
 * proíbe em maiúsculas falar da gestação, e um bloco de contexto dizendo
 * "26 semanas" seria a porta dos fundos desse portão.
 */
import { faixaDoImc, iomGain, posicaoNaFaixa, type PosicaoNaFaixa } from "./curva-de-ganho";

export type PerfilNutricional = {
  careMode: boolean;
  /** Texto livre do perfil — o que ELA escreveu, sem reescrever. */
  alergias?: string | null;
  medicacoes?: string | null;
  semanas?: number | null;
  trimestre?: 1 | 2 | 3 | null;
  /**
   * ⚠️ ELA JÁ TEVE O BEBÊ. `birth_date` preenchida no perfil. Quando é
   * verdadeiro, `semanas`/`trimestre`/ganho NÃO entram — `computeGestation`
   * conta para sempre, e uma mulher a 20 dias do parto apareceria como
   * "semana 42 da gestação (3º trimestre)". Foi exatamente o que o prompt
   * dizia até set/2026 (medido com DUM −300 dias).
   */
  posParto?: boolean;
  /** Dias de vida do bebê; `null` quando a data não é legível. */
  diasDoBebe?: number | null;
  imc?: number | null;
  ganhoKg?: number | null;
  /** Última glicemia dela, e se estava alterada (régua de `sinais-clinicos`). */
  glicemia?: { valor: number; alterada: boolean; quando: string } | null;
  /** História de diabetes gestacional numa gestação anterior. */
  dmgAnterior?: boolean;
  /** Quantas glicemias alteradas nos últimos 30 dias. */
  glicemiasAlteradas?: number;
  /** 0–23, o relógio DELA — decide a sugestão de refeição da vez. */
  hora?: number | null;
};

/* ─── O LANCHE PELA HORA ────────────────────────────────────────────────────
   ⚠️ A régua do período do dia já existe em `frases-do-mascote.ts`, mas ela
   responde outra pergunta ("manhã/tarde/noite/madrugada" para escolher uma
   frase de conforto). Aqui a pergunta é qual REFEIÇÃO vem a seguir, e as
   fronteiras são outras — às 10h o mascote diz "manhã" e a nutricionista
   precisa dizer "lanche da manhã". Duas perguntas, duas réguas. */
export type MomentoDoDia =
  | "café da manhã"
  | "lanche da manhã"
  | "almoço"
  | "lanche da tarde"
  | "jantar"
  | "ceia"
  | "madrugada";

export function momentoDoDia(hora: number): MomentoDoDia {
  if (hora < 5) return "madrugada";
  if (hora < 9) return "café da manhã";
  if (hora < 11) return "lanche da manhã";
  if (hora < 14) return "almoço";
  if (hora < 18) return "lanche da tarde";
  if (hora < 21) return "jantar";
  return "ceia";
}

/** A frase que a tela mostra no convite ("16h — um lanche que segura até o jantar"). */
export function conviteDoMomento(hora: number): string {
  const m = momentoDoDia(hora);
  const convites: Record<MomentoDoDia, string> = {
    "café da manhã": "Que tal montar um café da manhã que segura até o meio da manhã?",
    "lanche da manhã": "Um lanche leve agora ajuda a chegar melhor no almoço.",
    almoço: "Vamos montar um almoço equilibrado?",
    "lanche da tarde": "Um lanche da tarde que segura até o jantar?",
    jantar: "Vamos montar um jantar leve para dormir melhor?",
    ceia: "Uma ceia leve ajuda a atravessar a noite sem acordar com fome.",
    /* ⚠️ De madrugada NÃO se propõe refeição: quem está acordada às 3h numa
       gestação de risco não precisa de mais alguém sugerindo o que comer. */
    madrugada: "Acordou de madrugada? Posso sugerir algo leve, se você quiser.",
  };
  return convites[m];
}

/* ─── O BLOCO QUE VAI PARA O MODELO ─────────────────────────────────────── */

/** Recorta texto livre do perfil: o prompt não é lugar para um romance. */
export const TEXTO_LIVRE_MAX = 240;
export function recortar(t: string | null | undefined): string | null {
  if (!t) return null;
  const s = t.replace(/\s+/g, " ").trim();
  return s ? s.slice(0, TEXTO_LIVRE_MAX) : null;
}

/** "há 3 dias" · "há 5 semanas" · "há 4 meses" — a unidade que ela mesma usaria. */
export function idadeDoBebe(dias: number): string {
  const d = Math.max(0, Math.floor(dias));
  if (d < 14) return d === 1 ? "o bebê nasceu há 1 dia" : `o bebê nasceu há ${d} dias`;
  if (d < 60) return `o bebê tem ${Math.floor(d / 7)} semanas`;
  const m = Math.floor(d / 30);
  return m === 1 ? "o bebê tem 1 mês" : `o bebê tem ${m} meses`;
}

export function blocoDaPaciente(p: PerfilNutricional): string {
  const linhas: string[] = [];

  /* ⚠️ ALERGIA PRIMEIRO, E SEMPRE — inclusive em Modo Cuidado. É o único item
     do bloco cuja ausência pode machucar alguém hoje. */
  const alergias = recortar(p.alergias);
  if (alergias) {
    linhas.push(
      `- ALERGIAS/INTOLERÂNCIAS relatadas por ela: ${alergias}. NUNCA sugira nada que contenha isso, e ofereça substituto quando o alimento aparecer.`,
    );
  }
  const medicacoes = recortar(p.medicacoes);
  if (medicacoes) {
    linhas.push(
      `- Medicações/suplementos em uso: ${medicacoes}. Considere interações com alimentos (ex.: ferro com cálcio ou café), mas NUNCA mude dose nem horário — isso é do médico.`,
    );
  }

  if (!p.careMode && p.posParto) {
    /* ⚠️ O PÓS-PARTO SUBSTITUI A SEMANA, e não se soma a ela. A semana
       gestacional, o trimestre e a faixa de ganho da IOM são de uma gestação
       EM CURSO; para quem já pariu, os três são falsos. O que entra no lugar
       é o fato e a idade do bebê — e a amamentação vai como HIPÓTESE ("se
       estiver amamentando"), nunca como afirmação: o app não sabe se ela
       amamenta, e afirmar isso a quem não conseguiu é a pior frase possível. */
    linhas.push(
      `- ELA JÁ TEVE O BEBÊ: está no pós-parto${
        p.diasDoBebe != null ? `, ${idadeDoBebe(p.diasDoBebe)}` : ""
      }. Responda para o PUERPÉRIO (recuperação do corpo dela, sono quebrado, refeições rápidas de uma mão só) e, SE ela estiver amamentando, para a amamentação — pergunte antes de assumir. NUNCA fale como se ela ainda estivesse grávida, e nunca cite semana gestacional ou trimestre.`,
    );
  } else if (!p.careMode) {
    if (p.semanas != null && p.trimestre) {
      linhas.push(`- Está na semana ${p.semanas} da gestação (${p.trimestre}º trimestre).`);
    }
    if (p.imc != null && p.semanas != null && p.ganhoKg != null) {
      const faixa = iomGain(p.semanas, p.imc);
      const onde = posicaoNaFaixa(p.ganhoKg, p.semanas, p.imc);
      const comoEsta: Record<PosicaoNaFaixa, string> = {
        abaixo: "abaixo da faixa de referência",
        dentro: "dentro da faixa de referência",
        acima: "acima da faixa de referência",
      };
      linhas.push(
        `- Ganho de peso até aqui: ${p.ganhoKg.toFixed(1)} kg — ${comoEsta[onde]} para esta semana (${faixa.min.toFixed(1)}–${faixa.max.toFixed(1)} kg), partindo de ${faixaDoImc(p.imc)} antes da gestação.`,
      );
      /* ⚠️ A instrução de TOM vem colada no número, e não solta no prompt: sem
         ela o modelo transforma "acima da faixa" em plano de restrição, que é
         a coisa mais perigosa que se pode dizer a uma gestante de alto risco. */
      linhas.push(
        `- Use o ganho apenas como contexto. NUNCA proponha restrição calórica, déficit, dieta de emagrecimento ou meta de peso: quem define o alvo dela é o médico.`,
      );
    }
  }

  /* ─── O QUE FAZ DELA UMA NUTRICIONISTA DE ALTO RISCO ───────────────────
     ⚠️ Não existe interruptor de "modo diabetes": ele seria mais um campo
     que ninguém preenche. O que existe é o que ela JÁ registrou — glicemias
     alteradas — e o que o perfil já sabe — DMG numa gestação anterior. Os
     dois juntos mudam a orientação de carboidrato, e é isso que uma
     nutricionista faria. A conduta continua sendo do médico. */
  if (p.glicemia) {
    linhas.push(
      `- Última glicemia registrada por ela: ${p.glicemia.valor} mg/dL em ${p.glicemia.quando}${
        p.glicemia.alterada ? " — FORA do alvo" : " (dentro do alvo)"
      }.`,
    );
  }
  const atencaoGlicemia = (p.glicemiasAlteradas ?? 0) >= 2 || p.dmgAnterior === true;
  if (atencaoGlicemia && !p.careMode) {
    const porque = [
      p.dmgAnterior ? "teve diabetes gestacional numa gestação anterior" : null,
      (p.glicemiasAlteradas ?? 0) >= 2
        ? `registrou ${p.glicemiasAlteradas} glicemias fora do alvo nos últimos 30 dias`
        : null,
    ]
      .filter(Boolean)
      .join(" e ");
    linhas.push(
      `- ATENÇÃO GLICÊMICA: ela ${porque}. Priorize orientação sobre TIPO e DISTRIBUIÇÃO de carboidrato (integral em vez de refinado, fracionar em 5–6 refeições, combinar carboidrato com proteína ou fibra), e evite sugerir doces, sucos e massas refinadas sem essa combinação. NUNCA diga que ela tem diabetes gestacional nem faça diagnóstico: quem diz isso é o médico.`,
    );
  }

  if (!linhas.length) return "";
  return `\n\nO QUE VOCÊ SABE DESTA PACIENTE (dados que ela registrou no app):\n${linhas.join("\n")}\nUse isto como CONTEXTO para responder de forma pessoal. Não recite estes dados de volta para ela sem que ela pergunte, e nunca os trate como diagnóstico.`;
}
