import { supabase } from "~/servidor/supabase";

/**
 * A coluna que o PostgREST diz não existir ("Could not find the 'x' column of
 * 'patient_profiles' in the schema cache", PGRST204). Os APLICAR_*.sql chegam
 * DEPOIS do código: o app tira a coluna e grava o resto, em vez de perder tudo.
 */
export function colunaQueFalta(erro: { code?: string; message?: string } | null): string | null {
  if (!erro?.message) return null;
  const m =
    /Could not find the '([^']+)' column/i.exec(erro.message) ??
    /column "?([a-z_]+)"? .*does not exist/i.exec(erro.message);
  return m ? m[1] : null;
}

export type ResultadoDaGravacao = { ok: true; ignoradas: string[] } | { ok: false };

/** UPSERT da linha da paciente, com o degrau de recuo por coluna ausente. */
export async function gravarPerfil(
  uid: string,
  campos: Record<string, unknown>,
): Promise<ResultadoDaGravacao> {
  const payload: Record<string, unknown> = {
    ...campos,
    id: uid,
    updated_at: new Date().toISOString(),
  };
  const ignoradas: string[] = [];
  for (let tentativa = 0; tentativa < 6; tentativa++) {
    const { error } = await supabase.from("patient_profiles").upsert(payload);
    if (!error) return { ok: true, ignoradas };
    const coluna = colunaQueFalta(error);
    if (!coluna || !(coluna in payload) || coluna === "id") return { ok: false };
    delete payload[coluna];
    ignoradas.push(coluna);
  }
  return { ok: false };
}
