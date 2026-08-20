import { createServerFn } from "@tanstack/react-start";
import { codigoParaConvite } from "@/lib/convite.functions";
import { z } from "zod";

// ─── Album ────────────────────────────────────────────────────────────────────

export type AlbumPost = {
  id: string;
  patient_user_id: string;
  author_name: string;
  caption: string | null;
  /**
   * O que a tag `<img>` deve usar — URL assinada quando a foto está no
   * Storage, a data URL antiga enquanto a linha não migrou.
   *
   * Chamava-se `image_data` e carregava base64 cru. O nome mudou de propósito
   * em vez de o campo passar a carregar uma URL calado: assim o compilador
   * aponta cada tela que lê isto, e nenhuma fica servindo a coluna velha
   * depois que a linha migrou.
   */
  image_url: string | null;
  emoji: string | null;
  created_at: string;
};

/**
 * O álbum visto por QUEM TEM O LINK — sem o uuid dela.
 *
 * `AlbumPost` carrega `patient_user_id` porque na tela dela isso é o próprio
 * id. Na rota por token, o público é o grupo da família, e o id de
 * `auth.users` não tem o que fazer ali.
 */
export type AlbumPostPublico = Omit<AlbumPost, "patient_user_id">;

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
    const { error } = await gravarPost(u.user.id, data);
    return { ok: !error, error: error?.message };
  });

/**
 * A parte da linha que carrega a foto — no Storage quando dá, em base64 quando
 * não dá.
 *
 * As duas inserções do álbum (a dela e a do acompanhante com link) precisam da
 * MESMA decisão. Escrevê-la duas vezes é como as duas telas do álbum acabaram
 * com `select("*")` numa e colunas nomeadas na outra: a correção foi feita num
 * lado só e o uuid dela continuou vazando pelo outro por meses.
 *
 * O `null` de `guardarImagem` não é erro a tratar: é a instrução para gravar
 * como sempre se gravou. Se o balde ainda não existe em produção — e o banco
 * de lá está atrás do repositório há meses —, a foto entra em base64 e ninguém
 * percebe. Quando o balde aparece, a economia começa sozinha, sem novo deploy.
 */
async function gravarPost(
  donoId: string,
  data: {
    authorName: string;
    caption: string | null;
    imageData: string | null;
    emoji: string | null;
  },
) {
  const { gravarLinhaComImagem, BALDE_ALBUM } = await import("@/lib/imagens.server");
  return await gravarLinhaComImagem({
    tabela: "family_album_posts",
    balde: BALDE_ALBUM,
    donoId,
    dataUrl: data.imageData,
    resto: {
      patient_user_id: donoId,
      author_name: data.authorName,
      caption: data.caption,
      emoji: data.emoji,
    },
  });
}

export const getAlbumByToken = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: z.string() }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Validate companion token → get patient_user_id
    /* ⚠️ `album_token`, NUNCA `token`. Os dois vivem na mesma linha e têm
       privilégios diferentes: `token` abre o painel do acompanhante E os SOS
       dos últimos 30 minutos, com latitude e longitude
       (`getRecentPanicByToken`). O link do álbum é o que ela manda para o
       grupo da família — e numa influenciadora, para muito mais gente.

       Isto já foi UM token só, e o comentário da criação do convite dizia com
       todas as letras: "dá acesso ao painel do papai, álbum e alerta de
       pânico". Era desenho conhecido; o que o tornou errado foi o álbum virar
       link de circulação ampla. Ver APLICAR_SOS_SO_PARA_QUEM_DEVE.sql, que
       REBAIXA o token antigo para `album_token` e sorteia um novo para o
       acompanhante — assim todo link já espalhado para de abrir o SOS. */
    const { data: invite } = await (supabaseAdmin as any)
      .from("companion_invites")
      .select("user_id, expires_at")
      .eq("album_token", data.token)
      .single();
    if (!invite) return { ok: false as const, error: "Token inválido." };
    if (invite.expires_at && new Date(invite.expires_at) < new Date())
      return { ok: false as const, error: "Convite expirado." };
    /* COLUNAS NOMEADAS, E SEM O uuid DELA.
       `select("*")` trazia `patient_user_id` em CADA post, e o retorno o
       repetia no topo — o uuid de `auth.users` dela entregue a quem tem o link
       do álbum, que é o grupo da família inteiro. A tela do álbum
       (`album.$token.tsx`) nunca usou esse campo: era dado morto viajando.

       É exatamente o que foi removido de `getPublicNameSession`, com o
       comentário certo, 190 linhas abaixo neste mesmo arquivo. A correção não
       tinha sido propagada para o irmão. */
    const { lerComCaminho } = await import("@/lib/imagens.server");
    const { data: posts } = await lerComCaminho<any[]>(
      "family_album_posts",
      "id, created_at, author_name, caption, image_data, emoji",
      (q) => q.eq("patient_user_id", invite.user_id).order("created_at", { ascending: false }),
    );
    return {
      ok: true as const,
      posts: (await comUrlDeImagem(posts ?? [])) as AlbumPostPublico[],
      /* ⚠️ O código dela, para o rodapé de convite — `null` em Modo Cuidado.
         O ÁLBUM continua de pé no luto (as fotos são a memória do que houve, e
         escondê-las seria o app apagar o bebê dela); o que some é só o convite,
         que fala de gestação em curso. A régua está em `codigoParaConvite`. */
      codigoDeConvite: await codigoParaConvite(supabaseAdmin as any, invite.user_id as string),
    };
  });

