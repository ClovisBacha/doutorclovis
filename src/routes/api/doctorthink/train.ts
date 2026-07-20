import { createFileRoute } from "@tanstack/react-router";

/**
 * DoctorThink API — POST /api/doctorthink/train
 *
 * Alimenta o cérebro do médico com uma resposta APROVADA (Q&A). A entrada já
 * nasce "encontrável" (vetor semântico fire-and-forget). Autentica por API key.
 *
 * Body: { doctorId: string, question: string, answer: string }
 * Resposta: { ok: true, id } | { error }
 *
 * ATENÇÃO (IA médica): treinar = registrar conhecimento aprovado pelo médico.
 * Este endpoint assume que o app cliente só chama com conteúdo validado pelo
 * profissional — o cérebro nunca "aprende" sozinho.
 */
function jsonRes(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export const Route = createFileRoute("/api/doctorthink/train")({
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
          question?: string;
          answer?: string;
        } | null;
        const question = body?.question?.trim();
        const answer = body?.answer?.trim();
        if (!question || !answer) {
          return jsonRes({ error: "question e answer são obrigatórios" }, 400);
        }
        // Escopo tenant→médico (igual ao /ask): chave trancada só opera no seu médico.
        const doctorId = auth.doctorId ?? body?.doctorId;
        if (!doctorId) return jsonRes({ error: "doctorId é obrigatório" }, 400);
        if (auth.doctorId && body?.doctorId && body.doctorId !== auth.doctorId) {
          return jsonRes({ error: "forbidden: chave trancada a outro médico" }, 403);
        }

        try {
          const { createObstetricaBrainStore } =
            await import("@/lib/doctorthink/obstetrica-store.server");
          const row = await createObstetricaBrainStore().addEntry(doctorId, question, answer);
          if (!row) return jsonRes({ error: "internal_error" }, 500);
          // approved:false — entrou como rascunho; o médico aprova no painel.
          return jsonRes({ ok: true, id: row.id, status: "pending_approval" }, 200);
        } catch {
          return jsonRes({ error: "internal_error" }, 500);
        }
      },
    },
  },
});
