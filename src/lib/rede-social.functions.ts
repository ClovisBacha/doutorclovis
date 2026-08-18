/**
 * A REDE SOCIAL — o lado do servidor.
 *
 * As réguas moram em `rede-social.ts`, testadas sem banco. Aqui fica o que
 * exige o servidor: provar quem é quem, montar o contexto de visibilidade, e
 * nunca devolver mais do que quem pergunta pode ver.
 *
 * ─── ⚠️ POR QUE A LEITURA NÃO É RLS ────────────────────────────────────────
 *
 * Saber se eu posso ver um post cruza QUATRO coisas: o Modo Cuidado do autor, o
 * bloqueio nos dois sentidos, o seguir, e o grafo de amizade que já existe. Uma
 * policy de RLS que fizesse isso duplicaria `podeVerPost` em SQL, e as duas
 * divergiriam no primeiro conserto — com a divergência aparecendo como POST
 * VAZANDO, não como erro. Aqui a régua é chamada uma vez, do TypeScript.
 *
 * ─── ⚠️ O CONTEXTO É CARREGADO UMA VEZ, NÃO POR POST ───────────────────────
 *
 * `contextoDe` lê de uma vez: quem eu sigo, quem me bloqueou, quem eu bloqueei
 * e quem são minhas amigas. Perguntar isso por post faria um feed de vinte
 * posts custar oitenta consultas — e o feed é a tela mais aberta do app.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  aoSeguir,
  LIMITE_DA_BIO,
  LIMITE_DO_TEXTO,
  MINIMO_DA_BUSCA,
  normalizarBusca,
  ordenarFeed,
  podeAparecerNaBusca,
  podeVerPost,
  POSTS_POR_PAGINA,
  postEhValido,
  reacaoConhecida,
  REACOES,
  type ContagemDeReacoes,
  type TipoDeReacao,
  type EspecieDeAviso,
  type Visibilidade,
} from "@/lib/rede-social";

export type PostNaTela = {
  id: string;
  autorId: string;
  autorNome: string;
  autorAvatar: string | null;
  texto: string | null;
  /** A PRIMEIRA foto — é ela que a grade e a prévia usam. */
  imagemUrl: string | null;
  /**
   * O carrossel inteiro, a primeira inclusa.
   *
   * ⚠️ Sempre preenchido quando há foto: um post de foto única é um carrossel
   * de uma. A tela decide mostrar os pontinhos por `length > 1`, e nunca por
   * um segundo campo booleano que um dia discordaria da lista.
   */
  imagens: string[];
  visibilidade: Visibilidade;
  criadoEm: string;
  reacoes: ContagemDeReacoes;
  /** A minha, para o botão já nascer aceso. */
  minhaReacao: TipoDeReacao | null;
  souAAutora: boolean;
  /**
   * Guardei este post?
   *
   * ⚠️ Vem do servidor junto com o post, e não de uma segunda consulta que a
   * tela faria depois. Sem ele o marcador nasceria apagado em toda abertura e
   * quem já tinha salvado salvaria de novo — o `upsert` aguenta, mas a tela
   * estaria mentindo sobre o que ela já fez.
   */
  salvo: boolean;
};

export type PerfilNaTela = {
  id: string;
  nome: string;
  bio: string | null;
  avatarUrl: string | null;
  publico: boolean;
  /** `null` = não sigo. */
  meuVinculo: "ativo" | "pendente" | null;
  souEu: boolean;
  /** ⚠️ Só a DONA vê. Não existe contador público de seguidores — ver a régua. */
  meusSeguidores: number | null;
};

async function pacienteDaSessao(accessToken: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.auth.getUser(accessToken);
  return data.user?.id ?? null;
}

/** Tudo que a visibilidade precisa, numa leva só. */
type Contexto = {
  sigo: Set<string>;
  bloqueio: Set<string>;
  amigas: Set<string>;
};

async function contextoDe(sb: any, eu: string): Promise<Contexto> {
  const [{ data: seguindo }, { data: bloqMeus }, { data: bloqDeles }] = await Promise.all([
    sb.from("rede_seguidores").select("seguido_id").eq("seguidor_id", eu).eq("estado", "ativo"),
    sb.from("rede_bloqueios").select("bloqueado_id").eq("quem_id", eu),
    sb.from("rede_bloqueios").select("quem_id").eq("bloqueado_id", eu),
  ]);

  /* ⚠️ O bloqueio entra nos DOIS sentidos no mesmo Set. Guardar só o meu
     deixaria quem me bloqueou continuar aparecendo no meu feed — e a palavra
     "bloquear" promete que nenhuma das duas vê a outra. */
  const bloqueio = new Set<string>();
  for (const b of (bloqMeus ?? []) as { bloqueado_id: string }[]) bloqueio.add(b.bloqueado_id);
  for (const b of (bloqDeles ?? []) as { quem_id: string }[]) bloqueio.add(b.quem_id);

  /* O grafo de amizade é o que JÁ EXISTE. Reusar `idsDasAmigas` em vez de
     recriar: duas réguas de "quem é amiga" divergiriam, e aqui a divergência
     apareceria como post da camada restrita vazando. */
  let amigas = new Set<string>();
  try {
    const { idsDasAmigas } = await import("@/lib/amigas.functions");
    const r = await idsDasAmigas(sb, eu);
    amigas = r.todas instanceof Set ? r.todas : new Set(r.todas as string[]);
  } catch {
    /* Sem o grafo, a camada `amigas` fecha em vez de abrir. Errar para o lado
       de não mostrar é a única direção segura numa régua de visibilidade. */
  }

  return {
    sigo: new Set(((seguindo ?? []) as { seguido_id: string }[]).map((s) => s.seguido_id)),
    bloqueio,
    amigas,
  };
}

/** Perfis por id, com o que a rede precisa. */
async function perfisPorId(sb: any, ids: string[]) {
  if (ids.length === 0) return new Map<string, any>();
  const { data } = await sb
    .from("patient_profiles")
    .select("id, display_name, avatar_url, bio, perfil_publico, care_mode")
    .in("id", ids);
  return new Map(((data ?? []) as any[]).map((p) => [p.id, p]));
}

