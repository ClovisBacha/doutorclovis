/**
 * OS COMENTÁRIOS — servidor.
 *
 * A régua (o que passa, o que é recusado e por quê) mora em `comentarios.ts`,
 * pura e testada. Aqui ela vira lei.
 *
 * ⚠️ **A TRIAGEM RODA NO SERVIDOR, e a da tela não conta.** Um corpo montado à
 * mão pula qualquer verificação de tela — e o que está em jogo é conduta
 * clínica publicada embaixo do nome de um consultório.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  COMENTARIOS_POR_DIA,
  LIMITE_DO_COMENTARIO,
  podeApagarComentario,
  recadoDoComentario,
  triarComentario,
} from "./comentarios";

export type ComentarioNaTela = {
  id: string;
  autorId: string;
  autorNome: string;
  autorAvatar: string | null;
  texto: string;
  criadoEm: string;
  /** Posso apagar este? Ver `podeApagarComentario`. */
  possoApagar: boolean;
};

async function pacienteDaSessao(accessToken: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any).auth.getUser(accessToken);
  return data?.user?.id ?? null;
}

/**
 * O post, se eu puder vê-lo.
 *
 * ⚠️ **COMENTAR EXIGE A MESMA VISIBILIDADE QUE LER.** Sem esta conferência, um
 * `postId` forjado deixaria comentar num post da camada `amigas` de alguém que
 * ela não conhece — e o comentário apareceria para todas as amigas daquela
 * pessoa, com o nome dela junto.
 */
async function postQueEuVejo(sb: any, postId: string, eu: string) {
  const { contextoDe } = await import("./rede-social.functions");
  const { podeVerPost } = await import("./rede-social");
  const ctx = await contextoDe(sb, eu);

  /**
   * ⚠️ **RECUO PARA BANCO SEM `comentarios_abertos`.**
   *
   * A coluna nasce num `APLICAR_` que o dono roda à mão, e o deploy chega
   * SEMPRE antes. Sem este recuo o select falha com `42703`, `postQueEuVejo`
   * devolve `null` e a tela responde "indisponivel" — a mesma imagem de um post
   * apagado, sobre um post que está lá.
   *
   * Ausente vale ABERTO, que é o padrão da coluna: o pior caso é ela poder
   * comentar num post que a dona teria fechado se o banco soubesse guardar essa
   * decisão — e a dona pode apagar. O inverso (tudo fechado) desligaria o
   * recurso inteiro sem ninguém entender por quê.
   */
  const cheia = await sb
    .from("rede_posts")
    .select("id, autor_id, visibilidade, comentarios_abertos, arquivado_em")
    .eq("id", postId)
    .maybeSingle();
  let data = cheia.data;
  if (cheia.error) {
    console.warn("[rede] sem comentarios_abertos — rode APLICAR_CONVERSA_E_COMENTARIOS.sql");
    const velho = await sb
      .from("rede_posts")
      .select("id, autor_id, visibilidade, arquivado_em")
      .eq("id", postId)
      .maybeSingle();
    if (velho.error) return null;
    data = velho.data ? { ...velho.data, comentarios_abertos: true } : null;
  }
  if (!data || data.arquivado_em) return null;

  const { data: autor, error: erroAutor } = await sb
    .from("patient_profiles")
    .select("id, care_mode, perfil_publico")
    .eq("id", data.autor_id)
    .maybeSingle();
  /* ⚠️ Falha de leitura do AUTOR recusa. Sem saber se ele está em Modo Cuidado
     ou se o perfil é público, publicar o comentário seria decidir visibilidade
     no escuro — e o lado seguro aqui é não deixar comentar. */
  if (erroAutor || !autor) return null;

  /* ⚠️ **A MESMA `podeVerPost` DO FEED, nunca uma régua própria.** Comentar
     exige a mesma visibilidade que ler: sem esta conferência, um `postId`
     forjado deixaria comentar num post da camada `amigas` de alguém que ela não
     conhece — e o comentário apareceria para todas as amigas daquela pessoa,
     com o nome dela junto. */
  const vejo = podeVerPost({
    post: { autorId: data.autor_id, visibilidade: data.visibilidade },
    euId: eu,
    autor: { emCuidado: !!autor.care_mode, publico: !!autor.perfil_publico },
    bloqueado: ctx.bloqueio.has(data.autor_id),
    sigoAtivo: ctx.sigo.has(data.autor_id),
    somosAmigas: ctx.amigas.has(data.autor_id),
  });
  if (!vejo) return null;
  return data;
}

