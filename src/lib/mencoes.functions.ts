/**
 * O @, A TROCA E A # — servidor.
 *
 * A régua (o que é um @ válido, quantas trocas cabem, quem pode mencionar, como
 * achar no texto) mora em `mencoes.ts`, pura e testada. Aqui ela vira lei.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  HANDLE_MAX,
  MENCOES_POR_POST,
  type QuemMenciona,
  TAGS_POR_POST,
  acharMencoes,
  acharTags,
  normalizarHandle,
  podeMencionar,
  podeTrocarHandle,
  recusaDoHandle,
  reservaVencida,
} from "./mencoes";
import { paraLike } from "./like-seguro";

async function pacienteDaSessao(accessToken: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any).auth.getUser(accessToken);
  return data?.user?.id ?? null;
}

/**
 * ESCOLHER OU TROCAR O @.
 *
 * ⚠️ **A CORRIDA É REAL, e quem a resolve é o índice único.** Duas pacientes
 * podem pedir `@marina` no mesmo segundo; a conferência de disponibilidade é
 * uma leitura, e entre ela e a gravação cabe a outra. O `23505` do índice é o
 * veredito — e aqui ele é RECUSA, não sucesso repetido, ao contrário da
 * `rede_atividade`.
 */
export const escolherHandle = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), handle: z.string().max(HANDLE_MAX + 5) }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const novo = normalizarHandle(data.handle);
    const recusa = recusaDoHandle(novo);
    if (recusa) return { ok: false as const, motivo: recusa };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: meu, error: erroMeu } = await sb
      .from("patient_profiles")
      .select("handle")
      .eq("id", eu)
      .maybeSingle();
    if (erroMeu) return { ok: false as const, motivo: "banco" as const };
    const antigo = (meu?.handle ?? null) as string | null;
    if (antigo && normalizarHandle(antigo) === novo) return { ok: true as const, handle: novo };

    const agora = new Date();

    /* O limite de trocas — só vale para quem JÁ tem um; a primeira escolha é
       livre, como no Instagram. */
    if (antigo) {
      const { data: trocas, error: erroTrocas } = await sb
        .from("rede_handles_antigos")
        .select("liberado_em")
        .eq("user_id", eu)
        .order("liberado_em", { ascending: false })
        .limit(10);
      if (erroTrocas) return { ok: false as const, motivo: "banco" as const };
      if (
        !podeTrocarHandle(
          ((trocas ?? []) as any[]).map((t) => t.liberado_em),
          agora,
        )
      ) {
        return { ok: false as const, motivo: "muitas_trocas" as const };
      }
    }

    /**
     * ⚠️ **A RESERVA DE OUTRA PESSOA BARRA, mas a MINHA não.** Se eu larguei
     * `@marina` ontem e quero de volta hoje, é meu direito — a reserva existe
     * para proteger as menções antigas de apontarem para ESTRANHOS, e voltar
     * para o meu próprio @ faz elas voltarem a apontar certo.
     */
    const { data: reservado, error: erroRes } = await sb
      .from("rede_handles_antigos")
      .select("user_id, liberado_em")
      .eq("handle", novo)
      .maybeSingle();
    if (erroRes) return { ok: false as const, motivo: "banco" as const };
    if (reservado && reservado.user_id !== eu && !reservaVencida(reservado.liberado_em, agora)) {
      return { ok: false as const, motivo: "reservado" as const };
    }

    const { error } = await sb.from("patient_profiles").update({ handle: novo }).eq("id", eu);
    if (error) {
      /* ⚠️ `23505` AQUI É RECUSA: outra pessoa levou o @ entre a conferência e
         a gravação. Tratar como sucesso deixaria a tela dizendo "pronto" sobre
         um nome que não é dela. */
      const code = (error as { code?: string }).code;
      return { ok: false as const, motivo: code === "23505" ? "ocupado" : "banco" };
    }

    /* O antigo entra na reserva. Falhar aqui não desfaz a troca — o @ novo já é
       dela, e o custo é o antigo ficar livre cedo. */
    if (antigo) {
      const { error: erroRe } = await sb
        .from("rede_handles_antigos")
        .upsert(
          { handle: normalizarHandle(antigo), user_id: eu, liberado_em: agora.toISOString() },
          { onConflict: "handle" },
        );
      if (erroRe) console.warn("[rede] não consegui reservar o @ antigo");
    }
    /* ⚠️ Devolve o `@` NORMALIZADO, e a tela pinta o que voltou: quem digitou
       "Marina.C" tem de ver "@marina.c" — a normalização é do servidor, e uma
       segunda cópia dela no cliente divergiria em silêncio. */
    return { ok: true as const, handle: novo };
  });

