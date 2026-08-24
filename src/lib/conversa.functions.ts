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
  MENSAGENS_POR_PAGINA,
  colunaDoOutro,
  foiLidaPeloOutro,
  fotoEhDeQuemMandou,
  minhaColuna,
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
  /** Já assinada, e só por uma hora. `null` quando a mensagem é só texto. */
  imagemUrl?: string | null;
  /** O que ela anexa, quando nasceu de dentro do app. */
  refTipo?: "post" | "story" | null;
  refId?: string | null;
  /**
   * A outra já leu ESTA mensagem? Ver `foiLidaPeloOutro`.
   *
   * ⚠️ Sempre `false` nas mensagens dela — desenhar ✓✓ do lado de lá seria o
   * app afirmando que EU li, informação que ela não tem como conferir.
   */
  lidaPelaOutra?: boolean;
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
/**
 * A conversa, se ela for MINHA.
 *
 * ⚠️ **Recuo de coluna, e ele é a diferença entre um recurso novo e uma avaria.**
 * Esta função é a porta de TODAS as outras (ler, enviar, silenciar, sair, subir
 * foto). Sem o recuo, um banco sem `silenciada_*`/`saiu_*` faria o `42703`
 * devolver `null` aqui — e o app inteiro responderia "esta conversa não é sua"
 * para as duas donas dela.
 */
