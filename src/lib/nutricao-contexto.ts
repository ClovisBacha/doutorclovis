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
import { sinalGlicemia } from "./sinais-clinicos";
import { imcPreGestacional } from "./curva-de-ganho";
import { diasEntre } from "./filhos";
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
};

export type LinhaDeSaude = {
  log_date: string;
  weight_kg: number | null;
  glucose_mg_dl: number | null;
};

/** `YYYY-MM-DD` do instante, no relógio LOCAL do servidor — o mesmo que `computeGestation` usa. */
function ymdDe(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function perfilNutricionalDe(args: {
  perfil: LinhaDoPerfil;
  logs: LinhaDeSaude[];
  careMode: boolean;
  agora: Date;
}): PerfilNutricional {
  const { perfil, logs, careMode, agora } = args;

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

  return {
    careMode,
    alergias: perfil.allergies ?? null,
    medicacoes: perfil.medications ?? null,
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
    hora: agora.getHours(),
  };
}
