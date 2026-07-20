import { createFileRoute } from "@tanstack/react-router";

/**
 * DoctorThink API — POST /api/doctorthink/ask
 *
 * Produto do Segundo Cérebro para outros apps. Autentica por API key
 * (Authorization: Bearer dtk_... ou header X-API-Key) e devolve o BLOCO de
 * contexto do cérebro do médico para o app cliente injetar no próprio LLM.
 *
 * Body: { doctorId: string, message: string, channel?: "app"|"whatsapp"|"teste" }
 * Resposta: { block: string, hadCoverage: boolean, enabledChannels: {...} }
 *
 * Hoje serve o inquilino Obstétrica (store sobre o Supabase da Obstétrica); na
 * Fase 3, o tenant da chave seleciona o store do banco próprio do DoctorThink.
 */
function jsonRes(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export const Route = createFileRoute("/api/doctorthink/ask")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authApiKey } = await import("@/lib/doctorthink/api-keys.server");
        const auth = await authApiKey(
          request.headers.get("authorization") || request.headers.get("x-api-key"),
        );
        if (!auth) return jsonRes({ error: "unauthorized" }, 401);

        const body = (await request.json().catch(() => null)) as {
          doctorId?: string;
          message?: string;
          channel?: string;
        } | null;
        if (!body?.message) return jsonRes({ error: "message é obrigatório" }, 400);

        // Escopo tenant→médico: chave TRANCADA a um médico só opera nele; chave
        // ampla (doctorId null, 1ª parte) usa o doctorId do corpo.
        const doctorId = auth.doctorId ?? body.doctorId;
        if (!doctorId) return jsonRes({ error: "doctorId é obrigatório" }, 400);
        if (auth.doctorId && body.doctorId && body.doctorId !== auth.doctorId) {
          return jsonRes({ error: "forbidden: chave trancada a outro médico" }, 403);
        }
        // Whitelist de canal (default-deny fora do conjunto conhecido).
        const channel =
          body.channel === "whatsapp" || body.channel === "teste" ? body.channel : "app";

        const [{ createObstetricaBrainStore }, { runBrainQuery }, { OBSTETRICA_LABELS }] =
          await Promise.all([
            import("@/lib/doctorthink/obstetrica-store.server"),
            import("@/lib/doctorthink/orchestrator"),
            import("@/lib/secondbrain.server"),
          ]);

        try {
          const result = await runBrainQuery(
            { tenantId: auth.tenantId, doctorId, message: body.message, channel },
            createObstetricaBrainStore(),
            OBSTETRICA_LABELS,
            { maxEntriesLoaded: 200, maxEntriesScored: 6 },
          );
          const { logDoctorThinkUsage } = await import("@/lib/doctorthink/usage.server");
          logDoctorThinkUsage(auth.tenantId, doctorId, "ask", result.hadCoverage);
          return jsonRes(result, 200);
        } catch {
          return jsonRes({ error: "internal_error" }, 500);
        }
      },
    },
  },
});
