import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ─── Album ────────────────────────────────────────────────────────────────────

export type AlbumPost = {
  id: string;
  patient_user_id: string;
  author_name: string;
  caption: string | null;
  image_data: string | null;
  emoji: string | null;
  created_at: string;
};

export const createAlbumPost = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        authorName: z.string().min(1),
        caption: z.string().nullable(),
        imageData: z.string().nullable(),
        emoji: z.string().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error: authErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !u.user) return { ok: false as const, error: "Não autenticado" };
    const { error } = await supabaseAdmin.from("family_album_posts").insert({
      patient_user_id: u.user.id,
      author_name: data.authorName,
      caption: data.caption,
      image_data: data.imageData,
      emoji: data.emoji,
    });
    return { ok: !error, error: error?.message };
  });

export const getAlbumByToken = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: z.string() }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Validate companion token → get patient_user_id
    const { data: invite } = await supabaseAdmin
      .from("companion_invites")
      .select("user_id, expires_at")
      .eq("token", data.token)
      .single();
    if (!invite) return { ok: false as const, error: "Token inválido." };
    if (invite.expires_at && new Date(invite.expires_at) < new Date())
      return { ok: false as const, error: "Convite expirado." };
    const { data: posts } = await supabaseAdmin
      .from("family_album_posts")
      .select("*")
      .eq("patient_user_id", invite.user_id)
      .order("created_at", { ascending: false });
    return {
      ok: true as const,
      posts: (posts ?? []) as AlbumPost[],
      patientUserId: invite.user_id,
    };
  });

export const addAlbumPostPublic = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        token: z.string().max(64),
        authorName: z.string().min(1).max(80),
        caption: z.string().max(500).nullable(),
        // Foto vem em base64 (canvas 800px jpeg ≈ 200KB). O teto de 1,5M chars
        // impede payloads gigantes de inflarem o banco via endpoint público.
        imageData: z.string().max(1_500_000).nullable(),
        emoji: z.string().max(8).nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite } = await supabaseAdmin
      .from("companion_invites")
      .select("user_id, expires_at")
      .eq("token", data.token)
      .single();
    if (!invite) return { ok: false as const, error: "Token inválido." };
    if (invite.expires_at && new Date(invite.expires_at) < new Date())
      return { ok: false as const, error: "Convite expirado." };
    const { error } = await supabaseAdmin.from("family_album_posts").insert({
      patient_user_id: invite.user_id,
      author_name: data.authorName,
      caption: data.caption,
      image_data: data.imageData,
      emoji: data.emoji,
    });
    return { ok: !error, error: error?.message };
  });

export const deleteAlbumPost = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error: authErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !u.user) return { ok: false as const };
    const { error } = await supabaseAdmin
      .from("family_album_posts")
      .delete()
      .eq("id", data.id)
      .eq("patient_user_id", u.user.id);
    return { ok: !error };
  });

export const getMyAlbumPosts = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error: authErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !u.user) return { ok: false as const, error: "Não autenticado" };
    const { data: posts } = await supabaseAdmin
      .from("family_album_posts")
      .select("*")
      .eq("patient_user_id", u.user.id)
      .order("created_at", { ascending: false });
    return { ok: true as const, posts: (posts ?? []) as AlbumPost[] };
  });

// ─── Baby Name Voting ─────────────────────────────────────────────────────────

export type NameEntry = {
  id: string;
  name: string;
  suggested_by: string;
  created_at: string;
  vote_count?: number;
};

export type NameSession = {
  id: string;
  share_token: string;
  is_active: boolean;
  reveal_winner: boolean;
};

export const getOrCreateNameSession = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error: authErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !u.user) return { ok: false as const, error: "Não autenticado" };
    // Try to get existing session
    const { data: existing } = await supabaseAdmin
      .from("baby_name_sessions")
      .select("*")
      .eq("patient_user_id", u.user.id)
      .single();
    if (existing) {
      // Load entries with vote counts
      const { data: entries } = await supabaseAdmin
        .from("baby_name_entries")
        .select("*, baby_name_votes(count)")
        .eq("session_id", existing.id)
        .order("created_at", { ascending: true });
      const enriched = (entries ?? []).map((e: any) => ({
        ...e,
        vote_count: e.baby_name_votes?.[0]?.count ?? 0,
      }));
      return {
        ok: true as const,
        session: existing as NameSession,
        entries: enriched as NameEntry[],
      };
    }
    // Create new
    const { data: created, error } = await supabaseAdmin
      .from("baby_name_sessions")
      .insert({ patient_user_id: u.user.id })
      .select()
      .single();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, session: created as NameSession, entries: [] as NameEntry[] };
  });

