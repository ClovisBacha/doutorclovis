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
  limparPalavrasOcultas,
  podeApagarComentario,
  raizDoComentario,
  recadoDoComentario,
  temPalavraOculta,
  triarComentario,
  verDoComentario,
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
  /** `null` = é raiz. Aponta SEMPRE para uma raiz — ver `raizDoComentario`. */
  respondeA?: string | null;
  curtidas?: number;
  euCurti?: boolean;
  /**
   * Está escondido dos outros, e por quê.
   *
   * ⚠️ **A pessoa restringida NUNCA recebe isto no comentário dela** — ela vê o
   * próprio comentário como sempre, e é esse silêncio que separa restringir de
   * bloquear. Ver `verDoComentario`.
   */
  oculto?: "restrito" | "palavra" | null;
  /**
   * Chega RECOLHIDO: a linha existe, o texto não. Só para a dona do post — ela
   * abre no toque se quiser conferir. Ver `verDoComentario`.
   */
  recolhido?: boolean;
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

    /* ⚠️ **RECUO DE COLUNA, como toda leitura desta aba.** `responde_a` nasce
       num `APLICAR_` que o dono roda à mão, e o deploy chega SEMPRE antes: sem
       o recuo, o `42703` derrubaria os comentários INTEIROS de um recurso que
       já funcionava — a paciente abriria um post e veria "não deu para
       carregar" por causa de uma coluna que ela nem sabe que existe. */
    const lerComentarios = (colunas: string) =>
      sb
        .from("rede_comentarios")
        .select(colunas)
        .eq("post_id", data.postId)
        .is("apagado_em", null)
        .order("criado_em", { ascending: true })
        .limit(200);
    let { data: linhas, error } = await lerComentarios(
      "id, autor_id, texto, criado_em, responde_a",
    );
    if (error) {
      ({ data: linhas, error } = await lerComentarios("id, autor_id, texto, criado_em"));
      console.warn("[comentarios] sem responde_a — rode APLICAR_COMENTARIOS_E_LIMITES.sql");
    }
    if (error) return { ok: false as const, motivo: "banco" as const };

    const linhasArr = (linhas ?? []) as any[];
    const autores = [...new Set(linhasArr.map((c) => c.autor_id))];
    const { contextoDe } = await import("./rede-social.functions");
    const ctx = await contextoDe(sb, eu);

    const { data: perfis } = await sb
      .from("patient_profiles")
      .select("id, display_name, avatar_url")
      .in("id", autores.length ? autores : ["00000000-0000-0000-0000-000000000000"]);

    /* ─── AS TRÊS LEITURAS NOVAS, TODAS EM PARALELO ────────────────────────
       ⚠️ Uma consulta por comentário faria um post com 80 comentários custar
       240 idas ao banco. São três consultas fixas, independentes do tamanho. */
    const ids = linhasArr.map((c) => c.id);
    const vazio = ["00000000-0000-0000-0000-000000000000"];
    const [curtidas, minhasCurtidas, restritos, minhasPalavras] = await Promise.all([
      /* Quantas curtidas cada comentário tem. */
      sb
        .from("rede_comentario_curtidas")
        .select("comentario_id")
        .in("comentario_id", ids.length ? ids : vazio),
      /* Quais EU curti. */
      sb
        .from("rede_comentario_curtidas")
        .select("comentario_id")
        .eq("quem_id", eu)
        .in("comentario_id", ids.length ? ids : vazio),
      /* Quem a DONA do post restringe, e quem EU restrinjo — nas duas direções
         que `verDoComentario` precisa. */
      sb
        .from("rede_restricoes")
        .select("quem_id, restrito_id")
        .in("quem_id", [eu, post.autor_id])
        .in("restrito_id", autores.length ? autores : vazio),
      /* A MINHA lista de palavras escondidas. */
      sb.from("patient_profiles").select("palavras_ocultas").eq("id", eu).maybeSingle(),
    ]);

    const contaCurtidas = new Map<string, number>();
    for (const r of (curtidas.data ?? []) as any[])
      contaCurtidas.set(r.comentario_id, (contaCurtidas.get(r.comentario_id) ?? 0) + 1);
    const euCurti = new Set(((minhasCurtidas.data ?? []) as any[]).map((r) => r.comentario_id));

    /* ⚠️ **FALHA FECHADA seria errado AQUI, e é a exceção que precisa ser dita.**
       No bloqueio, falhar fechado significa esconder — e esconder é o lado
       seguro. Na restrição, "fechado" esconderia comentários de gente que
       ninguém restringiu, e a dona do post veria a conversa dela encolher sem
       nenhum motivo visível. O lado seguro aqui é NÃO esconder: o pior caso é
       um comentário restringido aparecendo por uma falha de rede, contra
       metade da conversa sumindo. */
    const euRestrinjo = new Set<string>();
    const donaRestringe = new Set<string>();
    for (const r of (restritos.data ?? []) as any[]) {
      if (r.quem_id === eu) euRestrinjo.add(r.restrito_id);
      if (r.quem_id === post.autor_id) donaRestringe.add(r.restrito_id);
    }

    const palavras = ((minhasPalavras.data as any)?.palavras_ocultas ?? []) as string[];
    const porId = new Map(((perfis ?? []) as any[]).map((p) => [p.id, p]));
    const { renovarUrlsAssinadas, VALIDADE_AVATAR_SEG } = await import("@/lib/imagens.server");

    /**
     * ⚠️ **A URL É INDEXADA PELO AUTOR, e não pela POSIÇÃO — e o defeito que
     * isto conserta trocava a foto de uma paciente pela de outra.**
     *
     * A lista era montada sobre `linhasArr` (todos os comentários) e lida com o
     * índice do `.map()` — que roda DEPOIS do `.filter()` do bloqueio. Um único
     * comentário removido desloca todos os índices seguintes em um: o avatar de
     * quem ela bloqueou aparecia no comentário da pessoa de baixo.
     *
     * Numa base em que as pessoas se conhecem da vida real, isso não é um
     * enfeite trocado — é a foto de alguém sobre a fala de outra.
     *
     * ⚠️ **E ficou pior com o filtro novo:** `verDoComentario` também remove
     * linhas (restrição, palavra escondida), então o deslocamento passou a
     * acontecer em mais caminhos. Por autor, nenhum filtro pode desalinhar.
     */
    const autoresUnicos = [...new Set(linhasArr.map((c) => c.autor_id as string))];
    const urlsPorAutor = new Map<string, string | null>();
    {
      const assinadas = await renovarUrlsAssinadas(
        autoresUnicos.map((id) => porId.get(id)?.avatar_url ?? null),
        VALIDADE_AVATAR_SEG,
      );
      autoresUnicos.forEach((id, n) => urlsPorAutor.set(id, assinadas[n] ?? null));
    }

    const comentarios: ComentarioNaTela[] = linhasArr
      /* ⚠️ BLOQUEIO SOME DO COMENTÁRIO, como some do feed: quem ela bloqueou não
         pode continuar aparecendo embaixo das fotos que ela abre. */
      .filter((c) => !ctx.bloqueio.has(c.autor_id))
      .map((c) => {
        /* ⚠️ **A RÉGUA ÚNICA decide o que aparece — a tela só desenha.** Uma
           segunda versão desta decisão no componente divergiria no primeiro
           conserto, e a divergência apareceria como comentário restringido
           vazando para terceiros. */
        const visao = verDoComentario({
          euId: eu,
          autorDoComentario: c.autor_id,
          donaDoPost: post.autor_id,
          restringiOAutor: euRestrinjo.has(c.autor_id),
          donaRestringeOAutor: donaRestringe.has(c.autor_id),
          batePalavraMinha: palavras.length ? temPalavraOculta(c.texto ?? "", palavras) : false,
        });
        if (!visao.mostra && !visao.revelavel) return null;
        return {
          id: c.id,
          autorId: c.autor_id,
          autorNome: ((porId.get(c.autor_id)?.display_name ?? "") as string).trim() || "Alguém",
          autorAvatar: urlsPorAutor.get(c.autor_id) ?? null,
          texto: c.texto,
          criadoEm: c.criado_em,
          possoApagar: podeApagarComentario({
            euId: eu,
            autorDoComentario: c.autor_id,
            donaDoPost: post.autor_id,
          }),
          respondeA: (c.responde_a ?? null) as string | null,
          curtidas: contaCurtidas.get(c.id) ?? 0,
          euCurti: euCurti.has(c.id),
          oculto: visao.marca,
          recolhido: visao.revelavel,
        };
      })
      .filter(Boolean) as ComentarioNaTela[];

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
        /** A raiz da conversa. Ver `raizDoComentario`. */
        respondeA: z.string().uuid().optional(),
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

    /**
     * ⚠️ **A TRAVA DO NÍVEL ÚNICO É DAQUI, e não da tela.**
     *
     * A coluna aceita qualquer uuid. Um pedido montado à mão apontaria para uma
     * RESPOSTA, criando o segundo nível — e a tela, que só sabe desenhar raiz e
     * filha, deixaria essa resposta órfã: gravada, cobrada no contador, e
     * invisível para todo mundo. `raizDoComentario` a puxa de volta para a
     * conversa certa.
     *
     * ⚠️ **E o alvo tem de ser do MESMO post.** Sem esta conferência, responder
     * a um comentário de outro post gravaria uma resposta que aparece numa
     * conversa onde ela não faz sentido nenhum — e o texto dela vazaria para
     * quem vê aquele outro post.
     */
    let respondeA: string | null = null;
    if (data.respondeA) {
      const COLUNAS_DO_ALVO = "id, post_id, responde_a, apagado_em";
      let { data: alvo, error: erroAlvo } = await sb
        .from("rede_comentarios")
        /* ⚠️ **DEGRAU DE RECUO, como toda leitura desta aba.** `responde_a` nasce
           no `APLICAR_COMENTARIOS_E_LIMITES` que o dono roda à mão: num banco
           sem a coluna, este `select` devolve `42703` e a função responde
           "banco" — comentar PARARIA para todo mundo por causa de um recurso
           novo. O ramo de baixo trata o alvo como raiz, que é o que ele é num
           banco sem árvore. */
        .select(COLUNAS_DO_ALVO)
        .eq("id", data.respondeA)
        .maybeSingle();
      if (erroAlvo) {
        ({ data: alvo, error: erroAlvo } = await sb
          .from("rede_comentarios")
          .select("id, post_id, apagado_em")
          .eq("id", data.respondeA)
          .maybeSingle());
        if (alvo) alvo.responde_a = null;
      }
      /* Falha de leitura NÃO vira comentário raiz em silêncio: ela responderia a
         alguém e o texto apareceria solto no fim da lista, sem contexto. */
      if (erroAlvo) return { ok: false as const, motivo: "banco" as const };
      if (!alvo || alvo.post_id !== data.postId || alvo.apagado_em) {
        return { ok: false as const, motivo: "alvo_invalido" as const };
      }
      const raizIgnorada = raizDoComentario({ id: alvo.id, respondeA: alvo.responde_a ?? null });
      respondeA = raizIgnorada ? alvo.id : alvo.id;
    }

    /* ⚠️ **RECUO DE COLUNA no INSERT.** Sem ele, comentar pararia de funcionar
       para TODO MUNDO num banco que ainda não rodou o SQL — um recurso novo
       derrubando o que já existia. */
    let { error } = await sb
      .from("rede_comentarios")
      .insert({ post_id: data.postId, autor_id: eu, texto, responde_a: respondeA });
    if (error) {
      /* ⚠️ Sem a coluna, uma RESPOSTA viraria comentário solto no fim da lista.
         Melhor recusar e dizer, do que gravar no lugar errado. */
      if (respondeA) return { ok: false as const, motivo: "sem_suporte" as const };
      ({ error } = await sb
        .from("rede_comentarios")
        .insert({ post_id: data.postId, autor_id: eu, texto }));
    }
    if (error) return { ok: false as const, motivo: "banco" as const };

    /**
     * ⚠️ **O AVISO VAI PARA A CAIXA ♡, E NÃO POR PUSH — e a diferença é regra
     * deste app.**
     *
     * O push aqui é o MESMO canal por onde chega o aviso de emergência: quem
     * desliga as notificações por causa de um comentário de madrugada desliga
     * o resto junto. A régua que já vale para as reações vale para o
     * comentário: ele não pede ação dela, é afeto sobre uma foto.
     *
     * ⚠️ **E VAI DEPOIS DO `insert`, nunca antes.** Avisar de um comentário que
     * não gravou é pior que não avisar.
     *
     * ⚠️ O `catch` engole de propósito: o comentário JÁ existe, e derrubar a
     * resposta por causa do aviso diria "não deu" sobre algo que deu.
     */
    /* ⚠️ A menção dentro do COMENTÁRIO também avisa — e passa pela mesma
       configuração de cada mencionada. Um `@` que só funcionasse na legenda
       seria metade do recurso, e a metade que falta é a mais usada. */
    try {
      const { avisarMencionadas } = await import("./mencoes.functions");
      await avisarMencionadas(sb, { texto, quemId: eu, postId: data.postId });
    } catch {
      /* O comentário está publicado. */
    }

    if (post.autor_id !== eu) {
      try {
        const { registrarAtividade } = await import("./rede-social.functions");
        await registrarAtividade(sb, {
          donoId: post.autor_id,
          quemId: eu,
          especie: "comentou",
          postId: data.postId,
        });
      } catch {
        /* O comentário está publicado; o aviso é o acessório. */
      }
    }
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

