import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { typedDb } from "@/integrations/supabase/types.extended";
import { computeGestation } from "@/lib/gestacao";
import { grantSementinhas, SEMENTINHAS, BIG_ACHIEVEMENTS } from "@/lib/sementinhas.functions";

export type AchievementDef = {
  key: string;
  title: string;
  description: string;
  emoji: string;
  category: "saude" | "diario" | "bebe" | "educacao" | "familia";
};

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  {
    key: "first_login",
    title: "Bem-vinda!",
    description: "Criou sua conta no portal",
    emoji: "🌟",
    category: "bebe",
  },
  {
    key: "profile_complete",
    title: "Perfil Completo",
    description: "Preencheu todas as informações do perfil",
    emoji: "✅",
    category: "bebe",
  },
  {
    key: "first_health_log",
    title: "Saúde em Dia",
    description: "Registrou o primeiro dado de saúde",
    emoji: "❤️",
    category: "saude",
  },
  {
    key: "health_7_days",
    title: "Semana Saudável",
    description: "7 registros de saúde realizados",
    emoji: "💪",
    category: "saude",
  },
  {
    key: "first_journal",
    title: "Memória Afetiva",
    description: "Escreveu o primeiro diário",
    emoji: "📝",
    category: "diario",
  },
  {
    key: "journal_10",
    title: "Escritora Dedicada",
    description: "10 entradas no diário da gestação",
    emoji: "📔",
    category: "diario",
  },
  {
    key: "first_kicks",
    title: "Primeiros Chutes!",
    description: "Registrou a primeira sessão de movimentos",
    emoji: "👟",
    category: "bebe",
  },
  {
    key: "kicks_10",
    title: "Bebê Ativo",
    description: "10 sessões de contagem de chutes",
    emoji: "⚽",
    category: "bebe",
  },
  {
    key: "first_course",
    title: "Escola Aberta",
    description: "Completou o primeiro módulo da Escola do Bebê",
    emoji: "🎓",
    category: "educacao",
  },
  {
    key: "course_5",
    title: "Aluna Dedicada",
    description: "Completou 5 módulos da Escola do Bebê",
    emoji: "🏅",
    category: "educacao",
  },
  {
    key: "course_complete",
    title: "Mamãe Preparada!",
    description: "Completou todos os 12 módulos da Escola do Bebê",
    emoji: "🏆",
    category: "educacao",
  },
  {
    key: "companion_invited",
    title: "Família Unida",
    description: "Convidou um acompanhante para o portal",
    emoji: "💑",
    category: "familia",
  },
  {
    key: "album_post",
    title: "Memórias Registradas",
    description: "Adicionou a primeira foto ao álbum da família",
    emoji: "📸",
    category: "familia",
  },
  {
    key: "prenatal_done",
    title: "Pré-natal Concluído!",
    description: "Checklist completo — parabéns!",
    emoji: "🥇",
    category: "bebe",
  },
];

export const getMyAchievements = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = typedDb(supabaseAdmin);
    const { data: u, error: authErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !u.user) return { ok: false as const, error: "Não autenticado" };
    const { data: rows } = await db
      .from("patient_achievements")
      .select("achievement_key, unlocked_at")
      .eq("user_id", u.user.id);
    return {
      ok: true as const,
      unlocked: (rows ?? []) as { achievement_key: string; unlocked_at: string }[],
    };
  });