export const addNameByPatient = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({ accessToken: z.string().min(10), name: z.string().min(1), suggestedBy: z.string() })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (!u.user) return { ok: false as const };
    const { data: session } = await supabaseAdmin
      .from("baby_name_sessions")
      .select("id")
      .eq("patient_user_id", u.user.id)
      .single();
    if (!session) return { ok: false as const, error: "Sessão não encontrada" };
    const { error } = await supabaseAdmin.from("baby_name_entries").insert({
      session_id: session.id,
      name: data.name,
      suggested_by: data.suggestedBy || "Mamãe",
    });
    return { ok: !error };
  });

export const toggleNameSession = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({ accessToken: z.string().min(10), isActive: z.boolean(), revealWinner: z.boolean() })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (!u.user) return { ok: false as const };
    const { error } = await supabaseAdmin
      .from("baby_name_sessions")
      .update({ is_active: data.isActive, reveal_winner: data.revealWinner })
      .eq("patient_user_id", u.user.id);
    return { ok: !error };
  });

export const removeNameEntry = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), entryId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (!u.user) return { ok: false as const };
    const { data: session } = await supabaseAdmin
      .from("baby_name_sessions")
      .select("id")
      .eq("patient_user_id", u.user.id)
      .single();
    if (!session) return { ok: false as const };
    const { error } = await supabaseAdmin
      .from("baby_name_entries")
      .delete()
      .eq("id", data.entryId)
      .eq("session_id", session.id);
    return { ok: !error };
  });

// Public (family) voting endpoints
export const getPublicNameSession = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ shareToken: z.string() }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: session } = await supabaseAdmin
      .from("baby_name_sessions")
      .select("*")
      .eq("share_token", data.shareToken)
      .single();
    if (!session) return { ok: false as const, error: "Link inválido." };
    if (!session.is_active && !session.reveal_winner)
      return { ok: false as const, error: "A votação foi encerrada." };
    const { data: entries } = await supabaseAdmin
      .from("baby_name_entries")
      .select("*, baby_name_votes(count)")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true });
    const enriched = (entries ?? []).map((e: any) => ({
      ...e,
      vote_count: Number(e.baby_name_votes?.[0]?.count ?? 0),
    }));
    // Also get patient's baby name for display
    const { data: profile } = await supabaseAdmin
      .from("patient_profiles")
      .select("display_name, baby_name")
      .eq("id", session.patient_user_id)
      .single();
    return {
      ok: true as const,
      session: session as NameSession,
      entries: enriched as NameEntry[],
      motherName: (profile as any)?.display_name ?? null,
      babyName: (profile as any)?.baby_name ?? null,
    };
  });

export const addPublicNameEntry = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({ shareToken: z.string(), name: z.string().min(1), suggestedBy: z.string().min(1) })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: session } = await supabaseAdmin
      .from("baby_name_sessions")
      .select("id, is_active")
      .eq("share_token", data.shareToken)
      .single();
    if (!session || !session.is_active) return { ok: false as const, error: "Votação inativa." };
    const { error } = await supabaseAdmin.from("baby_name_entries").insert({
      session_id: session.id,
      name: data.name,
      suggested_by: data.suggestedBy,
    });
    return { ok: !error, error: error?.message };
  });

export const voteForName = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        shareToken: z.string(),
        entryId: z.string().uuid(),
        voterName: z.string().min(1),
        voterToken: z.string(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: session } = await supabaseAdmin
      .from("baby_name_sessions")
      .select("id, is_active")
      .eq("share_token", data.shareToken)
      .single();
    if (!session || !session.is_active) return { ok: false as const, error: "Votação inativa." };
    const { error } = await supabaseAdmin.from("baby_name_votes").upsert({
      entry_id: data.entryId,
      voter_name: data.voterName,
      voter_token: data.voterToken,
    });
    if (error && error.code !== "23505") return { ok: false as const, error: error.message };
    return { ok: true as const };
  });
