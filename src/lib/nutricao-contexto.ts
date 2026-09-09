/**
 * DE LINHAS DO BANCO A `PerfilNutricional` — a parte PURA do adaptador.
 *
 * `nutricao-contexto.server.ts` lê o banco; esta função decide o que as linhas
 * significam. Ela existe separada por UMA razão: **poder ser executada num
 * teste com a paciente que a produção tem e a máquina de desenvolvimento não**
 * — a que pariu há vinte dias com a DUM ainda no perfil.
 *
 * ⚠️ **`birth_date` MANDA NA GESTAÇÃO.** `computeGestation` conta para sempre:
 * com a DUM a 300 dias e o bebê no colo, o prompt dizia "Está na semana 42 da
 * gestação (3º trimestre)" — medido em set/2026. O resto do app já sabia
 * (`faseDe`, `ehPosParto`, `mesesEntre`); a nutricionista era o único módulo
 * que ignorava a coluna. Com a data preenchida, a gestação é `null` e o bloco
 * fala do puerpério.
 *
 * ⚠️ **E O MODO CUIDADO VENCE O PÓS-PARTO.** `care_mode` não limpa
 * `birth_date` (natimorto, óbito neonatal): nesse caso `posParto` tem de sair
 * `false`, senão o bloco diria "ela já teve o bebê … se estiver amamentando"
 * para quem acabou de perdê-lo. A precedência é a mesma de `blocoDaPaciente`.
 */
import { computeGestation, trimesterForWeek } from "./gestacao";
import { sinalGlicemia, sinalPressao } from "./sinais-clinicos";
import { imcPreGestacional } from "./curva-de-ganho";
import { diasEntre } from "./filhos";
import { MOOD_LABEL } from "./humor-e-saudacao";
import { ALL_SYMPTOMS } from "./triage";
import type { PerfilNutricional } from "./nutricao-perfil";

export type LinhaDoPerfil = {
  allergies?: string | null;
  medications?: string | null;
  height_cm?: number | null;
  pre_pregnancy_weight_kg?: number | null;
  prior_gestational_diabetes?: boolean | null;
  lmp_date?: string | null;
  reference_date?: string | null;
  reference_weeks?: number | null;
  reference_days?: number | null;
  /** Ausente num banco sem a coluna — o degrau do servidor a tira do select. */
  birth_date?: string | null;
  /** Idem: `APLICAR_MEMORIA_DA_NUTRICAO.sql`. */
  food_preferences?: string | null;
};

export type LinhaDeSaude = {
  log_date: string;
  weight_kg: number | null;
  glucose_mg_dl: number | null;
  systolic?: number | null;
  diastolic?: number | null;
};

/** Uma linha do diário — SÓ o emoji do humor; `content` nunca é pedido ao banco. */
export type LinhaDoDiario = { entry_date: string; mood: string | null };
/** Uma linha da triagem — nível e ids de catálogo; `note` nunca é pedido ao banco. */
export type LinhaDaTriagem = { created_at: string; level: string; symptoms: string[] | null };

/* ─── COMO ELA VEM PASSANDO ─────────────────────────────────────────────
   ⚠️ NADA que ela ESCREVEU entra: o emoji vira o rótulo de `MOOD_LABEL` e o
   id do sintoma vira o rótulo de `ALL_SYMPTOMS`; o que não está no catálogo
   é DESCARTADO. É a mesma allowlist de `textoDaPaciente` no chat clínico,
   pela mesma razão — um campo livre da paciente já carregou uma instrução de
   prompt uma vez. */
export const JANELA_HUMOR_DIAS = 7;
export const JANELA_TRIAGEM_DIAS = 14;
export const JANELA_ALERTA_DIAS = 7;
export const HUMORES_MAX = 4;
/** Os sintomas da triagem que mudam o PRATO. Os vermelhos ficam de fora um a
    um: eles viram só o aviso de alerta — sangramento não é assunto de cardápio. */
export const SINTOMAS_QUE_MUDAM_O_PRATO: readonly string[] = [
  "vomito",
  "tontura",
  "inchaco_pes",
  "ardor_urinar",
];