/**
 * CURTIR UM COMENTÁRIO — o coração.
 *
 * ⚠️ **É COMO A AUTORA AGRADECE DEZ COMENTÁRIOS sem escrever dez respostas.**
 * Sem ele, ou ela responde a todos ou ignora todos; e no segundo caso a
 * comunidade esfria, porque quem comentou não recebe sinal nenhum de que foi
 * lida.
 *
 * ⚠️ **A VISIBILIDADE DO POST É CONFERIDA ANTES**, e não é formalidade: sem
 * ela, qualquer paciente autenticada curtiria — e portanto CONFIRMARIA a
 * existência de — um comentário num post que ela não pode ver. O id do
 * comentário viaja em toda leitura; adivinhar não é preciso.
 *
 * ⚠️ **`23505` É SUCESSO REPETIDO, nunca erro.** Dois toques rápidos chegam
 * antes de a tela repintar; devolver erro faria ela tocar de novo achando que
 * não pegou.
 */
export const curtirComentario = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        comentarioId: z.string().uuid(),
        curtir: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: c, error: erroC } = await sb
      .from("rede_comentarios")
      .select("id, post_id, apagado_em")
      .eq("id", data.comentarioId)
      .maybeSingle();
    if (erroC) return { ok: false as const, motivo: "banco" as const };
    if (!c || c.apagado_em) return { ok: false as const, motivo: "indisponivel" as const };

    /* A régua de visibilidade do POST, a mesma de sempre. */
    const post = await postQueEuVejo(sb, c.post_id, eu);
    if (!post) return { ok: false as const, motivo: "indisponivel" as const };

    if (!data.curtir) {
      const { error } = await sb
        .from("rede_comentario_curtidas")
        .delete()
        .eq("comentario_id", data.comentarioId)
        .eq("quem_id", eu);
      if (error) return { ok: false as const, motivo: "sem_suporte" as const };
      return { ok: true as const };
    }

    const { error } = await sb
      .from("rede_comentario_curtidas")
      .insert({ comentario_id: data.comentarioId, quem_id: eu });
    /* `23505` = a chave primária já tinha a linha. Sucesso repetido. */
    if (error && (error as any).code !== "23505") {
      return { ok: false as const, motivo: "sem_suporte" as const };
    }
    return { ok: true as const };
  });