async function minhaConversa(sb: any, id: string, eu: string): Promise<any | null> {
  const BASE = "id, a_id, b_id, iniciada_por, aceita, ultima_em, lida_a, lida_b";
  const ler = (colunas: string) =>
    sb.from("rede_conversas").select(colunas).eq("id", id).maybeSingle();

  let { data, error } = await ler(`${BASE}, silenciada_a, silenciada_b, saiu_a, saiu_b`);
  if (error) ({ data, error } = await ler(BASE));
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

    /* ⚠️ Recuo de coluna, como toda leitura desta aba: `saiu_*`/`silenciada_*`
       nascem num `APLICAR_` que o dono roda à mão, e o deploy chega antes. Sem
       ele, a LISTA DE CONVERSAS inteira sumiria — um recurso que já funcionava,
       apagado por colunas que ninguém sabia que existiam. */
    const lerLista = (colunas: string) =>
      sb
        .from("rede_conversas")
        .select(colunas)
        .or(`a_id.eq.${eu},b_id.eq.${eu}`)
        .order("ultima_em", { ascending: false })
        .limit(100);
    const BASE = "id, a_id, b_id, iniciada_por, aceita, ultima_em, lida_a, lida_b";
    let { data: linhas, error } = await lerLista(
      `${BASE}, silenciada_a, silenciada_b, saiu_a, saiu_b`,
    );
    if (error) {
      ({ data: linhas, error } = await lerLista(BASE));
      console.warn("[conversa] sem saiu_*/silenciada_* — rode APLICAR_DIRECT_COMPLETO.sql");
    }
    if (error) return { ok: false as const, motivo: "banco" as const };

    const conversas = ((linhas ?? []) as any[]).filter((c) => {
      /* ⚠️ **QUEM SAIU SÓ VOLTA A VER SE A OUTRA ESCREVER DEPOIS.** Filtrar por
         "saiu" apenas esconderia a conversa para sempre — e o gênero inteiro
         faz o contrário: sair é limpar a lista, não bloquear. Quem quer que a
         pessoa não escreva mais tem o bloqueio, com o nome certo. */
      const saiuEm = c[minhaColuna("saiu", eu, c.a_id)];
      if (!saiuEm) return true;
      return new Date(c.ultima_em).getTime() > new Date(saiuEm).getTime();
    });
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

    /* ⚠️ **RECUO DE COLUNA, como toda leitura desta aba.** `imagem_path`,
       `ref_tipo` e `ref_id` nascem num `APLICAR_` que o dono roda à mão, e o
       deploy chega SEMPRE antes: sem o recuo, o `42703` derrubaria a conversa
       inteira — a paciente abriria um direct que já funcionava e veria uma tela
       vazia, por causa de colunas que ela nem sabe que existem. */
    const buscar = async (colunas: string) => {
      let q = sb
        .from("rede_mensagens")
        .select(colunas)
        .eq("conversa_id", data.conversaId)
        .order("criada_em", { ascending: false })
        .limit(MENSAGENS_POR_PAGINA + 1);
      if (data.antes) q = q.lt("criada_em", data.antes);
      return q;
    };
    let { data: linhas, error } = await buscar(
      "id, autor_id, texto, criada_em, apagada_em, imagem_path, ref_tipo, ref_id",
    );
    let semCorpo = false;
    if (error) {
      ({ data: linhas, error } = await buscar("id, autor_id, texto, criada_em, apagada_em"));
      semCorpo = true;
      console.warn("[conversa] sem imagem_path/ref — rode APLICAR_DIRECT_COMPLETO.sql");
    }
    if (error) return { ok: false as const, motivo: "banco" as const };

    /* ⚠️ **PEDE UMA A MAIS PARA SABER SE HÁ MAIS, e não conta o total.** Um
       `count: exact` numa conversa longa varre a tabela a cada abertura; a
       linha extra responde a mesma pergunta com uma leitura só. Ela é cortada
       antes de virar tela — senão a página mostraria 51 e a próxima repetiria
       uma. */
    const brutas = ((linhas ?? []) as any[]).slice(0, MENSAGENS_POR_PAGINA);
    const temMais = ((linhas ?? []) as any[]).length > MENSAGENS_POR_PAGINA;

    /* ⚠️ **O CARIMBO DE LEITURA DA OUTRA, para o ✓✓.** É a coluna que sempre
       existiu e ninguém lia deste lado: quem escreve "acho que estou sentindo
       contração" e não sabe se a outra viu fica olhando uma tela que não
       responde. */
    const leituraDoOutro = (c as any)[colunaDoOutro("lida", eu, c.a_id)] ?? null;

    /* As fotos viram URL assinada aqui, uma vez por página. */
    const comFoto = brutas.filter((m) => m.imagem_path && !m.apagada_em);
    const assinadas = new Map<string, string>();
    if (comFoto.length) {
      const { data: urls } = await sb.storage.from("conversas").createSignedUrls(
        comFoto.map((m) => m.imagem_path as string),
        60 * 60,
      );
      for (const [i, u] of ((urls ?? []) as any[]).entries()) {
        const caminho = comFoto[i]?.imagem_path;
        if (u?.signedUrl && caminho) assinadas.set(caminho, u.signedUrl);
      }
    }

    const mensagens: MensagemNaTela[] = brutas
      .map((m) => ({
        id: m.id,
        souEu: m.autor_id === eu,
        /* ⚠️ O TEXTO DA APAGADA NÃO VIAJA. Mandá-lo com um `apagada: true` para
           a tela esconder deixaria a mensagem apagada dentro da resposta da
           rede — visível para quem abrisse o inspetor. */
        texto: m.apagada_em ? null : (m.texto ?? null),
        criadaEm: m.criada_em,
        apagada: !!m.apagada_em,
        /* ⚠️ A foto da apagada também não viaja — mesma decisão do texto. */
        imagemUrl: m.apagada_em ? null : (assinadas.get(m.imagem_path) ?? null),
        refTipo: m.apagada_em ? null : ((m.ref_tipo ?? null) as "post" | "story" | null),
        refId: m.apagada_em ? null : ((m.ref_id ?? null) as string | null),
        lidaPelaOutra: foiLidaPeloOutro({
          souEu: m.autor_id === eu,
          criadaEm: m.criada_em,
          leituraDoOutro,
        }),
      }))
      .reverse();

    return {
      ok: true as const,
      mensagens,
      /* O cursor da página seguinte: a mais ANTIGA que veio. */
      antesDe: temMais ? (brutas[brutas.length - 1]?.criada_em ?? null) : null,
      semCorpo,
      pedido: !c.aceita,
      euIniciei: c.iniciada_por === eu,
      comId: (c.a_id === eu ? c.b_id : c.a_id) as string,
      /* ⚠️ Vem do SERVIDOR, e não de um estado da tela: a paciente pode ter
         silenciado no outro aparelho, e um interruptor que nasce desligado
         faria ela silenciar duas vezes e continuar recebendo push. */
      silenciada: !!(c as any)[minhaColuna("silenciada", eu, c.a_id)],
    };
  });