export function humoresDe(
  linhas: LinhaDoDiario[] | null | undefined,
  agora: Date,
): { rotulo: string; vezes: number }[] {
  if (!linhas?.length) return [];
  const desde = ymdDe(new Date(agora.getTime() - JANELA_HUMOR_DIAS * 86400000));
  const conta = new Map<string, number>();
  for (const l of linhas) {
    if (typeof l.entry_date !== "string" || l.entry_date < desde) continue;
    const rotulo = typeof l.mood === "string" ? MOOD_LABEL[l.mood] : undefined;
    if (!rotulo) continue; /* fora do catálogo: descarta, nunca passa o cru */
    conta.set(rotulo, (conta.get(rotulo) ?? 0) + 1);
  }
  return [...conta.entries()]
    .map(([rotulo, vezes]) => ({ rotulo, vezes }))
    .sort((x, y) => y.vezes - x.vezes)
    .slice(0, HUMORES_MAX);
}

export function triagemDe(
  linhas: LinhaDaTriagem[] | null | undefined,
  agora: Date,
): { sintomas: { rotulo: string; quando: string }[]; alerta: boolean } {
  if (!linhas?.length) return { sintomas: [], alerta: false };
  const desdeSintomas = agora.getTime() - JANELA_TRIAGEM_DIAS * 86400000;
  const desdeAlerta = agora.getTime() - JANELA_ALERTA_DIAS * 86400000;
  const rotuloDe = new Map(ALL_SYMPTOMS.map((s) => [s.id, s.label]));
  const vistos = new Map<string, string>();
  let alerta = false;
  const ordenadas = [...linhas].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  for (const l of ordenadas) {
    const t = new Date(l.created_at).getTime();
    if (!Number.isFinite(t) || t > agora.getTime() + 60000) continue;
    if (l.level === "vermelho" && t >= desdeAlerta) alerta = true;
    if (t < desdeSintomas) continue;
    for (const id of l.symptoms ?? []) {
      if (typeof id !== "string" || !SINTOMAS_QUE_MUDAM_O_PRATO.includes(id)) continue;
      const rotulo = rotuloDe.get(id);
      if (!rotulo || vistos.has(rotulo)) continue; /* fica a ocorrência mais recente */
      vistos.set(rotulo, new Date(t).toLocaleDateString("pt-BR"));
    }
  }
  return {
    sintomas: [...vistos.entries()].map(([rotulo, quando]) => ({ rotulo, quando })),
    alerta,
  };
}

/**
 * O que a TELA manda junto do pedido: água e suplementos vivem só no
 * `localStorage` dela, e o servidor não tem outro jeito de saber.
 *
 * ⚠️ É ENTRADA DO CLIENTE, e passa por aqui antes de virar prompt: número
 * fora do plausível vira nada, string longa é cortada, lista longa é cortada.
 * Um corpo montado à mão não pode injetar um parágrafo no prompt por este
 * campo.
 */
export type DoAparelho = {
  agua?: { copos: number; meta: number } | null;
  tomados?: string[] | null;
};
export const AGUA_MAX = 30;
export const TOMADOS_MAX = 12;
export const TOMADO_CHARS_MAX = 40;
export function doAparelhoDe(bruto: unknown): DoAparelho {
  const o = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  const inteiro = (v: unknown, max: number) =>
    typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max ? v : null;
  const copos = inteiro(o.agua, AGUA_MAX);
  const meta = inteiro(o.meta, AGUA_MAX);
  const tomados = Array.isArray(o.tomados)
    ? o.tomados
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.replace(/\s+/g, " ").trim().slice(0, TOMADO_CHARS_MAX))
        .filter(Boolean)
        .slice(0, TOMADOS_MAX)
    : null;
  return {
    agua: copos != null && meta != null && meta > 0 ? { copos, meta } : null,
    tomados,
  };
}

