/**
 * O GRUPO DO DIRECT — servidor.
 *
 * ⚠️ **`rede_conversas` NÃO foi mexida.** Ela tem `a_id`/`b_id` `NOT NULL`, um
 * `CHECK (a_id < b_id)` e um índice único por par: a forma inteira dela É "duas
 * pessoas", e é nela que mora a garantia de que ninguém entra numa conversa de
 * duas. O grupo entra ao lado, e as MENSAGENS são as mesmas — `rede_mensagens`
 * ganhou `grupo_id`, com exatamente um dos dois destinos preenchido.
 *
 * Reusar a tabela de mensagens não é economia: é o que faz a citação, as
 * reações, o apagar e a RÉGUA CLÍNICA valerem igual nos dois. Uma tabela
 * separada seria seis lugares para divergir, e a divergência apareceria como a
 * triagem valendo no direct e não valendo no grupo.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * ⚠️ **CÓPIA DELIBERADA de três linhas, e não um import.**
 *
 * `conversa.functions.ts` tem a mesma — e o motivo é o mesmo: importar de
 * `rede-social.functions.ts` puxaria o módulo inteiro (49 funções de servidor,
 * `postsCrus`, `montarPosts`) para dentro deste, que existe para ser pequeno.
 * O que ela faz é uma chamada ao `auth` e nada mais; não há régua aqui para
 * divergir.
 */
async function pacienteDaSessao(accessToken: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any).auth.getUser(accessToken);
  return data?.user?.id ?? null;
}
import {
  MEMBROS_DO_GRUPO_MAX,
  NOME_DO_GRUPO_MAX,
  podeConvidarParaGrupo,
  type MembroDoGrupo,
} from "./grupo-da-conversa";

export type GrupoNaTela = {
  id: string;
  nome: string;
  membros: MembroDoGrupo[];
  souACriadora: boolean;
  ultimaEm: string;
  naoLida: boolean;
  silenciado: boolean;
};

/**
 * ⚠️ **O PORTÃO: eu sou membro ATIVO deste grupo?**
 *
 * Uma régua só, e todo handler passa por ela. Sem isso, um `grupoId` no corpo do
 * pedido leria a conversa de oito pessoas que não me conhecem — e é a mesma
 * classe de defeito que `minhaConversa` fecha no direct de duas.
 *
 * Devolve `{ grupo, membro }` ou `null`. ⚠️ Quem SAIU volta `null`: a linha fica
 * (é ela que recorta o histórico do período em que ela esteve), mas ela não age
 * mais no grupo.
 */
async function meuGrupo(sb: any, grupoId: string, eu: string) {
  const { data: g } = await sb
    .from("rede_grupos")
    .select("id, criadora_id, nome, ultima_em, encerrado_em")
    .eq("id", grupoId)
    .maybeSingle();
  if (!g || (g as any).encerrado_em) return null;
  const { data: m } = await sb
    .from("rede_grupo_membros")
    .select("grupo_id, quem_id, entrou_em, saiu_em, lida_em, silenciado_em")
    .eq("grupo_id", grupoId)
    .eq("quem_id", eu)
    .maybeSingle();
  if (!m || (m as any).saiu_em) return null;
  return { grupo: g as any, membro: m as any };
}