/** Reações de vários posts, agrupadas. */
async function reacoesDe(sb: any, postIds: string[], eu: string) {
  if (postIds.length === 0) {
    return {
      porPost: new Map<string, ContagemDeReacoes>(),
      minhas: new Map<string, TipoDeReacao>(),
    };
  }
  const { data } = await sb
    .from("rede_reacoes")
    .select("post_id, quem_id, tipo")
    .in("post_id", postIds);

  const porPost = new Map<string, ContagemDeReacoes>();
  const minhas = new Map<string, TipoDeReacao>();
  for (const r of (data ?? []) as { post_id: string; quem_id: string; tipo: TipoDeReacao }[]) {
    const c = porPost.get(r.post_id) ?? {};
    c[r.tipo] = (c[r.tipo] ?? 0) + 1;
    porPost.set(r.post_id, c);
    if (r.quem_id === eu) minhas.set(r.post_id, r.tipo);
  }
  return { porPost, minhas };
}

/** Quais destes eu já guardei. Uma consulta só, como a das reações. */
async function salvosDe(sb: any, postIds: string[], eu: string): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();
  const { data } = await sb
    .from("rede_salvos")
    .select("post_id")
    .eq("quem_id", eu)
    .in("post_id", postIds);
  return new Set(((data ?? []) as { post_id: string }[]).map((l) => l.post_id));
}

/** Monta os posts para a tela, já filtrados pela régua. */
async function montarPosts(
  sb: any,
  eu: string,
  brutos: any[],
  ctx: Contexto,
): Promise<PostNaTela[]> {
  const autores = await perfisPorId(sb, [...new Set(brutos.map((p) => p.autor_id))]);

  const visiveis = brutos.filter((p) => {
    const a = autores.get(p.autor_id);
    if (!a) return false;
    return podeVerPost({
      post: { autorId: p.autor_id, visibilidade: p.visibilidade },
      euId: eu,
      autor: { emCuidado: !!a.care_mode, publico: !!a.perfil_publico },
      bloqueado: ctx.bloqueio.has(p.autor_id),
      sigoAtivo: ctx.sigo.has(p.autor_id),
      somosAmigas: ctx.amigas.has(p.autor_id),
    });
  });

  /* Reações e salvos em PARALELO: duas consultas independentes, e em série a
     segunda só sairia depois de a primeira voltar. */
  const [{ porPost, minhas }, salvos] = await Promise.all([
    reacoesDe(
      sb,
      visiveis.map((p) => p.id),
      eu,
    ),
    salvosDe(
      sb,
      visiveis.map((p) => p.id),
      eu,
    ),
  ]);

  const { urlAssinada } = await import("@/lib/imagens.server");
  return Promise.all(
    visiveis.map(async (p) => {
      const a = autores.get(p.autor_id);
      /* ⚠️ `imagem_path` é a primeira e `imagens` são as DEMAIS — a coluna
         nasceu depois, e os posts antigos têm o array vazio. Juntar aqui é o
         que faz o post antigo e o novo terem a mesma forma na tela; sem isso a
         tela precisaria de um `if` para cada caso. */
      const caminhos = [p.imagem_path, ...((p.imagens ?? []) as string[])].filter(
        Boolean,
      ) as string[];
      const urls = (await Promise.all(caminhos.map((c) => urlAssinada("rede", c, 3600)))).filter(
        Boolean,
      ) as string[];
      return {
        id: p.id,
        autorId: p.autor_id,
        autorNome: (a?.display_name ?? "").trim() || "Alguém",
        autorAvatar: a?.avatar_url ?? null,
        texto: p.texto ?? null,
        imagemUrl: urls[0] ?? null,
        imagens: urls,
        visibilidade: p.visibilidade,
        criadoEm: p.criado_em,
        reacoes: porPost.get(p.id) ?? {},
        minhaReacao: minhas.get(p.id) ?? null,
        souAAutora: p.autor_id === eu,
        salvo: salvos.has(p.id),
      };
    }),
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PERFIL
   ══════════════════════════════════════════════════════════════════════════ */

/** As configurações do meu perfil social. */
export const meuPerfilSocial = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const [{ data: p }, { count: seguidores }, { data: pendentes }] = await Promise.all([
      sb
        .from("patient_profiles")
        .select("display_name, avatar_url, bio, perfil_publico, care_mode")
        .eq("id", eu)
        .maybeSingle(),
      sb
        .from("rede_seguidores")
        .select("id", { count: "exact", head: true })
        .eq("seguido_id", eu)
        .eq("estado", "ativo"),
      sb
        .from("rede_seguidores")
        .select("seguidor_id, criado_em")
        .eq("seguido_id", eu)
        .eq("estado", "pendente")
        .order("criado_em", { ascending: false })
        .limit(50),
    ]);

    const quemPediu = await perfisPorId(
      sb,
      ((pendentes ?? []) as { seguidor_id: string }[]).map((x) => x.seguidor_id),
    );

    return {
      ok: true as const,
      perfil: {
        id: eu,
        nome: ((p as any)?.display_name ?? "").trim() || "Você",
        bio: (p as any)?.bio ?? null,
        avatarUrl: (p as any)?.avatar_url ?? null,
        publico: !!(p as any)?.perfil_publico,
        meuVinculo: null,
        souEu: true,
        meusSeguidores: seguidores ?? 0,
      } as PerfilNaTela,
      emCuidado: !!(p as any)?.care_mode,
      pedidos: ((pendentes ?? []) as { seguidor_id: string }[])
        .map((x) => {
          const q = quemPediu.get(x.seguidor_id);
          /* Quem entrou em Modo Cuidado some da fila de pedidos, sem aviso. */
          if (!q || q.care_mode) return null;
          return {
            id: x.seguidor_id,
            nome: (q.display_name ?? "").trim() || "Alguém",
            avatarUrl: q.avatar_url ?? null,
          };
        })
        .filter(Boolean),
    };
  });

