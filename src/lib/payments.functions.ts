/**
 * Incidentes de pagamento (super-admin): reembolsos e disputas/chargebacks
 * capturados do Stripe (via webhook → tabela payment_incidents). Dá ao dono a
 * visão do dinheiro que saiu ou está sob disputa.
 */
import { createServerFn } from "@tanstack/react-start";
import { MAX_ROWS, TokenSchema, requireSuperAdmin, safe } from "@/lib/platform-admin.server";

export type PaymentIncident = {
  id: string;
  kind: "refund" | "dispute";
  stripe_charge_id: string | null;
  stripe_customer_id: string | null;
  amount_cents: number;
  reason: string | null;
  created_at: string;
};

export type PaymentIncidentsReport = {
  isSuperAdmin: true;
  incidents: PaymentIncident[];
  totals: { refundCount: number; refundCents: number; disputeCount: number; disputeCents: number };
  generatedAt: string;
};

export const getPaymentIncidents = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireSuperAdmin(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const incidents = await safe<PaymentIncident[]>(
      async () =>
        ((
          await (supabaseAdmin as any)
            .from("payment_incidents")
            .select("id,kind,stripe_charge_id,stripe_customer_id,amount_cents,reason,created_at")
            .order("created_at", { ascending: false })
            .limit(MAX_ROWS)
        ).data ?? []) as PaymentIncident[],
      [],
    );
    const totals = { refundCount: 0, refundCents: 0, disputeCount: 0, disputeCents: 0 };
    for (const i of incidents) {
      if (i.kind === "refund") {
        totals.refundCount += 1;
        totals.refundCents += i.amount_cents ?? 0;
      } else {
        totals.disputeCount += 1;
        totals.disputeCents += i.amount_cents ?? 0;
      }
    }
    const report: PaymentIncidentsReport = {
      isSuperAdmin: true,
      incidents,
      totals,
      generatedAt: new Date().toISOString(),
    };
    return { ok: true as const, report };
  });