/** Cria o grupo com a criadora dentro. Convidar é um passo à parte. */
export const criarGrupo = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        nome: z.string().trim().max(NOME_DO_GRUPO_MAX).nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* ⚠️ Quem está em luto ou pausou não cria grupo — a mesma régua de tudo
       nesta aba, e aqui ela importa: um grupo é um compromisso com outras
       pessoas, e o Modo Cuidado existe para tirar compromissos. */
    const { foraDaRede, perfisPorId } = await import("./rede-social.functions");
    const perfis = await perfisPorId(sb, [eu]);
    if (foraDaRede(perfis.get(eu))) {
      return { ok: false as const, motivo: "indisponivel" as const };
    }

    const { data: g, error } = await sb
      .from("rede_grupos")
      .insert({ criadora_id: eu, nome: (data.nome ?? "").trim() || "" })
      .select("id")
      .maybeSingle();
    if (error || !g) return { ok: false as const, motivo: "sem_suporte" as const };

    const { error: erroM } = await sb
      .from("rede_grupo_membros")
      .insert({ grupo_id: (g as any).id, quem_id: eu });
    /* ⚠️ Grupo sem a criadora dentro é um grupo que nem ela abre. Se a segunda
       escrita falhar, desfaz a primeira — aqui o rollback é seguro porque o
       grupo recém-criado não tem mais nada apontando para ele. */
    if (erroM) {
      const { error: erroLimpeza } = await sb
        .from("rede_grupos")
        .delete()
        .eq("id", (g as any).id);
      /* ⚠️ **ROLLBACK É MAIS UMA ESCRITA QUE PODE FALHAR**, e falhando deixa
         exatamente o estado que ele veio evitar: um grupo órfão, sem ninguém
         dentro, que nenhuma tela lista. Não dá para desfazer melhor sem uma
         terceira escrita — o que fica é o registro, e o grupo órfão não
         aparece para ninguém porque `meusGrupos` parte dos MEMBROS. */
      if (erroLimpeza) console.warn("[grupo] órfão não limpou", erroLimpeza.code);
      return { ok: false as const, motivo: "sem_suporte" as const };
    }
    return { ok: true as const, grupoId: (g as any).id as string };
  });

/**
 * CONVIDAR — só a criadora, e só de dentro do grafo dela.
 *
 * ⚠️ **A LISTA DO CLIENTE É SÓ UM PEDIDO.** Cada id é conferido contra o BANCO:
 * o vínculo (sigo ou amiga), o bloqueio nos dois sentidos e o Modo Cuidado. É a
 * mesma régua de marcar alguém num post, e ela vive em `grupo-da-conversa.ts`.
 */
export const convidarParaGrupo = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        grupoId: z.string().uuid(),
        alvos: z.array(z.string().uuid()).min(1).max(MEMBROS_DO_GRUPO_MAX),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const meu = await meuGrupo(sb, data.grupoId, eu);
    if (!meu) return { ok: false as const, motivo: "indisponivel" as const };
    if (meu.grupo.criadora_id !== eu) return { ok: false as const, motivo: "so_criadora" as const };

    const { contextoDe, perfisPorId, foraDaRede } = await import("./rede-social.functions");
    const ctx = await contextoDe(sb, eu);
    const perfis = await perfisPorId(sb, [...new Set(data.alvos)]);

    /* ⚠️ Conta os ATIVOS: quem saiu não ocupa vaga, senão um grupo que perdeu
       metade nunca mais aceitaria ninguém. */
    /* ⚠️ **O TETO DE OITO FALHAVA ABERTO.** O `error` era descartado e
       `(jaLa ?? [])` virava lista vazia numa falha de leitura: `ativos.length`
       ia a ZERO, e o teto passava a ser calculado a partir do nada — ela podia
       chamar mais oito para um grupo que ja tinha oito. O teto existe por uma
       razao escrita: acima disso ninguem le tudo, e o que sobra e quem fala
       mais alto. */
    const { data: jaLa, error: erroMembros } = await sb
      .from("rede_grupo_membros")
      .select("quem_id, saiu_em")
      .eq("grupo_id", data.grupoId);
    if (erroMembros || !jaLa) return { ok: false as const, motivo: "instavel" as const };
    const ativos = (jaLa as any[]).filter((m) => !m.saiu_em);
    const jaEstao = new Set(ativos.map((m) => m.quem_id as string));

    let entraram = 0;
    for (const alvo of [...new Set(data.alvos)]) {
      if (jaEstao.has(alvo)) continue;
      const pode = podeConvidarParaGrupo({
        euId: eu,
        criadoraId: meu.grupo.criadora_id,
        alvoId: alvo,
        sigoAtivo: ctx.sigo.has(alvo),
        somosAmigas: ctx.amigas.has(alvo),
        bloqueio: ctx.bloqueio.has(alvo),
        emCuidado: foraDaRede(perfis.get(alvo)),
        jaSaoMembros: ativos.length + entraram,
      });
      if (!pode) continue;
      /* ⚠️ `upsert` com a chave (grupo, quem): quem já saiu e é reconvidada
         VOLTA, e `entrou_em` é reescrito — ela vê a partir de AGORA, e não do
         período anterior. É a régua de `mensagemVisivelNoGrupo` acontecendo na
         escrita. */
      const { error } = await sb.from("rede_grupo_membros").upsert(
        {
          grupo_id: data.grupoId,
          quem_id: alvo,
          entrou_em: new Date().toISOString(),
          saiu_em: null,
        },
        { onConflict: "grupo_id,quem_id" },
      );
      if (!error) entraram += 1;
    }
    return { ok: true as const, entraram, teto: MEMBROS_DO_GRUPO_MAX };
  });