/** Ligar/desligar o perfil público e escrever a bio. */
export const salvarPerfilSocial = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        publico: z.boolean().optional(),
        bio: z.string().max(LIMITE_DA_BIO).nullable().optional(),
        nome: z.string().max(60).optional(),
        /** Data URL. O cliente já corta o quadrado e reduz para 512px. */
        avatar: z.string().max(1_500_000).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* ⚠️ A foto vai para o balde `rede`, como as dos posts — e NÃO como data
       URL na coluna. `avatar_url` já aceita data URL neste app (é assim que o
       `campo-foto.tsx` grava), mas uma foto de perfil viaja em TODA leitura de
       lista: `minhasAmigas`, a lista de seguidores, cada post do feed. Em base64
       ela custa ~35% a mais e vai inteira em cada linha; como caminho no balde,
       vai uma URL assinada. */
    let avatarUrl: string | null | undefined = undefined;
    if (data.avatar !== undefined) {
      if (data.avatar === null) {
        avatarUrl = null;
      } else {
        const { guardarImagem, urlAssinada } = await import("@/lib/imagens.server");
        const caminho = await guardarImagem({
          balde: "rede",
          donoId: eu,
          dataUrl: data.avatar,
        });
        if (!caminho) return { ok: false as const, motivo: "imagem" as const };
        /* Validade longa: o avatar aparece em toda tela, e uma URL de 1h faria
           a foto sumir no meio da sessão. Uma semana, e a próxima leitura
           renova. */
        avatarUrl = await urlAssinada("rede", caminho, 7 * 24 * 3600);
      }
    }

    const { error } = await sb
      .from("patient_profiles")
      .update({
        ...(data.publico !== undefined ? { perfil_publico: data.publico } : {}),
        ...(data.bio !== undefined ? { bio: data.bio } : {}),
        ...(data.nome !== undefined && data.nome.trim() ? { display_name: data.nome.trim() } : {}),
        ...(avatarUrl !== undefined ? { avatar_url: avatarUrl } : {}),
      })
      .eq("id", eu);
    if (error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
  });

/** O perfil de outra pessoa, com os posts que eu posso ver. */
export const verPerfil = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), alvoId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const ctx = await contextoDe(sb, eu);
    const perfis = await perfisPorId(sb, [data.alvoId]);
    const a = perfis.get(data.alvoId);

    /* ⚠️ As três recusas devolvem o MESMO `indisponivel`: perfil inexistente,
       bloqueio e Modo Cuidado. Distinguir contaria à bloqueada que ela foi
       bloqueada, e contaria a perda de quem entrou em luto. */
    if (!a || a.care_mode || (ctx.bloqueio.has(data.alvoId) && data.alvoId !== eu)) {
      return { ok: false as const, motivo: "indisponivel" as const };
    }

    const { data: vinculo } = await sb
      .from("rede_seguidores")
      .select("estado")
      .eq("seguidor_id", eu)
      .eq("seguido_id", data.alvoId)
      .maybeSingle();

    const { data: brutos } = await sb
      .from("rede_posts")
      .select("id, autor_id, texto, imagem_path, imagens, visibilidade, criado_em")
      .eq("autor_id", data.alvoId)
      .is("arquivado_em", null)
      .order("criado_em", { ascending: false })
      .limit(POSTS_POR_PAGINA);

    const posts = await montarPosts(sb, eu, (brutos ?? []) as any[], ctx);

    const perfil: PerfilNaTela = {
      id: data.alvoId,
      nome: (a.display_name ?? "").trim() || "Alguém",
      bio: a.bio ?? null,
      avatarUrl: a.avatar_url ?? null,
      publico: !!a.perfil_publico,
      meuVinculo: ((vinculo as any)?.estado as "ativo" | "pendente") ?? null,
      souEu: data.alvoId === eu,
      /* ⚠️ `null` para terceiros — não existe contador público de seguidores.
         Um placar de audiência num app de gestação de alto risco mede
         popularidade num momento em que ela já está sendo medida clinicamente. */
      meusSeguidores: data.alvoId === eu ? 0 : null,
    };

    return { ok: true as const, perfil, posts: ordenarFeed(posts) };
  });

/* ══════════════════════════════════════════════════════════════════════════
   SEGUIR
   ══════════════════════════════════════════════════════════════════════════ */

export const seguir = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), alvoId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const ctx = await contextoDe(sb, eu);
    const a = (await perfisPorId(sb, [data.alvoId])).get(data.alvoId);
    if (!a) return { ok: false as const, motivo: "indisponivel" as const };

    const estado = aoSeguir({
      euId: eu,
      alvo: {
        id: data.alvoId,
        nome: a.display_name ?? "",
        bio: null,
        avatarUrl: null,
        publico: !!a.perfil_publico,
        emCuidado: !!a.care_mode,
      },
      fuiBloqueada: ctx.bloqueio.has(data.alvoId),
    });
    if (!estado) return { ok: false as const, motivo: "indisponivel" as const };

    const { error } = await sb.from("rede_seguidores").upsert(
      {
        seguidor_id: eu,
        seguido_id: data.alvoId,
        estado,
        aceito_em: estado === "ativo" ? new Date().toISOString() : null,
      },
      { onConflict: "seguidor_id,seguido_id" },
    );
    if (error) return { ok: false as const, motivo: "banco" as const };

    /* ⚠️ Só o PEDIDO manda push — reação e "começou a te seguir" não mandam.
       O push deste app é o mesmo canal do aviso de emergência, e quem desliga
       as notificações por causa de um coraçãozinho desliga o resto junto. */
    await registrarAtividade(sb, {
      donoId: data.alvoId,
      quemId: eu,
      especie: estado === "ativo" ? "seguiu" : "pediu_para_seguir",
    });

    if (estado === "pendente") {
      try {
        const { sendPushToUser } = await import("@/lib/push.server");
        const meu = (await perfisPorId(sb, [eu])).get(eu);
        await sendPushToUser(data.alvoId, {
          title: "Novo pedido",
          body: `${(meu?.display_name ?? "Alguém").trim()} quer te acompanhar`,
          url: "/minha-conta?tab=Comunidade",
        });
      } catch {
        /* Push é enfeite aqui: o pedido já está gravado e aparece na tela. */
      }
    }

    return { ok: true as const, estado };
  });