export const enviarMensagem = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        conversaId: z.string().uuid(),
        /* ⚠️ **`min(0)`, e não `min(1)`: a mensagem pode ser SÓ FOTO.** Com o
           mínimo de 1, mandar uma ultrassom sem legenda voltava recusada pelo
           validador — antes de qualquer régua, sem mensagem de erro útil. */
        texto: z.string().max(LIMITE_DA_MENSAGEM).optional(),
        imagemPath: z.string().max(300).optional(),
        refTipo: z.enum(["post", "story"]).optional(),
        refId: z.string().uuid().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const texto = (data.texto ?? "").trim();
    const temCorpo = !!texto || !!data.imagemPath || !!data.refId;
    if (!temCorpo) return { ok: false as const, motivo: "vazia" as const };

    /* ⚠️ **A FOTO TEM DE SER DA PASTA DE QUEM MANDA.** O caminho vem do
       cliente (ele sobe pela URL assinada), então sem esta conferência uma
       paciente aponta para a pasta de outra e a mensagem passa a exibir, dentro
       de uma conversa privada, um arquivo que não é dela. Mesma trava do vídeo
       do post. */
    if (data.imagemPath && !fotoEhDeQuemMandou(data.imagemPath, eu)) {
      return { ok: false as const, motivo: "foto_invalida" as const };
    }
    /* Anexo pela metade não existe: os dois campos andam juntos. */
    if (!!data.refTipo !== !!data.refId) {
      return { ok: false as const, motivo: "anexo_invalido" as const };
    }

    /**
     * ⚠️ **A RÉGUA CLÍNICA RODA AQUI, E ELA NÃO RODAVA.**
     *
     * O comentário passa por `triarTexto`; a caixinha passa; a mensagem direta
     * — que é o canal MAIS íntimo e o mais provável de carregar "no seu lugar
     * eu esperava" — não passava por nada. É exatamente o cenário dos 5,5% de
     * respostas potencialmente danosas: a conversa de duas em que uma
     * tranquiliza a outra sobre um sintoma que precisava de avaliação.
     *
     * ⚠️ **E O DESFECHO AQUI É DIFERENTE DO DO COMENTÁRIO.** Lá a régua
     * RECUSA. Aqui ela só recusa a EMERGÊNCIA — porque uma conversa privada
     * entre duas pessoas que se escolheram não é um comentário público, e
     * bloquear "toma chá de camomila" numa conversa privada seria o app
     * censurando duas adultas. O que ele faz é o que pode fazer sem mentir:
     * manda a mensagem e AVISA quem escreveu.
     */
    let avisoClinico: "conduta" | null = null;
    if (texto) {
      try {
        const { triarTexto } = await import("./pergunta-clinica");
        const desfecho = triarTexto(texto);
        if (desfecho === "emergencia") {
          return { ok: false as const, motivo: "emergencia" as const };
        }
        if (desfecho !== "publicavel") avisoClinico = "conduta";
      } catch {
        /* ⚠️ Falha ao TRIAR não impede a mensagem. A régua é uma proteção
           adicional, não a condição de existir da conversa — derrubar o direct
           inteiro porque um módulo não carregou seria trocar um risco por uma
           avaria certa. */
      }
    }

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

    /* ⚠️ **RECUO POR COLUNA, uma de cada vez.** O banco que ainda não rodou o
       `APLICAR_` recusa `imagem_path`/`ref_tipo` com `PGRST204` — e sem o
       recuo, ENVIAR pararia de funcionar para todo mundo por causa de um
       recurso novo. É a mesma lição de `marcarConsultaNoDia`. */
    const base = { conversa_id: data.conversaId, autor_id: eu, texto };
    let { error } = await sb.from("rede_mensagens").insert({
      ...base,
      imagem_path: data.imagemPath ?? null,
      ref_tipo: data.refTipo ?? null,
      ref_id: data.refId ?? null,
    });
    if (error) {
      /* ⚠️ Sem as colunas, uma mensagem que é SÓ foto viraria uma linha em
         branco — pior que a recusa, porque ela acha que mandou. */
      if (!texto) return { ok: false as const, motivo: "sem_suporte" as const };
      ({ error } = await sb.from("rede_mensagens").insert(base));
    }
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

    /**
     * ⚠️ **A MENSAGEM MANDA PUSH, e é a única coisa desta aba que manda além do
     * pedido para seguir.**
     *
     * A regra do app é explícita e está em `avisoMandaPush`: *push é para o que
     * fica esperando resposta*. Reação não manda, marcação não manda, comentário
     * não manda — nenhum deles prende uma decisão dela. Uma mensagem direta
     * prende: alguém escreveu e está esperando.
     *
     * ⚠️ **E O PEDIDO NÃO MANDA.** Este é o ponto delicado: uma desconhecida
     * poderia acordar a paciente às três da manhã com uma mensagem que ela
     * nunca pediu. O pedido aparece no emblema e espera; só a conversa ACEITA
     * empurra. Sem essa distinção, a trava de uma-mensagem viraria uma trava de
     * um-push, que não é a mesma coisa.
     *
     * ⚠️ **O TEXTO NÃO VAI NA NOTIFICAÇÃO.** Ela aparece na tela bloqueada, e
     * uma conversa entre duas gestantes é o conteúdo mais íntimo desta aba —
     * quem estiver do lado do celular leria. Só o nome de quem escreveu.
     *
     * ⚠️ E vai DEPOIS de tudo ter gravado. Avisar de uma mensagem que não
     * gravou é o defeito que o presente do médico já teve.
     */
    /**
     * ⚠️ **O SILÊNCIO É DO LADO DE QUEM RECEBE, e é ele que decide o push.**
     *
     * Sem esta leitura, "silenciar" seria um interruptor decorativo: a conversa
     * ficaria marcada como silenciada na tela dela e o celular continuaria
     * tocando — que é pior que não ter o botão, porque ela para de procurar
     * outra saída achando que resolveu.
     *
     * ⚠️ E é a coluna DA OUTRA (`colunaDoOutro`), não a minha: quem silenciou a
     * conversa foi quem vai receber o aviso. Com `minhaColuna` aqui, eu
     * silenciaria o celular dela ao silenciar o meu.
     */
    const outroSilenciou = !!(c as any)[colunaDoOutro("silenciada", eu, c.a_id)];

    if (aceitaAgora && !outroSilenciou) {
      try {
        const [{ sendPushToUser }, { data: quem }] = await Promise.all([
          import("./push.server"),
          sb.from("patient_profiles").select("display_name").eq("id", eu).maybeSingle(),
        ]);
        const nome = ((quem?.display_name ?? "") as string).trim() || "Alguém";
        await sendPushToUser(outro, {
          title: nome,
          body: "te mandou uma mensagem",
          url: "/minha-conta?tab=Comunidade",
        });
      } catch {
        /* A mensagem está gravada; o aviso é o acessório. */
      }
    }

    return { ok: true as const, avisoClinico };
  });