/**
 * SAIR — e a criadora saindo ENCERRA o grupo.
 *
 * ⚠️ **Um grupo sem dona é um grupo sem ninguém responsável por quem entra.** A
 * alternativa (passar a coroa) exigiria decidir para quem, e essa é uma decisão
 * de produto que ninguém tomou. Encerrar é honesto e reversível pela criação de
 * um grupo novo.
 *
 * ⚠️ **E encerrar MARCA, nunca apaga.** As mensagens ficam: elas são o que as
 * outras pessoas escreveram, e apagá-las seria decidir por elas.
 */
export const sairDoGrupo = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), grupoId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const meu = await meuGrupo(sb, data.grupoId, eu);
    if (!meu) return { ok: false as const, motivo: "indisponivel" as const };

    const agora = new Date().toISOString();
    const { error } = await sb
      .from("rede_grupo_membros")
      .update({ saiu_em: agora })
      .eq("grupo_id", data.grupoId)
      .eq("quem_id", eu);
    if (error) return { ok: false as const, motivo: "banco" as const };

    if (meu.grupo.criadora_id === eu) {
      const { error: erroFim } = await sb
        .from("rede_grupos")
        .update({ encerrado_em: agora })
        .eq("id", data.grupoId);
      /* ⚠️ Ela JÁ saiu (a escrita acima passou). Se o encerramento falhar, o
         grupo fica sem criadora e com as outras dentro — o estado que
         `sairDoGrupo` existe para não deixar acontecer. Não dá para desfazer a
         saída sem uma terceira escrita que também pode falhar, então o que fica
         é o registro. */
      if (erroFim) console.warn("[grupo] não encerrou", erroFim.code);
      return { ok: true as const, encerrou: true as const };
    }
    return { ok: true as const, encerrou: false as const };
  });

