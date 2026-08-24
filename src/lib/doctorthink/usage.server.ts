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
  /* DISPARA-E-ESQUECE AUTORIZADO: telemetria pura. Perder uma linha não muda
     nada para ninguém, e aguardar poria uma escrita no caminho da resposta. */
  void (async () => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await (supabaseAdmin as any).from("doctorthink_usage").insert({
        tenant_id: tenantId,
        doctor_id: doctorId,
        endpoint,
        had_coverage: hadCoverage ?? null,
      });
      /* "Telemetria pura" é o que o comentário acima diz, mas o cabeçalho
         deste arquivo diz outra coisa: é a BASE PARA FATURAR POR USO. Linha
         perdida em silêncio é chamada consumida e não cobrada, e a conta só
         fecha errado no fim do mês, sem nada a que voltar. */
      if (error) console.error("[doctorthink] uso não registrado", tenantId, endpoint, error);
    } catch (e) {
      console.error("[doctorthink] uso não registrado", tenantId, endpoint, e);
    }
  })();
}