/** A configuração de quem pode mencionar. As três opções do Instagram. */
export const salvarQuemMenciona = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        valor: z.enum(["todos", "sigo", "ninguem"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("patient_profiles")
      .update({ quem_pode_mencionar: data.valor })
      .eq("id", eu);
    if (error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
  });

/**
 * GRAVA AS TAGS E AVISA AS MENCIONADAS.
 *
 * Chamada depois de publicar ou comentar. ⚠️ **Nunca antes:** avisar de uma
 * menção que não gravou é o defeito que o presente do médico já teve.
 */
export async function processarTextoDoPost(
  sb: any,
  opts: { postId: string; autorId: string; texto: string | null },
) {
  const tags = acharTags(opts.texto).slice(0, TAGS_POR_POST);
  if (tags.length > 0) {
    const { error } = await sb.from("rede_tags").upsert(
      tags.map((tag) => ({ post_id: opts.postId, tag })),
      { onConflict: "post_id,tag" },
    );
    if (error) console.warn("[rede] tags não gravadas — rode APLICAR_MENCOES_E_TAGS.sql");
  }
  await avisarMencionadas(sb, {
    texto: opts.texto,
    quemId: opts.autorId,
    postId: opts.postId,
  });
}

/**
 * ⚠️ **A CONFIGURAÇÃO DE CADA MENCIONADA É CONSULTADA, uma por uma.**
 *
 * `quem_pode_mencionar` é dela, não de quem escreve. Ignorá-la faria a chave
 * das três opções ser decoração — e o "Ninguém" existe justamente para a
 * paciente que já foi incomodada.
 *
 * ⚠️ E "sigo" é quem A MENCIONADA segue. Ver o comentário de `podeMencionar`.
 */
export async function avisarMencionadas(
  sb: any,
  opts: { texto: string | null; quemId: string; postId?: string | null },
) {
  const handles = acharMencoes(opts.texto).slice(0, MENCOES_POR_POST);
  if (handles.length === 0) return;
  try {
    const { data: gente, error } = await sb
      .from("patient_profiles")
      .select("id, handle, quem_pode_mencionar, care_mode")
      .in("handle", handles);
    if (error || !gente) return;

    const { contextoDe, registrarAtividade } = await import("./rede-social.functions");
    const ctx = await contextoDe(sb, opts.quemId);

    /**
     * ⚠️ **A MENCIONADA PRECISA PODER VER O POST, e isso não era conferido.**
     *
     * Mencionar alguém num post da camada `amigas` mandava o aviso para a caixa
     * ♡ dela — **com a capa da publicação** — sem ela poder abrir o post. E a
     * capa cai em `miniatura_path ?? imagem_path`: numa publicação anterior ao
     * recurso de miniatura, o que vazava era a FOTO DE 1080.
     *
     * ⚠️ **A régua é `podeVerPost`, a mesma de sempre.** Ela é chamada com o
     * contexto DA MENCIONADA, e não com o de quem escreveu — a pergunta é "ela
     * pode ver?", e responder com o meu contexto seria responder outra
     * pergunta.
     *
     * ⚠️ **Falha ao ler o post NÃO avisa.** Um aviso que aponta para um post
     * que ninguém conseguiu carregar é, no melhor caso, uma linha morta na
     * caixa dela; no pior, é este vazamento voltando por um erro de rede.
     */
    let post: {
      autorId: string;
      visibilidade: string;
      emCuidado: boolean;
      publico: boolean;
    } | null = null;
    if (opts.postId) {
      const { data: linha, error: erroPost } = await sb
        .from("rede_posts")
        .select("autor_id, visibilidade, arquivado_em")
        .eq("id", opts.postId)
        .maybeSingle();
      if (erroPost || !linha || linha.arquivado_em) return;
      const { data: autor } = await sb
        .from("patient_profiles")
        .select("care_mode, perfil_publico")
        .eq("id", linha.autor_id)
        .maybeSingle();
      post = {
        autorId: linha.autor_id as string,
        visibilidade: linha.visibilidade as string,
        emCuidado: !!autor?.care_mode,
        publico: !!autor?.perfil_publico,
      };
    }

    const { podeVerPost } = await import("./rede-social");

    /* ⚠️ **EM LOTE, e este laço era SEQUENCIAL.** Eram até dez menções × duas
       viagens cada (o "ela me segue?" e o contexto dela), uma esperando a
       outra: vinte idas ao banco em série pendurando a resposta de PUBLICAR.
       O aviso é acessório; a publicação é o que ela está esperando na tela.

       A ordem da régua não mudou — os portões baratos (eu mesma, bloqueio,
       Modo Cuidado) recortam ANTES de qualquer viagem, e só quem sobra custa
       consulta. */
    const candidatas = (gente as any[]).filter(
      (p) => p.id !== opts.quemId && !ctx.bloqueio.has(p.id) && !p.care_mode,
    );
    if (candidatas.length === 0) return;

    /* Uma consulta só para "quem, dentre elas, me segue" — antes era uma por
       pessoa. ⚠️ Falha de leitura vira conjunto VAZIO, e isso é fechar: sem
       saber quem me segue, quem escolheu "só quem eu sigo" não recebe aviso. */
    const { data: laços } = await sb
      .from("rede_seguidores")
      .select("seguidor_id")
      .in(
        "seguidor_id",
        candidatas.map((p) => p.id),
      )
      .eq("seguido_id", opts.quemId)
      .eq("estado", "ativo");
    const meSegue = new Set<string>(((laços ?? []) as any[]).map((l) => l.seguidor_id));

    const permitidas = candidatas.filter((p) =>
      podeMencionar({
        config: (p.quem_pode_mencionar ?? "todos") as QuemMenciona,
        mencionadaSegueQuemMenciona: meSegue.has(p.id),
      }),
    );
    if (permitidas.length === 0) return;

    /* ⚠️ O contexto é DELA — ver o bloco acima. Em PARALELO: são contextos
       independentes, e um `await` dentro do laço somava as latências. */
    const contextos = post
      ? await Promise.all(permitidas.map((p) => contextoDe(sb, p.id)))
      : permitidas.map(() => null);

    for (let k = 0; k < permitidas.length; k++) {
      const p = permitidas[k];
      const ctxDela = contextos[k];
      if (post && ctxDela) {
        const podeVer = podeVerPost({
          post: { autorId: post.autorId, visibilidade: post.visibilidade as any },
          euId: p.id,
          autor: { emCuidado: post.emCuidado, publico: post.publico },
          bloqueado: ctxDela.bloqueio.has(post.autorId),
          sigoAtivo: ctxDela.sigo.has(post.autorId),
          somosAmigas: ctxDela.amigas.has(post.autorId),
        });
        if (!podeVer) continue;
      }
      await registrarAtividade(sb, {
        donoId: p.id,
        quemId: opts.quemId,
        especie: "mencionou",
        postId: opts.postId ?? null,
      });
    }
  } catch {
    /* A publicação já existe; o aviso é o acessório. */
  }
}

/**
 * AS PUBLICAÇÕES DE UMA TAG.
 *
 * ⚠️ **SÓ AS PÚBLICAS, e o recorte é feito no SERVIDOR pela mesma régua do
 * feed.** A página da tag é uma superfície de DESCOBERTA: sem esse recorte, uma
 * publicação da camada `amigas` apareceria para qualquer pessoa que digitasse a
 * palavra certa — a porta dos fundos da visibilidade, aberta por um `#`.
 */
export const postsDaTag = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), tag: z.string().min(1).max(60) }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const tag = data.tag.trim().toLowerCase().replace(/^#/, "");
    const { data: linhas, error } = await sb
      .from("rede_tags")
      .select("post_id")
      .eq("tag", tag)
      .limit(200);
    if (error) return { ok: false as const, motivo: "banco" as const };
    const ids = ((linhas ?? []) as any[]).map((l) => l.post_id);
    if (ids.length === 0) return { ok: true as const, posts: [] };

    const { montarPosts, contextoDe, postsCrus } = await import("./rede-social.functions");
    const ctx = await contextoDe(sb, eu);
    /* ⚠️ **O `arquivado_em` É FILTRADO AQUI**, e não em `montarPosts`: a página
       da tag lê por id, e um post arquivado continua com a tag na tabela — ela
       guarda a tag de TODA publicação de propósito, porque a autora pode
       reabrir depois. */
    /**
     * ⚠️ **`postsCrus`, e NUNCA um `select` próprio.**
     *
     * Este bloco reescrevia `COLUNAS_DO_POST` à mão — a sexta cópia — e a cópia
     * já tinha divergido: faltava `alt_texto`. Pior, sem degrau de recuo e
     * descartando o `error`: num banco que ainda não rodou algum dos quatro
     * `APLICAR_` que criam essas colunas, o `42703` devolvia `data: null` e a
     * página da tag ficava VAZIA, sem erro em lugar nenhum.
     */
    const crus = await postsCrus(sb, (base: any) =>
      base.in("id", ids).is("arquivado_em", null).order("criado_em", { ascending: false }),
    );
    /* ⚠️ O filtro de PÚBLICO vem antes de montar: `montarPosts` já aplica
       `podeVerPost`, mas ele deixaria passar o post de uma amiga — e a página
       da tag não é o feed dela. */
    const somentePublicos = crus.filter((p: any) => p.visibilidade === "publico");
    const posts = await montarPosts(sb, eu, somentePublicos, ctx);
    return { ok: true as const, posts };
  });