/** Os grupos de que eu participo, para a lista do direct. */
export const meusGrupos = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: minhas, error } = await sb
      .from("rede_grupo_membros")
      .select("grupo_id, lida_em, silenciado_em, saiu_em")
      .eq("quem_id", eu)
      .is("saiu_em", null)
      .limit(50);
    /* ⚠️ Sem a tabela, a lista simplesmente não tem grupos — nunca um erro na
       tela por causa de um recurso que aquele banco ainda não tem. */
    if (error) return { ok: true as const, grupos: [] as GrupoNaTela[] };

    const ids = ((minhas ?? []) as any[]).map((m) => m.grupo_id as string);
    if (ids.length === 0) return { ok: true as const, grupos: [] as GrupoNaTela[] };

    const { data: gs } = await sb
      .from("rede_grupos")
      .select("id, criadora_id, nome, ultima_em, encerrado_em")
      .in("id", ids)
      .is("encerrado_em", null)
      .order("ultima_em", { ascending: false });

    const vivos = (gs ?? []) as any[];
    if (vivos.length === 0) return { ok: true as const, grupos: [] as GrupoNaTela[] };

    const { data: todosMembros } = await sb
      .from("rede_grupo_membros")
      .select("grupo_id, quem_id, saiu_em")
      .in(
        "grupo_id",
        vivos.map((g) => g.id),
      );
    const ativos = ((todosMembros ?? []) as any[]).filter((m) => !m.saiu_em);

    const { perfisPorId, foraDaRede } = await import("./rede-social.functions");
    const perfis = await perfisPorId(sb, [...new Set(ativos.map((m) => m.quem_id as string))]);
    const meuEstado = new Map(((minhas ?? []) as any[]).map((m) => [m.grupo_id, m]));

    const { nomeDoGrupo } = await import("./grupo-da-conversa");
    const grupos: GrupoNaTela[] = vivos.map((g) => {
      const dele = ativos.filter((m) => m.grupo_id === g.id);
      const membros: MembroDoGrupo[] = dele.map((m) => {
        const p = perfis.get(m.quem_id);
        return {
          id: m.quem_id,
          /* ⚠️ Quem entrou em luto ou pausou vira "Alguém" na lista, e NÃO some:
             tirá-la contaria a perda dela para o grupo inteiro — e o grupo
             continua sendo o mesmo grupo. */
          nome: foraDaRede(p) ? "Alguém" : ((p?.display_name ?? "") as string).trim() || "Alguém",
          avatarUrl: foraDaRede(p) ? null : ((p?.avatar_url ?? null) as string | null),
          souEu: m.quem_id === eu,
          ehCriadora: m.quem_id === g.criadora_id,
        };
      });
      const meu = meuEstado.get(g.id);
      return {
        id: g.id as string,
        nome: nomeDoGrupo(
          g.nome,
          membros.filter((m) => !m.souEu),
        ),
        membros,
        souACriadora: g.criadora_id === eu,
        ultimaEm: g.ultima_em as string,
        naoLida: !meu?.lida_em || Date.parse(meu.lida_em) < Date.parse(g.ultima_em),
        silenciado: !!meu?.silenciado_em,
      };
    });
    return { ok: true as const, grupos };
  });

/**
 * MANDAR NO GRUPO — e a régua clínica é a MESMA do direct.
 *
 * ⚠️ **É por isso que a tabela de mensagens foi reusada.** Uma tabela própria
 * de mensagens de grupo teria de repetir `triarTexto`, e a cópia que divergisse
 * apareceria como "no seu lugar eu não iria ao PS" passando no grupo e sendo
 * recusado no direct — no canal que tem OITO leitoras em vez de uma.
 */