/**
 * A URL ASSINADA PARA SUBIR A FOTO.
 *
 * ⚠️ **O CAMINHO É MONTADO NO SERVIDOR, sempre.** Deixar o cliente escolher
 * seria dar a ele a chave de escrever em qualquer pasta do balde — inclusive na
 * de outra paciente. Mesma decisão de `urlParaSubirVideo`.
 *
 * ⚠️ **E A CONVERSA É CONFERIDA ANTES DE EMITIR A URL.** Sem isso, qualquer
 * paciente autenticada pediria espaço no balde privado das conversas sem ter
 * conversa nenhuma — armazenamento de graça pago pelo app, e uma pasta cheia de
 * arquivos que nenhuma mensagem referencia.
 */
export const urlParaSubirFotoDaConversa = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        conversaId: z.string().uuid(),
        extensao: z.enum(["jpg", "png", "webp"]),
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

    /* ⚠️ O nome do arquivo é sorteado no servidor, e a pasta é a de quem manda —
       é o par que faz `fotoEhDeQuemMandou` valer alguma coisa no envio. */
    const caminho = `${eu}/${crypto.randomUUID()}.${data.extensao}`;
    const { data: assinada, error } = await sb.storage
      .from("conversas")
      .createSignedUploadUrl(caminho);
    if (error || !assinada?.signedUrl) return { ok: false as const, motivo: "banco" as const };
    return {
      ok: true as const,
      url: assinada.signedUrl as string,
      token: (assinada.token ?? null) as string | null,
      caminho,
    };
  });