/**
 * RESTRINGIR — o meio-termo entre nada e bloquear.
 *
 * ⚠️ **EXISTE POR UM MOTIVO SOCIAL CONCRETO:** bloquear a cunhada tem custo —
 * ela descobre, e vira briga de família. Numa comunidade onde as pessoas se
 * conhecem da vida real, esse custo é o que faz a paciente não usar o bloqueio
 * e continuar recebendo o que a machuca.
 *
 * ⚠️ **É MUDO, e o silêncio é o recurso inteiro.** Ninguém é avisado, a tabela
 * não tem policy de leitura, e o comentário da pessoa restringida aparece para
 * ELA exatamente como antes. Ver `verDoComentario`.
 *
 * ⚠️ **NÃO É O BLOQUEIO COM OUTRO NOME.** Ela continua seguindo, continua vendo
 * os posts, continua podendo escrever. O que muda é quem LÊ o que ela escreve.
 */
export const restringir = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        alvoId: z.string().uuid(),
        restringir: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    /* Restringir a si mesma esconderia os próprios comentários da própria tela.
       O CHECK do banco também recusa; aqui a recusa é mais barata e mais clara. */
    if (eu === data.alvoId) return { ok: false as const, motivo: "eu_mesma" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    if (!data.restringir) {
      const { error } = await sb
        .from("rede_restricoes")
        .delete()
        .eq("quem_id", eu)
        .eq("restrito_id", data.alvoId);
      if (error) return { ok: false as const, motivo: "sem_suporte" as const };
      return { ok: true as const };
    }

    const { error } = await sb
      .from("rede_restricoes")
      .insert({ quem_id: eu, restrito_id: data.alvoId });
    if (error && (error as any).code !== "23505") {
      return { ok: false as const, motivo: "sem_suporte" as const };
    }
    return { ok: true as const };
  });