export const mandarNoGrupo = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        grupoId: z.string().uuid(),
        texto: z.string().max(1000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const texto = (data.texto ?? "").trim();
    if (!texto) return { ok: false as const, motivo: "vazia" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* ⚠️ O portão ANTES da régua e antes de qualquer escrita: sem ele, um
       `grupoId` no corpo do pedido escreveria numa conversa de oito pessoas que
       não me conhecem. */
    const meu = await meuGrupo(sb, data.grupoId, eu);
    if (!meu) return { ok: false as const, motivo: "indisponivel" as const };

    /* ⚠️ **A MESMA `triarTexto` do direct e do comentário.** Emergência é
       RECUSADA — quem está sangrando não deve estar esperando resposta de um
       grupo; o resto passa. É a régua estreita de propósito que `enviarMensagem`
       já documenta. */
    const { triarTexto } = await import("./pergunta-clinica");
    const desfecho = triarTexto(texto);
    if (desfecho === "emergencia") {
      return { ok: false as const, motivo: "emergencia" as const };
    }
    /**
     * ⚠️ **O GRUPO AVISAVA MENOS QUE O 1-A-1, e a assimetria estava invertida.**
     *
     * `enviarMensagem` (o direct de duas pessoas) devolve `avisoClinico` quando
     * a triagem reconhece conduta: manda a mensagem — não é papel do app
     * censurar conversa privada — e LEMBRA quem escreveu. Aqui, o mesmo texto
     * chegava a **até oito leitoras** e ninguém era avisado: nem quem escreveu,
     * nem quem lia.
     *
     * Ou seja: o canal com uma leitora avisava, e o canal com sete não. É o
     * cenário dos 5,5% de respostas potencialmente danosas multiplicado por
     * sete — e a frase que abre a decisão de não ter comentários neste app.
     *
     * ⚠️ **Continua NÃO recusando.** Um grupo aqui é criado por uma pessoa, só
     * com gente do grafo dela, com teto de oito e leitura a partir de
     * `entrou_em`: é conversa privada, não publicação. O que muda é que agora
     * ela sabe o que acabou de mandar.
     */
    const avisoClinico = desfecho !== "publicavel" ? ("conduta" as const) : null;

    const agora = new Date().toISOString();
    const { error } = await sb
      .from("rede_mensagens")
      .insert({ grupo_id: data.grupoId, conversa_id: null, autor_id: eu, texto });
    if (error) return { ok: false as const, motivo: "sem_suporte" as const };

    /* ⚠️ Sem `ultima_em`, a lista de grupos ordenaria pela criação e o grupo com
       conversa viva ficaria embaixo do que ninguém abre. Falha aqui não derruba
       a mensagem — ela já existe. */
    const { error: erroOrdem } = await sb
      .from("rede_grupos")
      .update({ ultima_em: agora })
      .eq("id", data.grupoId);
    /* ⚠️ **Silêncio TOTAL é o que a catraca proíbe**, e a resposta aqui é a do
       meio: silêncio para a paciente (a mensagem já foi), registro para quem
       investigar por que um grupo vivo aparece no fim da lista. */
    if (erroOrdem) console.warn("[grupo] ordem não atualizou", erroOrdem.code);

    /* ⚠️ **O GRUPO NÃO AVISAVA NINGUÉM.** A mensagem para até sete pessoas não
       gerava push nenhum, e o emblema da aba Mensagens conta só as conversas de
       DUAS — então as outras membras só descobriam se, por conta própria,
       abrissem a caixa de entrada e reparassem numa bolinha dentro da lista de
       grupos. Um canal onde ninguém responde é um canal que morre.
       O direct de duas já mandava; o de oito, não.

       ⚠️ **E ELE RESPEITA `silenciado_em`, POR MEMBRO.** Este é o mesmo canal
       por onde chega o aviso de emergência: um push de grupo que não se pode
       calar é como uma paciente desliga a notificação do app inteiro, e leva o
       SOS junto. Sem a coluna de silêncio este bloco não deveria existir.

       ⚠️ **Best-effort, e depois da gravação.** Avisar sobre uma mensagem que
       não gravou manda sete pessoas abrirem uma conversa vazia. */
    /* ⚠️ `await`, e NUNCA `void (async () => …)()`: no servidor a invocação
       congela quando a resposta sai, e a promessa que ninguém guarda morre
       antes de rodar — sem erro, sem log. Esta base já perdeu três recursos
       exatamente assim, e a catraca `travas-do-servidor` me pegou escrevendo o
       quarto. Os pushes saem numa rodada só, então o custo é uma latência. */
    await (async () => {
      try {
        const [{ sendPushToUser }, membros] = await Promise.all([
          import("./push.server"),
          sb
            .from("rede_grupo_membros")
            .select("quem_id, silenciado_em")
            .eq("grupo_id", data.grupoId)
            .is("saiu_em", null),
        ]);
        if (membros.error || !membros.data) return;
        const { data: g } = await sb
          .from("rede_grupos")
          .select("nome")
          .eq("id", data.grupoId)
          .maybeSingle();
        /* ⚠️ O texto NÃO vai no push. Ele chega na tela de bloqueio, e quem
           estiver ao lado lê — a mesma decisão do resumo semanal da rede. */
        const titulo = (g as { nome?: string } | null)?.nome?.trim() || "Grupo";
        const alvos = (membros.data as { quem_id: string; silenciado_em: string | null }[])
          .filter((m) => m.quem_id !== eu && !m.silenciado_em)
          .map((m) => m.quem_id);
        await Promise.all(
          alvos.map((quem) =>
            sendPushToUser(quem, {
              title: titulo,
              body: "Nova mensagem no grupo",
              url: "/minha-conta?tab=Comunidade",
            }).catch(() => {}),
          ),
        );
      } catch {
        /* Um aviso que não saiu não pode derrubar a mensagem que já existe. */
      }
    })();

    return { ok: true as const, avisoClinico };
  });