export const deixarDeSeguir = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), alvoId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* Aqui o DELETE é o certo, e é a única exceção do arquivo: "deixei de
       seguir" não é um fato que alguém precise consultar depois, e guardar a
       linha faria a chave única impedir de seguir de novo. */
    const { error } = await sb
      .from("rede_seguidores")
      .delete()
      .eq("seguidor_id", eu)
      .eq("seguido_id", data.alvoId);
    if (error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
  });

/** Ela responde a um pedido de perfil privado. */
export const responderPedido = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        seguidorId: z.string().uuid(),
        aceitar: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    if (data.aceitar) {
      const { error } = await sb
        .from("rede_seguidores")
        .update({ estado: "ativo", aceito_em: new Date().toISOString() })
        .eq("seguidor_id", data.seguidorId)
        .eq("seguido_id", eu)
        .eq("estado", "pendente");
      if (error) return { ok: false as const, motivo: "banco" as const };
      /* Quem pediu fica sabendo que foi aceita. */
      await registrarAtividade(sb, {
        donoId: data.seguidorId,
        quemId: eu,
        especie: "aceitou",
      });
    } else {
      /* ⚠️ Recusar APAGA. Marcar "recusado" bloquearia o par para sempre pela
         chave única, e quem pediu de novo depois de um mal-entendido nunca
         mais conseguiria. Mesma decisão de `APLICAR_DUPLAS.sql`. */
      const { error } = await sb
        .from("rede_seguidores")
        .delete()
        .eq("seguidor_id", data.seguidorId)
        .eq("seguido_id", eu)
        .eq("estado", "pendente");
      if (error) return { ok: false as const, motivo: "banco" as const };
    }
    return { ok: true as const };
  });

/* ══════════════════════════════════════════════════════════════════════════
   POSTS E FEED
   ══════════════════════════════════════════════════════════════════════════ */

export const publicarPost = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        texto: z.string().max(LIMITE_DO_TEXTO).nullable(),
        /** Data URL. O cliente já reduz para 512px antes de mandar. */
        imagem: z.string().max(1_500_000).nullable(),
        /** As DEMAIS do carrossel. Até nove — a primeira vai em `imagem`. */
        extras: z.array(z.string().max(1_500_000)).max(9).optional(),
        visibilidade: z.enum(["publico", "seguidores", "amigas"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* ⚠️ Modo Cuidado NÃO publica. O portão da tela some, mas um pedido montado
       à mão não passa pela tela. */
    const { data: meu } = await sb
      .from("patient_profiles")
      .select("care_mode")
      .eq("id", eu)
      .maybeSingle();
    if ((meu as any)?.care_mode) return { ok: false as const, motivo: "indisponivel" as const };

    if (!postEhValido({ texto: data.texto, temImagem: !!data.imagem })) {
      return { ok: false as const, motivo: "vazio" as const };
    }

    let caminho: string | null = null;
    const extras: string[] = [];
    if (data.imagem) {
      const { guardarImagem } = await import("@/lib/imagens.server");
      caminho = await guardarImagem({ balde: "rede", donoId: eu, dataUrl: data.imagem });
      /* Falhar aqui RECUSA o post inteiro. Publicar só o texto de um post que
         ela montou com foto entregaria uma coisa diferente da que ela mandou,
         e ela só descobriria olhando o feed. */
      if (!caminho) return { ok: false as const, motivo: "imagem" as const };

      /* ⚠️ E o mesmo vale para as DEMAIS: se a terceira de cinco falhar, o post
         inteiro é recusado. Publicar quatro de cinco entregaria um carrossel
         com um buraco no meio, e ela não teria como saber qual sumiu. */
      for (const extra of data.extras ?? []) {
        const c = await guardarImagem({ balde: "rede", donoId: eu, dataUrl: extra });
        if (!c) return { ok: false as const, motivo: "imagem" as const };
        extras.push(c);
      }
    }

    const { data: post, error } = await sb
      .from("rede_posts")
      .insert({
        autor_id: eu,
        texto: data.texto?.trim() || null,
        imagem_path: caminho,
        imagens: extras,
        visibilidade: data.visibilidade,
      })
      .select("id")
      .single();
    if (error || !post) return { ok: false as const, motivo: "banco" as const };

    return { ok: true as const, postId: post.id };
  });

export const apagarPost = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), postId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* Marca, não apaga: as reações apontam para o post, e um DELETE levaria
       junto o registro de quem esteve ali. O `.eq("autor_id")` é o que impede
       apagar post alheio — o id vem do cliente. */
    const { error } = await sb
      .from("rede_posts")
      .update({ arquivado_em: new Date().toISOString() })
      .eq("id", data.postId)
      .eq("autor_id", eu);
    if (error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
  });

/** O feed: posts de quem eu sigo, das minhas amigas, e os meus. */
export const meuFeed = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        antesDe: z.string().max(40).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const ctx = await contextoDe(sb, eu);
    const de = [...new Set([eu, ...ctx.sigo, ...ctx.amigas])].filter(
      (id) => !ctx.bloqueio.has(id) || id === eu,
    );

    let q = sb
      .from("rede_posts")
      .select("id, autor_id, texto, imagem_path, imagens, visibilidade, criado_em")
      .in("autor_id", de)
      .is("arquivado_em", null)
      .order("criado_em", { ascending: false })
      /* Puxa mais do que cabe na página: a régua ainda vai FILTRAR (Modo
         Cuidado, perfil fechado depois de publicar), e sem folga uma página
         voltaria com três posts. */
      .limit(POSTS_POR_PAGINA * 2);
    if (data.antesDe) q = q.lt("criado_em", data.antesDe);

    const { data: brutos } = await q;
    const posts = await montarPosts(sb, eu, (brutos ?? []) as any[], ctx);
    const pagina = ordenarFeed(posts).slice(0, POSTS_POR_PAGINA);

    return {
      ok: true as const,
      posts: pagina,
      /* O cursor sai do ÚLTIMO da página, não do último bruto: senão a página
         seguinte pularia os que a régua filtrou. */
      proximo: pagina.length === POSTS_POR_PAGINA ? pagina[pagina.length - 1].criadoEm : null,
    };
  });

