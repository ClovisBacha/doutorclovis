/**
 * A MENSAGEM DIRETA — servidor.
 *
 * A régua (quem pode escrever para quem, e quantas vezes) mora em `conversa.ts`,
 * pura e testada. Aqui ela vira lei.
 *
 * ⚠️ **NADA AQUI CONFIA NO CLIENTE.** `conversaId` e `alvoId` vêm do corpo do
 * pedido; toda leitura e toda escrita conferem que quem pergunta é uma das duas
 * pontas. Sem isso, um uuid montado à mão leria a conversa privada de duas
 * pacientes — e conversa é o dado mais íntimo desta aba.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { alcancaOPerfil } from "./selo-do-perfil";
import {
  LIMITE_DA_MENSAGEM,
  MENSAGENS_POR_DIA,
  minhaColunaDeLeitura,
  parOrdenado,
  podeEnviar,
  podeIniciarConversa,
  previaDaMensagem,
  temNaoLida,
} from "./conversa";

export type ConversaNaTela = {
  id: string;
  /** A outra ponta. */
  comId: string;
  comNome: string;
  comAvatar: string | null;
  previa: string;
  ultimaEm: string | null;
  naoLida: boolean;
  /** `true` = ainda é pedido, esperando ela aceitar. */
  pedido: boolean;
  /** Fui eu quem puxou conversa. Decide o texto da tela do pedido. */
  euIniciei: boolean;
};

export type MensagemNaTela = {
  id: string;
  souEu: boolean;
  texto: string | null;
  criadaEm: string;
  apagada: boolean;
};

async function pacienteDaSessao(accessToken: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any).auth.getUser(accessToken);
  return data?.user?.id ?? null;
}

/**
 * A conversa, conferindo que sou uma das pontas.
 *
 * ⚠️ **DEVOLVE `null` TANTO PARA "NÃO EXISTE" QUANTO PARA "NÃO É MINHA".**
 * Distinguir os dois diria a quem sondasse uuids quais conversas existem no
 * sistema — e a existência de uma conversa entre duas pessoas já é informação
 * sobre elas.
 */
async function minhaConversa(sb: any, id: string, eu: string): Promise<any | null> {
  const { data, error } = await sb
    .from("rede_conversas")
    .select("id, a_id, b_id, iniciada_por, aceita, ultima_em, lida_a, lida_b")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  if (data.a_id !== eu && data.b_id !== eu) return null;
  return data;
}

/** Quem, entre estes ids, me segue de verdade. */
async function quemMeSegue(sb: any, eu: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { data, error } = await sb
    .from("rede_seguidores")
    .select("seguidor_id")
    .eq("seguido_id", eu)
    .eq("estado", "ativo")
    .in("seguidor_id", ids);
  /* ⚠️ Falha FECHADA: sem saber quem me segue, a conversa nasce como PEDIDO.
     O pior caso é um toque a mais para aceitar; o inverso seria uma estranha
     entrando direto na caixa principal por causa de um erro de rede. */
  if (error) return new Set();
  return new Set(((data ?? []) as any[]).map((r) => r.seguidor_id));
}