/**
 * SILENCIAR — e só do MEU lado.
 *
 * ⚠️ **A coluna é escolhida por `minhaColuna`, nunca por um `? :` escrito à
 * mão.** Invertida, ela silencia a conversa da OUTRA pessoa: a amiga para de
 * receber aviso sem ter pedido nada, e não há nada na tela dela que explique.
 *
 * ⚠️ **E ninguém é avisado.** É a mesma decisão do silenciar do feed e do
 * bloqueio: anunciar transforma um gesto privado numa briga, e num app onde as
 * pessoas se conhecem da vida real isso piora a situação que a motivou.
 */
export const silenciarConversa = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        conversaId: z.string().uuid(),
        silenciar: z.boolean(),
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

    const coluna = minhaColuna("silenciada", eu, c.a_id);
    const { error } = await sb
      .from("rede_conversas")
      .update({ [coluna]: data.silenciar ? new Date().toISOString() : null })
      .eq("id", data.conversaId);
    if (error) return { ok: false as const, motivo: "sem_suporte" as const };
    return { ok: true as const };
  });

/**
 * SAIR DA CONVERSA — esconder, nunca apagar.
 *
 * ⚠️ **APAGAR AS MENSAGENS APAGARIA AS DELA JUNTO.** O texto que a outra pessoa
 * escreveu, no aparelho dela, sumindo porque eu limpei a minha lista. A linha
 * fica; o que muda é a minha tela.
 *
 * ⚠️ **E A CONVERSA VOLTA SE A OUTRA ESCREVER.** É o comportamento do gênero, e
 * é o certo: "sair" não é bloquear. Quem quer que a pessoa não escreva mais tem
 * o bloqueio, que a tela oferece ao lado — com o nome certo.
 */
export const sairDaConversa = createServerFn({ method: "POST" })
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

    const coluna = minhaColuna("saiu", eu, c.a_id);
    const { error } = await sb
      .from("rede_conversas")
      .update({ [coluna]: new Date().toISOString() })
      .eq("id", data.conversaId);
    if (error) return { ok: false as const, motivo: "sem_suporte" as const };
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

/**
 * "ESTÃO NA MESMA FASE QUE VOCÊ" — a fileira da caixa de entrada.
 *
 * O diferencial pedido pelo dono: *por que elas conversariam aqui e não no
 * Instagram ou no WhatsApp?* No WhatsApp não há como achar alguém que esteja na
 * mesma fase da gestação; no Instagram há uma hashtag e um oceano de
 * desconhecidas. Aqui o app sabe — e é a única coisa que ele sabe e as outras
 * duas redes não têm como saber.
 *
 * ⚠️ **O RECORTE DE PERFIL PÚBLICO ESTÁ NA CONSULTA, antes de tudo** — decisão
 * do dono, e a mesma régua da busca e das sugestões do feed. Filtrar depois de
 * ler é como um perfil vaza; e `podeAparecerNaBusca` é reaproveitada de
 * propósito: quem não pode ser achada não pode ser sugerida, senão a fileira
 * vira a porta dos fundos da busca e o Modo Cuidado volta pela lateral.
 *
 * ⚠️ **A FASE É CALCULADA AQUI E O NÚMERO DA SEMANA NÃO SAI DESTA FUNÇÃO.** Nem
 * no retorno, nem para ordenar. Ver `conversa-sugerida.ts`.
 */