/* ══════════════════════════════════════════════════════════════════════════
   REAÇÕES
   ══════════════════════════════════════════════════════════════════════════ */

export const reagir = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        postId: z.string().uuid(),
        /** `null` tira a reação. */
        tipo: z.string().max(20).nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    if (data.tipo === null) {
      /* Falhar em silêncio deixaria a reação lá: a tela apagaria o botão, o
         banco manteria a linha, e a próxima abertura a traria de volta. */
      const { error } = await sb
        .from("rede_reacoes")
        .delete()
        .eq("post_id", data.postId)
        .eq("quem_id", eu);
      if (error) return { ok: false as const, motivo: "banco" as const };
      return { ok: true as const };
    }

    if (!reacaoConhecida(data.tipo)) return { ok: false as const, motivo: "tipo" as const };

    /* ⚠️ REAGIR EXIGE PODER VER O POST, e essa conferência não é formalidade:
       sem ela, um `postId` sorteado que respondesse 200 confirmaria a
       existência de um post privado — vazamento pela porta dos fundos. */
    const { data: post } = await sb
      .from("rede_posts")
      .select("id, autor_id, visibilidade")
      .eq("id", data.postId)
      .is("arquivado_em", null)
      .maybeSingle();
    if (!post) return { ok: false as const, motivo: "indisponivel" as const };

    const ctx = await contextoDe(sb, eu);
    const a = (await perfisPorId(sb, [(post as any).autor_id])).get((post as any).autor_id);
    const pode =
      !!a &&
      podeVerPost({
        post: { autorId: (post as any).autor_id, visibilidade: (post as any).visibilidade },
        euId: eu,
        autor: { emCuidado: !!a.care_mode, publico: !!a.perfil_publico },
        bloqueado: ctx.bloqueio.has((post as any).autor_id),
        sigoAtivo: ctx.sigo.has((post as any).autor_id),
        somosAmigas: ctx.amigas.has((post as any).autor_id),
      });
    if (!pode) return { ok: false as const, motivo: "indisponivel" as const };

    const { error } = await sb
      .from("rede_reacoes")
      .upsert(
        { post_id: data.postId, quem_id: eu, tipo: data.tipo },
        { onConflict: "post_id,quem_id" },
      );
    if (error) return { ok: false as const, motivo: "banco" as const };

    await registrarAtividade(sb, {
      donoId: (post as any).autor_id,
      quemId: eu,
      especie: "reagiu",
      postId: data.postId,
    });
    return { ok: true as const };
  });

/* ══════════════════════════════════════════════════════════════════════════
   BLOQUEIO E DESCOBERTA
   ══════════════════════════════════════════════════════════════════════════ */

export const bloquear = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        alvoId: z.string().uuid(),
        bloquear: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    if (eu === data.alvoId) return { ok: false as const, motivo: "indisponivel" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    if (!data.bloquear) {
      await sb.from("rede_bloqueios").delete().eq("quem_id", eu).eq("bloqueado_id", data.alvoId);
      return { ok: true as const };
    }

    /* ⚠️ **A ORDEM AQUI É A GARANTIA, e ela substitui um rollback.**
       Bloquear são DUAS escritas — desfazer o seguir e gravar o bloqueio — e
       não há transação entre elas. A primeira versão gravava o bloqueio antes
       e desfazia o seguir depois, com um rollback no erro; mas um rollback é
       mais uma escrita que pode falhar, e falhando ela deixa exatamente o
       estado que veio evitar.

       Desfazer o seguir PRIMEIRO torna o rollback desnecessário, porque os
       dois estados intermediários passam a ser assimétricos:

         · falha no seguir  → nada foi escrito. Ela vê o erro e tenta de novo.
         · falha no bloqueio → ela deixou de seguir e não bloqueou. Chato, e
           inofensivo: é o gesto MENOR, e ela vê o erro.

       O estado que não pode existir — bloqueio gravado com a linha de seguir
       viva, ressuscitando o vínculo no dia em que ela desbloquear — deixou de
       ser alcançável. Meio bloqueio é pior que nenhum, porque ela acha que
       está protegida. */
    const { error: erroSeguir } = await sb
      .from("rede_seguidores")
      .delete()
      .or(
        `and(seguidor_id.eq.${eu},seguido_id.eq.${data.alvoId}),and(seguidor_id.eq.${data.alvoId},seguido_id.eq.${eu})`,
      );
    if (erroSeguir) return { ok: false as const, motivo: "banco" as const };

    const { error } = await sb
      .from("rede_bloqueios")
      .upsert({ quem_id: eu, bloqueado_id: data.alvoId }, { onConflict: "quem_id,bloqueado_id" });
    if (error) return { ok: false as const, motivo: "banco" as const };

    return { ok: true as const };
  });

/** A busca — só perfil público. */
export const buscarPerfis = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), termo: z.string().max(60) }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const termo = normalizarBusca(data.termo);
    if (termo.length < MINIMO_DA_BUSCA) return { ok: true as const, perfis: [] };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* ⚠️ `.eq("perfil_publico", true)` na CONSULTA, não num filtro depois: quem
       não abriu o perfil não pode nem viajar pela rede. É o portão que preserva
       o desenho original da aba — o grafo fechado por indicação. */
    const { data: linhas } = await sb
      .from("patient_profiles")
      .select("id, display_name, avatar_url, bio, perfil_publico, care_mode")
      .eq("perfil_publico", true)
      .ilike("display_name", `%${data.termo.trim()}%`)
      .limit(20);

    const ctx = await contextoDe(sb, eu);
    return {
      ok: true as const,
      perfis: ((linhas ?? []) as any[])
        .filter(
          (p) =>
            p.id !== eu &&
            !ctx.bloqueio.has(p.id) &&
            podeAparecerNaBusca({ publico: !!p.perfil_publico, emCuidado: !!p.care_mode }),
        )
        .map((p) => ({
          id: p.id,
          nome: (p.display_name ?? "").trim() || "Alguém",
          bio: p.bio ?? null,
          avatarUrl: p.avatar_url ?? null,
          publico: true,
          meuVinculo: (ctx.sigo.has(p.id) ? "ativo" : null) as "ativo" | null,
          souEu: false,
          meusSeguidores: null,
        })),
    };
  });