export const comentariosDoPost = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), postId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const post = await postQueEuVejo(sb, data.postId, eu);
    if (!post) return { ok: false as const, motivo: "indisponivel" as const };

    const { data: linhas, error } = await sb
      .from("rede_comentarios")
      .select("id, autor_id, texto, criado_em")
      .eq("post_id", data.postId)
      .is("apagado_em", null)
      .order("criado_em", { ascending: true })
      .limit(200);
    if (error) return { ok: false as const, motivo: "banco" as const };

    const linhasArr = (linhas ?? []) as any[];
    const autores = [...new Set(linhasArr.map((c) => c.autor_id))];
    const { contextoDe } = await import("./rede-social.functions");
    const ctx = await contextoDe(sb, eu);

    const { data: perfis } = await sb
      .from("patient_profiles")
      .select("id, display_name, avatar_url")
      .in("id", autores.length ? autores : ["00000000-0000-0000-0000-000000000000"]);
    const porId = new Map(((perfis ?? []) as any[]).map((p) => [p.id, p]));
    const { renovarUrlsAssinadas, VALIDADE_AVATAR_SEG } = await import("@/lib/imagens.server");
    const urls = await renovarUrlsAssinadas(
      linhasArr.map((c) => porId.get(c.autor_id)?.avatar_url ?? null),
      VALIDADE_AVATAR_SEG,
    );

    const comentarios: ComentarioNaTela[] = linhasArr
      /* ⚠️ BLOQUEIO SOME DO COMENTÁRIO, como some do feed: quem ela bloqueou não
         pode continuar aparecendo embaixo das fotos que ela abre. */
      .filter((c) => !ctx.bloqueio.has(c.autor_id))
      .map((c, i) => ({
        id: c.id,
        autorId: c.autor_id,
        autorNome: ((porId.get(c.autor_id)?.display_name ?? "") as string).trim() || "Alguém",
        autorAvatar: urls[i] ?? null,
        texto: c.texto,
        criadoEm: c.criado_em,
        possoApagar: podeApagarComentario({
          euId: eu,
          autorDoComentario: c.autor_id,
          donaDoPost: post.autor_id,
        }),
      }));

    return {
      ok: true as const,
      comentarios,
      abertos: post.comentarios_abertos !== false,
      souADona: post.autor_id === eu,
    };
  });

export const comentar = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        postId: z.string().uuid(),
        texto: z.string().min(1).max(LIMITE_DO_COMENTARIO),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const texto = data.texto.trim();
    if (!texto) return { ok: false as const, motivo: "vazio" as const };

    /**
     * ⚠️ **A TRIAGEM VEM ANTES DE QUALQUER ESCRITA.** É a trava que manteve os
     * comentários fora do produto por meses; rodá-la depois do `insert` seria o
     * mesmo que não tê-la.
     */
    const desfecho = triarComentario(texto);
    if (desfecho !== "publicavel") {
      return { ok: false as const, motivo: desfecho, recado: recadoDoComentario(desfecho) };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const post = await postQueEuVejo(sb, data.postId, eu);
    if (!post) return { ok: false as const, motivo: "indisponivel" as const };
    /* ⚠️ A dona pode ter FECHADO os comentários daquele post. */
    if (post.comentarios_abertos === false) {
      return { ok: false as const, motivo: "fechados" as const };
    }

    const ontem = new Date(Date.now() - 86400_000).toISOString();
    const { count, error: erroConta } = await sb
      .from("rede_comentarios")
      .select("id", { count: "exact", head: true })
      .eq("autor_id", eu)
      .gte("criado_em", ontem);
    if (erroConta) return { ok: false as const, motivo: "banco" as const };
    if ((count ?? 0) >= COMENTARIOS_POR_DIA)
      return { ok: false as const, motivo: "muitos" as const };

    const { error } = await sb
      .from("rede_comentarios")
      .insert({ post_id: data.postId, autor_id: eu, texto });
    if (error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
  });

/**
 * APAGAR UM COMENTÁRIO.
 *
 * ⚠️ **MARCA, e não `delete`** — a mesma decisão do post. E o portão é a régua
 * pura: a autora apaga o seu, a dona do post apaga qualquer um. O `id` vem do
 * cliente, então quem confere é aqui.
 */
export const apagarComentario = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: c, error: erroLer } = await sb
      .from("rede_comentarios")
      .select("id, autor_id, post_id")
      .eq("id", data.id)
      .maybeSingle();
    if (erroLer) return { ok: false as const, motivo: "banco" as const };
    if (!c) return { ok: false as const, motivo: "nao_existe" as const };

    const { data: post, error: erroPost } = await sb
      .from("rede_posts")
      .select("autor_id")
      .eq("id", c.post_id)
      .maybeSingle();
    if (erroPost) return { ok: false as const, motivo: "banco" as const };

    if (
      !podeApagarComentario({
        euId: eu,
        autorDoComentario: c.autor_id,
        donaDoPost: post?.autor_id ?? "",
      })
    ) {
      return { ok: false as const, motivo: "nao_e_seu" as const };
    }

    const { error } = await sb
      .from("rede_comentarios")
      .update({ apagado_em: new Date().toISOString() })
      .eq("id", data.id);
    if (error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
  });

/**
 * FECHAR OU ABRIR OS COMENTÁRIOS DE UM POST.
 *
 * ⚠️ É a saída que transforma "não quero opinião nisto" numa escolha, em vez de
 * num apagar constante — e o post sobre uma perda é exatamente onde ela precisa
 * dela.
 */
export const fecharComentarios = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        postId: z.string().uuid(),
        abertos: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("rede_posts")
      .update({ comentarios_abertos: data.abertos })
      .eq("id", data.postId)
      /* ⚠️ Só a DONA fecha. O `postId` vem do cliente. */
      .eq("autor_id", eu);
    if (error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
  });

/** Denunciar um comentário — a mesma fila do resto da rede. */
export const denunciarComentario = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("rede_comentarios")
      .update({ denunciado_em: new Date().toISOString() })
      .eq("id", data.id);
    if (error) return { ok: false as const, motivo: "banco" as const };
    /* ⚠️ Resposta pelada, sem confirmar nada sobre o comentário nem sobre quem
       escreveu — a mesma decisão da denúncia da caixinha. */
    return { ok: true as const };
  });