export const conversasSugeridas = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const [{ sugerirConversas }, { faseDe }, { podeAparecerNaBusca }, { contextoDe }] =
      await Promise.all([
        import("./conversa-sugerida"),
        import("./fase-parecida"),
        import("./rede-social"),
        import("./rede-social.functions"),
      ]);

    /* A minha linha, para saber a minha fase. */
    const { data: minha } = await sb
      .from("patient_profiles")
      .select("lmp_date, reference_date, reference_weeks, reference_days, birth_date, care_mode")
      .eq("id", eu)
      .maybeSingle();
    /* ⚠️ Modo Cuidado tira a fileira inteira — quem acabou de perder a gestação
       não recebe do app um convite para conversar com quem está na fase dela. */
    if (!minha || minha.care_mode) return { ok: true as const, sugeridas: [] };

    const faseDaLinha = async (p: any) => {
      const { computeGestation } = await import("@/lib/gestacao");
      const g = computeGestation({
        lmp: p?.lmp_date ?? null,
        referenceDate: p?.reference_date ?? null,
        referenceWeeks: p?.reference_weeks ?? null,
        referenceDays: p?.reference_days ?? null,
        today: hojeEmSaoPauloLocal(),
      });
      /* ⚠️ Os meses do bebê saem da data de nascimento, e não de `g` — sem
         isso `faseDe` devolvia "pos" para a mãe de dois anos e a fileira
         juntaria recém-nascido com criança. Mesma correção do filtro do feed. */
      const meses = p?.birth_date
        ? Math.floor(
            (Date.now() - new Date(`${p.birth_date}T12:00:00Z`).getTime()) / (30.44 * 86400_000),
          )
        : null;
      return faseDe(g?.weeks ?? null, !!p?.birth_date, meses);
    };

    const minhaFase = await faseDaLinha(minha);
    if (!minhaFase) return { ok: true as const, sugeridas: [] };

    /* ⚠️ **`perfil_publico` NA CONSULTA.** E o teto de 200 é de URL e de
       memória, não de gosto: a régua corta para três, e ler a base inteira para
       devolver três seria pagar por uma varredura a cada abertura da caixa. */
    const { data: linhas, error } = await sb
      .from("patient_profiles")
      .select(
        "id, display_name, avatar_url, perfil_publico, care_mode, last_seen_at, " +
          "lmp_date, reference_date, reference_weeks, reference_days, birth_date",
      )
      .eq("perfil_publico", true)
      .neq("id", eu)
      .order("last_seen_at", { ascending: false, nullsFirst: false })
      .limit(200);
    /* ⚠️ Falha de leitura devolve fileira VAZIA, nunca erro: esta é uma
       sugestão dentro da caixa de entrada, e derrubar a lista de conversas
       inteira por causa dela seria trocar um enfeite por uma avaria. */
    if (error) return { ok: true as const, sugeridas: [] };

    const candidatas = [];
    for (const p of (linhas ?? []) as any[]) {
      if (!podeAparecerNaBusca({ publico: !!p.perfil_publico, emCuidado: !!p.care_mode })) continue;
      candidatas.push({
        id: p.id as string,
        nome: ((p.display_name ?? "") as string).trim() || "Alguém",
        avatarUrl: (p.avatar_url ?? null) as string | null,
        fase: await faseDaLinha(p),
        ultimaVez: (p.last_seen_at ?? null) as string | null,
      });
    }

    const ctx = await contextoDe(sb, eu);

    /* Com quem eu JÁ converso — sugerir alguém que está três linhas abaixo, na
       própria tela, faz o app parecer que não sabe o que já aconteceu. */
    const { data: minhasConv } = await sb
      .from("rede_conversas")
      .select("a_id, b_id")
      .or(`a_id.eq.${eu},b_id.eq.${eu}`)
      .limit(200);
    const jaConverso = new Set<string>(
      ((minhasConv ?? []) as any[]).map((c) => (c.a_id === eu ? c.b_id : c.a_id)),
    );

    return {
      ok: true as const,
      sugeridas: sugerirConversas({
        euId: eu,
        minhaFase,
        candidatas,
        bloqueadas: ctx.bloqueio,
        jaConverso,
      }),
    };
  });

/** O "hoje" de São Paulo, como o resto do app. Nunca o do contêiner, que é UTC. */
function hojeEmSaoPauloLocal(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}
