import type { ConquistaDesbloqueada } from "~/servidor/economia";
import {
  abrirCarteiraDoDia,
  conferirConquistas,
  pagarAtividade,
  pagarAulaDoDia,
  pagarCincoEstrelas,
  progressoDoDia,
  resgatarConquista,
  type Atividade,
  type Carteira,
} from "~/servidor/economia";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { estadoDaBancada } from "~/componentes/jornada/bancada";

/**
 * A economia vista pela Jornada: as funções do servidor (src/servidor/economia.ts)
 * com duas coisas a mais —
 *
 *  1. NUNCA lançam: rede caída vira `null` ("não sei"), que a tela mostra
 *     como falha e nunca como sucesso. Resposta `{ok:false}` também é `null`.
 *  2. Na bancada não chamam o servidor: devolvem dados de exemplo pelos
 *     mesmos caminhos (e `&estado=falhou` faz a carteira falhar).
 */

const espera = (ms = 250) => new Promise((r) => setTimeout(r, ms));

export type CarteiraOk = Extract<Carteira, { ok: true }>;

export async function lerCarteiraDoDia(): Promise<CarteiraOk | null> {
  if (ehBancada()) {
    await espera();
    if (estadoDaBancada() === "falhou") return null;
    return {
      ok: true,
      balance: estadoDaBancada() === "fechado" ? 287 : 245,
      trofeus: estadoDaBancada() === "fechado" ? 10 : 9,
      recent: [],
      presente:
        parametroDaBancada("presente") === "1"
          ? { quantidade: 30, quando: "2026-10-01T12:00:00Z", de: "amiga", nome: "Júlia" }
          : null,
    };
  }
  try {
    const r = await abrirCarteiraDoDia();
    return r && r.ok ? r : null;
  } catch {
    return null;
  }
}

/** Quanto o servidor creditou; `null` = não sabemos (falhou). */
export async function pagarAula(day: number, correct: number): Promise<number | null> {
  if (ehBancada()) {
    await espera(600);
    return 5 + 3 * correct;
  }
  try {
    const r = await pagarAulaDoDia({ day, correct });
    return r.ok ? r.granted : null;
  } catch {
    return null;
  }
}

export async function pagarMomento(day: number, activity: Atividade): Promise<number | null> {
  if (ehBancada()) {
    await espera(600);
    return 5;
  }
  try {
    const r = await pagarAtividade({ day, activity });
    return r.ok ? r.granted : null;
  } catch {
    return null;
  }
}

export async function pagarDiaFechado(day: number): Promise<number | null> {
  if (ehBancada()) {
    await espera(300);
    return 20;
  }
  try {
    const r = await pagarCincoEstrelas({ day });
    return r.ok ? r.granted : null;
  } catch {
    return null;
  }
}

export async function lerProgressoDoDia(day: number): Promise<Atividade[] | null> {
  if (ehBancada()) return null;
  try {
    const r = await progressoDoDia({ day });
    return r.ok ? r.done : null;
  } catch {
    return null;
  }
}

export type LeituraDasConquistas = {
  unlocked: ConquistaDesbloqueada[];
  resgatadas: string[] | null;
  careMode: boolean;
};

export async function lerConquistas(): Promise<LeituraDasConquistas | null> {
  if (ehBancada()) {
    await espera();
    const estado = estadoDaBancada();
    if (estado === "falhou") return null;
    const unlocked = [
      ["first_login", "2026-06-02T12:00:00Z"],
      ["profile_complete", "2026-06-03T12:00:00Z"],
      ["first_journal", "2026-07-10T12:00:00Z"],
      ["first_health_log", "2026-07-11T12:00:00Z"],
      ["health_7_days", "2026-08-02T12:00:00Z"],
      ["journal_10", "2026-09-20T12:00:00Z"],
    ].map(([achievement_key, unlocked_at]) => ({ achievement_key, unlocked_at }));
    return {
      unlocked,
      resgatadas: estado === "neutro" ? null : ["first_login", "profile_complete", "first_health_log"],
      careMode: false,
    };
  }
  try {
    const r = await conferirConquistas();
    if (!r.ok) return null;
    return { unlocked: r.unlocked, resgatadas: r.resgatadas, careMode: r.careMode };
  } catch {
    return null;
  }
}

export async function resgatar(
  key: string,
): Promise<{ granted: number; repetido: boolean } | null> {
  if (ehBancada()) {
    await espera(500);
    return { granted: key === "journal_10" ? 40 : 15, repetido: false };
  }
  try {
    const r = await resgatarConquista({ key });
    return r.ok ? { granted: r.granted, repetido: r.repetido } : null;
  } catch {
    return null;
  }
}