/** O catálogo, para a tela não reescrever os emojis. */
export const CATALOGO_DE_REACOES = REACOES;

/* ══════════════════════════════════════════════════════════════════════════
   AS LISTAS DE GENTE — seguidores e seguindo
   ══════════════════════════════════════════════════════════════════════════ */

export type PessoaNaLista = {
  id: string;
  nome: string;
  bio: string | null;
  avatarUrl: string | null;
  /** Eu sigo esta pessoa? Para o botão da linha já nascer certo. */
  sigo: "ativo" | "pendente" | null;
  souEu: boolean;
};

/**
 * Quem segue alguém, ou quem alguém segue.
 *
 * ⚠️ **Só a DONA vê as listas dela.** No Instagram qualquer um abre a lista de
 * seguidores de um perfil público; aqui não, e é a mesma razão pela qual o
 * contador não é público: a lista de quem acompanha uma gestante de alto risco
 * é o círculo social dela, e expô-la a estranhos é entregar de quem ela é
 * próxima para quem só quis olhar um perfil.
 *
 * A dona vê as duas listas — é informação dela sobre a rede dela, e é o que
 * torna possível remover alguém que ela não quer mais por perto.
 */
export const listaDeGente = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        tipo: z.enum(["seguidores", "seguindo"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const ctx = await contextoDe(sb, eu);

    /* `seguidores` = quem tem `seguido_id = eu`; `seguindo` = o inverso. */
    const coluna = data.tipo === "seguidores" ? "seguido_id" : "seguidor_id";
    const outra = data.tipo === "seguidores" ? "seguidor_id" : "seguido_id";

    const { data: linhas } = await sb
      .from("rede_seguidores")
      .select(`${outra}, criado_em`)
      .eq(coluna, eu)
      .eq("estado", "ativo")
      .order("criado_em", { ascending: false })
      .limit(200);

    const ids = ((linhas ?? []) as any[]).map((l) => l[outra]).filter(Boolean);
    const perfis = await perfisPorId(sb, ids);

    const gente: PessoaNaLista[] = ids
      .map((id: string) => {
        const p = perfis.get(id);
        /* ⚠️ Modo Cuidado e bloqueio somem da lista, sem anunciar — a mesma
           régua de `minhasAmigas`. Quem entrou em luto não vira uma linha
           faltando com explicação; vira uma linha que não está lá. */
        if (!p || p.care_mode || ctx.bloqueio.has(id)) return null;
        return {
          id,
          nome: (p.display_name ?? "").trim() || "Alguém",
          bio: p.bio ?? null,
          avatarUrl: p.avatar_url ?? null,
          sigo: ctx.sigo.has(id) ? ("ativo" as const) : null,
          souEu: id === eu,
        };
      })
      .filter(Boolean) as PessoaNaLista[];

    return { ok: true as const, gente };
  });

/**
 * Um post só, para a tela que abre ao tocar na grade.
 *
 * ⚠️ Passa pela MESMA `podeVerPost` do feed. Sem isso, um id de post
 * adivinhado devolveria conteúdo da camada restrita de qualquer pessoa — o
 * caminho mais óbvio para vazar o que o feed protege.
 */
export const verPost = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), postId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: bruto } = await sb
      .from("rede_posts")
      .select("id, autor_id, texto, imagem_path, imagens, visibilidade, criado_em")
      .eq("id", data.postId)
      .is("arquivado_em", null)
      .maybeSingle();
    if (!bruto) return { ok: false as const, motivo: "indisponivel" as const };

    const ctx = await contextoDe(sb, eu);
    const [post] = await montarPosts(sb, eu, [bruto], ctx);
    if (!post) return { ok: false as const, motivo: "indisponivel" as const };

    return { ok: true as const, post };
  });

/* ══════════════════════════════════════════════════════════════════════════
   STORIES — a foto que some em 24 horas
   ══════════════════════════════════════════════════════════════════════════ */

export type StoryNaTela = {
  id: string;
  autorId: string;
  autorNome: string;
  autorAvatar: string | null;
  imagemUrl: string | null;
  texto: string | null;
  criadoEm: string;
  visto: boolean;
};

/** Um autor e os stories vivos dele — é assim que a fileira desenha. */
export type BolhaDeStory = {
  autorId: string;
  autorNome: string;
  autorAvatar: string | null;
  /** Algum ainda não visto? É o que acende o anel. */
  novo: boolean;
  stories: StoryNaTela[];
};

export const publicarStory = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        imagem: z.string().max(1_500_000),
        texto: z.string().max(200).nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* Modo Cuidado não publica — o mesmo portão de `publicarPost`, e pelo mesmo
       motivo: um pedido montado à mão não passa pela tela. */
    const { data: meu } = await sb
      .from("patient_profiles")
      .select("care_mode")
      .eq("id", eu)
      .maybeSingle();
    if ((meu as any)?.care_mode) return { ok: false as const, motivo: "indisponivel" as const };

    const { guardarImagem } = await import("@/lib/imagens.server");
    const caminho = await guardarImagem({ balde: "rede", donoId: eu, dataUrl: data.imagem });
    if (!caminho) return { ok: false as const, motivo: "imagem" as const };

    const { error } = await sb
      .from("rede_stories")
      .insert({ autor_id: eu, imagem_path: caminho, texto: data.texto });
    if (error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
  });

/**
 * A fileira de bolinhas.
 *
 * ⚠️ **A MINHA vem primeiro, sempre — mesmo sem story.** É a bolinha do
 * "adicionar", e o Instagram faz assim porque ela é o convite: sem ela na
 * primeira posição, publicar um story vira uma função escondida.
 *
 * ⚠️ E os expirados NÃO são apagados aqui. A consulta filtra por `expira_em`;
 * a linha morta fica no banco até alguém varrer. Apagar na leitura faria uma
 * consulta de tela virar escrita, e uma tela que apaga dado é uma tela que
 * apaga dado quando não devia.
 */