export const minhasConversas = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: linhas, error } = await sb
      .from("rede_conversas")
      .select("id, a_id, b_id, iniciada_por, aceita, ultima_em, lida_a, lida_b")
      .or(`a_id.eq.${eu},b_id.eq.${eu}`)
      .order("ultima_em", { ascending: false })
      .limit(100);
    if (error) return { ok: false as const, motivo: "banco" as const };

    const conversas = (linhas ?? []) as any[];
    if (conversas.length === 0) {
      return { ok: true as const, conversas: [] as ConversaNaTela[], naoLidas: 0 };
    }

    const outros = conversas.map((c) => (c.a_id === eu ? c.b_id : c.a_id));
    const { contextoDe } = await import("./rede-social.functions");
    const ctx = await contextoDe(sb, eu);

    /* A última mensagem de cada conversa, numa consulta só. */
    const { data: msgs } = await sb
      .from("rede_mensagens")
      .select("conversa_id, autor_id, texto, criada_em, apagada_em")
      .in(
        "conversa_id",
        conversas.map((c) => c.id),
      )
      .order("criada_em", { ascending: false });
    const ultima = new Map<string, any>();
    for (const m of (msgs ?? []) as any[]) {
      if (!ultima.has(m.conversa_id)) ultima.set(m.conversa_id, m);
    }

    const { data: perfis } = await sb
      .from("patient_profiles")
      .select("id, display_name, avatar_url")
      .in("id", outros);
    const porId = new Map(((perfis ?? []) as any[]).map((p) => [p.id, p]));

    const { renovarUrlsAssinadas, VALIDADE_AVATAR_SEG } = await import("@/lib/imagens.server");
    const avatares = await renovarUrlsAssinadas(
      outros.map((id) => porId.get(id)?.avatar_url ?? null),
      VALIDADE_AVATAR_SEG,
    );

    const saida: ConversaNaTela[] = [];
    conversas.forEach((c, i) => {
      const outro = c.a_id === eu ? c.b_id : c.a_id;
      /* ⚠️ BLOQUEIO SOME DA LISTA, dos dois lados e em silêncio — a mesma
         decisão do feed. Uma conversa que continua visível depois do bloqueio
         é a pessoa bloqueada ainda ocupando espaço na tela dela. */
      if (ctx.bloqueio.has(outro)) return;
      const m = ultima.get(c.id);
      const p = porId.get(outro);
      saida.push({
        id: c.id,
        comId: outro,
        comNome: ((p?.display_name ?? "") as string).trim() || "Alguém",
        comAvatar: avatares[i] ?? null,
        previa: previaDaMensagem(m?.texto ?? null, !!m?.apagada_em),
        ultimaEm: c.ultima_em ?? null,
        naoLida: temNaoLida({
          ultimaEm: c.ultima_em ?? null,
          minhaLeitura: (c[minhaColunaDeLeitura(eu, c.a_id)] as string | null) ?? null,
          ultimoAutor: m?.autor_id ?? null,
          euId: eu,
        }),
        pedido: !c.aceita,
        euIniciei: c.iniciada_por === eu,
      });
    });

    /* ⚠️ O emblema conta só o que EU preciso responder: pedido que EU mandei
       não é novidade minha, é espera. */
    const naoLidas = saida.filter((c) => c.naoLida && !(c.pedido && c.euIniciei)).length;
    return { ok: true as const, conversas: saida, naoLidas };
  });

export const abrirConversa = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), alvoId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { contextoDe } = await import("./rede-social.functions");
    const ctx = await contextoDe(sb, eu);

    const { data: alvo, error: erroAlvo } = await sb
      .from("patient_profiles")
      .select("id, perfil_publico")
      .eq("id", data.alvoId)
      .maybeSingle();
    if (erroAlvo) return { ok: false as const, motivo: "banco" as const };

    const meSegue = await quemMeSegue(sb, eu, [data.alvoId]);
    const veredito = podeIniciarConversa({
      euId: eu,
      alvoId: data.alvoId,
      temBloqueio: ctx.bloqueio.has(data.alvoId),
      /* ⚠️ A MESMA régua do perfil — ver o cabeçalho de `conversa.ts`. */
      alcancaOPerfil: alcancaOPerfil({
        perfilPublico: !!alvo?.perfil_publico,
        souEu: false,
        sigoAtivo: ctx.sigo.has(data.alvoId),
        somosAmigas: ctx.amigas.has(data.alvoId),
      }),
      alvoMeSegue: meSegue.has(data.alvoId),
    });
    if (!veredito.pode) return { ok: false as const, motivo: veredito.motivo };

    const { a, b } = parOrdenado(eu, data.alvoId);
    const { data: existente } = await sb
      .from("rede_conversas")
      .select("id")
      .eq("a_id", a)
      .eq("b_id", b)
      .maybeSingle();
    if (existente?.id) return { ok: true as const, id: existente.id as string };

    const { data: nova, error } = await sb
      .from("rede_conversas")
      .insert({ a_id: a, b_id: b, iniciada_por: eu, aceita: !veredito.comoPedido })
      .select("id")
      .maybeSingle();
    if (error || !nova?.id) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const, id: nova.id as string };
  });

export const mensagensDaConversa = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        conversaId: z.string().uuid(),
        antes: z.string().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const c = await minhaConversa(sb, data.conversaId, eu);
    if (!c) return { ok: false as const, motivo: "nao_e_minha" as const };

    let q = sb
      .from("rede_mensagens")
      .select("id, autor_id, texto, criada_em, apagada_em")
      .eq("conversa_id", data.conversaId)
      .order("criada_em", { ascending: false })
      .limit(50);
    if (data.antes) q = q.lt("criada_em", data.antes);
    const { data: linhas, error } = await q;
    if (error) return { ok: false as const, motivo: "banco" as const };

    const mensagens: MensagemNaTela[] = ((linhas ?? []) as any[])
      .map((m) => ({
        id: m.id,
        souEu: m.autor_id === eu,
        /* ⚠️ O TEXTO DA APAGADA NÃO VIAJA. Mandá-lo com um `apagada: true` para
           a tela esconder deixaria a mensagem apagada dentro da resposta da
           rede — visível para quem abrisse o inspetor. */
        texto: m.apagada_em ? null : (m.texto ?? null),
        criadaEm: m.criada_em,
        apagada: !!m.apagada_em,
      }))
      .reverse();

    return {
      ok: true as const,
      mensagens,
      pedido: !c.aceita,
      euIniciei: c.iniciada_por === eu,
      comId: (c.a_id === eu ? c.b_id : c.a_id) as string,
    };
  });

