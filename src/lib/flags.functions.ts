/**
 * Administração das feature flags (super-admin). O dono liga/desliga features
 * e controla rollout gradual sem deploy. A leitura em runtime é feita pelo
 * helper isFlagEnabled (platform-flags.server.ts).
 *
 * FLAG_CATALOG: as chaves conhecidas do produto — o dono vê a lista pronta
 * com descrição em vez de precisar adivinhar nomes.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { TokenSchema, requireSuperAdmin, safe } from "@/lib/platform-admin.server";
import { clearFlagCache } from "@/lib/platform-flags.server";
import { writeAudit } from "@/lib/audit.server";

/** Chaves de flag conhecidas (kill switches das features principais). */
export const FLAG_CATALOG: { key: string; description: string }[] = [
  {
    key: "consulta_particular",
    description: "Solicitação de consulta particular (paga) pela paciente.",
  },
  { key: "lives", description: "Lives dos médicos (cadastro e divulgação)." },
  { key: "teleconsulta", description: "Teleconsulta por vídeo." },
  { key: "segundo_cerebro", description: "Respostas automáticas do Segundo Cérebro (IA)." },
  { key: "chat_ia", description: "Chatbot de IA no app da paciente." },
  {
    key: "doctorthink_remote",
    description:
      "Consumir o cérebro pela API DoctorThink remota. Duplo opt-in: precisa de DOCTORTHINK_API_URL/KEY E esta flag LIGADA (ausente/desligada = cérebro local).",
  },
];

export type PlatformFlag = {
  key: string;
  enabled: boolean;
  rollout_pct: number;
  description: string | null;
  updated_at: string | null;
};

/** Lista as flags salvas + as do catálogo ainda não criadas (default ligado). */
export const listFlags = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireSuperAdmin(data.accessToken);
    if (!user) return { ok: false as const, flags: [] as PlatformFlag[] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const saved = await safe<PlatformFlag[]>(
      async () =>
        ((await (supabaseAdmin as any).from("platform_flags").select("*").limit(500)).data ??
          []) as PlatformFlag[],
      [],
    );
    const byKey = new Map(saved.map((f) => [f.key, f]));
    // Une catálogo (default ligado, 100%) com o que já foi salvo.
    const merged: PlatformFlag[] = FLAG_CATALOG.map(
      (c) =>
        byKey.get(c.key) ?? {
          key: c.key,
          enabled: true,
          rollout_pct: 100,
          description: c.description,
          updated_at: null,
        },
    );
    // Flags salvas fora do catálogo (criadas à mão) entram no fim.
    for (const f of saved) if (!FLAG_CATALOG.some((c) => c.key === f.key)) merged.push(f);
    return { ok: true as const, flags: merged };
  });

/** Cria/atualiza uma flag (super-admin). Salvar limpa o cache de runtime. */
export const setFlag = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        key: z
          .string()
          .min(2)
          .max(60)
          .regex(/^[a-z0-9_]+$/, "só minúsculas, números e _"),
        enabled: z.boolean(),
        rolloutPct: z.number().int().min(0).max(100).default(100),
        description: z.string().max(200).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const user = await requireSuperAdmin(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const catalog = FLAG_CATALOG.find((c) => c.key === data.key);
    const { error } = await (supabaseAdmin as any).from("platform_flags").upsert(
      {
        key: data.key,
        enabled: data.enabled,
        rollout_pct: data.rolloutPct,
        description: data.description ?? catalog?.description ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
    if (error?.code === "42P01") return { ok: false as const, reason: "migracao" as const };
    if (error) return { ok: false as const };
    clearFlagCache();
    await writeAudit({ id: user.id, email: user.email }, "flag.set", data.key, {
      enabled: data.enabled,
      rolloutPct: data.rolloutPct,
    });
    return { ok: true as const };
  });
