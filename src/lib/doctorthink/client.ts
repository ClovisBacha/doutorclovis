/**
 * DoctorThinkClient — wrapper de fetch para CONSUMIR a API do DoctorThink.
 * Usado pela Obstétrica (Fase 3) para chamar um DoctorThink remoto/standalone,
 * ou por qualquer app cliente. Sem dependência de Supabase — só fetch + chave.
 */
import type { BrainContextResult, BrainChannel } from "./contract";

export type AskBrainInput = { doctorId: string; message: string; channel?: BrainChannel };

/** POST {baseUrl}/api/doctorthink/ask. Retorna o bloco de contexto ou null. */
export async function askBrainRemote(
  baseUrl: string,
  apiKey: string,
  input: AskBrainInput,
  timeoutMs = 4000,
): Promise<BrainContextResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/doctorthink/ask`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        doctorId: input.doctorId,
        message: input.message,
        channel: input.channel ?? "app",
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<BrainContextResult>;
    if (typeof data?.block !== "string") return null;
    return {
      block: data.block,
      hadCoverage: !!data.hadCoverage,
      enabledChannels: data.enabledChannels ?? {},
    };
  } catch {
    return null; // timeout/rede → o chamador cai no cérebro local
  } finally {
    clearTimeout(timer);
  }
}

/** POST {baseUrl}/api/doctorthink/train. Retorna o id do rascunho ou null. */
export async function trainBrainRemote(
  baseUrl: string,
  apiKey: string,
  input: { doctorId: string; question: string; answer: string },
  timeoutMs = 6000,
): Promise<{ id: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/doctorthink/train`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: string };
    return data?.id ? { id: data.id } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
