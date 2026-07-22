/**
 * Medição de uso do DoctorThink (metering). Um registro por chamada de API,
 * fire-and-forget (nunca afeta a resposta). Base para faturar por uso.
 */
export function logDoctorThinkUsage(
  tenantId: string,
  doctorId: string | null,
  endpoint: "ask" | "train",
  hadCoverage?: boolean,
): void {
  void (async () => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await (supabaseAdmin as any).from("doctorthink_usage").insert({
        tenant_id: tenantId,
        doctor_id: doctorId,
        endpoint,
        had_coverage: hadCoverage ?? null,
      });
    } catch {
      /* metering best-effort — nunca quebra a API */
    }
  })();
}