/**
 * Troca (image_path, image_data) por uma `image_url` só, para a tela.
 *
 * As assinaturas saem em paralelo. Em série, um álbum de trinta fotos faria
 * trinta idas ao Storage uma depois da outra — o tipo de espera que aparece
 * como "o álbum demora a abrir" e ninguém liga à causa.
 */
async function comUrlDeImagem<T extends { image_data?: string | null; image_path?: string | null }>(
  linhas: T[],
): Promise<Array<Omit<T, "image_data" | "image_path"> & { image_url: string | null }>> {
  const { imagemDaLinha, BALDE_ALBUM } = await import("@/lib/imagens.server");
  return Promise.all(
    linhas.map(async (l) => {
      const { image_data: _d, image_path: _p, ...resto } = l;
      return { ...resto, image_url: await imagemDaLinha(BALDE_ALBUM, l) };
    }),
  );
}

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
    /* ⚠️ `album_token`, NUNCA `token`. Os dois vivem na mesma linha e têm
       privilégios diferentes: `token` abre o painel do acompanhante E os SOS
       dos últimos 30 minutos, com latitude e longitude
       (`getRecentPanicByToken`). O link do álbum é o que ela manda para o
       grupo da família — e numa influenciadora, para muito mais gente.

       Isto já foi UM token só, e o comentário da criação do convite dizia com
       todas as letras: "dá acesso ao painel do papai, álbum e alerta de
       pânico". Era desenho conhecido; o que o tornou errado foi o álbum virar
       link de circulação ampla. Ver APLICAR_SOS_SO_PARA_QUEM_DEVE.sql, que
       REBAIXA o token antigo para `album_token` e sorteia um novo para o
       acompanhante — assim todo link já espalhado para de abrir o SOS. */
    const { data: invite } = await (supabaseAdmin as any)
      .from("companion_invites")
      .select("user_id, expires_at")
      .eq("album_token", data.token)
      .single();
    if (!invite) return { ok: false as const, error: "Token inválido." };
    if (invite.expires_at && new Date(invite.expires_at) < new Date())
      return { ok: false as const, error: "Convite expirado." };
    /* A pasta é a DELA, não de quem postou: o acompanhante não tem conta, e o
       arquivo pertence ao álbum dela — inclusive para a hora de apagar tudo a
       pedido dela, que a LGPD exige que seja possível. */
    const { error } = await gravarPost(String(invite.user_id), data);
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
    /* O caminho ANTES do delete — depois a linha não existe mais e o arquivo
       ficaria no balde para sempre, pago e invisível. `.eq(patient_user_id)`
       nas duas consultas: sem isso, um id de outra pessoa devolveria o caminho
       da foto dela e o arquivo seria apagado por quem não podia. */
    const { lerComCaminho } = await import("@/lib/imagens.server");
    const { data: linha } = await lerComCaminho<{ image_path?: string | null }>(
      "family_album_posts",
      "id",
      (q) => q.eq("id", data.id).eq("patient_user_id", u.user.id).maybeSingle(),
    );
    const { error } = await supabaseAdmin
      .from("family_album_posts")
      .delete()
      .eq("id", data.id)
      .eq("patient_user_id", u.user.id);
    if (!error && linha?.image_path) {
      const { apagarImagem, BALDE_ALBUM } = await import("@/lib/imagens.server");
      await apagarImagem(BALDE_ALBUM, linha.image_path as string);
    }
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
    return { ok: true as const, posts: (await comUrlDeImagem(posts ?? [])) as AlbumPost[] };
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
    /* Sem `patient_user_id`: o `select("*")` entregava o uuid de `auth.users`
       dela para qualquer anônimo com o link de votação. Não é explorável
       sozinho — a RLS não aceita uuid como credencial —, mas é o identificador
       que aparece em toda outra tabela, e não há motivo para ele sair daqui. */
    const { data: session } = await supabaseAdmin
      .from("baby_name_sessions")
      .select("id,share_token,is_active,reveal_winner,created_at,patient_user_id")
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
    /* `patient_user_id` é usado ACIMA para achar o nome dela, e sai do retorno.
       O uuid de `auth.users` não tem por que chegar a um anônimo com o link de
       votação — não é credencial, mas é o identificador que aparece em toda
       outra tabela. */
    const { patient_user_id: _uuidDela, ...sessaoPublica } = session as Record<string, unknown>;
    return {
      ok: true as const,
      session: sessaoPublica as unknown as NameSession,
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