export const storiesDoFeed = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const ctx = await contextoDe(sb, eu);
    const de = [...new Set([eu, ...ctx.sigo, ...ctx.amigas])].filter(
      (id) => !ctx.bloqueio.has(id) || id === eu,
    );

    const agora = new Date().toISOString();
    const { data: brutos } = await sb
      .from("rede_stories")
      .select("id, autor_id, imagem_path, texto, criado_em")
      .in("autor_id", de)
      .gt("expira_em", agora)
      .order("criado_em", { ascending: true })
      .limit(200);

    const linhas = (brutos ?? []) as any[];
    const perfis = await perfisPorId(sb, [...new Set(linhas.map((l) => l.autor_id))]);

    const { data: vistos } = await sb
      .from("rede_stories_vistos")
      .select("story_id")
      .eq("quem_id", eu)
      .in(
        "story_id",
        linhas.map((l) => l.id),
      );
    const jaVi = new Set(((vistos ?? []) as { story_id: string }[]).map((v) => v.story_id));

    const { urlAssinada } = await import("@/lib/imagens.server");
    const porAutor = new Map<string, BolhaDeStory>();

    for (const l of linhas) {
      const p = perfis.get(l.autor_id);
      /* Modo Cuidado tira os stories da fileira, como tira tudo o mais. */
      if (!p || p.care_mode) continue;
      const b: BolhaDeStory = porAutor.get(l.autor_id) ?? {
        autorId: l.autor_id,
        autorNome: (p.display_name ?? "").trim() || "Alguém",
        autorAvatar: p.avatar_url ?? null,
        novo: false,
        stories: [],
      };
      const visto = jaVi.has(l.id);
      b.novo = b.novo || !visto;
      b.stories.push({
        id: l.id,
        autorId: l.autor_id,
        autorNome: b.autorNome,
        autorAvatar: b.autorAvatar,
        imagemUrl: await urlAssinada("rede", l.imagem_path, 3600),
        texto: l.texto ?? null,
        criadoEm: l.criado_em,
        visto,
      });
      porAutor.set(l.autor_id, b);
    }

    /* ⚠️ A ordem: EU primeiro, depois os NÃO VISTOS, depois o resto. É a régua
       do Instagram, e ela é útil — quem tem coisa nova para mostrar fica onde
       o polegar alcança sem rolar. */
    const bolhas = [...porAutor.values()].sort((a, b) => {
      if (a.autorId === eu) return -1;
      if (b.autorId === eu) return 1;
      if (a.novo !== b.novo) return a.novo ? -1 : 1;
      return 0;
    });

    return { ok: true as const, bolhas };
  });

export const marcarStoryVisto = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), storyId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* `ignoreDuplicates`: ver o mesmo story duas vezes é o caso comum, e a
       chave primária composta já recusa a segunda linha. */
    const { error } = await sb
      .from("rede_stories_vistos")
      .upsert({ story_id: data.storyId, quem_id: eu }, { onConflict: "story_id,quem_id" });
    if (error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
  });

/* ══════════════════════════════════════════════════════════════════════════
   SALVAR
   ══════════════════════════════════════════════════════════════════════════ */

export const salvarPost = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        postId: z.string().uuid(),
        salvar: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    if (!data.salvar) {
      const { error } = await sb
        .from("rede_salvos")
        .delete()
        .eq("quem_id", eu)
        .eq("post_id", data.postId);
      if (error) return { ok: false as const, motivo: "banco" as const };
      return { ok: true as const };
    }

    /* ⚠️ Salvar exige poder VER o post, pela mesma razão de `reagir`: sem a
       conferência, um id sorteado que respondesse 200 confirmaria a existência
       de um post privado. */
    const { data: post } = await sb
      .from("rede_posts")
      .select("id, autor_id, visibilidade")
      .eq("id", data.postId)
      .is("arquivado_em", null)
      .maybeSingle();
    if (!post) return { ok: false as const, motivo: "indisponivel" as const };

    const ctx = await contextoDe(sb, eu);
    const a = (await perfisPorId(sb, [(post as any).autor_id])).get((post as any).autor_id);
    const pode =
      !!a &&
      podeVerPost({
        post: { autorId: (post as any).autor_id, visibilidade: (post as any).visibilidade },
        euId: eu,
        autor: { emCuidado: !!a.care_mode, publico: !!a.perfil_publico },
        bloqueado: ctx.bloqueio.has((post as any).autor_id),
        sigoAtivo: ctx.sigo.has((post as any).autor_id),
        somosAmigas: ctx.amigas.has((post as any).autor_id),
      });
    if (!pode) return { ok: false as const, motivo: "indisponivel" as const };

    const { error } = await sb
      .from("rede_salvos")
      .upsert({ quem_id: eu, post_id: data.postId }, { onConflict: "quem_id,post_id" });
    if (error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
  });

/** Os posts que ela salvou. Ninguém mais vê esta lista — nem a autora deles. */
export const meusSalvos = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: linhas } = await sb
      .from("rede_salvos")
      .select("post_id, criado_em")
      .eq("quem_id", eu)
      .order("criado_em", { ascending: false })
      .limit(100);

    const ids = ((linhas ?? []) as { post_id: string }[]).map((l) => l.post_id);
    if (ids.length === 0) return { ok: true as const, posts: [] };

    const { data: brutos } = await sb
      .from("rede_posts")
      .select("id, autor_id, texto, imagem_path, imagens, visibilidade, criado_em")
      .in("id", ids)
      .is("arquivado_em", null);

    const ctx = await contextoDe(sb, eu);
    /* ⚠️ Passa pela régua DE NOVO na leitura: ela pode ter salvado um post e a
       autora ter fechado o perfil, entrado em Modo Cuidado ou bloqueado depois.
       Salvo não é uma cópia — é um marcador, e o marcador não sobrevive à
       decisão de quem escreveu. */
    const posts = await montarPosts(sb, eu, (brutos ?? []) as any[], ctx);
    return { ok: true as const, posts: ordenarFeed(posts) };
  });

