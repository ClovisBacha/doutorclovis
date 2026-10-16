import { funcaoDoServidor } from "~/servidor/ponte";

/**
 * A economia de sementinhas e as conquistas — o MESMO ledger do site
 * (sementinhas_ledger), validado no servidor: o app não credita nada sozinho.
 * Contratos lidos de src/lib/sementinhas.functions.ts e
 * src/lib/achievements.functions.ts.
 */

export type PresenteRecebido = {
  quantidade: number;
  quando: string;
  de: "medico" | "amiga" | "criadora";
  nome: string | null;
};
type Movimento = { amount: number; reason: string; created_at: string };

export type Carteira =
  | {
      ok: true;
      careMode?: boolean;
      balance: number;
      recent: Movimento[];
      presente: PresenteRecebido | null;
      trofeus: number;
    }
  | { ok: false; error: string };

/** Abre a carteira e credita o check-in do dia (5 🌱, uma vez por dia). */
export const abrirCarteiraDoDia = funcaoDoServidor<Record<string, never>, Carteira>(
  "src/lib/sementinhas.functions.ts",
  "claimDailyAndGetWallet",
);

export const lerCarteira = funcaoDoServidor<Record<string, never>, Carteira>(
  "src/lib/sementinhas.functions.ts",
  "getWallet",
);

export type Atividade = "movement" | "meditation" | "bonding" | "gratitude";

/** Paga a aula do dia: 5 + 3 por acerto. Só vale para hoje (±1 dia). */
export const pagarAulaDoDia = funcaoDoServidor<
  { day: number; correct: number },
  { ok: true; granted: number } | { ok: false; error: string }
>("src/lib/sementinhas.functions.ts", "grantDailyQuizReward");

/** Paga uma atividade do dia (5 🌱). `allDone` = as quatro feitas. */
export const pagarAtividade = funcaoDoServidor<
  { day: number; activity: Atividade },
  | { ok: true; granted: number; doneCount?: number; allDone?: boolean }
  | { ok: false; error: string }
>("src/lib/sementinhas.functions.ts", "grantWellnessReward");

/** Bônus das cinco estrelas (20 🌱) — o servidor confere as quatro atividades. */
export const pagarCincoEstrelas = funcaoDoServidor<
  { day: number },
  { ok: boolean; granted: number }
>("src/lib/sementinhas.functions.ts", "grantDayStarsBonus");

/** Quais das quatro atividades do dia o servidor já registrou. */
export const progressoDoDia = funcaoDoServidor<
  { day: number },
  { ok: boolean; done: Atividade[]; allDone: boolean }
>("src/lib/sementinhas.functions.ts", "getWellnessProgress");

export type ConquistaDesbloqueada = { achievement_key: string; unlocked_at: string };

/** Confere e desbloqueia conquistas; NÃO paga — quem paga é o resgate (toque). */
export const conferirConquistas = funcaoDoServidor<
  Record<string, never>,
  | {
      ok: true;
      unlocked: ConquistaDesbloqueada[];
      resgatadas: string[] | null;
      newlyAwarded: string[];
      careMode: boolean;
    }
  | { ok: false; unlocked: []; newlyAwarded: [] }
>("src/lib/achievements.functions.ts", "checkAndAwardAchievements");

export const resgatarConquista = funcaoDoServidor<
  { key: string },
  { ok: true; granted: number; repetido: boolean } | { ok: false; error: string }
>("src/lib/achievements.functions.ts", "resgatarConquista");
