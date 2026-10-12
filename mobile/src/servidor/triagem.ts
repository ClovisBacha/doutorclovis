import { funcaoDoServidor } from "~/servidor/ponte";

/** src/lib/triage.functions.ts — a régua é a de src/lib/triage.ts; a IA só reescreve a mensagem. */
export type NivelDeRisco = "verde" | "amarelo" | "vermelho";

export const avaliarSintomas = funcaoDoServidor<
  {
    symptoms: string[];
    systolic?: number | null;
    diastolic?: number | null;
    note?: string;
    weeks?: number | null;
  },
  { level: NivelDeRisco; reasons: string[]; message: string }
>("src/lib/triage.functions.ts", "assessSymptoms");

export const guardarTriagem = funcaoDoServidor<
  {
    level: NivelDeRisco;
    symptoms: string[];
    systolic?: number | null;
    diastolic?: number | null;
    note?: string | null;
  },
  { ok: boolean }
>("src/lib/triage.functions.ts", "saveTriageLog");