/**
 * AS MENSAGENS DO GRUPO — recortadas por `entrou_em`.
 *
 * ⚠️ **É AQUI que "entrar num grupo" deixa de ser "ler a conversa dos outros".**
 * Sem o recorte, convidar alguém entregaria de uma vez tudo o que foi dito —
 * inclusive por pessoas que não sabiam que ela leria. A régua é pura
 * (`mensagemVisivelNoGrupo`) e o filtro é aplicado na CONSULTA, para o texto
 * anterior nem sair do banco.
 */
export const mensagensDoGrupo = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), grupoId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const meu = await meuGrupo(sb, data.grupoId, eu);
    if (!meu) return { ok: false as const, motivo: "indisponivel" as const };

    /* ⚠️ **`.gte("criada_em", entrou_em)` NA CONSULTA, e não um filtro depois.**
       Filtrar na aplicação traria o texto anterior pela rede — e o que não é
       lido não vaza. */
    const { data: linhas, error } = await sb
      .from("rede_mensagens")
      .select("id, autor_id, texto, criada_em, apagada_em")
      .eq("grupo_id", data.grupoId)
      .gte("criada_em", meu.membro.entrou_em)
      .order("criada_em", { ascending: false })
      .limit(80);
    if (error) return { ok: false as const, motivo: "banco" as const };

    const brutas = ((linhas ?? []) as any[]).reverse();
    const { perfisPorId, foraDaRede } = await import("./rede-social.functions");
    const perfis = await perfisPorId(sb, [...new Set(brutas.map((m) => m.autor_id as string))]);

    /* Abrir marca como lida — a mesma decisão do direct de duas. */
    const { error: erroLida } = await sb
      .from("rede_grupo_membros")
      .update({ lida_em: new Date().toISOString() })
      .eq("grupo_id", data.grupoId)
      .eq("quem_id", eu);
    /* Falha aqui deixa o ponto aceso — incômodo, não perda. Mas ela fica no log:
       um emblema que nunca apaga é uma reclamação que chega sem rastro. */
    if (erroLida) console.warn("[grupo] leitura não marcou", erroLida.code);

    return {
      ok: true as const,
      mensagens: brutas.map((m) => {
        const p = perfis.get(m.autor_id);
        return {
          id: m.id as string,
          souEu: m.autor_id === eu,
          /* ⚠️ O texto da apagada NÃO viaja — mandá-lo com um `apagada: true`
             para a tela esconder deixaria a mensagem dentro da resposta da
             rede. Mesma decisão do direct. */
          texto: m.apagada_em ? null : ((m.texto ?? null) as string | null),
          apagada: !!m.apagada_em,
          criadaEm: m.criada_em as string,
          autorNome: foraDaRede(p)
            ? "Alguém"
            : ((p?.display_name ?? "") as string).trim() || "Alguém",
        };
      }),
    };
  });