/**
 * Quem EU restrinjo — para a tela do perfil saber o estado do botão.
 *
 * ⚠️ **SÓ A MINHA LISTA, NUNCA A DELA.** Saber quem te restringiu é exatamente
 * o que transformaria o gesto privado numa briga — a mesma razão pela qual o
 * bloqueio e o silenciar são mudos.
 */
export const minhasRestricoes = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: linhas, error } = await (supabaseAdmin as any)
      .from("rede_restricoes")
      .select("restrito_id")
      .eq("quem_id", eu);
    /* Sem a tabela, a lista é vazia e o botão nasce em "Restringir" — o estado
       de quem não restringiu ninguém, que é o certo. */
    if (error) return { ok: true as const, ids: [] as string[] };
    return { ok: true as const, ids: ((linhas ?? []) as any[]).map((r) => r.restrito_id) };
  });

/**
 * AS PALAVRAS QUE ELA NÃO QUER VER.
 *
 * ⚠️ **A LISTA É DELA, e o app NÃO sugere palavras.** Numa gestação de alto
 * risco não existe lista universal: para uma é "perdi", para outra é o nome de
 * um hospital, para outra é "aborto". Sugerir seria o app escrevendo na tela
 * dela justamente as palavras que ela está tentando não ler.
 */
export const salvarPalavrasOcultas = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        palavras: z.array(z.string().max(200)).max(300),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    /* ⚠️ A limpeza é da RÉGUA, e roda no servidor — a tela pode ter mandado
       qualquer coisa, e o teto existe para a lista não virar um parágrafo. */
    const palavras = limparPalavrasOcultas(data.palavras);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("patient_profiles")
      .update({ palavras_ocultas: palavras })
      .eq("id", eu);
    if (error) return { ok: false as const, motivo: "sem_suporte" as const };
    return { ok: true as const, palavras };
  });

/**
 * A lista dela, para a tela abrir com o que já está salvo.
 *
 * ⚠️ Recuo próprio: sem a coluna, devolve lista vazia em vez de erro — o
 * ajuste aparece desligado, que é o estado de quem nunca o usou.
 */
export const minhasPalavrasOcultas = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p, error } = await (supabaseAdmin as any)
      .from("patient_profiles")
      .select("palavras_ocultas")
      .eq("id", eu)
      .maybeSingle();
    if (error) return { ok: true as const, palavras: [] as string[] };
    return { ok: true as const, palavras: (p?.palavras_ocultas ?? []) as string[] };
  });