/** `YYYY-MM-DD` do instante, no relógio LOCAL do servidor — o mesmo que `computeGestation` usa. */
function ymdDe(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function perfilNutricionalDe(args: {
  perfil: LinhaDoPerfil;
  logs: LinhaDeSaude[];
  careMode: boolean;
  agora: Date;
  doAparelho?: DoAparelho;
  /** O humor do diário (só o emoji) e a triagem (só nível e ids) — ver acima. */
  diario?: LinhaDoDiario[] | null;
  triagens?: LinhaDaTriagem[] | null;
}): PerfilNutricional {
  const { perfil, logs, careMode, agora, doAparelho, diario, triagens } = args;
  const humores = humoresDe(diario, agora);
  const triagem = triagemDe(triagens, agora);

  const nascimento =
    typeof perfil.birth_date === "string" && perfil.birth_date ? perfil.birth_date : null;
  const posParto = !careMode && nascimento != null;
  const diasDoBebe = posParto ? diasEntre(nascimento, ymdDe(agora)) : null;

  /* Nem no luto nem depois do parto há gestação em curso. */
  const gest =
    careMode || posParto
      ? null
      : computeGestation({
          lmp: perfil.lmp_date ?? null,
          referenceDate: perfil.reference_date ?? null,
          referenceWeeks: perfil.reference_weeks ?? null,
          referenceDays: perfil.reference_days ?? null,
          today: agora,
        });

  /* Peso: o mais recente da janela, contra o peso pré-gestacional. */
  const pesoAtual = logs.find((l) => l.weight_kg != null)?.weight_kg ?? null;
  const prePreg = perfil.pre_pregnancy_weight_kg ?? null;
  const altura = perfil.height_cm ?? null;
  const imc = prePreg != null && altura != null ? imcPreGestacional(prePreg, altura) : null;
  const ganhoKg = pesoAtual != null && prePreg != null ? pesoAtual - prePreg : null;

  /* Glicemia: a última, e quantas fora do alvo na janela. */
  const comGlicemia = logs.filter((l) => l.glucose_mg_dl != null);
  const ultima = comGlicemia[0] ?? null;
  const sinalDaUltima = ultima ? sinalGlicemia(ultima.glucose_mg_dl) : null;
  const alteradas = comGlicemia.filter((l) => {
    const s = sinalGlicemia(l.glucose_mg_dl);
    return s != null && s.gravidade !== "normal";
  }).length;

  /* Pressão: a última com os DOIS números, e quantas fora da faixa. A régua é
     a de `sinais-clinicos` — ela já trata o par implausível e o invertido. */
  const comPressao = logs.filter((l) => l.systolic != null && l.diastolic != null);
  const ultimaPA = comPressao[0] ?? null;
  const sinalPA = ultimaPA ? sinalPressao(ultimaPA.systolic, ultimaPA.diastolic) : null;
  const pressoesAlteradas = comPressao.filter((l) => {
    const s = sinalPressao(l.systolic, l.diastolic);
    return s != null && s.gravidade !== "normal";
  }).length;

  return {
    careMode,
    alergias: perfil.allergies ?? null,
    medicacoes: perfil.medications ?? null,
    preferencias: perfil.food_preferences ?? null,
    semanas: gest?.weeks ?? null,
    trimestre: gest ? trimesterForWeek(gest.weeks) : null,
    posParto,
    diasDoBebe: diasDoBebe != null && diasDoBebe >= 0 ? diasDoBebe : null,
    imc,
    ganhoKg,
    glicemia:
      ultima && sinalDaUltima
        ? {
            valor: ultima.glucose_mg_dl as number,
            alterada: sinalDaUltima.gravidade !== "normal",
            quando: new Date(`${ultima.log_date}T12:00:00`).toLocaleDateString("pt-BR"),
          }
        : null,
    dmgAnterior: Boolean(perfil.prior_gestational_diabetes),
    glicemiasAlteradas: alteradas,
    pressao:
      ultimaPA && sinalPA
        ? {
            sistolica: ultimaPA.systolic as number,
            diastolica: ultimaPA.diastolic as number,
            alterada: sinalPA.gravidade !== "normal",
            nota: sinalPA.nota,
            quando: new Date(`${ultimaPA.log_date}T12:00:00`).toLocaleDateString("pt-BR"),
          }
        : null,
    pressoesAlteradas,
    agua: doAparelho?.agua ?? null,
    tomados: doAparelho?.tomados ?? null,
    hora: agora.getHours(),
    humores: humores.length ? humores : null,
    sintomas: triagem.sintomas.length ? triagem.sintomas : null,
    triagemDeAlerta: triagem.alerta,
  };
}