export const enviarMensagem = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        conversaId: z.string().uuid(),
        texto: z.string().min(1).max(LIMITE_DA_MENSAGEM),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const texto = data.texto.trim();
    if (!texto) return { ok: false as const, motivo: "vazia" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const c = await minhaConversa(sb, data.conversaId, eu);
    if (!c) return { ok: false as const, motivo: "nao_e_minha" as const };
    const outro = c.a_id === eu ? c.b_id : c.a_id;

    const { contextoDe } = await import("./rede-social.functions");
    const ctx = await contextoDe(sb, eu);

    /* Quantas EU já mandei nesta conversa — a trava das mensagens antes do
       aceite. Contada no banco, nunca na tela. */
    const { count: minhas, error: erroConta } = await sb
      .from("rede_mensagens")
      .select("id", { count: "exact", head: true })
      .eq("conversa_id", data.conversaId)
      .eq("autor_id", eu);
    if (erroConta) return { ok: false as const, motivo: "banco" as const };

    const veredito = podeEnviar({
      souODono: true,
      aceita: !!c.aceita,
      euIniciei: c.iniciada_por === eu,
      minhasMensagens: minhas ?? 0,
      temBloqueio: ctx.bloqueio.has(outro),
    });
    if (!veredito.pode) return { ok: false as const, motivo: veredito.motivo! };

    /* O teto diário, contra o dedo preso e contra automação. */
    const ontem = new Date(Date.now() - 86400_000).toISOString();
    const { count: hoje, error: erroHoje } = await sb
      .from("rede_mensagens")
      .select("id", { count: "exact", head: true })
      .eq("autor_id", eu)
      .gte("criada_em", ontem);
    if (erroHoje) return { ok: false as const, motivo: "banco" as const };
    if ((hoje ?? 0) >= MENSAGENS_POR_DIA) return { ok: false as const, motivo: "muitas" as const };

    const { error } = await sb
      .from("rede_mensagens")
      .insert({ conversa_id: data.conversaId, autor_id: eu, texto });
    if (error) return { ok: false as const, motivo: "banco" as const };

    /**
     * ⚠️ **RESPONDER ACEITA A CONVERSA.** Quem recebeu o pedido e respondeu já
     * disse sim; deixar `aceita = false` manteria a conversa na caixa de
     * pedidos DELA depois de ela ter escrito nela.
     */
    const aceitaAgora = c.aceita || c.iniciada_por !== eu;
    const { error: erroToque } = await sb
      .from("rede_conversas")
      .update({ ultima_em: new Date().toISOString(), aceita: aceitaAgora })
      .eq("id", data.conversaId);
    if (erroToque) return { ok: false as const, motivo: "banco" as const };

    return { ok: true as const };
  });

export const marcarConversaLida = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), conversaId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const c = await minhaConversa(sb, data.conversaId, eu);
    if (!c) return { ok: false as const, motivo: "nao_e_minha" as const };

    const { error } = await sb
      .from("rede_conversas")
      .update({ [minhaColunaDeLeitura(eu, c.a_id)]: new Date().toISOString() })
      .eq("id", data.conversaId);
    if (error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
  });

/**
 * APAGAR UMA MENSAGEM.
 *
 * ⚠️ **MARCA, e não `delete`.** A linha some da conversa mas o lugar dela fica:
 * sem isso, a última mensagem apagada faria a lista voltar a mostrar a anterior,
 * e a paciente concluiria que a mensagem que ela viu chegar não existiu.
 *
 * ⚠️ E o TEXTO é apagado de verdade (`texto: ""`), não só marcado — deixar o
 * texto na linha manteria a mensagem legível para qualquer consulta futura.
 */
export const apagarMensagem = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("rede_mensagens")
      .update({ apagada_em: new Date().toISOString(), texto: "" })
      .eq("id", data.id)
      /* ⚠️ Só a AUTORA apaga a própria mensagem. O id vem do cliente. */
      .eq("autor_id", eu);
    if (error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
  });