/* ══════════════════════════════════════════════════════════════════════════
   ATIVIDADE — a aba do coração
   ══════════════════════════════════════════════════════════════════════════ */

export type AtividadeNaTela = {
  id: string;
  especie: EspecieDeAviso;
  quemId: string;
  quemNome: string;
  quemAvatar: string | null;
  postId: string | null;
  /** A capa do post, para a linha mostrar do que se trata. */
  postCapa: string | null;
  criadoEm: string;
  visto: boolean;
  /**
   * O pedido de seguir ainda está DE PÉ?
   *
   * ⚠️ Só faz sentido em `pediu_para_seguir`, e existe porque a linha da
   * atividade não sabe o desfecho: ela é gravada quando o pedido chega e nunca
   * mais muda. Sem este campo, um pedido já aceito continuaria mostrando
   * "Aceitar" para sempre — um botão que promete uma ação e não faz nada,
   * porque o `update` filtra por `estado = "pendente"` e não acha mais linha.
   */
  pendente: boolean;
};

/**
 * Registra um gesto na caixa de alguém.
 *
 * ⚠️ **Engole o erro de propósito.** É enriquecimento: quem reagiu já reagiu, e
 * derrubar a reação porque o aviso não gravou trocaria uma coisa que funciona
 * por uma que não. É a mesma decisão de `try/catch` do bônus das cinco
 * estrelas.
 */
async function registrarAtividade(
  sb: any,
  opts: { donoId: string; quemId: string; especie: EspecieDeAviso; postId?: string | null },
) {
  if (opts.donoId === opts.quemId) return;
  try {
    const { error } = await sb.from("rede_atividade").upsert(
      {
        dono_id: opts.donoId,
        quem_id: opts.quemId,
        especie: opts.especie,
        post_id: opts.postId ?? null,
      },
      /* O índice único é sobre (dono, quem, espécie, post) — tirar e pôr a
         reação cinco vezes não enche a caixa dela com cinco avisos. */
      { onConflict: "dono_id,quem_id,especie,post_id", ignoreDuplicates: true },
    );
    /* ⚠️ NÃO derruba o gesto, mas também não some sem deixar rastro. A catraca
       de `travas-do-servidor.test.ts` existe para forçar esta pergunta, e a
       resposta aqui é a do meio: silêncio para a paciente (a reação dela já
       valeu), registro para quem for investigar por que a caixa de alguém
       está vazia. Silêncio TOTAL é o que a catraca proíbe. */
    if (error) console.warn("[atividade] não gravou", error.code, error.message);
  } catch (e) {
    console.warn("[atividade] não gravou", e);
  }
}

export const minhaAtividade = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: linhas } = await sb
      .from("rede_atividade")
      .select("id, quem_id, especie, post_id, criado_em, visto_em")
      .eq("dono_id", eu)
      .order("criado_em", { ascending: false })
      .limit(80);

    const brutas = (linhas ?? []) as any[];
    const ctx = await contextoDe(sb, eu);
    const perfis = await perfisPorId(sb, [...new Set(brutas.map((l) => l.quem_id))]);

    /* As capas dos posts citados, para a linha mostrar do que se trata. */
    const postIds = [...new Set(brutas.map((l) => l.post_id).filter(Boolean))] as string[];
    const capas = new Map<string, string>();
    if (postIds.length) {
      const { data: ps } = await sb
        .from("rede_posts")
        .select("id, imagem_path")
        .in("id", postIds)
        .is("arquivado_em", null);
      const { urlAssinada } = await import("@/lib/imagens.server");
      for (const p of (ps ?? []) as any[]) {
        if (!p.imagem_path) continue;
        const u = await urlAssinada("rede", p.imagem_path, 3600);
        if (u) capas.set(p.id, u);
      }
    }

    /* Quem ainda está esperando resposta. Uma consulta só, para todas as
       linhas de pedido da caixa. */
    const { data: esperando } = await sb
      .from("rede_seguidores")
      .select("seguidor_id")
      .eq("seguido_id", eu)
      .eq("estado", "pendente");
    const pendentes = new Set(
      ((esperando ?? []) as { seguidor_id: string }[]).map((l) => l.seguidor_id),
    );

    const itens: AtividadeNaTela[] = brutas
      .map((l) => {
        const p = perfis.get(l.quem_id);
        /* ⚠️ Modo Cuidado e bloqueio somem da caixa, sem anunciar. Uma linha
           "Fulana reagiu" de quem entrou em luto contaria a perda dela pela
           porta dos fundos — e uma de quem ela bloqueou traria a pessoa de
           volta à tela justamente depois de ela ter pedido para não ver. */
        if (!p || p.care_mode || ctx.bloqueio.has(l.quem_id)) return null;
        return {
          id: l.id,
          especie: l.especie as EspecieDeAviso,
          quemId: l.quem_id,
          quemNome: (p.display_name ?? "").trim() || "Alguém",
          quemAvatar: p.avatar_url ?? null,
          postId: l.post_id ?? null,
          postCapa: l.post_id ? (capas.get(l.post_id) ?? null) : null,
          criadoEm: l.criado_em,
          visto: !!l.visto_em,
          pendente: l.especie === "pediu_para_seguir" && pendentes.has(l.quem_id),
        };
      })
      .filter(Boolean) as AtividadeNaTela[];

    return { ok: true as const, itens, novas: itens.filter((i) => !i.visto).length };
  });

/** Marca a caixa inteira como vista — é o que abre a aba faz. */
export const marcarAtividadeVista = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* ⚠️ Aqui abrir a aba MARCA TUDO, ao contrário da central de recados, em
       que o toque em cada item é quem marca. A diferença é o que está em jogo:
       lá são recados do app que podem exigir ação dela (uma pré-consulta, uma
       vaga liberada), e perder o rastro de cinco de uma vez custa caro. Aqui
       são coraçõezinhos — nada a fazer, nada a perder. */
    const { error } = await sb
      .from("rede_atividade")
      .update({ visto_em: new Date().toISOString() })
      .eq("dono_id", eu)
      .is("visto_em", null);
    if (error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
  });