export const checkAndAwardAchievements = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = typedDb(supabaseAdmin);
    const { data: u, error: authErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !u.user)
      return {
        ok: false as const,
        unlocked: [] as { achievement_key: string; unlocked_at: string }[],
        newlyAwarded: [] as string[],
      };
    const uid = u.user.id;
    const toAward: string[] = [];

    toAward.push("first_login");

    const { data: profile } = await db
      .from("patient_profiles")
      .select(
        "display_name, lmp_date, reference_date, reference_weeks, reference_days, blood_type, emergency_contact, emergency_phone, height_cm, pre_pregnancy_weight_kg",
      )
      .eq("id", uid)
      .single();
    if (profile) {
      const fields = [
        profile.display_name,
        profile.lmp_date || profile.reference_date,
        profile.blood_type,
        profile.emergency_contact,
        profile.emergency_phone,
        profile.height_cm,
        profile.pre_pregnancy_weight_kg,
      ];
      if (fields.every(Boolean)) toAward.push("profile_complete");
    }

    const { count: healthCount } = await db
      .from("health_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", uid);
    if ((healthCount ?? 0) >= 1) toAward.push("first_health_log");
    if ((healthCount ?? 0) >= 7) toAward.push("health_7_days");

    const { count: journalCount } = await db
      .from("journal_entries")
      .select("*", { count: "exact", head: true })
      .eq("user_id", uid);
    if ((journalCount ?? 0) >= 1) toAward.push("first_journal");
    if ((journalCount ?? 0) >= 10) toAward.push("journal_10");

    const { count: kickCount } = await db
      .from("kick_sessions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", uid);
    if ((kickCount ?? 0) >= 1) toAward.push("first_kicks");
    if ((kickCount ?? 0) >= 10) toAward.push("kicks_10");

    const { count: courseCount } = await db
      .from("course_progress")
      .select("*", { count: "exact", head: true })
      .eq("user_id", uid);
    if ((courseCount ?? 0) >= 1) toAward.push("first_course");
    if ((courseCount ?? 0) >= 5) toAward.push("course_5");
    if ((courseCount ?? 0) >= 12) toAward.push("course_complete");

    const { count: inviteCount } = await db
      .from("companion_invites")
      .select("*", { count: "exact", head: true })
      .eq("user_id", uid);
    if ((inviteCount ?? 0) >= 1) toAward.push("companion_invited");

    const { count: albumCount } = await db
      .from("family_album_posts")
      .select("*", { count: "exact", head: true })
      .eq("patient_user_id", uid);
    if ((albumCount ?? 0) >= 1) toAward.push("album_post");

    const { data: checkItems } = await db.from("checklist_items").select("done").eq("user_id", uid);
    if (checkItems && checkItems.length > 0 && checkItems.every((c: any) => c.done))
      toAward.push("prenatal_done");

    // Chaves já desbloqueadas antes desta checagem, para detectar as novas
    // (permite que os pontos de ação exibam um toast de "nova conquista").
    const { data: existingRows } = await db
      .from("patient_achievements")
      .select("achievement_key")
      .eq("user_id", uid);
    const existing = new Set(
      ((existingRows ?? []) as { achievement_key: string }[]).map((r) => r.achievement_key),
    );
    const newlyAwarded = toAward.filter((key) => !existing.has(key));

    if (toAward.length > 0) {
      await db.from("patient_achievements").upsert(
        toAward.map((key) => ({ user_id: uid, achievement_key: key })),
        { onConflict: "user_id,achievement_key", ignoreDuplicates: true },
      );
    }

    // 🌱 Sementinhas: recompensa por conquistas + marcos de semana/trimestre.
    // Tudo idempotente (dedupe_key), então rodar a cada checagem se auto-corrige
    // sem conceder em dobro. Ganho só por ação/educação/marco — nunca por
    // resultado clínico.
    const titleByKey = new Map(ACHIEVEMENT_DEFS.map((d) => [d.key, d.title]));
    const grants: { amount: number; reason: string; dedupeKey: string }[] = toAward.map((key) => ({
      amount: BIG_ACHIEVEMENTS.has(key)
        ? SEMENTINHAS.achievementBig
        : SEMENTINHAS.achievementDefault,
      reason: `Conquista: ${titleByKey.get(key) ?? key}`,
      dedupeKey: `achievement:${key}`,
    }));
    const gest = computeGestation({
      lmp: profile?.lmp_date ?? null,
      referenceDate: profile?.reference_date ?? null,
      referenceWeeks: profile?.reference_weeks ?? null,
      referenceDays: profile?.reference_days ?? null,
    });
    if (gest) {
      // Marcos escopados à GESTAÇÃO atual (LMP/referência) — senão, numa 2ª
      // gravidez os marcos já teriam sido "consumidos" na 1ª e ela não ganharia.
      const cycle = profile?.lmp_date ?? profile?.reference_date ?? "x";
      // Marco da semana atual: presente por avançar, não por performance.
      grants.push({
        amount: SEMENTINHAS.weekMilestone,
        reason: `Semana ${gest.weeks} 🎉`,
        dedupeKey: `week:${cycle}:${gest.weeks}`,
      });
      if (gest.weeks >= 13)
        grants.push({
          amount: SEMENTINHAS.trimesterMilestone,
          reason: "Fim do 1º trimestre 🎊",
          dedupeKey: `trimester:${cycle}:1`,
        });
      if (gest.weeks >= 27)
        grants.push({
          amount: SEMENTINHAS.trimesterMilestone,
          reason: "Fim do 2º trimestre 🎊",
          dedupeKey: `trimester:${cycle}:2`,
        });
    }
    await grantSementinhas(db, uid, grants);

    const { data: rows } = await db
      .from("patient_achievements")
      .select("achievement_key, unlocked_at")
      .eq("user_id", uid);
    return {
      ok: true as const,
      unlocked: (rows ?? []) as { achievement_key: string; unlocked_at: string }[],
      newlyAwarded,
    };
  });