/**
 * O `@` VIRA UM PERFIL.
 *
 * ⚠️ **Só resolve o endereço — NÃO decide se ela pode ver.** Quem decide é
 * `verPerfil`, que já sabe distinguir "não existe" de "fechado" de "Modo
 * Cuidado". Duplicar aqui qualquer parte daquela régua criaria a segunda
 * versão que este projeto proíbe desde `podeVerPost`, e a divergência
 * apareceria como perfil abrindo pela porta lateral.
 *
 * ⚠️ **E O `@` ANTIGO CONTINUA LEVANDO À DONA DELE, durante a reserva.** Uma
 * menção escrita ontem aponta para o apelido de ontem; sem esta segunda
 * leitura, trocar de `@` quebraria toda menção já publicada — que é exatamente
 * o que a reserva de 14 dias existe para impedir.
 */
export const perfilPorHandle = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), handle: z.string().min(1).max(80) }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    /* ⚠️ **`_` É CURINGA NO `LIKE`, E `_` É LETRA VÁLIDA NUM `@`.** Sem
       escapar, `@marina_c` casaria `marinaXc` — e o toque na menção abriria o
       perfil de outra pessoa. É o mesmo vazamento do e-mail da influenciadora,
       aqui com uma chance a mais de acontecer, porque o `_` é comum em apelido. */
    const alvo = normalizarHandle(data.handle);
    if (!alvo) return { ok: false as const, motivo: "nao_achei" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: atual, error } = await sb
      .from("patient_profiles")
      .select("id")
      .ilike("handle", paraLike(alvo))
      .maybeSingle();
    /* ⚠️ Falha de leitura NÃO vira "não achei": a tela diria que a pessoa não
       existe por causa de um timeout, e quem lê uma menção concluiria que a
       amiga apagou a conta. */
    if (error) return { ok: false as const, motivo: "banco" as const };
    if (atual?.id) return { ok: true as const, id: atual.id as string };

    const { data: velho } = await sb
      .from("rede_handles_antigos")
      .select("user_id, liberado_em")
      .ilike("handle", paraLike(alvo))
      .order("liberado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (velho?.user_id && !reservaVencida(velho.liberado_em, new Date())) {
      return { ok: true as const, id: velho.user_id as string };
    }
    return { ok: false as const, motivo: "nao_achei" as const };
  });
